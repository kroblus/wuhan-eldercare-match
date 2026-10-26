package com.wuhan.eldercare.visit.assessment;

public record HistoryMetadata(String kind, String id, String status, int schemaVersion,
        String completedAt, String assessmentContractVersion, String source, int snapshotRevision) {
    public static final String SOURCE = "COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1";
}
