package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.VisitEvaluationContextService;
import com.wuhan.eldercare.visit.web.VisitEvaluationContextController;
import com.wuhan.eldercare.visit.web.VisitEvaluationContextResultV1;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VisitEvaluationContextController.class)
class VisitEvaluationContextControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VisitEvaluationContextService service;

    @Test
    void routeUsesOnlyPathIdentityAndSessionHeaderAndReturnsMinimalNotCompletedResult() throws Exception {
        var result = new VisitEvaluationContextService.Result(
                VisitEvaluationContextService.AuthResolution.AUTHENTICATED,
                VisitEvaluationContextService.Availability.NOT_COMPLETED,
                new VisitEvaluationContextService.Context("visit-1", "institution-1", "revision-1", "scheduled"));
        when(service.load(eq("visit-1"), eq("opaque-session"))).thenReturn(result);

        mockMvc.perform(get("/api/v1/visits/visit-1/evaluation-context")
                        .header("X-Auth-Evidence", "opaque-session")
                        .queryParam("status", "completed")
                        .queryParam("userId", "forged-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contractVersion", equalTo(
                        VisitEvaluationContextResultV1.CONTRACT_VERSION)))
                .andExpect(jsonPath("$.kind", equalTo(VisitEvaluationContextResultV1.KIND)))
                .andExpect(jsonPath("$.authResolution", equalTo("authenticated")))
                .andExpect(jsonPath("$.availability", equalTo("not_completed")))
                .andExpect(jsonPath("$.context.visitId", equalTo("visit-1")))
                .andExpect(jsonPath("$.context.visitStatus", equalTo("scheduled")))
                .andExpect(jsonPath("$.context.userId").doesNotExist())
                .andExpect(jsonPath("$.context.phone").doesNotExist())
                .andExpect(jsonPath("$.context.elderId").doesNotExist())
                .andExpect(jsonPath("$.context.notes").doesNotExist());

        verify(service).load("visit-1", "opaque-session");
    }

    @Test
    void missingSessionResultHasNullAvailabilityAndContext() throws Exception {
        var result = new VisitEvaluationContextService.Result(
                VisitEvaluationContextService.AuthResolution.MISSING, null, null);
        when(service.load(eq("visit-1"), eq(null))).thenReturn(result);

        mockMvc.perform(get("/api/v1/visits/visit-1/evaluation-context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authResolution", equalTo("missing")))
                .andExpect(jsonPath("$.availability").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.context").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void unexpectedFailureBeforeAuthResolutionDoesNotClaimAuthenticated() throws Exception {
        doThrow(new IllegalStateException("private detail"))
                .when(service).load(eq("visit-1"), eq("opaque-session"));

        mockMvc.perform(get("/api/v1/visits/visit-1/evaluation-context")
                        .header("X-Auth-Evidence", "opaque-session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authResolution", equalTo("technical_failure")))
                .andExpect(jsonPath("$.availability").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.context").value(org.hamcrest.Matchers.nullValue()));
    }
}
