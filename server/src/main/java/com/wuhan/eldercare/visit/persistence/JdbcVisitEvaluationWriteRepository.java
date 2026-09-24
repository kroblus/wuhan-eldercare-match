package com.wuhan.eldercare.visit.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.VisitEvaluationContentNormalizer;
import com.wuhan.eldercare.visit.application.VisitEvaluationWriteRepository;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteContentV1;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

/** JDBC persistence boundary; the locked Visit row serializes all submissions for that resource. */
public final class JdbcVisitEvaluationWriteRepository implements VisitEvaluationWriteRepository {
    private static final String FIND_OWNED_VISIT_SQL = "SELECT visit_id, institution_id, institution_record_revision, status "
            + "FROM institution_visit_v1 WHERE visit_id = ? AND user_id = ? FOR UPDATE";
    private static final String FIND_EVALUATION_SQL = "SELECT evaluation_id, visit_id, idempotency_key_hash, "
            + "content_fingerprint, submitted_at FROM visit_evaluation_v1 WHERE visit_id = ? FOR UPDATE";
    private static final String INSERT_EVALUATION_SQL = "INSERT INTO visit_evaluation_v1 "
            + "(evaluation_id, visit_id, user_id, institution_id, institution_record_revision, overall_rating, "
            + "consideration, content_json, idempotency_key_hash, content_fingerprint, submitted_at) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    private final DataSource dataSource;
    private final VisitEvaluationContentNormalizer normalizer;

    public JdbcVisitEvaluationWriteRepository(DataSource dataSource, ObjectMapper objectMapper) {
        if (dataSource == null || objectMapper == null) throw new IllegalArgumentException("persistence dependencies required");
        this.dataSource = dataSource;
        this.normalizer = new VisitEvaluationContentNormalizer(objectMapper);
    }

    @Override
    public Result createOrResolve(TrustedPrincipal principal, String visitId, String idempotencyKeyDigest,
                                 String contentFingerprint, VisitEvaluationWriteContentV1 content,
                                 String evaluationId, Instant submittedAt) {
        if (principal == null || blank(visitId) || blank(idempotencyKeyDigest) || blank(contentFingerprint)
                || content == null || blank(evaluationId) || submittedAt == null) {
            return Result.of(Result.Status.TECHNICAL_FAILURE);
        }
        final String contentJson;
        try {
            contentJson = new String(normalizer.toJson(content), java.nio.charset.StandardCharsets.UTF_8);
        } catch (RuntimeException ignored) {
            return Result.of(Result.Status.TECHNICAL_FAILURE);
        }

        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                Optional<OwnedVisit> owned = findOwnedVisitForUpdate(connection, principal.userId(), visitId);
                if (owned.isEmpty()) {
                    connection.commit();
                    return Result.of(Result.Status.NOT_FOUND);
                }

                Optional<EvaluationRow> existing = findEvaluationForUpdate(connection, visitId);
                if (existing.isPresent()) {
                    Result resolved = resolveExisting(existing.get(), idempotencyKeyDigest, contentFingerprint);
                    connection.commit();
                    return resolved;
                }

                OwnedVisit visit = owned.get();
                if (!isValidVisit(visit)) {
                    connection.commit();
                    return Result.of(Result.Status.TECHNICAL_FAILURE);
                }
                if (!"completed".equals(visit.status())) {
                    connection.commit();
                    return Result.of(Result.Status.NOT_COMPLETED);
                }

        insertEvaluation(connection, principal.userId(), visit, content, contentJson, idempotencyKeyDigest,
                        contentFingerprint, evaluationId, submittedAt);
                connection.commit();
                return Result.accepted(receipt(evaluationId, visit.visitId(), submittedAt));
            } catch (SQLException failure) {
                rollbackQuietly(connection);
                if (isDuplicateKey(failure)) {
                    return resolveAfterConstraint(principal, visitId, idempotencyKeyDigest, contentFingerprint);
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

    private Result resolveAfterConstraint(TrustedPrincipal principal, String visitId,
                                          String idempotencyKeyDigest, String contentFingerprint) {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            Optional<OwnedVisit> owned = findOwnedVisitForUpdate(connection, principal.userId(), visitId);
            if (owned.isEmpty()) {
                connection.commit();
                return Result.of(Result.Status.NOT_FOUND);
            }
            Optional<EvaluationRow> existing = findEvaluationForUpdate(connection, visitId);
            connection.commit();
            return existing.isEmpty()
                    ? Result.of(Result.Status.TECHNICAL_FAILURE)
                    : resolveExisting(existing.get(), idempotencyKeyDigest, contentFingerprint);
        } catch (SQLException failure) {
            return Result.of(isUnavailable(failure) ? Result.Status.UNAVAILABLE : Result.Status.TECHNICAL_FAILURE);
        } catch (RuntimeException ignored) {
            return Result.of(Result.Status.TECHNICAL_FAILURE);
        }
    }

    private static Result resolveExisting(EvaluationRow existing, String keyDigest, String contentFingerprint) {
        if (existing.idempotencyKeyHash().equals(keyDigest)) {
            if (!existing.contentFingerprint().equals(contentFingerprint)) {
                return Result.of(Result.Status.IDEMPOTENCY_CONFLICT);
            }
            if (existing.submittedAt() == null || blank(existing.evaluationId()) || blank(existing.visitId())) {
                return Result.of(Result.Status.TECHNICAL_FAILURE);
            }
            return Result.replayed(receipt(existing.evaluationId(), existing.visitId(), existing.submittedAt()));
        }
        return Result.of(Result.Status.ALREADY_SUBMITTED);
    }

    private static Optional<OwnedVisit> findOwnedVisitForUpdate(Connection connection, String userId, String visitId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(FIND_OWNED_VISIT_SQL)) {
            statement.setString(1, visitId);
            statement.setString(2, userId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                return Optional.of(new OwnedVisit(result.getString("visit_id"),
                        result.getString("institution_id"), result.getString("institution_record_revision"),
                        result.getString("status")));
            }
        }
    }

    private static Optional<EvaluationRow> findEvaluationForUpdate(Connection connection, String visitId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(FIND_EVALUATION_SQL)) {
            statement.setString(1, visitId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                Timestamp submittedAt = result.getTimestamp("submitted_at");
                return Optional.of(new EvaluationRow(result.getString("evaluation_id"), result.getString("visit_id"),
                        result.getString("idempotency_key_hash"), result.getString("content_fingerprint"),
                        submittedAt == null ? null : submittedAt.toInstant()));
            }
        }
    }

    private static void insertEvaluation(Connection connection, String userId, OwnedVisit visit,
                                         VisitEvaluationWriteContentV1 content, String contentJson,
                                         String keyDigest, String contentFingerprint, String evaluationId,
                                         Instant submittedAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_EVALUATION_SQL)) {
            statement.setString(1, evaluationId);
            statement.setString(2, visit.visitId());
            statement.setString(3, userId);
            statement.setString(4, visit.institutionId());
            statement.setString(5, visit.institutionRecordRevision());
            statement.setInt(6, content.overallRating());
            statement.setString(7, content.consideration());
            statement.setString(8, contentJson);
            statement.setString(9, keyDigest);
            statement.setString(10, contentFingerprint);
            statement.setTimestamp(11, Timestamp.from(submittedAt));
            statement.executeUpdate();
        }
    }

    private static boolean isValidVisit(OwnedVisit visit) {
        return visit != null && !blank(visit.visitId()) && !blank(visit.institutionId())
                && !blank(visit.institutionRecordRevision())
                && SetHolder.VISIT_STATUSES.contains(visit.status());
    }

    private static VisitEvaluationWriteRepository.Receipt receipt(String evaluationId, String visitId, Instant submittedAt) {
        return new VisitEvaluationWriteRepository.Receipt(evaluationId, visitId, "submitted", submittedAt);
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
        SQLException current = exception;
        while (current != null) {
            String state = current.getSQLState();
            if (state != null && (state.startsWith("08") || "40001".equals(state))) return true;
            current = current.getNextException();
        }
        return false;
    }

    private static void rollbackQuietly(Connection connection) {
        try { connection.rollback(); } catch (SQLException ignored) { /* Do not project raw DB failure. */ }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }

    private record OwnedVisit(String visitId, String institutionId, String institutionRecordRevision, String status) { }
    private record EvaluationRow(String evaluationId, String visitId, String idempotencyKeyHash,
                                 String contentFingerprint, Instant submittedAt) { }
    private static final class SetHolder {
        private static final java.util.Set<String> VISIT_STATUSES = java.util.Set.of(
                "requested", "contacting", "scheduled", "completed", "cancelled");
    }
}
