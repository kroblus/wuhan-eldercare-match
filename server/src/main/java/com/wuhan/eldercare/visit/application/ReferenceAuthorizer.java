package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import java.sql.Connection;

public interface ReferenceAuthorizer {
    Authorization authorize(TrustedPrincipal principal, String elderId, String institutionId, String institutionRecordRevision);

    /** Transaction-scoped authorization; the returned Elder ID is always server-resolved. */
    default Resolution authorize(Connection connection, TrustedPrincipal principal, String elderId,
                                 String institutionId, String institutionRecordRevision) {
        Authorization authorization = authorize(principal, elderId, institutionId, institutionRecordRevision);
        if (authorization == Authorization.AUTHORIZED && elderId != null && !elderId.isBlank()) {
            return Resolution.authorized(elderId);
        }
        return Resolution.of(authorization == Authorization.AUTHORIZED ? Authorization.INVALID : authorization);
    }

    default boolean supportsTransactionalAuthorization() { return false; }

    record Resolution(Authorization status, String elderId) {
        public Resolution {
            if (status == null || ((status == Authorization.AUTHORIZED) != (elderId != null && !elderId.isBlank()))) {
                throw new IllegalArgumentException("canonical Elder ID belongs only to authorized resolution");
            }
        }

        public static Resolution authorized(String elderId) {
            return new Resolution(Authorization.AUTHORIZED, elderId);
        }

        public static Resolution of(Authorization status) {
            return new Resolution(status, null);
        }
    }

    enum Authorization {
        AUTHORIZED,
        UNAUTHORIZED,
        INVALID,
        UNAVAILABLE,
        TECHNICAL_FAILURE
    }
}
