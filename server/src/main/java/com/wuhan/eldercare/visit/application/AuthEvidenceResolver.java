package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import java.sql.Connection;

public interface AuthEvidenceResolver {
    Resolution resolve(String opaqueEvidence);

    /** Revalidates evidence inside the caller's transaction when supported by the concrete authority. */
    default Resolution resolve(Connection connection, String opaqueEvidence) {
        return resolve(opaqueEvidence);
    }

    default boolean supportsTransactionalResolution() { return false; }

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
