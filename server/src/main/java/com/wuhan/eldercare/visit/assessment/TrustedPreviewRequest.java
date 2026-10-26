package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;

@JsonIgnoreProperties(ignoreUnknown = false)
public record TrustedPreviewRequest(String kind,String sessionId,String assessmentContractVersion,
        Integer schemaVersion,String elderId,JsonNode answers) {
    @Override public String toString() { return "TrustedPreviewRequest[REDACTED]"; }
}
