package com.wuhan.eldercare.visit.auth;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import java.time.Clock;

/** Resolves only self-owned sessions; provider evidence is never accepted here. */
public final class C5AuthEvidenceResolver implements AuthEvidenceResolver {
    private final AuthIdentitySessionRepository repository;
    private final SessionEvidenceHasher evidenceHasher;
    private final Clock clock;

    public C5AuthEvidenceResolver(
            AuthIdentitySessionRepository repository,
            SessionEvidenceHasher evidenceHasher,
            Clock clock
    ) {
        this.repository = repository;
        this.evidenceHasher = evidenceHasher;
        this.clock = clock;
    }

    @Override
    public Resolution resolve(String opaqueEvidence) {
        if (opaqueEvidence == null || opaqueEvidence.isBlank()) {
            return Resolution.failure(Resolution.Status.MISSING);
        }
        var digest = evidenceHasher.digest(opaqueEvidence);
        if (digest == null || digest.isEmpty()) return Resolution.failure(Resolution.Status.INVALID);
        AuthIdentitySessionRepository.SessionResolution resolution;
        try {
            resolution = repository.resolveSession(digest.get(), clock.instant());
        } catch (RuntimeException ignored) {
            return Resolution.failure(Resolution.Status.TECHNICAL_FAILURE);
        }
        if (resolution == null) return Resolution.failure(Resolution.Status.TECHNICAL_FAILURE);
        return switch (resolution.status()) {
            case ACTIVE -> {
                try {
                    yield Resolution.authenticated(new TrustedPrincipal(resolution.userId()));
                } catch (RuntimeException ignored) {
                    yield Resolution.failure(Resolution.Status.TECHNICAL_FAILURE);
                }
            }
            case EXPIRED -> Resolution.failure(Resolution.Status.EXPIRED);
            case REVOKED, UNKNOWN -> Resolution.failure(Resolution.Status.INVALID);
            case UNAVAILABLE -> Resolution.failure(Resolution.Status.UNAVAILABLE);
            case TECHNICAL_FAILURE -> Resolution.failure(Resolution.Status.TECHNICAL_FAILURE);
        };
    }
}
