package com.wuhan.eldercare.visit.auth;

import java.time.Instant;

/** Stable public authentication result. Provider fields never cross this type. */
public record AuthResultV1(
        String contractVersion,
        String kind,
        Outcome outcome,
        String code,
        String sessionEvidence,
        Instant expiresAt
) {
    public enum Outcome {
        AUTHENTICATED,
        INVALID,
        UNAVAILABLE,
        TECHNICAL_FAILURE
    }

    public AuthResultV1 {
        if (!AuthContractV1.CONTRACT_VERSION.equals(contractVersion)) {
            throw new IllegalArgumentException("invalid auth contract version");
        }
        if (!AuthContractV1.RESULT_KIND.equals(kind)) {
            throw new IllegalArgumentException("invalid auth result kind");
        }
        if (outcome == null || code == null || code.isBlank()) {
            throw new IllegalArgumentException("auth result fields required");
        }
        if ((outcome == Outcome.AUTHENTICATED) != (sessionEvidence != null && expiresAt != null)) {
            throw new IllegalArgumentException("session evidence only belongs to authenticated result");
        }
    }

    public static AuthResultV1 authenticated(String sessionEvidence, Instant expiresAt) {
        return new AuthResultV1(AuthContractV1.CONTRACT_VERSION, AuthContractV1.RESULT_KIND,
                Outcome.AUTHENTICATED, "AUTHENTICATED", sessionEvidence, expiresAt);
    }

    public static AuthResultV1 invalid(String code) {
        return failure(Outcome.INVALID, code);
    }

    public static AuthResultV1 unavailable() {
        return failure(Outcome.UNAVAILABLE, "SERVICE_UNAVAILABLE");
    }

    public static AuthResultV1 technicalFailure() {
        return failure(Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
    }

    private static AuthResultV1 failure(Outcome outcome, String code) {
        return new AuthResultV1(AuthContractV1.CONTRACT_VERSION, AuthContractV1.RESULT_KIND,
                outcome, code, null, null);
    }
}
