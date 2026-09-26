package com.wuhan.eldercare.visit.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.application.InstitutionSnapshotValidator;
import com.wuhan.eldercare.visit.institution.persistence.JdbcInstitutionRevisionRepository;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JdbcAvailabilityClassificationTest {
    @Test
    void elderLookupSeparatesConnectionUnavailableFromOtherSqlFailure() throws Exception {
        assertEquals(ElderRecordRepository.Lookup.Status.UNAVAILABLE,
                new JdbcElderRecordRepository(failingDataSource(new SQLException("offline", "08006")))
                        .findByResponsibleUserId("synthetic-user").status());
        assertEquals(ElderRecordRepository.Lookup.Status.TECHNICAL_FAILURE,
                new JdbcElderRecordRepository(failingDataSource(new SQLException("bad query", "42000")))
                        .findByResponsibleUserId("synthetic-user").status());
    }

    @Test
    void elderEstablishSeparatesConnectionAndInsertConnectionFailuresFromOtherSqlFailure() throws Exception {
        var candidate = new ElderRecord("elder-synthetic", "synthetic-user", Instant.parse("2026-09-27T00:00:00Z"));
        assertEquals(ElderRecordRepository.Establish.Status.UNAVAILABLE,
                new JdbcElderRecordRepository(failingDataSource(new SQLException("offline", "08001")))
                        .establish(candidate).status());

        for (String sqlState : new String[]{"08006", "42000"}) {
            DataSource dataSource = mock(DataSource.class);
            Connection connection = mock(Connection.class);
            PreparedStatement statement = mock(PreparedStatement.class);
            when(dataSource.getConnection()).thenReturn(connection);
            when(connection.prepareStatement(anyString())).thenReturn(statement);
            doThrow(new SQLException("insert failed", sqlState)).when(statement).executeUpdate();
            assertEquals("08".equals(sqlState.substring(0, 2))
                            ? ElderRecordRepository.Establish.Status.UNAVAILABLE
                            : ElderRecordRepository.Establish.Status.TECHNICAL_FAILURE,
                    new JdbcElderRecordRepository(dataSource).establish(candidate).status());
        }
    }

    @Test
    void elderConstraintRecheckPreservesUnavailableOwnerLookup() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        when(dataSource.getConnection()).thenReturn(connection)
                .thenThrow(new SQLException("connection lost during owner recheck", "08006"));
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        doThrow(new SQLException("duplicate binding", "23000")).when(statement).executeUpdate();

        var candidate = new ElderRecord("elder-synthetic", "synthetic-user", Instant.parse("2026-09-27T00:00:00Z"));
        assertEquals(ElderRecordRepository.Establish.Status.UNAVAILABLE,
                new JdbcElderRecordRepository(dataSource).establish(candidate).status());
    }

    @Test
    void institutionMissingRowAndUnavailableSourceRemainDistinct() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet result = mock(ResultSet.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        when(statement.executeQuery()).thenReturn(result);
        when(result.next()).thenReturn(false);
        var repository = institutionRepository(dataSource);
        assertEquals(InstitutionRevisionRepository.CurrentAppointmentRevisionResult.Status.NOT_FOUND,
                repository.resolveCurrentAppointmentRevision("synthetic-missing", 1).status());

        assertEquals(InstitutionRevisionRepository.CurrentAppointmentRevisionResult.Status.UNAVAILABLE,
                institutionRepository(failingDataSource(new SQLException("offline", "08006")))
                        .resolveCurrentAppointmentRevision("synthetic-institution", 1).status());
        assertEquals(InstitutionRevisionRepository.CurrentAppointmentRevisionResult.Status.TECHNICAL_FAILURE,
                institutionRepository(failingDataSource(new SQLException("bad query", "42000")))
                        .resolveCurrentAppointmentRevision("synthetic-institution", 1).status());

        var offlineRepository = institutionRepository(failingDataSource(new SQLException("offline", "08006")));
        assertEquals(InstitutionRevisionRepository.CurrentHeadResult.Status.UNAVAILABLE,
                offlineRepository.currentHead("synthetic-institution").status());
        assertEquals(InstitutionRevisionRepository.ExactPublicNameResult.Status.UNAVAILABLE,
                offlineRepository.resolveExactPublicName("synthetic-institution", 1).status());

        var invalidQueryRepository = institutionRepository(failingDataSource(new SQLException("bad query", "42000")));
        assertEquals(InstitutionRevisionRepository.CurrentHeadResult.Status.TECHNICAL_FAILURE,
                invalidQueryRepository.currentHead("synthetic-institution").status());
        assertEquals(InstitutionRevisionRepository.ExactPublicNameResult.Status.TECHNICAL_FAILURE,
                invalidQueryRepository.resolveExactPublicName("synthetic-institution", 1).status());
    }

    private static JdbcInstitutionRevisionRepository institutionRepository(DataSource dataSource) {
        return new JdbcInstitutionRevisionRepository(dataSource, new ObjectMapper(),
                record -> InstitutionSnapshotValidator.ValidationResult.valid());
    }

    private static DataSource failingDataSource(SQLException failure) throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(failure);
        return dataSource;
    }
}
