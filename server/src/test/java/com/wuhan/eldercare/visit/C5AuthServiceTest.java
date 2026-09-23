package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.AuthResultV1;
import com.wuhan.eldercare.visit.auth.C5AuthService;
import com.wuhan.eldercare.visit.auth.HmacProviderSubjectHasher;
import com.wuhan.eldercare.visit.auth.ProviderSubjectHasher;
import com.wuhan.eldercare.visit.auth.ServerSessionEvidenceSource;
import com.wuhan.eldercare.visit.auth.SessionEvidenceHasher;
import com.wuhan.eldercare.visit.auth.Sha256SessionEvidenceHasher;
import com.wuhan.eldercare.visit.auth.WeChatAuthProvider;
import com.wuhan.eldercare.visit.auth.WeChatAuthRequestV1;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class C5AuthServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-18T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void firstLoginCreatesOpaqueIdentityAndSessionWithoutLeakingProviderSubject() {
        FakeRepository repository = new FakeRepository();
        C5AuthService service = service(
                code -> WeChatAuthProvider.ExchangeResult.authenticated("wechat:test-app", "openid-raw"),
                repository,
                () -> "session-secret-evidence"
        );

        AuthResultV1 result = service.authenticate(request("code-1"));

        assertEquals(AuthResultV1.Outcome.AUTHENTICATED, result.outcome());
        assertNotNull(result.sessionEvidence());
        assertNotEquals("openid-raw", result.sessionEvidence());
        assertEquals(1, repository.identityCalls);
        assertEquals(1, repository.sessionCalls);
        assertEquals("usr-test-1", repository.userId);
        assertFalse(repository.storedIdentityDigest.contains("openid-raw"));
    }

    @Test
    void sameProviderSubjectMapsToExistingIdentity() {
        FakeRepository repository = new FakeRepository();
        C5AuthService service = service(
                code -> WeChatAuthProvider.ExchangeResult.authenticated("wechat:test-app", "openid-raw"),
                repository,
                new SequenceSessionSource("session-one", "session-two")
        );

        AuthResultV1 first = service.authenticate(request("code-1"));
        AuthResultV1 second = service.authenticate(request("code-2"));

        assertEquals(AuthResultV1.Outcome.AUTHENTICATED, first.outcome());
        assertEquals(AuthResultV1.Outcome.AUTHENTICATED, second.outcome());
        assertEquals(2, repository.identityCalls);
        assertEquals(1, repository.createdIdentityCalls);
        assertEquals(2, repository.sessionCalls);
    }

    @Test
    void invalidProviderAndProviderFailureFailClosed() {
        FakeRepository repository = new FakeRepository();
        C5AuthService invalid = service(code -> WeChatAuthProvider.ExchangeResult.failure(
                WeChatAuthProvider.ExchangeResult.Status.INVALID), repository, () -> "unused");
        C5AuthService unavailable = service(code -> WeChatAuthProvider.ExchangeResult.failure(
                WeChatAuthProvider.ExchangeResult.Status.UNAVAILABLE), repository, () -> "unused");

        assertEquals(AuthResultV1.Outcome.INVALID, invalid.authenticate(request("bad")).outcome());
        assertEquals(AuthResultV1.Outcome.UNAVAILABLE, unavailable.authenticate(request("down")).outcome());
        assertEquals(0, repository.identityCalls);
        assertEquals(0, repository.sessionCalls);
    }

    @Test
    void invalidRequestDoesNotCallProvider() {
        FakeRepository repository = new FakeRepository();
        int[] calls = {0};
        C5AuthService service = service(code -> {
            calls[0]++;
            return WeChatAuthProvider.ExchangeResult.authenticated("wechat:test-app", "subject");
        }, repository, () -> "unused");

        assertEquals(AuthResultV1.Outcome.INVALID, service.authenticate(null).outcome());
        assertEquals(0, calls[0]);
        assertEquals(AuthResultV1.Outcome.INVALID, service.authenticate(
                new WeChatAuthRequestV1("wrong", "wrong", "code")).outcome());
        assertEquals(0, calls[0]);
    }

    @Test
    void repositoryFailureNeverReturnsSessionEvidence() {
        FakeRepository repository = new FakeRepository();
        repository.loginStatus = AuthIdentitySessionRepository.LoginResult.Status.UNAVAILABLE;
        C5AuthService service = service(
                code -> WeChatAuthProvider.ExchangeResult.authenticated("wechat:test-app", "subject"),
                repository,
                () -> "session"
        );

        AuthResultV1 result = service.authenticate(request("code"));
        assertEquals(AuthResultV1.Outcome.UNAVAILABLE, result.outcome());
        assertEquals(null, result.sessionEvidence());
    }

    @Test
    void failedAtomicLoginLeavesNoIdentityAndNoSession() {
        FakeRepository repository = new FakeRepository();
        repository.loginStatus = AuthIdentitySessionRepository.LoginResult.Status.UNAVAILABLE;
        C5AuthService service = service(
                code -> WeChatAuthProvider.ExchangeResult.authenticated("wechat:test-app", "subject"),
                repository, () -> "session");

        AuthResultV1 result = service.authenticate(request("code"));
        assertEquals(AuthResultV1.Outcome.UNAVAILABLE, result.outcome());
        assertEquals(0, repository.identities.size());
        assertEquals(0, repository.sessionCalls);
        assertEquals(null, result.sessionEvidence());
    }

    private C5AuthService service(
            WeChatAuthProvider provider,
            FakeRepository repository,
            ServerSessionEvidenceSource sessionSource
    ) {
        ProviderSubjectHasher subjectHasher = new HmacProviderSubjectHasher("test-only-hash-secret");
        SessionEvidenceHasher sessionHasher = new Sha256SessionEvidenceHasher();
        return new C5AuthService(provider, subjectHasher, sessionHasher, repository, sessionSource,
                clock, Duration.ofHours(2));
    }

    private static WeChatAuthRequestV1 request(String code) {
        return new WeChatAuthRequestV1(
                "wechat-authenticated-principal-contract-v1",
                "wechat_authentication_request_v1",
                code);
    }

    private static final class SequenceSessionSource implements ServerSessionEvidenceSource {
        private final String[] values;
        private int index;

        private SequenceSessionSource(String... values) {
            this.values = values;
        }

        @Override
        public String newSessionEvidence() {
            return values[Math.min(index++, values.length - 1)];
        }
    }

    private static final class FakeRepository implements AuthIdentitySessionRepository {
        private final Map<String, String> identities = new HashMap<>();
        private String userId;
        private String storedIdentityDigest = "";
        private int identityCalls;
        private int createdIdentityCalls;
        private int sessionCalls;
        private LoginResult.Status loginStatus = LoginResult.Status.ISSUED;

        @Override
        public LoginResult createOrLogin(String providerNamespace, String providerSubjectDigest,
                                         String sessionDigest, Instant issuedAt, Instant expiresAt) {
            if (loginStatus != LoginResult.Status.ISSUED) return new LoginResult(loginStatus);
            identityCalls++;
            String key = providerNamespace + "\u0000" + providerSubjectDigest;
            if (!identities.containsKey(key)) {
                userId = "usr-test-1";
                storedIdentityDigest = providerSubjectDigest;
                identities.put(key, userId);
                createdIdentityCalls++;
            }
            sessionCalls++;
            return new LoginResult(LoginResult.Status.ISSUED);
        }

        @Override
        public SessionResolution resolveSession(String sessionDigest, Instant now) {
            return new SessionResolution(SessionResolution.Status.UNKNOWN, null);
        }

        @Override
        public RevokeResult revokeSession(String sessionDigest, Instant revokedAt) {
            return new RevokeResult(RevokeResult.Status.UNKNOWN);
        }
    }
}
