package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteContentV1;

import java.time.Instant;

/** Atomic owner/status/idempotency/cardinality boundary for production Evaluation writes. */
public interface VisitEvaluationWriteRepository {
    Result createOrResolve(
            TrustedPrincipal principal,
            String visitId,
            String idempotencyKeyDigest,
            String contentFingerprint,
            VisitEvaluationWriteContentV1 content,
            String evaluationId,
            Instant submittedAt
    );

    record Receipt(String evaluationId, String visitId, String state, Instant submittedAt) {
        public Receipt {
            if (blank(evaluationId) || blank(visitId) || !"submitted".equals(state) || submittedAt == null) {
                throw new IllegalArgumentException("invalid Evaluation receipt");
            }
        }
    }

    record Result(Status status, Receipt receipt) {
        public enum Status {
            ACCEPTED,
            REPLAYED,
            NOT_FOUND,
            NOT_COMPLETED,
            VALIDATION_FAILED,
            ALREADY_SUBMITTED,
            IDEMPOTENCY_CONFLICT,
            UNAVAILABLE,
            TECHNICAL_FAILURE
        }

        public Result {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.ACCEPTED || status == Status.REPLAYED) != (receipt != null)) {
                throw new IllegalArgumentException("receipt only belongs to accepted/replayed result");
            }
        }

        public static Result accepted(Receipt receipt) { return new Result(Status.ACCEPTED, receipt); }
        public static Result replayed(Receipt receipt) { return new Result(Status.REPLAYED, receipt); }
        public static Result of(Status status) { return new Result(status, null); }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
