package com.wuhan.eldercare.visit.persistence;

import com.wuhan.eldercare.visit.application.CanonicalPayloadHasher;
import com.wuhan.eldercare.visit.application.ServerIdentitySource;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.PersistedVisitCandidateV1;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
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

/**
 * The only production persistence implementation in C4. It deliberately uses
 * JDBC so the transaction and unique idempotency boundary is visible and does
 * not depend on an ORM's hidden retry behavior.
 */
public final class JdbcVisitSubmissionRepository implements VisitSubmissionRepository {
    private final DataSource dataSource;
    private final ServerIdentitySource identitySource;
    private final CanonicalPayloadHasher hasher = new CanonicalPayloadHasher();

    public JdbcVisitSubmissionRepository(DataSource dataSource, ServerIdentitySource identitySource) {
        this.dataSource = dataSource;
        this.identitySource = identitySource;
    }

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
        Optional<VisitRow> visit = selectVisit(connection, prior.visitId());
        if (visit.isEmpty() || !"requested".equals(visit.get().status())) {
            return new Result(Result.Status.TECHNICAL_FAILURE, null);
        }
        VisitRow row = visit.get();
        return new Result(Result.Status.REPLAYED, new PersistedVisitCandidateV1(
                row.visitId(), row.userId(), row.elderId(), row.institutionId(), row.institutionRecordRevision(),
                row.visitDate(), row.visitTimePreference(), row.participantCount(), row.pickupRequested(),
                row.contactName(), row.phone(), row.phonePurpose(), row.status(), row.acceptedAt(), row.notes()));
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
