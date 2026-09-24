package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.persistence.JdbcVisitEvaluationContextRepository;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JdbcVisitEvaluationContextRepositoryTest {
    @Test
    void queryUsesOwnerAndVisitIdAndSelectsOnlyMinimalContextFields() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet rows = mock(ResultSet.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            assertEquals("SELECT visit_id, institution_id, institution_record_revision, status "
                    + "FROM institution_visit_v1 WHERE visit_id = ? AND user_id = ?", sql);
            return statement;
        });
        when(statement.executeQuery()).thenReturn(rows);
        when(rows.next()).thenReturn(true);
        when(rows.getString("visit_id")).thenReturn("visit-1");
        when(rows.getString("institution_id")).thenReturn("institution-1");
        when(rows.getString("institution_record_revision")).thenReturn("revision-1");
        when(rows.getString("status")).thenReturn("completed");

        var result = new JdbcVisitEvaluationContextRepository(dataSource)
                .findOwned(new TrustedPrincipal("trusted-user"), "visit-1");

        assertEquals("FOUND", result.status().name());
        assertEquals("completed", result.visit().visitStatus());
        verify(statement).setString(1, "visit-1");
        verify(statement).setString(2, "trusted-user");
    }

    @Test
    void missingOwnerScopedRowReturnsNotFound() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet rows = mock(ResultSet.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        when(statement.executeQuery()).thenReturn(rows);
        when(rows.next()).thenReturn(false);

        var result = new JdbcVisitEvaluationContextRepository(dataSource)
                .findOwned(new TrustedPrincipal("trusted-user"), "visit-unknown");

        assertEquals("NOT_FOUND", result.status().name());
    }

    @Test
    void connectionFailureMapsUnavailableWithoutLeakingDriverDetails() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("private driver detail", "08001"));

        var result = new JdbcVisitEvaluationContextRepository(dataSource)
                .findOwned(new TrustedPrincipal("trusted-user"), "visit-1");

        assertEquals("UNAVAILABLE", result.status().name());
    }
}
