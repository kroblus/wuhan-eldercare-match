package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import com.wuhan.eldercare.visit.domain.VisitReceiptV1;
import com.wuhan.eldercare.visit.web.ApiExceptionHandler;
import com.wuhan.eldercare.visit.web.VisitSubmissionController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VisitSubmissionController.class)
@Import(ApiExceptionHandler.class)
class VisitSubmissionControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VisitSubmissionService service;

    @Test
    void malformedJsonUsesStableValidationResultWithoutFrameworkDetails() throws Exception {
        mockMvc.perform(post("/api/v1/appointment-submissions")
                        .contentType("application/json")
                        .content("{\"contractVersion\": "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome", equalTo("rejected")))
                .andExpect(jsonPath("$.code", equalTo("VALIDATION_FAILED")))
                .andExpect(jsonPath("$.message").doesNotExist());
    }

    @Test
    void unknownAuthorityFieldUsesStableValidationResult() throws Exception {
        mockMvc.perform(post("/api/v1/appointment-submissions")
                        .contentType("application/json")
                        .content("{\"userId\":\"forged\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome", equalTo("rejected")))
                .andExpect(jsonPath("$.code", equalTo("VALIDATION_FAILED")))
                .andExpect(jsonPath("$.exception").doesNotExist());
    }

    @Test
    void acceptedHttpResponseContainsOnlyThePublicReceipt() throws Exception {
        when(service.submit(any(), any(), any())).thenReturn(SubmissionResultV1.accepted(publicReceipt()));

        assertSafeHttpResponse("accepted", "ACCEPTED");
        verify(service).submit(any(), any(), any());
    }

    @Test
    void replayedHttpResponseContainsOnlyThePublicReceipt() throws Exception {
        when(service.submit(any(), any(), any())).thenReturn(SubmissionResultV1.replayed(publicReceipt()));

        assertSafeHttpResponse("replayed", "REPLAYED");
        verify(service).submit(any(), any(), any());
    }

    private void assertSafeHttpResponse(String outcome, String code) throws Exception {
        String body = mockMvc.perform(post("/api/v1/appointment-submissions")
                        .header("X-Auth-Evidence", "opaque-auth")
                        .header("X-Phone-Auth-Evidence", "opaque-phone")
                        .contentType("application/json")
                        .content("{"
                                + "\"contractVersion\":\"appointment-institution-visit-contract-v1\","
                                + "\"kind\":\"appointment_submission_v1\","
                                + "\"idempotencyKey\":\"wire-candidate\","
                                + "\"institutionId\":\"institution-1\","
                                + "\"institutionRecordRevision\":\"revision-7\","
                                + "\"elderId\":\"elder-assertion-secret\","
                                + "\"visitDate\":\"2026-10-01\","
                                + "\"visitTimePreference\":\"morning\","
                                + "\"participantCount\":2,"
                                + "\"pickupRequested\":false,"
                                + "\"contactName\":\"private-contact-name\","
                                + "\"phone\":\"13800000000\","
                                + "\"phonePurpose\":\"appointment_or_consultant_contact\","
                                + "\"phoneAuthorization\":\"explicit\","
                                + "\"notes\":\"private-notes-secret\"} "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome", equalTo(outcome)))
                .andExpect(jsonPath("$.code", equalTo(code)))
                .andExpect(jsonPath("$.candidate").doesNotExist())
                .andExpect(jsonPath("$.userId").doesNotExist())
                .andExpect(jsonPath("$.elderId").doesNotExist())
                .andExpect(jsonPath("$.receipt.userId").doesNotExist())
                .andExpect(jsonPath("$.receipt.elderId").doesNotExist())
                .andExpect(jsonPath("$.receipt.contactName").doesNotExist())
                .andExpect(jsonPath("$.receipt.phone").doesNotExist())
                .andExpect(jsonPath("$.receipt.phonePurpose").doesNotExist())
                .andExpect(jsonPath("$.receipt.notes").doesNotExist())
                .andExpect(jsonPath("$.receipt.visitDate").doesNotExist())
                .andExpect(jsonPath("$.receipt.visitTimePreference").doesNotExist())
                .andExpect(jsonPath("$.receipt.participantCount").doesNotExist())
                .andExpect(jsonPath("$.receipt.pickupRequested").doesNotExist())
                .andExpect(jsonPath("$.receipt.visitId", equalTo("visit-public")))
                .andExpect(jsonPath("$.receipt.institutionId", equalTo("institution-1")))
                .andExpect(jsonPath("$.receipt.institutionRecordRevision", equalTo("revision-7")))
                .andExpect(jsonPath("$.receipt.status", equalTo("requested")))
                .andReturn().getResponse().getContentAsString();

        assertFalse(body.contains("user-private"));
        assertFalse(body.contains("elder-private"));
        assertFalse(body.contains("elder-assertion-secret"));
        assertFalse(body.contains("private-contact-name"));
        assertFalse(body.contains("13800000000"));
        assertFalse(body.contains("private-notes-secret"));
    }

    private static VisitReceiptV1 publicReceipt() {
        return new VisitReceiptV1("visit-public", "institution-1", "revision-7", "requested",
                java.time.Instant.parse("2026-09-17T00:00:00Z"), "ignored");
    }
}
