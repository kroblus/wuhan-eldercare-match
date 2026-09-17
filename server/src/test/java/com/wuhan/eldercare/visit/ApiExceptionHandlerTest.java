package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import com.wuhan.eldercare.visit.web.SubmissionRequestV1;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ApiExceptionHandlerTest {
    @Test
    void malformedPayloadMapsToStableRejectedResult() {
        SubmissionResultV1 result = SubmissionResultV1.rejected("VALIDATION_FAILED");
        assertEquals("rejected", result.outcome().wireValue());
        assertEquals("VALIDATION_FAILED", result.code());
    }

    @Test
    void unknownAuthorityFieldCannotDeserialize() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        String json = "{\"contractVersion\":\"appointment-institution-visit-contract-v1\","
                + "\"kind\":\"appointment_submission_v1\",\"userId\":\"forged\"}";
        assertThrows(Exception.class, () -> mapper.readValue(json, SubmissionRequestV1.class));
    }

    @Test
    void wireOutcomeUsesC3Lowercase() throws Exception {
        String json = new ObjectMapper().writeValueAsString(SubmissionResultV1.unavailable());
        assertTrue(json.contains("\"outcome\":\"unavailable\""));
        assertTrue(!json.contains("\"outcome\":\"UNAVAILABLE\""));
    }

    @Test
    void acceptedReceiptCarriesC2VersionedIdentity() throws Exception {
        var receipt = new com.wuhan.eldercare.visit.domain.VisitReceiptV1(
                "visit-1", "institution-1", "revision-1", "requested",
                java.time.Instant.parse("2026-09-17T00:00:00Z"), "ignored");
        String json = new ObjectMapper().findAndRegisterModules()
                .writeValueAsString(SubmissionResultV1.accepted(receipt));
        assertTrue(json.contains("\"contractVersion\":\"appointment-institution-visit-contract-v1\""));
        assertTrue(json.contains("\"kind\":\"appointment_submission_receipt_v1\""));
    }
}
