package com.wuhan.eldercare.visit.history;

import com.fasterxml.jackson.databind.JsonNode;

/** Deployment-owned verified source. No default catalog, HTTP registration, or client selector. */
public interface C2CatalogSource {
    Capture capture();
    /** Rechecks provenance/revocation of the exact pinned release, never substitutes a new release. */
    boolean authorizes(Capture pinned);
    record Capture(String releaseId, String sourceReference, JsonNode catalog) {
        public Capture {
            if (releaseId == null || releaseId.isBlank() || releaseId.length() > 120
                    || sourceReference == null || sourceReference.isBlank() || sourceReference.length() > 200
                    || catalog == null || !catalog.isObject()
                    || !"PRODUCTION".equals(catalog.path("datasetMode").asText()))
                throw new C2Failure(503, "SOURCE_UNAVAILABLE");
            catalog = catalog.deepCopy();
        }
        @Override public JsonNode catalog() { return catalog.deepCopy(); }
    }
}
