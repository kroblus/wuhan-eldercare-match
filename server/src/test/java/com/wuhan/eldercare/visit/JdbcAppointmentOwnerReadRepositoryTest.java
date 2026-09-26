package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.persistence.JdbcAppointmentOwnerReadRepository;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JdbcAppointmentOwnerReadRepositoryTest {
    @Test
    void queryFiltersByTrustedOwnerAndSelectsOnlyAppointmentProjectionFields() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet rows = mock(ResultSet.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            assertEquals("SELECT visit_id, institution_id, institution_record_revision, status, "
                    + "visit_date, visit_time_preference, participant_count, pickup_requested "
                    + "FROM institution_visit_v1 WHERE user_id = ? ORDER BY visit_id", sql);
            return statement;
        });
        when(statement.executeQuery()).thenReturn(rows);
        when(rows.next()).thenReturn(true, false);
        when(rows.getString("visit_id")).thenReturn("visit-1");
        when(rows.getString("institution_id")).thenReturn("institution-1");
        when(rows.getString("institution_record_revision")).thenReturn("3");
        when(rows.getString("status")).thenReturn("completed");
        when(rows.getString("visit_date")).thenReturn("2026-10-01");
        when(rows.getString("visit_time_preference")).thenReturn("morning");
        when(rows.getInt("participant_count")).thenReturn(2);
        when(rows.getBoolean("pickup_requested")).thenReturn(false);
        when(rows.wasNull()).thenReturn(true);

        var result = new JdbcAppointmentOwnerReadRepository(dataSource)
                .findAllOwned(new TrustedPrincipal("trusted-user"));

        assertEquals("READY", result.status().name());
        assertEquals(1, result.visits().size());
        assertEquals("completed", result.visits().getFirst().visitStatus());
        assertNull(result.visits().getFirst().pickupRequested());
        verify(statement).setString(1, "trusted-user");
    }

    @Test
    void connectionFailureIsNotMappedToEmptyCollection() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("synthetic-private-detail", "08001"));

        var result = new JdbcAppointmentOwnerReadRepository(dataSource)
                .findAllOwned(new TrustedPrincipal("trusted-user"));

        assertEquals("UNAVAILABLE", result.status().name());
        assertNull(result.visits());
    }
}
