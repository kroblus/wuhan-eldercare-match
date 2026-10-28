package com.wuhan.eldercare.visit.institution;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.institution.application.InstitutionSnapshotValidator;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.JdbcInstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.NodeInstitutionSnapshotValidator;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.io.InputStream;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NodeInstitutionSnapshotValidatorTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void packagedFrozenValidatorChecksCompleteSyntheticRecord() throws Exception {
        var validator = new NodeInstitutionSnapshotValidator("node", mapper);
        var record = syntheticRecord();
        assertEquals(InstitutionSnapshotValidator.Status.VALID, validator.validate(record).status());

        record.with("identity").with("name").put("value", "");
        var invalid = validator.validate(record);
        assertEquals(InstitutionSnapshotValidator.Status.INVALID, invalid.status());
        assertTrue(invalid.issues().stream().anyMatch(issue -> issue.path().equals("identity.name.value")));
    }

    @Test
    void missingNodeFailsClosed() throws Exception {
        var validator = new NodeInstitutionSnapshotValidator("missing-institution-node-for-test", mapper);
        assertEquals(InstitutionSnapshotValidator.Status.UNAVAILABLE,
                validator.validate(syntheticRecord()).status());
    }

    @Test
    void connectionUnavailabilityAndOtherSqlFailuresRemainDistinct() throws Exception {
        DataSource unavailableDatabase = mock(DataSource.class);
        when(unavailableDatabase.getConnection()).thenThrow(new SQLException("synthetic connection failure", "08001"));
        var repository = new JdbcInstitutionRevisionRepository(unavailableDatabase, mapper,
                new NodeInstitutionSnapshotValidator("node", mapper));
        assertEquals(InstitutionRevisionRepository.ExactPublicNameResult.Status.UNAVAILABLE,
                repository.resolveExactPublicName("synthetic-institution", 1).status());
        assertEquals(InstitutionRevisionRepository.CurrentHeadResult.Status.UNAVAILABLE,
                repository.currentHead("synthetic-institution").status());
        org.mockito.Mockito.doThrow(new SQLException("synthetic query failure", "42000")).when(unavailableDatabase).getConnection();
        assertEquals(InstitutionRevisionRepository.ExactPublicNameResult.Status.TECHNICAL_FAILURE,
                repository.resolveExactPublicName("synthetic-institution",1).status());
        assertEquals(InstitutionRevisionRepository.CurrentHeadResult.Status.TECHNICAL_FAILURE,
                repository.currentHead("synthetic-institution").status());
    }

    private com.fasterxml.jackson.databind.node.ObjectNode syntheticRecord() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/institution-synthetic-v121.json")) {
            if (input == null) throw new IllegalStateException("test-only Institution fixture missing");
            return (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(input);
        }
    }
}
