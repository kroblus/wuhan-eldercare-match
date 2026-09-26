package com.wuhan.eldercare.visit.lifecycle;

import java.time.Instant;

/** expectedStatus is an optimistic precondition only; persisted Visit state remains authoritative. */
public record VisitLifecycleMutationCommandV1(
        String operationId,
        String expectedStatus,
        String targetStatus,
        VisitLifecycleEvidenceV1 evidence,
        String requestFingerprint
) {
    private static final String STATUS_PATTERN = "requested|contacting|scheduled|completed|cancelled";

    public static VisitLifecycleMutationCommandV1 create(
            String operationId,
            String expectedStatus,
            String targetStatus,
            String evidenceKind,
            String evidenceReference,
            String factAt
    ) {
        if (operationId == null || !operationId.matches("[A-Za-z0-9._:-]{1,160}")) return null;
        if (expectedStatus == null || !expectedStatus.matches(STATUS_PATTERN)
                || targetStatus == null || !targetStatus.matches(STATUS_PATTERN)) return null;
        if (evidenceReference != null && (evidenceReference.isBlank() || evidenceReference.length() > 200
                || !evidenceReference.matches("[A-Za-z0-9._:/-]{1,200}"))) return null;

        VisitLifecycleEvidenceV1 evidence = null;
        if (evidenceKind != null || evidenceReference != null || factAt != null) {
            VisitLifecycleEvidenceV1.Kind kind = VisitLifecycleEvidenceV1.Kind.fromWire(evidenceKind);
            if (kind == null) return null;
            Instant parsedFactAt = null;
            if (factAt != null) {
                try {
                    parsedFactAt = Instant.parse(factAt);
                } catch (RuntimeException ignored) {
                    return null;
                }
            }
            try {
                evidence = new VisitLifecycleEvidenceV1(kind, evidenceReference, parsedFactAt);
            } catch (RuntimeException ignored) {
                return null;
            }
        }
        String fingerprint = VisitLifecycleRequestFingerprintV1.digest(
                expectedStatus, targetStatus, evidence);
        return new VisitLifecycleMutationCommandV1(operationId, expectedStatus, targetStatus, evidence, fingerprint);
    }

    public boolean evidenceMatchesTarget() {
        return evidence != null && targetStatus.equals(evidence.kind().targetStatus());
    }
}
