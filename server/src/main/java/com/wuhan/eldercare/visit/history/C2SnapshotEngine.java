package com.wuhan.eldercare.visit.history;

import com.fasterxml.jackson.databind.JsonNode;

/** Pure generation boundary; reads never use this engine. */
@FunctionalInterface
public interface C2SnapshotEngine {
    JsonNode generate(JsonNode completed, C2CatalogSource.Capture source, String evaluationAsOf);
}
