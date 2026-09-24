package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wuhan.eldercare.visit.application.VisitEvaluationContextService;

import java.util.Set;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record VisitEvaluationContextResultV1(
        String contractVersion,
        String kind,
        String authResolution,
        String availability,
        Context context
) {
    public static final String CONTRACT_VERSION = "authenticated-visit-evaluation-context-contract-v1";
    public static final String KIND = "authenticated_visit_evaluation_context_result_v1";
    private static final Set<String> AUTH_RESOLUTIONS = Set.of(
            "authenticated", "missing", "expired", "invalid", "unavailable", "technical_failure");
    private static final Set<String> AVAILABILITIES = Set.of(
            "eligible", "not_completed", "not_found", "unavailable", "technical_failure");
    private static final Set<String> VISIT_STATUSES = Set.of(
            "requested", "contacting", "scheduled", "completed", "cancelled");

    public VisitEvaluationContextResultV1 {
        if (!CONTRACT_VERSION.equals(contractVersion) || !KIND.equals(kind)
                || !AUTH_RESOLUTIONS.contains(authResolution)) {
            throw new IllegalArgumentException("invalid VisitEvaluation context result envelope");
        }
        if ("authenticated".equals(authResolution)) {
            if (!AVAILABILITIES.contains(availability)) {
                throw new IllegalArgumentException("authenticated result requires availability");
            }
        } else if (availability != null || context != null) {
            throw new IllegalArgumentException("unauthenticated result cannot contain Visit data");
        }
        boolean contextRequired = "eligible".equals(availability) || "not_completed".equals(availability);
        if (contextRequired != (context != null)) {
            throw new IllegalArgumentException("context does not match availability");
        }
        if (context != null) {
            if (!VISIT_STATUSES.contains(context.visitStatus())
                    || ("eligible".equals(availability) != "completed".equals(context.visitStatus()))) {
                throw new IllegalArgumentException("context status does not match availability");
            }
        }
    }

    public static VisitEvaluationContextResultV1 from(VisitEvaluationContextService.Result result) {
        if (result == null) return technicalFailure();
        Context context = result.context() == null ? null : new Context(
                result.context().visitId(), result.context().institutionId(),
                result.context().institutionRecordRevision(), result.context().visitStatus());
        return new VisitEvaluationContextResultV1(CONTRACT_VERSION, KIND,
                result.authResolution().wireValue(),
                result.availability() == null ? null : result.availability().wireValue(), context);
    }

    public static VisitEvaluationContextResultV1 technicalFailure() {
        return new VisitEvaluationContextResultV1(CONTRACT_VERSION, KIND,
                "technical_failure", null, null);
    }

    public record Context(String visitId, String institutionId, String institutionRecordRevision, String visitStatus) {
        public Context {
            if (blank(visitId) || blank(institutionId) || blank(institutionRecordRevision) || blank(visitStatus)) {
                throw new IllegalArgumentException("incomplete Evaluation context");
            }
        }

        private static boolean blank(String value) {
            return value == null || value.isBlank();
        }
    }
}
