package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.PurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.WeChatPurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.auth.UnavailablePhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.auth.WeChatHttpPhoneAuthorizationProvider;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.time.Clock;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class C6PhoneAuthorizationConfigurationTest {
    private final C6PhoneAuthorizationConfiguration configuration = new C6PhoneAuthorizationConfiguration();

    @Test
    void completeCanonicalProductionConfigSelectsOnlyRealWeChatProvider() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("c5.auth.enabled", "true")
                .withProperty("c4.persistence.enabled", "true")
                .withProperty("C5_WECHAT_APP_ID", "test-app")
                .withProperty("C5_WECHAT_APP_SECRET", "test-app-secret-" + UUID.randomUUID())
                .withProperty("C5_AUTH_HASH_SECRET", "test-hash-secret-" + UUID.randomUUID());

        PhoneAuthorizationProvider provider = configuration.c6PhoneAuthorizationProvider(
                environment, new ObjectMapper(), Clock.systemUTC());
        PurposeBoundContactVerifier verifier = configuration.c6PurposeBoundContactVerifier(provider);

        assertInstanceOf(WeChatHttpPhoneAuthorizationProvider.class, provider);
        assertInstanceOf(WeChatPurposeBoundContactVerifier.class, verifier);
        assertEquals(WeChatHttpPhoneAuthorizationProvider.class, provider.getClass());
    }

    @Test
    void missingProductionPrerequisiteSelectsFailClosedProvider() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("c5.auth.enabled", "true")
                .withProperty("c4.persistence.enabled", "true")
                .withProperty("C5_WECHAT_APP_ID", "test-app")
                .withProperty("C5_WECHAT_APP_SECRET", "test-app-secret-" + UUID.randomUUID());

        PhoneAuthorizationProvider provider = configuration.c6PhoneAuthorizationProvider(
                environment, new ObjectMapper(), Clock.systemUTC());

        assertInstanceOf(UnavailablePhoneAuthorizationProvider.class, provider);
        assertEquals(PhoneAuthorizationProvider.ExchangeResult.Status.UNAVAILABLE,
                provider.exchange("test-phone-code-" + UUID.randomUUID()).status());
    }

    @Test
    void disabledPersistenceNeverSelectsRealPhoneProvider() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("c5.auth.enabled", "true")
                .withProperty("c4.persistence.enabled", "false")
                .withProperty("C5_WECHAT_APP_ID", "test-app")
                .withProperty("C5_WECHAT_APP_SECRET", "test-app-secret-" + UUID.randomUUID())
                .withProperty("C5_AUTH_HASH_SECRET", "test-hash-secret-" + UUID.randomUUID());

        PhoneAuthorizationProvider provider = configuration.c6PhoneAuthorizationProvider(
                environment, new ObjectMapper(), Clock.systemUTC());

        assertInstanceOf(UnavailablePhoneAuthorizationProvider.class, provider);
    }
}
