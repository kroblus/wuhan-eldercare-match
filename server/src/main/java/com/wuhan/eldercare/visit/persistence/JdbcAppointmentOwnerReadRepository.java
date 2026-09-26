package com.wuhan.eldercare.visit.persistence;

import com.wuhan.eldercare.visit.application.AppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/** Reads only Appointment-card fields from Visits owned by the trusted C5 principal. */
public final class JdbcAppointmentOwnerReadRepository implements AppointmentOwnerReadRepository {
    private static final String FIND_OWNED_SQL = "SELECT visit_id, institution_id, institution_record_revision, status, "
            + "visit_date, visit_time_preference, participant_count, pickup_requested "
            + "FROM institution_visit_v1 WHERE user_id = ? ORDER BY visit_id";

    private final DataSource dataSource;

    public JdbcAppointmentOwnerReadRepository(DataSource dataSource) {
        if (dataSource == null) throw new IllegalArgumentException("dataSource required");
        this.dataSource = dataSource;
    }

    @Override
    public Result findAllOwned(TrustedPrincipal principal) {
        if (principal == null) return Result.technicalFailure();
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(FIND_OWNED_SQL)) {
            statement.setString(1, principal.userId());
            try (ResultSet rows = statement.executeQuery()) {
                List<OwnedVisit> visits = new ArrayList<>();
                while (rows.next()) {
                    boolean pickupValue = rows.getBoolean("pickup_requested");
                    Boolean pickupRequested = rows.wasNull() ? null : pickupValue;
                    visits.add(new OwnedVisit(
                            rows.getString("visit_id"),
                            rows.getString("institution_id"),
                            rows.getString("institution_record_revision"),
                            rows.getString("status"),
                            rows.getString("visit_date"),
                            rows.getString("visit_time_preference"),
                            rows.getInt("participant_count"),
                            pickupRequested));
                }
                return Result.ready(visits);
            }
        } catch (SQLException exception) {
            return isUnavailable(exception) ? Result.unavailable() : Result.technicalFailure();
        } catch (RuntimeException ignored) {
            return Result.technicalFailure();
        }
    }

    private static boolean isUnavailable(SQLException exception) {
        for (SQLException current = exception; current != null; current = current.getNextException()) {
            String state = current.getSQLState();
            if (state != null && (state.startsWith("08") || "40001".equals(state))) return true;
        }
        return false;
    }
}
