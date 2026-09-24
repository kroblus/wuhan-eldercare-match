package com.wuhan.eldercare.visit.persistence;

import com.wuhan.eldercare.visit.application.VisitEvaluationContextRepository;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/** Reads a minimized Visit projection using both requested ID and trusted owner identity. */
public final class JdbcVisitEvaluationContextRepository implements VisitEvaluationContextRepository {
    private static final String FIND_OWNED_SQL = "SELECT visit_id, institution_id, institution_record_revision, status "
            + "FROM institution_visit_v1 WHERE visit_id = ? AND user_id = ?";

    private final DataSource dataSource;

    public JdbcVisitEvaluationContextRepository(DataSource dataSource) {
        if (dataSource == null) throw new IllegalArgumentException("dataSource required");
        this.dataSource = dataSource;
    }

    @Override
    public Result findOwned(TrustedPrincipal principal, String visitId) {
        if (principal == null || visitId == null || visitId.isBlank()) return Result.notFound();
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(FIND_OWNED_SQL)) {
            statement.setString(1, visitId);
            statement.setString(2, principal.userId());
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Result.notFound();
                return Result.found(new OwnedVisit(
                        result.getString("visit_id"),
                        result.getString("institution_id"),
                        result.getString("institution_record_revision"),
                        result.getString("status")));
            }
        } catch (SQLException exception) {
            return isUnavailable(exception) ? Result.unavailable() : Result.technicalFailure();
        } catch (RuntimeException ignored) {
            return Result.technicalFailure();
        }
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
}
