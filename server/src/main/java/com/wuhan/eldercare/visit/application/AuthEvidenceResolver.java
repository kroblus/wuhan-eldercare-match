package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

public interface AuthEvidenceResolver {
    Resolution resolve(String opaqueEvidence);

    record Resolution(Status status, TrustedPrincipal principal) {
        public enum Status {
            AUTHENTICATED,
            MISSING,
            EXPIRED,
            INVALID,
            UNAVAILABLE,
            TECHNICAL_FAILURE
        }

        public Resolution {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.AUTHENTICATED) != (principal != null)) {
                throw new IllegalArgumentException("principal only belongs to authenticated result");
            }
        }

        public static Resolution authenticated(TrustedPrincipal principal) {
            return new Resolution(Status.AUTHENTICATED, principal);
        }

        public static Resolution failure(Status status) {
            return new Resolution(status, null);
        }
    }
}
