package com.wuhan.eldercare.visit.lifecycle;

import com.wuhan.eldercare.visit.operations.TrustedOperationsPrincipal;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/** MySQL persistence; authorization, Visit state, transition, and audit share one transaction. */
public final class JdbcVisitLifecycleMutationRepository implements VisitLifecycleMutationRepository {
    private final DataSource dataSource;
    private final VisitLifecycleTransitionEvaluatorV1 transitionEvaluator;

    public JdbcVisitLifecycleMutationRepository(DataSource dataSource,
                                               VisitLifecycleTransitionEvaluatorV1 transitionEvaluator) {
        if (dataSource == null || transitionEvaluator == null) {
            throw new IllegalArgumentException("lifecycle persistence dependencies required");
        }
        this.dataSource = dataSource;
        this.transitionEvaluator = transitionEvaluator;
    }

    @Override
    public Result mutate(TrustedOperationsPrincipal principal, String visitId,
                         VisitLifecycleMutationCommandV1 command, Instant recordedAt) {
        if (principal == null || blank(visitId) || command == null || recordedAt == null) {
            return Result.of(Result.Status.TECHNICAL_FAILURE);
        }
        // V7 timestamps are TIMESTAMP(6); first-write receipts must match persisted replay receipts.
        recordedAt = recordedAt.truncatedTo(ChronoUnit.MICROS);
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                if (!lockActivePrincipal(connection, principal.operationsPrincipalId(),
                        principal.credentialDigestForTransaction())) {
                    connection.rollback();
                    return Result.of(Result.Status.AUTH_REQUIRED);
                }
                if (!lockActiveGrant(connection, principal.operationsPrincipalId(), visitId)) {
                    connection.rollback();
                    return Result.of(Result.Status.NOT_FOUND);
                }

                Optional<VisitRow> lockedVisit = lockVisit(connection, visitId);
                if (lockedVisit.isEmpty()) {
                    connection.rollback();
                    return Result.of(Result.Status.NOT_FOUND);
                }
                VisitRow visit = lockedVisit.get();

                Optional<AuditRow> prior = findOperation(connection, principal.operationsPrincipalId(), command.operationId());
                if (prior.isPresent()) {
                    connection.commit();
                    return resolvePrior(prior.get(), visitId, command);
                }

                if (!isValidVisit(visit)) {
                    connection.rollback();
                    return Result.of(Result.Status.TECHNICAL_FAILURE);
                }
                if (!command.expectedStatus().equals(visit.status())) {
                    Result conflict = recordOutcome(connection, principal.operationsPrincipalId(), visitId,
                            command, visit, "CONFLICT", recordedAt);
                    connection.commit();
                    return conflict;
                }

                VisitLifecycleTransitionEvaluatorV1.Evaluation transition =
                        transitionEvaluator.evaluate(visit.status(), command.targetStatus());
                if (transition.kind() == VisitLifecycleTransitionEvaluatorV1.Kind.INVALID_STATUS) {
                    connection.rollback();
                    return Result.of(Result.Status.TECHNICAL_FAILURE);
                }
                if (transition.kind() == VisitLifecycleTransitionEvaluatorV1.Kind.ILLEGAL_TRANSITION) {
                    Result rejected = recordOutcome(connection, principal.operationsPrincipalId(), visitId,
                            command, visit, "ILLEGAL_TRANSITION", recordedAt);
                    connection.commit();
                    return rejected;
                }
                if (transition.kind() == VisitLifecycleTransitionEvaluatorV1.Kind.NO_OP) {
                    Result noOp = recordOutcome(connection, principal.operationsPrincipalId(), visitId,
                            command, visit, "NO_OP", recordedAt);
                    connection.commit();
                    return noOp;
                }
                if (!hasSufficientEvidence(command, recordedAt)) {
                    Result rejected = recordOutcome(connection, principal.operationsPrincipalId(), visitId,
                            command, visit, "EVIDENCE_INSUFFICIENT", recordedAt);
                    connection.commit();
                    return rejected;
                }

                Instant scheduledAt = "scheduled".equals(command.targetStatus())
                        ? command.evidence().factAt() : visit.scheduledAt();
                Instant completedAt = "completed".equals(command.targetStatus())
                        ? command.evidence().factAt() : visit.completedAt();
                int updated = updateVisit(connection, visit, command.targetStatus(), scheduledAt, completedAt);
                if (updated != 1) {
                    connection.rollback();
                    return Result.of(Result.Status.CONFLICT);
                }
                insertAudit(connection, principal.operationsPrincipalId(), visitId, command,
                        visit.status(), "ACCEPTED", command.targetStatus(), scheduledAt, completedAt, recordedAt);
                connection.commit();
                return Result.withReceipt(Result.Status.ACCEPTED,
                        receipt(command, visitId, command.targetStatus(), scheduledAt, completedAt, recordedAt));
            } catch (SQLException failure) {
                rollbackQuietly(connection);
                if (isUniqueConflict(failure)) {
                    return resolveAfterUniqueConflict(principal, visitId, command);
                }
                return Result.of(isUnavailable(failure) ? Result.Status.UNAVAILABLE : Result.Status.TECHNICAL_FAILURE);
            } catch (RuntimeException failure) {
                rollbackQuietly(connection);
                return Result.of(Result.Status.TECHNICAL_FAILURE);
            }
        } catch (SQLException failure) {
            return Result.of(isUnavailable(failure) ? Result.Status.UNAVAILABLE : Result.Status.TECHNICAL_FAILURE);
        }
    }

    private Result resolveAfterUniqueConflict(TrustedOperationsPrincipal principal, String visitId,
                                              VisitLifecycleMutationCommandV1 command) {
        String principalId = principal.operationsPrincipalId();
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            if (!lockActivePrincipal(connection, principalId, principal.credentialDigestForTransaction())) {
                connection.rollback();
                return Result.of(Result.Status.AUTH_REQUIRED);
            }
            if (!lockActiveGrant(connection, principalId, visitId)) {
                connection.rollback();
                return Result.of(Result.Status.NOT_FOUND);
            }
            Optional<VisitRow> visit = lockVisit(connection, visitId);
            if (visit.isEmpty()) {
                connection.rollback();
                return Result.of(Result.Status.NOT_FOUND);
            }
            Optional<AuditRow> existing = findOperation(connection, principalId, command.operationId());
            connection.commit();
            return existing.map(row -> resolvePrior(row, visitId, command))
                    .orElseGet(() -> Result.of(Result.Status.TECHNICAL_FAILURE));
        } catch (SQLException | RuntimeException ignored) {
            return Result.of(Result.Status.TECHNICAL_FAILURE);
        }
    }

    private static Result resolvePrior(AuditRow prior, String visitId, VisitLifecycleMutationCommandV1 command) {
        if (!prior.visitId().equals(visitId) || !prior.requestFingerprint().equals(command.requestFingerprint())) {
            return Result.of(Result.Status.IDEMPOTENCY_CONFLICT);
        }
        return switch (prior.outcome()) {
            case "ACCEPTED" -> Result.withReceipt(Result.Status.REPLAYED,
                    receipt(command, prior.visitId(), prior.resultStatus(), prior.scheduledAt(),
                            prior.completedAt(), prior.recordedAt()));
            case "NO_OP" -> Result.withReceipt(Result.Status.NO_OP,
                    receipt(command, prior.visitId(), prior.resultStatus(), prior.scheduledAt(),
                            prior.completedAt(), prior.recordedAt()));
            case "ILLEGAL_TRANSITION" -> Result.of(Result.Status.ILLEGAL_TRANSITION);
            case "EVIDENCE_INSUFFICIENT" -> Result.of(Result.Status.EVIDENCE_INSUFFICIENT);
            case "CONFLICT" -> Result.of(Result.Status.CONFLICT);
            default -> Result.of(Result.Status.TECHNICAL_FAILURE);
        };
    }

    private static Result recordOutcome(Connection connection, String principalId, String visitId,
                                        VisitLifecycleMutationCommandV1 command, VisitRow visit,
                                        String outcome, Instant recordedAt) throws SQLException {
        String resultStatus = "NO_OP".equals(outcome) ? visit.status() : null;
        insertAudit(connection, principalId, visitId, command, visit.status(), outcome,
                resultStatus, "NO_OP".equals(outcome) ? visit.scheduledAt() : null,
                "NO_OP".equals(outcome) ? visit.completedAt() : null, recordedAt);
        Result.Status status = switch (outcome) {
            case "NO_OP" -> Result.Status.NO_OP;
            case "ILLEGAL_TRANSITION" -> Result.Status.ILLEGAL_TRANSITION;
            case "EVIDENCE_INSUFFICIENT" -> Result.Status.EVIDENCE_INSUFFICIENT;
            case "CONFLICT" -> Result.Status.CONFLICT;
            default -> Result.Status.TECHNICAL_FAILURE;
        };
        if (status == Result.Status.NO_OP) {
            return Result.withReceipt(status, receipt(command, visitId, visit.status(), visit.scheduledAt(),
                    visit.completedAt(), recordedAt));
        }
        return Result.of(status);
    }

    private static boolean hasSufficientEvidence(VisitLifecycleMutationCommandV1 command, Instant recordedAt) {
        if (!command.evidenceMatchesTarget()) return false;
        Instant factAt = command.evidence().factAt();
        // scheduled factAt is the appointment time on the confirmed plan and may be in the future.
        // Every other factAt is an already occurred operational fact and cannot be future-dated.
        return "scheduled".equals(command.targetStatus()) || factAt == null || !factAt.isAfter(recordedAt);
    }

    private static boolean lockActivePrincipal(Connection connection, String principalId,
                                               String credentialDigest) throws SQLException {
        if (blank(credentialDigest)) return false;
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT p.principal_state, c.credential_state FROM operations_principal_v1 p "
                        + "JOIN operations_credential_v1 c ON c.operations_principal_id = p.operations_principal_id "
                        + "WHERE p.operations_principal_id = ? AND c.credential_digest = ? FOR UPDATE")) {
            statement.setString(1, principalId);
            statement.setString(2, credentialDigest);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() && "ACTIVE".equals(result.getString("principal_state"))
                        && "ACTIVE".equals(result.getString("credential_state"));
            }
        }
    }

    private static boolean lockActiveGrant(Connection connection, String principalId, String visitId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT grant_state FROM operations_visit_grant_v1 "
                        + "WHERE operations_principal_id = ? AND visit_id = ? FOR UPDATE")) {
            statement.setString(1, principalId);
            statement.setString(2, visitId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() && "ACTIVE".equals(result.getString("grant_state"));
            }
        }
    }

    private static Optional<VisitRow> lockVisit(Connection connection, String visitId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT visit_id, status, scheduled_at, completed_at, lifecycle_version "
                        + "FROM institution_visit_v1 WHERE visit_id = ? FOR UPDATE")) {
            statement.setString(1, visitId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                return Optional.of(new VisitRow(result.getString("visit_id"), result.getString("status"),
                        instant(result, "scheduled_at"), instant(result, "completed_at"),
                        result.getLong("lifecycle_version")));
            }
        }
    }

    private static Optional<AuditRow> findOperation(Connection connection, String principalId,
                                                    String operationId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT request_fingerprint, visit_id, target_status, outcome, result_status, "
                        + "result_scheduled_at, result_completed_at, recorded_at "
                        + "FROM institution_visit_lifecycle_audit_v1 "
                        + "WHERE operations_principal_id = ? AND operation_id = ? FOR UPDATE")) {
            statement.setString(1, principalId);
            statement.setString(2, operationId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                return Optional.of(new AuditRow(result.getString("request_fingerprint"), result.getString("visit_id"),
                        result.getString("target_status"), result.getString("outcome"), result.getString("result_status"),
                        instant(result, "result_scheduled_at"), instant(result, "result_completed_at"),
                        instant(result, "recorded_at")));
            }
        }
    }

    private static int updateVisit(Connection connection, VisitRow visit, String targetStatus,
                                   Instant scheduledAt, Instant completedAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE institution_visit_v1 SET status = ?, scheduled_at = ?, completed_at = ?, "
                        + "lifecycle_version = lifecycle_version + 1 "
                        + "WHERE visit_id = ? AND status = ? AND lifecycle_version = ?")) {
            statement.setString(1, targetStatus);
            timestamp(statement, 2, scheduledAt);
            timestamp(statement, 3, completedAt);
            statement.setString(4, visit.visitId());
            statement.setString(5, visit.status());
            statement.setLong(6, visit.version());
            return statement.executeUpdate();
        }
    }

    private static void insertAudit(Connection connection, String principalId, String visitId,
                                    VisitLifecycleMutationCommandV1 command, String previousStatus,
                                    String outcome, String resultStatus, Instant resultScheduledAt,
                                    Instant resultCompletedAt, Instant recordedAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO institution_visit_lifecycle_audit_v1 "
                        + "(operations_principal_id, operation_id, request_fingerprint, visit_id, expected_status, "
                        + "target_status, previous_status, outcome, evidence_kind, evidence_reference, fact_at, "
                        + "result_status, result_scheduled_at, result_completed_at, recorded_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            statement.setString(1, principalId);
            statement.setString(2, command.operationId());
            statement.setString(3, command.requestFingerprint());
            statement.setString(4, visitId);
            statement.setString(5, command.expectedStatus());
            statement.setString(6, command.targetStatus());
            statement.setString(7, previousStatus);
            statement.setString(8, outcome);
            statement.setString(9, command.evidence() == null ? null : command.evidence().kind().wireValue());
            statement.setString(10, command.evidence() == null ? null : command.evidence().reference());
            timestamp(statement, 11, command.evidence() == null ? null : command.evidence().factAt());
            statement.setString(12, resultStatus);
            timestamp(statement, 13, resultScheduledAt);
            timestamp(statement, 14, resultCompletedAt);
            statement.setTimestamp(15, Timestamp.from(recordedAt));
            statement.executeUpdate();
        }
    }

    private static Receipt receipt(VisitLifecycleMutationCommandV1 command, String visitId, String status,
                                   Instant scheduledAt, Instant completedAt, Instant recordedAt) {
        return new Receipt(command.operationId(), visitId, status, scheduledAt, completedAt, recordedAt);
    }

    private static boolean isValidVisit(VisitRow visit) {
        return visit != null && !blank(visit.visitId()) && !blank(visit.status())
                && new VisitLifecycleTransitionEvaluatorV1().evaluate(visit.status(), visit.status()).kind()
                == VisitLifecycleTransitionEvaluatorV1.Kind.NO_OP;
    }

    private static Instant instant(ResultSet result, String column) throws SQLException {
        Timestamp value = result.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static void timestamp(PreparedStatement statement, int index, Instant value) throws SQLException {
        if (value == null) statement.setNull(index, java.sql.Types.TIMESTAMP);
        else statement.setTimestamp(index, Timestamp.from(value));
    }

    private static boolean isUniqueConflict(SQLException exception) {
        SQLException current = exception;
        while (current != null) {
            if ("23000".equals(current.getSQLState()) || current.getErrorCode() == 1062) return true;
            current = current.getNextException();
        }
        return false;
    }

    private static boolean isUnavailable(SQLException exception) {
        SQLException current = exception;
        while (current != null) {
            String state = current.getSQLState();
            if (state != null && (state.startsWith("08") || "40001".equals(state))) return true;
            current = current.getNextException();
        }
        return false;
    }

    private static void rollbackQuietly(Connection connection) {
        try { connection.rollback(); } catch (SQLException ignored) { /* Keep provider detail inside the persistence boundary. */ }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }

    private record VisitRow(String visitId, String status, Instant scheduledAt, Instant completedAt, long version) { }
    private record AuditRow(String requestFingerprint, String visitId, String targetStatus, String outcome,
                            String resultStatus,
                            Instant scheduledAt, Instant completedAt, Instant recordedAt) { }
}
