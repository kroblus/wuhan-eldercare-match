package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.C5AuthService;
import com.wuhan.eldercare.visit.auth.HmacProviderSubjectHasher;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.ProviderSubjectHasher;
import com.wuhan.eldercare.visit.auth.ServerOpaquePrincipalSource;
import com.wuhan.eldercare.visit.auth.ServerSessionEvidenceSource;
import com.wuhan.eldercare.visit.auth.SessionEvidenceHasher;
import com.wuhan.eldercare.visit.auth.Sha256SessionEvidenceHasher;
import com.wuhan.eldercare.visit.auth.UnavailableAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.UnavailableWeChatAuthProvider;
import com.wuhan.eldercare.visit.auth.WeChatAuthProvider;
import com.wuhan.eldercare.visit.auth.WeChatHttpAuthProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;

@Configuration
public class C5AuthConfiguration {
    @Bean
    Clock c5Clock() {
        return Clock.systemUTC();
    }

    @Bean
    SessionEvidenceHasher c5SessionEvidenceHasher() {
        return new Sha256SessionEvidenceHasher();
    }

    @Bean
    ServerOpaquePrincipalSource c5PrincipalSource() {
        return ServerOpaquePrincipalSource.production();
    }

    @Bean
    ServerSessionEvidenceSource c5SessionEvidenceSource() {
        return ServerSessionEvidenceSource.production();
    }

    @Bean
    ProviderSubjectHasher c5ProviderSubjectHasher(Environment environment) {
        String secret = configuredValue(environment,
                "C5_AUTH_HASH_SECRET", "c5.auth.identity-hash-secret");
        return secret == null || secret.isBlank()
                ? (namespace, subject) -> java.util.Optional.empty()
                : new HmacProviderSubjectHasher(secret);
    }

    @Bean
    WeChatAuthProvider c5WeChatAuthProvider(Environment environment, ObjectMapper objectMapper) {
        boolean enabled = environment.getProperty("c5.auth.enabled", Boolean.class, false);
        boolean persistenceEnabled = environment.getProperty("c4.persistence.enabled", Boolean.class, false);
        String appId = configuredValue(environment, "C5_WECHAT_APP_ID", "c5.auth.app-id");
        String appSecret = configuredValue(environment, "C5_WECHAT_APP_SECRET", "c5.auth.app-secret");
        String hashSecret = configuredValue(environment,
                "C5_AUTH_HASH_SECRET", "c5.auth.identity-hash-secret");
        if (!enabled || !persistenceEnabled || blank(appId) || blank(appSecret) || blank(hashSecret)) {
            return new UnavailableWeChatAuthProvider();
        }
        return new WeChatHttpAuthProvider(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).build(), objectMapper,
                appId, appSecret, URI.create("https://api.weixin.qq.com/sns/jscode2session"));
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(AuthIdentitySessionRepository.class)
    AuthIdentitySessionRepository jdbcAuthIdentitySessionRepository(
            DataSource dataSource,
            ServerOpaquePrincipalSource principalSource
    ) {
        return new JdbcAuthIdentitySessionRepository(dataSource, principalSource);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(AuthIdentitySessionRepository.class)
    AuthIdentitySessionRepository unavailableAuthIdentitySessionRepository() {
        return new UnavailableAuthIdentitySessionRepository();
    }

    @Bean
    @Primary
    AuthEvidenceResolver c5AuthEvidenceResolver(
            AuthIdentitySessionRepository repository,
            SessionEvidenceHasher sessionEvidenceHasher,
            Clock c5Clock
    ) {
        return new C5AuthEvidenceResolver(repository, sessionEvidenceHasher, c5Clock);
    }

    @Bean
    C5AuthService c5AuthService(
            WeChatAuthProvider provider,
            ProviderSubjectHasher subjectHasher,
            SessionEvidenceHasher sessionHasher,
            AuthIdentitySessionRepository repository,
            ServerSessionEvidenceSource sessionSource,
            Clock c5Clock,
            Environment environment
    ) {
        long ttlSeconds = environment.getProperty("c5.auth.session-ttl-seconds", Long.class, 7200L);
        if (ttlSeconds < 60L || ttlSeconds > 2_592_000L) ttlSeconds = 7200L;
        return new C5AuthService(provider, subjectHasher, sessionHasher, repository,
                sessionSource, c5Clock, Duration.ofSeconds(ttlSeconds));
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String configuredValue(Environment environment, String externalName, String propertyName) {
        // Prefer application.yml's documented external key over relaxed-binding legacy aliases.
        String externalValue = environment.getProperty(externalName);
        return externalValue != null ? externalValue : environment.getProperty(propertyName);
    }
}
