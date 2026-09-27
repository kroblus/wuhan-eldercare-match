package com.wuhan.eldercare.visit.persistence;

import com.wuhan.eldercare.visit.application.CanonicalPayloadHasher;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.application.ServerIdentitySource;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.PersistedVisitCandidateV1;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.SubmissionValidation;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;

/**
 * The only production persistence implementation in C4. It deliberately uses
 * JDBC so the transaction and unique idempotency boundary is visible and does
 * not depend on an ORM's hidden retry behavior.
 */
public final class JdbcVisitSubmissionRepository implements VisitSubmissionRepository {
    private static final Set<String> VISIT_LIFECYCLE_STATUSES =
            Set.of("requested", "contacting", "scheduled", "completed", "cancelled");
    private final DataSource dataSource;
    private final ServerIdentitySource identitySource;
    private final CanonicalPayloadHasher hasher = new CanonicalPayloadHasher();

    public JdbcVisitSubmissionRepository(DataSource dataSource, ServerIdentitySource identitySource) {
        this.dataSource = dataSource;
        this.identitySource = identitySource;
    }

    @Override
    public boolean hasTransactionalAuthorization() {
        return true;
    }

    @Override
    public Result findCommitted(TrustedPrincipal principal, SubmissionCommandV1 command,
                               String authEvidence, AuthEvidenceResolver authEvidenceResolver) {
        if (principal == null || command == null || authEvidenceResolver == null
                || !authEvidenceResolver.supportsTransactionalResolution()) {
            return new Result(Result.Status.TECHNICAL_FAILURE, null);
        }
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            Result authFailure = validateSession(connection, principal, authEvidence, authEvidenceResolver);
            if (authFailure != null) {
                rollbackQuietly(connection);
                return authFailure;
            }
            Optional<IdempotencyRow> prior = selectIdempotency(connection, principal.userId(), command.idempotencyKey());
            if (prior.isEmpty()) {
                connection.commit();
                return new Result(Result.Status.NO_COMMITTED_RECORD, null);
            }
            Result result = resolvePrior(connection, prior.get(), command);
            connection.commit();
            return result;
        } catch (SQLException | RuntimeException failure) {
            return new Result(failure instanceof SQLException sql && isUnavailable(sql)
                    ? Result.Status.UNAVAILABLE : Result.Status.TECHNICAL_FAILURE, null);
        }
    }

    @Override
    public Result createOrReplay(TrustedPrincipal principal, SubmissionCommandV1 command, PrivateContact contact,
                                 String authEvidence, AuthEvidenceResolver authEvidenceResolver,
                                 ReferenceAuthorizer referenceAuthorizer) {
        if (principal == null || command == null || contact == null || authEvidenceResolver == null
                || referenceAuthorizer == null || !authEvidenceResolver.supportsTransactionalResolution()
                || !referenceAuthorizer.supportsTransactionalAuthorization()) {
            return new Result(Result.Status.TECHNICAL_FAILURE, null);
        }
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                Result authFailure = validateSession(connection, principal, authEvidence, authEvidenceResolver);
                if (authFailure != null) {
                    rollbackQuietly(connection);
                    return authFailure;
                }

                Optional<IdempotencyRow> prior = selectIdempotency(connection, principal.userId(), command.idempotencyKey());
                if (prior.isPresent()) {
                    Result replayOrConflict = resolvePrior(connection, prior.get(), command);
                    connection.commit();
                    return replayOrConflict;
                }

                ReferenceAuthorizer.Resolution reference;
                try {
                    reference = referenceAuthorizer.authorize(connection, principal, command.elderId(),
                            command.institutionId(), command.institutionRecordRevision());
                } catch (RuntimeException ignored) {
                    rollbackQuietly(connection);
                    return new Result(Result.Status.TECHNICAL_FAILURE, null);
                }
                if (reference == null || reference.status() == null) {
                    rollbackQuietly(connection);
                    return new Result(Result.Status.TECHNICAL_FAILURE, null);
                }
                if (reference.status() != ReferenceAuthorizer.Authorization.AUTHORIZED) {
                    rollbackQuietly(connection);
                    return mapReferenceFailure(reference.status());
                }
                SubmissionCommandV1 canonicalCommand = command.withElderId(reference.elderId());
                if (!contact.contactName().equals(command.contactName()) || !contact.phone().equals(command.phone())
                        || !SubmissionValidation.PHONE_PURPOSE.equals(command.phonePurpose())) {
                    rollbackQuietly(connection);
                    return new Result(Result.Status.TECHNICAL_FAILURE, null);
                }

                String canonicalHash = hasher.hash(canonicalCommand);
                String visitId = identitySource.newVisitId();
                Instant acceptedAt = identitySource.now();
                insertVisit(connection, visitId, principal, canonicalCommand, contact, acceptedAt);
                insertIdempotency(connection, principal.userId(), command.idempotencyKey(), canonicalHash, visitId, acceptedAt);
                connection.commit();
                return new Result(Result.Status.ACCEPTED,
                        candidate(visitId, principal, canonicalCommand, contact, acceptedAt));
            } catch (SQLException exception) {
                rollbackQuietly(connection);
                // A competing request may have won the durable key. Resolve it in a fresh C5-checked transaction.
                if (isDuplicateKey(exception)) {
                    return findCommitted(principal, command, authEvidence, authEvidenceResolver);
                }
                return new Result(isUnavailable(exception)
                        ? Result.Status.UNAVAILABLE : Result.Status.TECHNICAL_FAILURE, null);
            } catch (RuntimeException exception) {
                rollbackQuietly(connection);
                return new Result(Result.Status.TECHNICAL_FAILURE, null);
            }
        } catch (SQLException exception) {
            return new Result(isUnavailable(exception)
                    ? Result.Status.UNAVAILABLE : Result.Status.TECHNICAL_FAILURE, null);
        }
    }

    private Result validateSession(Connection connection, TrustedPrincipal principal, String authEvidence,
                                   AuthEvidenceResolver authEvidenceResolver) {
        AuthEvidenceResolver.Resolution resolution;
        try {
            resolution = authEvidenceResolver.resolve(connection, authEvidence);
        } catch (RuntimeException ignored) {
            return new Result(Result.Status.TECHNICAL_FAILURE, null);
        }
        if (resolution == null || resolution.status() == null) {
            return new Result(Result.Status.TECHNICAL_FAILURE, null);
        }
        return switch (resolution.status()) {
            case AUTHENTICATED -> resolution.principal() != null
                    && principal.userId().equals(resolution.principal().userId())
                    ? null : new Result(Result.Status.AUTH_REQUIRED, null);
            case MISSING, EXPIRED, INVALID -> new Result(Result.Status.AUTH_REQUIRED, null);
            case UNAVAILABLE -> new Result(Result.Status.AUTH_UNAVAILABLE, null);
            case TECHNICAL_FAILURE -> new Result(Result.Status.TECHNICAL_FAILURE, null);
        };
    }

    private static Result mapReferenceFailure(ReferenceAuthorizer.Authorization authorization) {
        return switch (authorization) {
            case AUTHORIZED -> throw new IllegalArgumentException("authorized is not a failure");
            case UNAUTHORIZED -> new Result(Result.Status.REFERENCE_REJECTED, null);
            case INVALID -> new Result(Result.Status.REFERENCE_INVALID, null);
            case UNAVAILABLE -> new Result(Result.Status.UNAVAILABLE, null);
            case TECHNICAL_FAILURE -> new Result(Result.Status.TECHNICAL_FAILURE, null);
        };
    }

    /**
     * Low-level persistence seam retained for C4 repository-only integration tests.
     * The production VisitSubmissionService always uses the transaction-authorized overload above.
     */
    @Deprecated(forRemoval = false)
    @Override
    public Result createOrReplay(TrustedPrincipal principal, SubmissionCommandV1 command, PrivateContact contact) {
        String canonicalHash = hasher.hash(command);
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                // The durable primary key is the concurrency authority. A
                // plain read avoids InnoDB gap-lock deadlocks when several
                // first attempts arrive for the same owner/key; the unique
                // insert below converges the loser to replay after commit.
                Optional<IdempotencyRow> prior = selectIdempotency(connection, principal.userId(), command.idempotencyKey());
                if (prior.isPresent()) {
                    Result replayOrConflict = resolvePrior(connection, prior.get(), canonicalHash);
                    connection.commit();
                    return replayOrConflict;
                }

                String visitId = identitySource.newVisitId();
                Instant acceptedAt = identitySource.now();
                insertVisit(connection, visitId, principal, command, contact, acceptedAt);
                insertIdempotency(connection, principal.userId(), command.idempotencyKey(), canonicalHash, visitId, acceptedAt);
                connection.commit();
                    return new Result(Result.Status.ACCEPTED,
                        candidate(visitId, principal, command, contact, acceptedAt));
            } catch (SQLException exception) {
                rollbackQuietly(connection);
                if (isDuplicateKey(exception)) {
                    return resolveAfterConcurrentInsert(principal, command, canonicalHash);
                }
                return new Result(isUnavailable(exception)
                        ? Result.Status.UNAVAILABLE
                        : Result.Status.TECHNICAL_FAILURE, null);
            } catch (RuntimeException exception) {
                rollbackQuietly(connection);
                return new Result(Result.Status.TECHNICAL_FAILURE, null);
            }
        } catch (SQLException exception) {
            return new Result(isUnavailable(exception)
                    ? Result.Status.UNAVAILABLE
                    : Result.Status.TECHNICAL_FAILURE, null);
        }
    }

    private Result resolveAfterConcurrentInsert(
            TrustedPrincipal principal,
            SubmissionCommandV1 command,
            String canonicalHash
    ) {
        try (Connection connection = dataSource.getConnection()) {
            Optional<IdempotencyRow> prior = selectIdempotency(connection, principal.userId(), command.idempotencyKey());
            if (prior.isEmpty()) return new Result(Result.Status.TECHNICAL_FAILURE, null);
            return resolvePrior(connection, prior.get(), canonicalHash);
        } catch (SQLException exception) {
            return new Result(isUnavailable(exception)
                    ? Result.Status.UNAVAILABLE
                    : Result.Status.TECHNICAL_FAILURE, null);
        }
    }

    private Result resolvePrior(Connection connection, IdempotencyRow prior, String canonicalHash) throws SQLException {
        if (!prior.canonicalHash().equals(canonicalHash)) {
            return new Result(Result.Status.CONFLICT, null);
        }
        return replayCandidate(connection, prior);
    }

    private Result resolvePrior(Connection connection, IdempotencyRow prior,
                                SubmissionCommandV1 request) throws SQLException {
        Optional<VisitRow> visit = selectVisit(connection, prior.visitId());
        if (visit.isEmpty() || !VISIT_LIFECYCLE_STATUSES.contains(visit.get().status())) {
            return new Result(Result.Status.TECHNICAL_FAILURE, null);
        }
        VisitRow row = visit.get();
        if (request.elderId() != null && !request.elderId().equals(row.elderId())) {
            return new Result(Result.Status.CONFLICT, null);
        }
        String canonicalHash = hasher.hash(request, row.elderId());
        if (!prior.canonicalHash().equals(canonicalHash)) return new Result(Result.Status.CONFLICT, null);
        return replayCandidate(connection, prior);
    }

    private Result replayCandidate(Connection connection, IdempotencyRow prior) throws SQLException {
        Optional<VisitRow> visit = selectVisit(connection, prior.visitId());
        if (visit.isEmpty() || !VISIT_LIFECYCLE_STATUSES.contains(visit.get().status())) {
            return new Result(Result.Status.TECHNICAL_FAILURE, null);
        }
        VisitRow row = visit.get();
        return new Result(Result.Status.REPLAYED, new PersistedVisitCandidateV1(
                row.visitId(), row.userId(), row.elderId(), row.institutionId(), row.institutionRecordRevision(),
                row.visitDate(), row.visitTimePreference(), row.participantCount(), row.pickupRequested(),
                row.contactName(), row.phone(), row.phonePurpose(), "requested", row.acceptedAt(), row.notes()));
    }

    private Optional<IdempotencyRow> selectIdempotency(
            Connection connection,
            String userId,
            String idempotencyKey
    ) throws SQLException {
        String sql = "SELECT canonical_hash, visit_id FROM appointment_idempotency_v1 "
                + "WHERE user_id = ? AND idempotency_key = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, userId);
            statement.setString(2, idempotencyKey);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                return Optional.of(new IdempotencyRow(result.getString(1), result.getString(2)));
            }
        }
    }

    private Optional<VisitRow> selectVisit(Connection connection, String visitId) throws SQLException {
        String sql = "SELECT visit_id, user_id, elder_id, institution_id, institution_record_revision, visit_date, "
                + "visit_time_preference, participant_count, pickup_requested, contact_name, phone, phone_purpose, "
                + "status, accepted_at, notes "
                + "FROM institution_visit_v1 WHERE visit_id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, visitId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                boolean pickup = result.getBoolean("pickup_requested");
                Boolean pickupRequested = result.wasNull() ? null : pickup;
                return Optional.of(new VisitRow(
                        result.getString("visit_id"),
                        result.getString("user_id"),
                        result.getString("elder_id"),
                        result.getString("institution_id"),
                        result.getString("institution_record_revision"),
                        result.getString("visit_date"),
                        result.getString("visit_time_preference"),
                        result.getInt("participant_count"),
                        pickupRequested,
                        result.getString("contact_name"),
                        result.getString("phone"),
                        result.getString("phone_purpose"),
                        result.getString("status"),
                        result.getTimestamp("accepted_at").toInstant(),
                        result.getString("notes")));
            }
        }
    }

    private static void insertVisit(
            Connection connection,
            String visitId,
            TrustedPrincipal principal,
            SubmissionCommandV1 command,
            PrivateContact contact,
            Instant acceptedAt
    ) throws SQLException {
        String sql = "INSERT INTO institution_visit_v1 "
                + "(visit_id, user_id, elder_id, institution_id, institution_record_revision, visit_date, "
                + "visit_time_preference, participant_count, pickup_requested, contact_name, phone, phone_purpose, "
                + "status, accepted_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, visitId);
            statement.setString(2, principal.userId());
            statement.setString(3, command.elderId());
            statement.setString(4, command.institutionId());
            statement.setString(5, command.institutionRecordRevision());
            statement.setString(6, command.visitDate());
            statement.setString(7, command.visitTimePreference());
            statement.setInt(8, command.participantCount());
            if (command.pickupRequested() == null) statement.setNull(9, java.sql.Types.BOOLEAN);
            else statement.setBoolean(9, command.pickupRequested());
            statement.setString(10, contact.contactName());
            statement.setString(11, contact.phone());
            statement.setString(12, command.phonePurpose());
            statement.setTimestamp(13, Timestamp.from(acceptedAt));
            if (command.notes() == null) statement.setNull(14, java.sql.Types.VARCHAR);
            else statement.setString(14, command.notes());
            statement.executeUpdate();
        }
    }

    private static void insertIdempotency(
            Connection connection,
            String userId,
            String idempotencyKey,
            String canonicalHash,
            String visitId,
            Instant acceptedAt
    ) throws SQLException {
        String sql = "INSERT INTO appointment_idempotency_v1 "
                + "(user_id, idempotency_key, canonical_hash, visit_id, accepted_at) VALUES (?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql, Statement.NO_GENERATED_KEYS)) {
            statement.setString(1, userId);
            statement.setString(2, idempotencyKey);
            statement.setString(3, canonicalHash);
            statement.setString(4, visitId);
            statement.setTimestamp(5, Timestamp.from(acceptedAt));
            statement.executeUpdate();
        }
    }

    private static PersistedVisitCandidateV1 candidate(
            String visitId,
            TrustedPrincipal principal,
            SubmissionCommandV1 command,
            PrivateContact contact,
            Instant acceptedAt
    ) {
        return new PersistedVisitCandidateV1(visitId, principal.userId(), command.elderId(), command.institutionId(),
                command.institutionRecordRevision(), command.visitDate(), command.visitTimePreference(),
                command.participantCount(), command.pickupRequested(), contact.contactName(), contact.phone(),
                command.phonePurpose(), "requested", acceptedAt, command.notes());
    }

    private static boolean isDuplicateKey(SQLException exception) {
        SQLException current = exception;
        while (current != null) {
            if ("23000".equals(current.getSQLState()) || current.getErrorCode() == 1062) return true;
            current = current.getNextException();
        }
        return false;
    }

    private static boolean isUnavailable(SQLException exception) {
        String state = exception.getSQLState();
        return state != null && (state.startsWith("08") || "40001".equals(state));
    }

    private static void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // The original stable result remains the only observable error.
        }
    }

    private record IdempotencyRow(String canonicalHash, String visitId) {
    }

    private record VisitRow(
            String visitId,
            String userId,
            String elderId,
            String institutionId,
            String institutionRecordRevision,
            String visitDate,
            String visitTimePreference,
            int participantCount,
            Boolean pickupRequested,
            String contactName,
            String phone,
            String phonePurpose,
            String status,
            Instant acceptedAt,
            String notes
    ) {
    }
}
