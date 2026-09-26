package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wuhan.eldercare.visit.lifecycle.VisitLifecycleMutationRepository;
import com.wuhan.eldercare.visit.lifecycle.VisitLifecycleMutationService;

import java.time.Instant;
import java.util.Set;

/** Stable, privacy-minimized Operations lifecycle result. */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record VisitLifecycleMutationResultV1(String contractVersion, String kind, String result, ReceiptV1 receipt) {
    public static final String CONTRACT_VERSION = "institution-visit-operations-lifecycle-contract-v1";
    public static final String KIND = "visit_lifecycle_mutation_result_v1";
    private static final Set<String> RESULTS = Set.of(
            "accepted", "replayed", "no_op", "auth_required", "not_found", "validation_failed",
            "illegal_transition", "evidence_insufficient", "conflict", "idempotency_conflict",
            "unavailable", "technical_failure");

    public VisitLifecycleMutationResultV1 {
        if (!CONTRACT_VERSION.equals(contractVersion) || !KIND.equals(kind) || !RESULTS.contains(result)) {
            throw new IllegalArgumentException("invalid Operations lifecycle result envelope");
        }
        if (("accepted".equals(result) || "replayed".equals(result) || "no_op".equals(result)) != (receipt != null)) {
            throw new IllegalArgumentException("receipt only belongs to successful lifecycle outcomes");
        }
    }

    public static VisitLifecycleMutationResultV1 from(VisitLifecycleMutationService.Result value) {
        if (value == null) return technicalFailure();
        return new VisitLifecycleMutationResultV1(CONTRACT_VERSION, KIND, value.status().wireValue(),
                value.receipt() == null ? null : ReceiptV1.from(value.receipt()));
    }

    public static VisitLifecycleMutationResultV1 validationFailed() {
        return new VisitLifecycleMutationResultV1(CONTRACT_VERSION, KIND, "validation_failed", null);
    }

    public static VisitLifecycleMutationResultV1 technicalFailure() {
        return new VisitLifecycleMutationResultV1(CONTRACT_VERSION, KIND, "technical_failure", null);
    }

    public record ReceiptV1(String operationId, String visitId, String status,
                            String scheduledAt, String completedAt, String recordedAt) {
        private static ReceiptV1 from(VisitLifecycleMutationRepository.Receipt value) {
            return new ReceiptV1(value.operationId(), value.visitId(), value.status(),
                    wireTime(value.scheduledAt()), wireTime(value.completedAt()), wireTime(value.recordedAt()));
        }

        private static String wireTime(Instant value) { return value == null ? null : value.toString(); }
    }
}
