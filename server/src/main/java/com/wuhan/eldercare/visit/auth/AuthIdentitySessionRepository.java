package com.wuhan.eldercare.visit.auth;

import java.sql.Connection;
import java.time.Instant;

/** Durable identity/session truth port. All provider and token material is already digested. */
public interface AuthIdentitySessionRepository {
    /** Creates or finds the identity and issues its session in one durable transaction. */
    LoginResult createOrLogin(String providerNamespace, String providerSubjectDigest,
                              String sessionDigest, Instant issuedAt, Instant expiresAt);

    SessionResolution resolveSession(String sessionDigest, Instant now);

    /** Resolves the active session on the caller's transaction and holds the row lock until commit. */
    default SessionResolution resolveSession(Connection connection, String sessionDigest, Instant now) {
        return resolveSession(sessionDigest, now);
    }

    default boolean supportsTransactionalSessionResolution() { return false; }

    RevokeResult revokeSession(String sessionDigest, Instant revokedAt);

    record LoginResult(Status status) {
        public enum Status { ISSUED, SESSION_COLLISION, UNAVAILABLE, TECHNICAL_FAILURE }

        public LoginResult {
            if (status == null) throw new IllegalArgumentException("status required");
        }
    }

    record SessionResolution(Status status, String userId) {
        public enum Status { ACTIVE, EXPIRED, REVOKED, UNKNOWN, UNAVAILABLE, TECHNICAL_FAILURE }

        public SessionResolution {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.ACTIVE) != (userId != null && !userId.isBlank())) {
                throw new IllegalArgumentException("user id only belongs to active session");
            }
        }
    }

    record RevokeResult(Status status) {
        public enum Status { REVOKED, UNKNOWN, UNAVAILABLE, TECHNICAL_FAILURE }

        public RevokeResult {
            if (status == null) throw new IllegalArgumentException("status required");
        }
    }
}
