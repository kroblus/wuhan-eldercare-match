package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.VisitEvaluationSubmissionService;
import com.wuhan.eldercare.visit.application.VisitEvaluationWriteRepository;
import com.wuhan.eldercare.visit.web.VisitEvaluationSubmissionController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VisitEvaluationSubmissionController.class)
class VisitEvaluationSubmissionControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VisitEvaluationSubmissionService service;

    @Test
    void requestUsesFrozenFlatContentShapeAndReturnsExactResultEnvelope() throws Exception {
        var receipt = new VisitEvaluationWriteRepository.Receipt("evaluation-test-id", "visit-test-id",
                "submitted", Instant.parse("2026-09-24T00:00:00Z"));
        when(service.submit(eq("visit-test-id"), org.mockito.ArgumentMatchers.any(), eq("opaque-session")))
                .thenReturn(new VisitEvaluationSubmissionService.Result("authenticated",
                        VisitEvaluationSubmissionService.Outcome.ACCEPTED, "ACCEPTED", receipt, null));

        mockMvc.perform(post("/api/v1/visits/visit-test-id/evaluation")
                        .header("X-Auth-Evidence", "opaque-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"contractVersion":"visit-evaluation-production-write-contract-v1",
                                 "kind":"visit_evaluation_submission_request_v1","idempotencyKey":"submit-key-001",
                                 "overallRating":5,"consideration":"willing","ratings":{"hygiene":4},
                                 "feeTopicExplanations":{"bed_fee":"explained"}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contractVersion", equalTo(
                        "visit-evaluation-production-write-contract-v1")))
                .andExpect(jsonPath("$.kind", equalTo("visit_evaluation_submission_result_v1")))
                .andExpect(jsonPath("$.authResolution", equalTo("authenticated")))
                .andExpect(jsonPath("$.outcome", equalTo("accepted")))
                .andExpect(jsonPath("$.code", equalTo("ACCEPTED")))
                .andExpect(jsonPath("$.receipt.evaluationId", equalTo("evaluation-test-id")))
                .andExpect(jsonPath("$.receipt.visitId", equalTo("visit-test-id")))
                .andExpect(jsonPath("$.receipt.state", equalTo("submitted")))
                .andExpect(jsonPath("$.receipt.submittedAt", equalTo("2026-09-24T00:00:00Z")))
                .andExpect(jsonPath("$.receipt.comment").doesNotExist())
                .andExpect(jsonPath("$.fieldErrors").value(org.hamcrest.Matchers.nullValue()));

        var requestCaptor = org.mockito.ArgumentCaptor.forClass(VisitEvaluationSubmissionService.Request.class);
        verify(service).submit(eq("visit-test-id"), requestCaptor.capture(), eq("opaque-session"));
        assert requestCaptor.getValue().content().overallRating() == 5;
        assert "explained".equals(requestCaptor.getValue().content().feeTopicExplanations().get("bed_fee"));
    }

    @Test
    void authorityFieldsAreRejectedByStrictRequestParsing() throws Exception {
        mockMvc.perform(post("/api/v1/visits/visit-test-id/evaluation")
                        .header("X-Auth-Evidence", "opaque-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"contractVersion":"visit-evaluation-production-write-contract-v1",
                                 "kind":"visit_evaluation_submission_request_v1","idempotencyKey":"submit-key-001",
                                 "overallRating":5,"consideration":"willing","userId":"forged-owner",
                                 "institutionRecordRevision":"forged-revision","visitStatus":"completed"}
                                """))
                .andExpect(status().isBadRequest());
        verify(service, never()).submit(eq("visit-test-id"), org.mockito.ArgumentMatchers.any(), eq("opaque-session"));
    }

    @Test
    void fractionalRequiredRatingIsRejectedBeforeApplicationService() throws Exception {
        assertInvalidRatingRequest("\"overallRating\":4.9,\"consideration\":\"willing\"");
    }

    @Test
    void fractionalOptionalDimensionRatingIsRejectedBeforeApplicationService() throws Exception {
        assertInvalidRatingRequest("\"overallRating\":5,\"consideration\":\"willing\",\"ratings\":{\"hygiene\":4.9}");
    }

    @Test
    void numericStringRequiredRatingIsRejectedBeforeApplicationService() throws Exception {
        assertInvalidRatingRequest("\"overallRating\":\"4\",\"consideration\":\"willing\"");
    }

    @Test
    void numericStringOptionalDimensionRatingIsRejectedBeforeApplicationService() throws Exception {
        assertInvalidRatingRequest("\"overallRating\":5,\"consideration\":\"willing\",\"ratings\":{\"hygiene\":\"4\"}");
    }

    private void assertInvalidRatingRequest(String invalidRating) throws Exception {
        mockMvc.perform(post("/api/v1/visits/visit-test-id/evaluation")
                        .header("X-Auth-Evidence", "opaque-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"contractVersion":"visit-evaluation-production-write-contract-v1",
                                 "kind":"visit_evaluation_submission_request_v1","idempotencyKey":"submit-key-001",%s}
                                """.formatted(invalidRating)))
                .andExpect(status().isBadRequest());
        verify(service, never()).submit(eq("visit-test-id"), org.mockito.ArgumentMatchers.any(), eq("opaque-session"));
    }
}
