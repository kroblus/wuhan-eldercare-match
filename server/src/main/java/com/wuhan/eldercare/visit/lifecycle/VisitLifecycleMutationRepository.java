package com.wuhan.eldercare.visit.lifecycle;

import com.wuhan.eldercare.visit.operations.TrustedOperationsPrincipal;

import java.time.Instant;

/** Atomic persistence port for one explicitly authorized lifecycle command. */
public interface VisitLifecycleMutationRepository {
    Result mutate(TrustedOperationsPrincipal principal, String visitId,
                  VisitLifecycleMutationCommandV1 command, Instant recordedAt);

    record Result(Status status, Receipt receipt) {
        public enum Status {
            ACCEPTED, REPLAYED, NO_OP, AUTH_REQUIRED, NOT_FOUND, ILLEGAL_TRANSITION, EVIDENCE_INSUFFICIENT,
            CONFLICT, IDEMPOTENCY_CONFLICT, UNAVAILABLE, TECHNICAL_FAILURE
        }

        public Result {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.ACCEPTED || status == Status.REPLAYED || status == Status.NO_OP) != (receipt != null)) {
                throw new IllegalArgumentException("receipt only belongs to accepted/no-op results");
            }
        }

        public static Result of(Status status) { return new Result(status, null); }
        public static Result withReceipt(Status status, Receipt receipt) { return new Result(status, receipt); }
    }

    record Receipt(String operationId, String visitId, String status,
                   Instant scheduledAt, Instant completedAt, Instant recordedAt) {
        public Receipt {
            if (blank(operationId) || blank(visitId) || blank(status) || recordedAt == null) {
                throw new IllegalArgumentException("lifecycle receipt fields required");
            }
        }
        private static boolean blank(String value) { return value == null || value.isBlank(); }
    }
}
