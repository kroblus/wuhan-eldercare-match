package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.Sha256SessionEvidenceHasher;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;

class C5AuthEvidenceResolverTest {
    @Test
    void mapsActiveExpiredUnknownRevokedAndUnavailableSessionsToC3Taxonomy() {
        FakeRepository repository = new FakeRepository();
        C5AuthEvidenceResolver resolver = new C5AuthEvidenceResolver(repository, new Sha256SessionEvidenceHasher(),
                Clock.fixed(Instant.parse("2026-09-18T00:00:00Z"), ZoneOffset.UTC));

        repository.status = AuthIdentitySessionRepository.SessionResolution.Status.ACTIVE;
        assertEquals(AuthEvidenceResolver.Resolution.Status.AUTHENTICATED, resolver.resolve("active").status());
        assertEquals("usr-test", resolver.resolve("active").principal().userId());

        repository.status = AuthIdentitySessionRepository.SessionResolution.Status.EXPIRED;
        assertEquals(AuthEvidenceResolver.Resolution.Status.EXPIRED, resolver.resolve("expired").status());
        repository.status = AuthIdentitySessionRepository.SessionResolution.Status.REVOKED;
        assertEquals(AuthEvidenceResolver.Resolution.Status.INVALID, resolver.resolve("revoked").status());
        repository.status = AuthIdentitySessionRepository.SessionResolution.Status.UNKNOWN;
        assertEquals(AuthEvidenceResolver.Resolution.Status.INVALID, resolver.resolve("unknown").status());
        repository.status = AuthIdentitySessionRepository.SessionResolution.Status.UNAVAILABLE;
        assertEquals(AuthEvidenceResolver.Resolution.Status.UNAVAILABLE, resolver.resolve("down").status());
        assertEquals(AuthEvidenceResolver.Resolution.Status.MISSING, resolver.resolve(null).status());
    }

    @Test
    void malformedEvidenceFailsClosedBeforeRepository() {
        FakeRepository repository = new FakeRepository();
        C5AuthEvidenceResolver resolver = new C5AuthEvidenceResolver(repository, new Sha256SessionEvidenceHasher(),
                Clock.systemUTC());

        assertEquals(AuthEvidenceResolver.Resolution.Status.MISSING, resolver.resolve(" ").status());
        assertEquals(0, repository.calls);
    }

    private static final class FakeRepository implements AuthIdentitySessionRepository {
        private SessionResolution.Status status = SessionResolution.Status.UNKNOWN;
        private int calls;

        @Override
        public LoginResult createOrLogin(String providerNamespace, String providerSubjectDigest,
                                         String sessionDigest, Instant issuedAt, Instant expiresAt) {
            return new LoginResult(LoginResult.Status.UNAVAILABLE);
        }

        @Override
        public SessionResolution resolveSession(String sessionDigest, Instant now) {
            calls++;
            return status == SessionResolution.Status.ACTIVE
                    ? new SessionResolution(status, "usr-test")
                    : new SessionResolution(status, null);
        }

        @Override
        public RevokeResult revokeSession(String sessionDigest, Instant revokedAt) {
            return new RevokeResult(RevokeResult.Status.UNKNOWN);
        }
    }
}
