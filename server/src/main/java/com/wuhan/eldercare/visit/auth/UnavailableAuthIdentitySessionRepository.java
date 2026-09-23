package com.wuhan.eldercare.visit.auth;

import java.time.Instant;

public final class UnavailableAuthIdentitySessionRepository implements AuthIdentitySessionRepository {
    @Override
    public LoginResult createOrLogin(String providerNamespace, String providerSubjectDigest,
                                     String sessionDigest, Instant issuedAt, Instant expiresAt) {
        return new LoginResult(LoginResult.Status.UNAVAILABLE);
    }
    @Override
    public SessionResolution resolveSession(String sessionDigest, Instant now) {
        return new SessionResolution(SessionResolution.Status.UNAVAILABLE, null);
    }

    @Override
    public RevokeResult revokeSession(String sessionDigest, Instant revokedAt) {
        return new RevokeResult(RevokeResult.Status.UNAVAILABLE);
    }
}
