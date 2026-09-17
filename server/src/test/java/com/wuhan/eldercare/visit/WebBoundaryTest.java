package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.web.SubmissionRequestV1;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

class WebBoundaryTest {
    @Test
    void clientAuthorityFieldsAreRejectedByRequestDeserializer() {
        ObjectMapper mapper = new ObjectMapper();
        String json = "{"
                + "\"contractVersion\":\"appointment-institution-visit-contract-v1\","
                + "\"kind\":\"appointment_submission_v1\","
                + "\"idempotencyKey\":\"key\","
                + "\"institutionId\":\"institution-1\","
                + "\"institutionRecordRevision\":\"revision-1\","
                + "\"elderId\":\"elder-1\","
                + "\"visitDate\":\"2026-10-01\","
                + "\"visitTimePreference\":\"morning\","
                + "\"participantCount\":1,"
                + "\"contactName\":\"张三\","
                + "\"phone\":\"13800000000\","
                + "\"phonePurpose\":\"appointment_or_consultant_contact\","
                + "\"phoneAuthorization\":\"explicit\","
                + "\"userId\":\"client-forged\""
                + "}";
        assertThrows(Exception.class, () -> mapper.readValue(json, SubmissionRequestV1.class));
    }
}
