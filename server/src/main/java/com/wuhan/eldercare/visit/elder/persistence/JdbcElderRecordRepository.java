package com.wuhan.eldercare.visit.elder.persistence;

import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Calendar;
import java.util.TimeZone;

/** MySQL persistence for the stable Elder subject and its one C5 responsible-user binding. */
public final class JdbcElderRecordRepository implements ElderRecordRepository {
    private static final String INSERT_SQL = "INSERT INTO elder_record_v1 "
            + "(elder_id, responsible_user_id, created_at) VALUES (?, ?, ?)";
    private static final String FIND_BY_OWNER_SQL = "SELECT elder_id, responsible_user_id, created_at "
            + "FROM elder_record_v1 WHERE responsible_user_id = ?";

    private final DataSource dataSource;

    public JdbcElderRecordRepository(DataSource dataSource) {
        if (dataSource == null) throw new IllegalArgumentException("Elder DataSource required");
        this.dataSource = dataSource;
    }

    @Override
    public Lookup findByResponsibleUserId(String responsibleUserId) {
        if (responsibleUserId == null || responsibleUserId.isBlank()) return Lookup.of(Lookup.Status.TECHNICAL_FAILURE);
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(FIND_BY_OWNER_SQL)) {
            statement.setString(1, responsibleUserId);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) return Lookup.of(Lookup.Status.NOT_FOUND);
                ElderRecord record = map(rows);
                if (rows.next()) return Lookup.of(Lookup.Status.TECHNICAL_FAILURE);
                return Lookup.found(record);
            }
        } catch (SQLException | RuntimeException failure) {
            return Lookup.of(failure instanceof SQLException sqlFailure && isUnavailable(sqlFailure)
                    ? Lookup.Status.UNAVAILABLE : Lookup.Status.TECHNICAL_FAILURE);
        }
    }

    @Override
    public Establish establish(ElderRecord candidate) {
        if (candidate == null) return Establish.of(Establish.Status.TECHNICAL_FAILURE);
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (PreparedStatement statement = connection.prepareStatement(INSERT_SQL)) {
                statement.setString(1, candidate.elderId());
                statement.setString(2, candidate.responsibleUserId());
                statement.setTimestamp(3, Timestamp.from(candidate.createdAt()), utcCalendar());
                statement.executeUpdate();
                connection.commit();
                return Establish.created(candidate);
            } catch (SQLException failure) {
                rollbackQuietly(connection);
                if (isConstraintViolation(failure)) return resolveOwnerAfterConstraint(candidate.responsibleUserId());
                return Establish.of(isUnavailable(failure)
                        ? Establish.Status.UNAVAILABLE : Establish.Status.TECHNICAL_FAILURE);
            }
        } catch (SQLException | RuntimeException failure) {
            return Establish.of(failure instanceof SQLException sqlFailure && isUnavailable(sqlFailure)
                    ? Establish.Status.UNAVAILABLE : Establish.Status.TECHNICAL_FAILURE);
        }
    }

    private Establish resolveOwnerAfterConstraint(String responsibleUserId) {
        Lookup owner = findByResponsibleUserId(responsibleUserId);
        return switch (owner.status()) {
            case FOUND -> Establish.alreadyBound(owner.record());
            case UNAVAILABLE -> Establish.of(Establish.Status.UNAVAILABLE);
            case NOT_FOUND, TECHNICAL_FAILURE -> Establish.of(Establish.Status.TECHNICAL_FAILURE);
        };
    }

    private static ElderRecord map(ResultSet rows) throws SQLException {
        Timestamp created = rows.getTimestamp("created_at", utcCalendar());
        if (created == null) throw new SQLException("Elder created_at missing");
        return new ElderRecord(rows.getString("elder_id"), rows.getString("responsible_user_id"), created.toInstant());
    }

    private static boolean isConstraintViolation(SQLException failure) {
        for (SQLException current = failure; current != null; current = current.getNextException()) {
            if (current.getErrorCode() == 1062 || "23000".equals(current.getSQLState())) return true;
        }
        return false;
    }

    private static boolean isUnavailable(SQLException failure) {
        for (SQLException current = failure; current != null; current = current.getNextException()) {
            String state = current.getSQLState();
            if (state != null && state.startsWith("08")) return true;
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
