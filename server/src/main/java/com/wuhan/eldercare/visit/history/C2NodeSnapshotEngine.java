package com.wuhan.eldercare.visit.history;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.assessment.HistoryFailure;
import com.wuhan.eldercare.visit.assessment.HistoryValidator;

public final class C2NodeSnapshotEngine implements C2SnapshotEngine {
    private final HistoryValidator bridge;
    private final ObjectMapper mapper;
    public C2NodeSnapshotEngine(ObjectMapper mapper, String node) {
        this.mapper = mapper;
        this.bridge = new HistoryValidator(mapper, node);
    }
    @Override public JsonNode generate(JsonNode completed, C2CatalogSource.Capture source, String asOf) {
        try {
            bridge.validate(completed.path("answers"));
            var input = mapper.createObjectNode();
            input.set("completed", completed);
            input.set("catalog", source.catalog());
            input.put("evaluationAsOf", asOf);
            return bridge.c2Snapshot(input);
        } catch (HistoryFailure failure) {
            throw new C2Failure(failure.status(), failure.status() == 400 ? "INVALID_INPUT" : "ENGINE_UNAVAILABLE");
        }
    }
}
