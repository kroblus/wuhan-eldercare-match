package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wuhan.eldercare.visit.lifecycle.VisitLifecycleMutationService;

/** Only the transition precondition, target intent, retry identity, and typed operational fact are accepted. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record VisitLifecycleMutationRequestV1(
        String operationId,
        String expectedStatus,
        String targetStatus,
        EvidenceV1 evidence
) {
    public VisitLifecycleMutationService.Request toApplicationRequest() {
        return new VisitLifecycleMutationService.Request(operationId, expectedStatus, targetStatus,
                evidence == null ? null : evidence.kind(),
                evidence == null ? null : evidence.reference(),
                evidence == null ? null : evidence.factAt());
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EvidenceV1(String kind, String reference, String factAt) { }
}
