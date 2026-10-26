package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;

@JsonIgnoreProperties(ignoreUnknown = false)
public record HistoryRequest(String kind, String intent, String assessmentContractVersion,
        Integer schemaVersion, String elderId, String idempotencyKey, JsonNode answers,
        String previewId, String displayBinding) {
    /** Preserves the original seven-field wire contract for existing TEST_ONLY callers. */
    public HistoryRequest(String kind,String intent,String assessmentContractVersion,Integer schemaVersion,
            String elderId,String idempotencyKey,JsonNode answers) {
        this(kind,intent,assessmentContractVersion,schemaVersion,elderId,idempotencyKey,answers,null,null);
    }
    @Override public String toString() { return "HistoryRequest[REDACTED]"; }
}
