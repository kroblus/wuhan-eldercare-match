package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.application.BackendSubmissionResultV1;
import com.wuhan.eldercare.visit.domain.PersistedVisitCandidateV1;
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
import static org.mockito.Mockito.when;
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
    void acceptedTransportCarriesCandidateForApplicationFirewallOnly() throws Exception {
        var command = TestFixtures.command("wire-candidate");
        var candidate = new PersistedVisitCandidateV1(
                "visit-wire", "user-wire", command.elderId(), command.institutionId(),
                command.institutionRecordRevision(), command.visitDate(), command.visitTimePreference(),
                command.participantCount(), command.pickupRequested(), command.contactName(), command.phone(),
                command.phonePurpose(), "requested", java.time.Instant.parse("2026-09-17T00:00:00Z"), command.notes());
        when(service.submitBackend(any(), any(), any()))
                .thenReturn(BackendSubmissionResultV1.accepted(candidate, false));

        mockMvc.perform(post("/api/v1/appointment-submissions")
                        .header("X-Auth-Evidence", "opaque-auth")
                        .header("X-Phone-Auth-Evidence", "opaque-phone")
                        .contentType("application/json")
                        .content("{"
                                + "\"contractVersion\":\"appointment-institution-visit-contract-v1\","
                                + "\"kind\":\"appointment_submission_v1\","
                                + "\"idempotencyKey\":\"wire-candidate\","
                                + "\"institutionId\":\"institution-1\","
                                + "\"institutionRecordRevision\":\"revision-7\","
                                + "\"elderId\":\"elder-1\","
                                + "\"visitDate\":\"2026-10-01\","
                                + "\"visitTimePreference\":\"morning\","
                                + "\"participantCount\":2,"
                                + "\"pickupRequested\":false,"
                                + "\"contactName\":\"张三\","
                                + "\"phone\":\"13800000000\","
                                + "\"phonePurpose\":\"appointment_or_consultant_contact\","
                                + "\"phoneAuthorization\":\"explicit\","
                                + "\"notes\":\"需要无障碍接待\"} "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome", equalTo("accepted")))
                .andExpect(jsonPath("$.candidate.userId", equalTo("user-wire")))
                .andExpect(jsonPath("$.candidate.phone", equalTo("13800000000")));
    }
}
