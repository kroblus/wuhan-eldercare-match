package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.PrivateContact;

public interface PurposeBoundContactVerifier {
    Verification verify(String opaqueEvidence, String purpose, String contactName, String phone);

    record Verification(Status status, PrivateContact contact) {
        public enum Status {
            AUTHORIZED,
            MISSING,
            DECLINED,
            EXPIRED,
            INVALID,
            UNAVAILABLE,
            TECHNICAL_FAILURE
        }

        public Verification {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.AUTHORIZED) != (contact != null)) {
                throw new IllegalArgumentException("contact only belongs to authorized result");
            }
        }

        public static Verification authorized(PrivateContact contact) {
            return new Verification(Status.AUTHORIZED, contact);
        }

        public static Verification failure(Status status) {
            return new Verification(status, null);
        }
    }
}
