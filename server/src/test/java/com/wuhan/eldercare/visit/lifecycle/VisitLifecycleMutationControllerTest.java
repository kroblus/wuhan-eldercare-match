package com.wuhan.eldercare.visit.lifecycle;

import com.wuhan.eldercare.visit.web.VisitLifecycleMutationController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Arrays;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VisitLifecycleMutationController.class)
class VisitLifecycleMutationControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VisitLifecycleMutationService service;

    @Test
    void routeReturnsVersionedAcceptedResultAndIgnoresClientAuthorityFields() throws Exception {
        var receipt = new VisitLifecycleMutationRepository.Receipt("op-1", "visit-1", "completed",
                null, Instant.parse("2026-09-26T10:15:00Z"), Instant.parse("2026-09-26T10:16:00Z"));
        when(service.mutate(eq("visit-1"), eq("opaque-operations-credential"), any()))
                .thenReturn(new VisitLifecycleMutationService.Result(
                        VisitLifecycleMutationService.Result.Status.ACCEPTED, receipt));

        mockMvc.perform(post("/api/v1/operations/visits/visit-1/lifecycle")
                        .header("X-Operations-Credential", "opaque-operations-credential")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operationId":"op-1","expectedStatus":"scheduled","targetStatus":"completed",
                                 "evidence":{"kind":"in_person_visit_occurred","reference":"case-17",
                                   "factAt":"2026-09-26T10:15:00Z"},
                                 "userId":"forged-user","ownerId":"forged-owner",
                                 "operationsPrincipalId":"forged-operator","visitStatus":"requested",
                                 "currentStatus":"requested","institutionId":"forged-institution",
                                 "institutionRecordRevision":"forged-revision","completed":true,
                                 "completedAt":"2001-01-01T00:00:00Z"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contractVersion", equalTo(
                        "institution-visit-operations-lifecycle-contract-v1")))
                .andExpect(jsonPath("$.kind", equalTo("visit_lifecycle_mutation_result_v1")))
                .andExpect(jsonPath("$.result", equalTo("accepted")))
                .andExpect(jsonPath("$.receipt.operationId", equalTo("op-1")))
                .andExpect(jsonPath("$.receipt.visitId", equalTo("visit-1")))
                .andExpect(jsonPath("$.receipt.status", equalTo("completed")))
                .andExpect(jsonPath("$.receipt.scheduledAt").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.receipt.completedAt", equalTo("2026-09-26T10:15:00Z")))
                .andExpect(jsonPath("$.receipt.recordedAt", equalTo("2026-09-26T10:16:00Z")))
                .andExpect(jsonPath("$.receipt.userId").doesNotExist())
                .andExpect(jsonPath("$.receipt.evidence").doesNotExist());

        var requestCaptor = org.mockito.ArgumentCaptor.forClass(VisitLifecycleMutationService.Request.class);
        verify(service).mutate(eq("visit-1"), eq("opaque-operations-credential"), requestCaptor.capture());
        var request = requestCaptor.getValue();
        assertEquals("op-1", request.operationId());
        assertEquals("scheduled", request.expectedStatus());
        assertEquals("completed", request.targetStatus());
        assertEquals("in_person_visit_occurred", request.evidenceKind());
        assertEquals("case-17", request.evidenceReference());
        assertEquals("2026-09-26T10:15:00Z", request.factAt());
        // The accepted application request shape has no caller-controlled identity or status authority fields.
        assertEquals(Set.of("operationId", "expectedStatus", "targetStatus", "evidenceKind",
                        "evidenceReference", "factAt"),
                Arrays.stream(request.getClass().getRecordComponents())
                        .map(java.lang.reflect.RecordComponent::getName).collect(java.util.stream.Collectors.toSet()));
    }

    @Test
    void missingOperationsCredentialIsPassedAsMissingAndMapsToAuthRequired() throws Exception {
        when(service.mutate(eq("visit-1"), isNull(), any()))
                .thenReturn(new VisitLifecycleMutationService.Result(
                        VisitLifecycleMutationService.Result.Status.AUTH_REQUIRED, null));

        mockMvc.perform(post("/api/v1/operations/visits/visit-1/lifecycle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contractVersion", equalTo(
                        "institution-visit-operations-lifecycle-contract-v1")))
                .andExpect(jsonPath("$.kind", equalTo("visit_lifecycle_mutation_result_v1")))
                .andExpect(jsonPath("$.result", equalTo("auth_required")))
                .andExpect(jsonPath("$.receipt").value(org.hamcrest.Matchers.nullValue()));

        verify(service).mutate(eq("visit-1"), isNull(), any());
    }

    @Test
    void invalidOperationsCredentialMapsToSameSafeAuthResultWithoutEchoingCredential() throws Exception {
        when(service.mutate(eq("visit-1"), eq("invalid-secret-value"), any()))
                .thenReturn(new VisitLifecycleMutationService.Result(
                        VisitLifecycleMutationService.Result.Status.AUTH_REQUIRED, null));

        mockMvc.perform(post("/api/v1/operations/visits/visit-1/lifecycle")
                        .header("X-Operations-Credential", "invalid-secret-value")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result", equalTo("auth_required")))
                .andExpect(jsonPath("$.credential").doesNotExist())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("invalid-secret-value"))));

        verify(service).mutate(eq("visit-1"), eq("invalid-secret-value"), any());
    }

    @Test
    void illegalTransitionHasStableNonSuccessResultWithoutReceipt() throws Exception {
        when(service.mutate(eq("visit-1"), eq("opaque-operations-credential"), any()))
                .thenReturn(new VisitLifecycleMutationService.Result(
                        VisitLifecycleMutationService.Result.Status.ILLEGAL_TRANSITION, null));

        mockMvc.perform(post("/api/v1/operations/visits/visit-1/lifecycle")
                        .header("X-Operations-Credential", "opaque-operations-credential")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result", equalTo("illegal_transition")))
                .andExpect(jsonPath("$.receipt").value(org.hamcrest.Matchers.nullValue()));
    }

    private static String validBody() {
        return """
                {"operationId":"op-1","expectedStatus":"scheduled","targetStatus":"completed",
                 "evidence":{"kind":"in_person_visit_occurred","reference":"case-17",
                   "factAt":"2026-09-26T10:15:00Z"}}
                """;
    }
}
