package com.wuhan.eldercare.visit.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public record SubmissionResultV1(
        Outcome outcome,
        String code,
        VisitReceiptV1 receipt
) {
    public enum Outcome {
        ACCEPTED,
        REPLAYED,
        REJECTED,
        CONFLICT,
        UNAVAILABLE,
        TECHNICAL_FAILURE;

        @JsonValue
        public String wireValue() {
            return switch (this) {
                case ACCEPTED -> "accepted";
                case REPLAYED -> "replayed";
                case REJECTED -> "rejected";
                case CONFLICT -> "conflict";
                case UNAVAILABLE -> "unavailable";
                case TECHNICAL_FAILURE -> "technical_failure";
            };
        }
    }

    public SubmissionResultV1 {
        if (outcome == null) throw new IllegalArgumentException("outcome required");
        if ((outcome == Outcome.ACCEPTED || outcome == Outcome.REPLAYED) != (receipt != null)) {
            throw new IllegalArgumentException("receipt is only allowed for accepted/replayed");
        }
        if (code == null || code.isBlank()) throw new IllegalArgumentException("code required");
    }

    public static SubmissionResultV1 accepted(VisitReceiptV1 receipt) {
        return new SubmissionResultV1(Outcome.ACCEPTED, "ACCEPTED", receipt);
    }

    public static SubmissionResultV1 replayed(VisitReceiptV1 receipt) {
        return new SubmissionResultV1(Outcome.REPLAYED, "REPLAYED", receipt);
    }

    public static SubmissionResultV1 rejected(String code) {
        return new SubmissionResultV1(Outcome.REJECTED, code, null);
    }

    public static SubmissionResultV1 conflict() {
        return new SubmissionResultV1(Outcome.CONFLICT, "IDEMPOTENCY_CONFLICT", null);
    }

    public static SubmissionResultV1 unavailable() {
        return new SubmissionResultV1(Outcome.UNAVAILABLE, "SERVICE_UNAVAILABLE", null);
    }

    public static SubmissionResultV1 technicalFailure() {
        return new SubmissionResultV1(Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);
    }
}
