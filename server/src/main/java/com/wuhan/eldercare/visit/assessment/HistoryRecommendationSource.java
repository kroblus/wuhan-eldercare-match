package com.wuhan.eldercare.visit.assessment;
import com.fasterxml.jackson.databind.JsonNode;

/** Server-installed source port. No HTTP registration or client source selector; absent by default. */
@FunctionalInterface
public interface HistoryRecommendationSource {
    Capture capture();
    record Capture(JsonNode catalog, String publicReference) { }
}
