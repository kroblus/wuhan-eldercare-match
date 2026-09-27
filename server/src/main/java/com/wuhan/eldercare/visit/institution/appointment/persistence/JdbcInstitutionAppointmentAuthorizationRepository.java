package com.wuhan.eldercare.visit.institution.appointment.persistence;

import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationRepository;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Calendar;
import java.util.TimeZone;

/** Append-only operational authorization source keyed by an exact immutable Institution revision. */
public final class JdbcInstitutionAppointmentAuthorizationRepository
        implements InstitutionAppointmentAuthorizationRepository {
    private static final String LATEST_SQL = "SELECT authorization_state FROM institution_appointment_authorization_event_v1 "
            + "WHERE institution_id = ? AND record_revision = ? ORDER BY authorization_sequence DESC LIMIT 1";
    private static final String LATEST_FOR_UPDATE_SQL = LATEST_SQL + " FOR UPDATE";
    private static final String LOCK_REVISION_SQL = "SELECT record_revision FROM institution_record_revision_v1 "
            + "WHERE institution_id = ? AND record_revision = ? FOR UPDATE";
    private static final String INSERT_SQL = "INSERT INTO institution_appointment_authorization_event_v1 "
            + "(operation_id, institution_id, record_revision, authorization_state, provenance_reference, "
            + "operator_reference, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
    private static final String FIND_OPERATION_SQL = "SELECT institution_id, record_revision, authorization_state, "
            + "provenance_reference, operator_reference FROM institution_appointment_authorization_event_v1 "
            + "WHERE operation_id = ?";

    private final DataSource dataSource;

    public JdbcInstitutionAppointmentAuthorizationRepository(DataSource dataSource) {
        if (dataSource == null) throw new IllegalArgumentException("authorization DataSource required");
        this.dataSource = dataSource;
    }

    @Override
    public Lookup latest(String institutionId, long recordRevision) {
        if (institutionId == null || institutionId.isBlank() || recordRevision < 1) {
            return Lookup.of(Lookup.Status.NOT_CONFIGURED);
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(LATEST_SQL)) {
            statement.setString(1, institutionId);
            statement.setLong(2, recordRevision);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Lookup.of(Lookup.Status.NOT_CONFIGURED);
                return switch (result.getString("authorization_state")) {
                    case "AUTHORIZED" -> Lookup.of(Lookup.Status.AUTHORIZED);
                    case "REVOKED" -> Lookup.of(Lookup.Status.REVOKED);
                    default -> Lookup.of(Lookup.Status.TECHNICAL_FAILURE);
                };
            }
        } catch (SQLException | RuntimeException failure) {
            return Lookup.of(isUnavailable(failure) ? Lookup.Status.UNAVAILABLE : Lookup.Status.TECHNICAL_FAILURE);
        }
    }

    @Override
    public Lookup latest(Connection connection, String institutionId, long recordRevision) {
        if (connection == null || institutionId == null || institutionId.isBlank() || recordRevision < 1) {
            return Lookup.of(Lookup.Status.NOT_CONFIGURED);
        }
        try (PreparedStatement lock = connection.prepareStatement(LOCK_REVISION_SQL)) {
            lock.setString(1, institutionId);
            lock.setLong(2, recordRevision);
            try (ResultSet revision = lock.executeQuery()) {
                if (!revision.next()) return Lookup.of(Lookup.Status.NOT_CONFIGURED);
            }
            try (PreparedStatement statement = connection.prepareStatement(LATEST_FOR_UPDATE_SQL)) {
                statement.setString(1, institutionId);
                statement.setLong(2, recordRevision);
                try (ResultSet result = statement.executeQuery()) {
                    if (!result.next()) return Lookup.of(Lookup.Status.NOT_CONFIGURED);
                    return switch (result.getString("authorization_state")) {
                        case "AUTHORIZED" -> Lookup.of(Lookup.Status.AUTHORIZED);
                        case "REVOKED" -> Lookup.of(Lookup.Status.REVOKED);
                        default -> Lookup.of(Lookup.Status.TECHNICAL_FAILURE);
                    };
                }
            }
        } catch (SQLException | RuntimeException failure) {
            return Lookup.of(isUnavailable(failure) ? Lookup.Status.UNAVAILABLE : Lookup.Status.TECHNICAL_FAILURE);
        }
    }

    @Override
    public boolean supportsTransactionScopedLookup() { return true; }

    @Override
    public Apply append(Event event) {
        if (event == null) return Apply.of(Apply.Status.INVALID);
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                if (!lockExactRevision(connection, event)) {
                    rollbackQuietly(connection);
                    return Apply.of(Apply.Status.INVALID);
                }
                try (PreparedStatement statement = connection.prepareStatement(INSERT_SQL)) {
                    statement.setString(1, event.operationId());
                    statement.setString(2, event.institutionId());
                    statement.setLong(3, event.recordRevision());
                    statement.setString(4, event.state().name());
                    statement.setString(5, event.provenanceReference());
                    statement.setString(6, event.operatorReference());
                    statement.setTimestamp(7, Timestamp.from(event.recordedAt()), utcCalendar());
                    statement.executeUpdate();
                }
                connection.commit();
                return Apply.of(Apply.Status.APPLIED);
            } catch (SQLException failure) {
                rollbackQuietly(connection);
                if (isConstraintViolation(failure)) return resolveOperationCollision(event);
                return Apply.of(isUnavailable(failure) ? Apply.Status.UNAVAILABLE : Apply.Status.TECHNICAL_FAILURE);
            } catch (RuntimeException failure) {
                rollbackQuietly(connection);
                return Apply.of(Apply.Status.TECHNICAL_FAILURE);
            }
        } catch (SQLException | RuntimeException failure) {
            return Apply.of(isUnavailable(failure) ? Apply.Status.UNAVAILABLE : Apply.Status.TECHNICAL_FAILURE);
        }
    }

    private boolean lockExactRevision(Connection connection, Event event) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOCK_REVISION_SQL)) {
            statement.setString(1, event.institutionId());
            statement.setLong(2, event.recordRevision());
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private Apply resolveOperationCollision(Event requested) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(FIND_OPERATION_SQL)) {
            statement.setString(1, requested.operationId());
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Apply.of(Apply.Status.INVALID);
                boolean same = requested.institutionId().equals(result.getString("institution_id"))
                        && requested.recordRevision() == result.getLong("record_revision")
                        && requested.state().name().equals(result.getString("authorization_state"))
                        && requested.provenanceReference().equals(result.getString("provenance_reference"))
                        && requested.operatorReference().equals(result.getString("operator_reference"));
                return Apply.of(same ? Apply.Status.REPLAYED : Apply.Status.CONFLICT);
            }
        } catch (SQLException | RuntimeException failure) {
            return Apply.of(isUnavailable(failure) ? Apply.Status.UNAVAILABLE : Apply.Status.TECHNICAL_FAILURE);
        }
    }

    private static boolean isConstraintViolation(SQLException failure) {
        for (SQLException current = failure; current != null; current = current.getNextException()) {
            if ("23000".equals(current.getSQLState())) return true;
        }
        return false;
    }

    private static boolean isUnavailable(Throwable failure) {
        for (Throwable current = failure; current != null; current = current.getCause()) {
            if (current instanceof SQLException sql) {
                for (SQLException next = sql; next != null; next = next.getNextException()) {
                    String state = next.getSQLState();
                    if (state != null && state.startsWith("08")) return true;
                }
            }
        }
        return false;
    }

    private static void rollbackQuietly(Connection connection) {
        try { connection.rollback(); } catch (SQLException ignored) { }
    }

    private static Calendar utcCalendar() {
        return Calendar.getInstance(TimeZone.getTimeZone("UTC"));
    }
}
