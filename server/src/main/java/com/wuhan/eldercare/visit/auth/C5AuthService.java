package com.wuhan.eldercare.visit.auth;

import java.time.Clock;
import java.time.Duration;

/** Orchestrates provider exchange, opaque identity mapping and self-owned session issuance. */
public final class C5AuthService {
    private final WeChatAuthProvider provider;
    private final ProviderSubjectHasher subjectHasher;
    private final SessionEvidenceHasher sessionHasher;
    private final AuthIdentitySessionRepository repository;
    private final ServerSessionEvidenceSource sessionSource;
    private final Clock clock;
    private final Duration sessionTtl;

    public C5AuthService(
            WeChatAuthProvider provider,
            ProviderSubjectHasher subjectHasher,
            SessionEvidenceHasher sessionHasher,
            AuthIdentitySessionRepository repository,
            ServerSessionEvidenceSource sessionSource,
            Clock clock,
            Duration sessionTtl
    ) {
        this.provider = provider;
        this.subjectHasher = subjectHasher;
        this.sessionHasher = sessionHasher;
        this.repository = repository;
        this.sessionSource = sessionSource;
        this.clock = clock;
        this.sessionTtl = sessionTtl;
    }

    public AuthResultV1 authenticate(WeChatAuthRequestV1 request) {
        if (request == null || !request.isValid()) return AuthResultV1.invalid("AUTH_REQUEST_INVALID");
        WeChatAuthProvider.ExchangeResult exchange;
        try {
            exchange = provider.exchange(request.loginCode());
        } catch (RuntimeException ignored) {
            return AuthResultV1.technicalFailure();
        }
        if (exchange == null) return AuthResultV1.technicalFailure();
        if (exchange.status() != WeChatAuthProvider.ExchangeResult.Status.AUTHENTICATED) {
            return mapProvider(exchange.status());
        }

        java.util.Optional<String> subjectDigest;
        try {
            subjectDigest = subjectHasher.digest(exchange.providerNamespace(), exchange.providerSubject());
        } catch (RuntimeException ignored) {
            return AuthResultV1.technicalFailure();
        }
        if (subjectDigest == null || subjectDigest.isEmpty()) return AuthResultV1.unavailable();
        var issuedAt = clock.instant();
        var expiresAt = issuedAt.plus(sessionTtl);
        for (int attempt = 0; attempt < 3; attempt++) {
            String sessionEvidence;
            java.util.Optional<String> digest;
            try {
                sessionEvidence = sessionSource.newSessionEvidence();
                digest = sessionHasher.digest(sessionEvidence);
            } catch (RuntimeException ignored) {
                return AuthResultV1.technicalFailure();
            }
            if (digest == null || digest.isEmpty()) return AuthResultV1.technicalFailure();
            AuthIdentitySessionRepository.LoginResult issued;
            try {
                issued = repository.createOrLogin(exchange.providerNamespace(), subjectDigest.get(),
                        digest.get(), issuedAt, expiresAt);
            } catch (RuntimeException ignored) {
                return AuthResultV1.technicalFailure();
            }
            if (issued == null) return AuthResultV1.technicalFailure();
            if (issued.status() == AuthIdentitySessionRepository.LoginResult.Status.ISSUED) {
                return AuthResultV1.authenticated(sessionEvidence, expiresAt);
            }
            if (issued.status() == AuthIdentitySessionRepository.LoginResult.Status.UNAVAILABLE) {
                return AuthResultV1.unavailable();
            }
            if (issued.status() != AuthIdentitySessionRepository.LoginResult.Status.SESSION_COLLISION) {
                return AuthResultV1.technicalFailure();
            }
            // The repository rolled back the entire attempt, so a new token is safe to retry.
        }
        return AuthResultV1.technicalFailure();
    }

    public AuthIdentitySessionRepository.RevokeResult revoke(String sessionEvidence) {
        java.util.Optional<String> digest;
        try {
            digest = sessionHasher.digest(sessionEvidence);
        } catch (RuntimeException ignored) {
            return new AuthIdentitySessionRepository.RevokeResult(
                    AuthIdentitySessionRepository.RevokeResult.Status.TECHNICAL_FAILURE);
        }
        if (digest == null || digest.isEmpty()) return new AuthIdentitySessionRepository.RevokeResult(
                AuthIdentitySessionRepository.RevokeResult.Status.UNKNOWN);
        try {
            return repository.revokeSession(digest.get(), clock.instant());
        } catch (RuntimeException ignored) {
            return new AuthIdentitySessionRepository.RevokeResult(
                    AuthIdentitySessionRepository.RevokeResult.Status.TECHNICAL_FAILURE);
        }
    }

    private static AuthResultV1 mapProvider(WeChatAuthProvider.ExchangeResult.Status status) {
        return switch (status) {
            case INVALID -> AuthResultV1.invalid("AUTH_EVIDENCE_INVALID");
            case UNAVAILABLE -> AuthResultV1.unavailable();
            case TECHNICAL_FAILURE -> AuthResultV1.technicalFailure();
            case AUTHENTICATED -> throw new IllegalStateException("authenticated is not a failure");
        };
    }

}
