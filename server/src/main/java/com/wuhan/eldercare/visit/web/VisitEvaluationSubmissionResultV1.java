package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wuhan.eldercare.visit.application.VisitEvaluationSubmissionService;
import com.wuhan.eldercare.visit.application.VisitEvaluationWriteRepository;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteValidation;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record VisitEvaluationSubmissionResultV1(
        String contractVersion,
        String kind,
        String authResolution,
        String outcome,
        String code,
        Receipt receipt,
        List<FieldError> fieldErrors
) {
    public static final String CONTRACT_VERSION = "visit-evaluation-production-write-contract-v1";
    public static final String KIND = "visit_evaluation_submission_result_v1";
    private static final Set<String> AUTH_RESOLUTIONS = Set.of(
            "authenticated", "missing", "expired", "invalid", "unavailable", "technical_failure");
    private static final Set<String> OUTCOMES = Set.of(
            "accepted", "replayed", "rejected", "conflict", "unavailable", "technical_failure");

    public VisitEvaluationSubmissionResultV1 {
        if (!CONTRACT_VERSION.equals(contractVersion) || !KIND.equals(kind)
                || !AUTH_RESOLUTIONS.contains(authResolution) || !OUTCOMES.contains(outcome)
                || code == null || code.isBlank()) {
            throw new IllegalArgumentException("invalid Evaluation submission result envelope");
        }
        boolean success = "accepted".equals(outcome) || "replayed".equals(outcome);
        if (success != (receipt != null)) throw new IllegalArgumentException("receipt does not match outcome");
        boolean validationFailure = "VALIDATION_FAILED".equals(code);
        if (validationFailure != (fieldErrors != null && !fieldErrors.isEmpty())) {
            throw new IllegalArgumentException("field errors do not match result code");
        }
        if (fieldErrors != null) fieldErrors = List.copyOf(fieldErrors);
    }

    public static VisitEvaluationSubmissionResultV1 from(VisitEvaluationSubmissionService.Result result) {
        if (result == null) return technicalFailure();
        Receipt receipt = result.receipt() == null ? null : new Receipt(result.receipt().evaluationId(),
                result.receipt().visitId(), result.receipt().state(), result.receipt().submittedAt());
        List<FieldError> errors = result.fieldErrors() == null ? null : result.fieldErrors().stream()
                .map(error -> new FieldError(error.field(), error.code())).toList();
        return new VisitEvaluationSubmissionResultV1(CONTRACT_VERSION, KIND, result.authResolution(),
                result.outcome().name().toLowerCase(java.util.Locale.ROOT), result.code(), receipt, errors);
    }

    public static VisitEvaluationSubmissionResultV1 technicalFailure() {
        return new VisitEvaluationSubmissionResultV1(CONTRACT_VERSION, KIND,
                "technical_failure", "technical_failure", "TECHNICAL_FAILURE", null, null);
    }

    public record Receipt(String evaluationId, String visitId, String state, Instant submittedAt) {
        public Receipt {
            if (blank(evaluationId) || blank(visitId) || !"submitted".equals(state) || submittedAt == null) {
                throw new IllegalArgumentException("invalid Evaluation receipt");
            }
        }
    }

    public record FieldError(String field, String code) {
        public FieldError {
            if (blank(field) || blank(code)) throw new IllegalArgumentException("invalid safe field error");
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
