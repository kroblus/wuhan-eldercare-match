package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.PhoneAuthorizationService;
import com.wuhan.eldercare.visit.application.PurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.WeChatPurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.auth.UnavailablePhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.auth.WeChatHttpPhoneAuthorizationProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;

@Configuration
public class C6PhoneAuthorizationConfiguration {
    @Bean
    PhoneAuthorizationProvider c6PhoneAuthorizationProvider(Environment environment, ObjectMapper objectMapper, Clock c5Clock) {
        boolean authEnabled = environment.getProperty("c5.auth.enabled", Boolean.class, false);
        boolean persistenceEnabled = environment.getProperty("c4.persistence.enabled", Boolean.class, false);
        String appId = configuredValue(environment, "C5_WECHAT_APP_ID", "c5.auth.app-id");
        String appSecret = configuredValue(environment, "C5_WECHAT_APP_SECRET", "c5.auth.app-secret");
        String hashSecret = configuredValue(environment, "C5_AUTH_HASH_SECRET", "c5.auth.identity-hash-secret");
        if (!authEnabled || !persistenceEnabled || blank(appId) || blank(appSecret) || blank(hashSecret)) {
            return new UnavailablePhoneAuthorizationProvider();
        }
        return new WeChatHttpPhoneAuthorizationProvider(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).build(), objectMapper, appId, appSecret, c5Clock);
    }

    @Bean
    @Primary
    PurposeBoundContactVerifier c6PurposeBoundContactVerifier(PhoneAuthorizationProvider provider) {
        return new WeChatPurposeBoundContactVerifier(provider);
    }

    @Bean
    PhoneAuthorizationService c6PhoneAuthorizationService(
            AuthEvidenceResolver authEvidenceResolver,
            PhoneAuthorizationProvider provider
    ) {
        return new PhoneAuthorizationService(authEvidenceResolver, provider);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String configuredValue(Environment environment, String externalName, String propertyName) {
        String externalValue = environment.getProperty(externalName);
        return externalValue != null ? externalValue : environment.getProperty(propertyName);
    }
}
