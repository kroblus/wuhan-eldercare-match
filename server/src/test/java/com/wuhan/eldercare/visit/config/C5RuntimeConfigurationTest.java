package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.HmacProviderSubjectHasher;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.ProviderSubjectHasher;
import com.wuhan.eldercare.visit.auth.UnavailableAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.UnavailableWeChatAuthProvider;
import com.wuhan.eldercare.visit.auth.WeChatAuthProvider;
import com.wuhan.eldercare.visit.auth.WeChatHttpAuthProvider;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

class C5RuntimeConfigurationTest {
    @Test
    void officialC5EnvironmentNamesTakePrecedenceOverImplicitLegacyAliases() throws Exception {
        ConfigurableEnvironment environment = applicationEnvironment(Map.ofEntries(
                Map.entry("C4_PERSISTENCE_ENABLED", "true"),
                Map.entry("C5_AUTH_ENABLED", "true"),
                Map.entry("C5_WECHAT_APP_ID", "canonical-app-id-test"),
                Map.entry("C5_WECHAT_APP_SECRET", "canonical-app-secret-test"),
                Map.entry("C5_AUTH_HASH_SECRET", "canonical-hash-secret-test"),
                Map.entry("C5_AUTH_APP_ID", "legacy-app-id-test"),
                Map.entry("C5_AUTH_APP_SECRET", "legacy-app-secret-test"),
                Map.entry("C5_AUTH_IDENTITY_HASH_SECRET", "legacy-hash-secret-test")
        ));
        C5AuthConfiguration configuration = new C5AuthConfiguration();

        assertEquals("legacy-app-id-test", environment.getProperty("c5.auth.app-id"));
        WeChatHttpAuthProvider provider = assertInstanceOf(WeChatHttpAuthProvider.class,
                configuration.c5WeChatAuthProvider(environment, new ObjectMapper()));
        assertEquals("canonical-app-id-test", field(provider, "appId"));
        assertEquals("canonical-app-secret-test", field(provider, "appSecret"));

        ProviderSubjectHasher hasher = configuration.c5ProviderSubjectHasher(environment);
        assertEquals(new HmacProviderSubjectHasher("canonical-hash-secret-test")
                        .digest("wechat:test", "subject-test"),
                hasher.digest("wechat:test", "subject-test"));
    }

    @Test
    void legacyC5AliasesRemainFallbackWhenOfficialNamesAreAbsent() throws Exception {
        ConfigurableEnvironment environment = applicationEnvironment(Map.of(
                "C4_PERSISTENCE_ENABLED", "true",
                "C5_AUTH_ENABLED", "true",
                "C5_AUTH_APP_ID", "legacy-app-id-test",
                "C5_AUTH_APP_SECRET", "legacy-app-secret-test",
                "C5_AUTH_IDENTITY_HASH_SECRET", "legacy-hash-secret-test"
        ));
        C5AuthConfiguration configuration = new C5AuthConfiguration();

        WeChatHttpAuthProvider provider = assertInstanceOf(WeChatHttpAuthProvider.class,
                configuration.c5WeChatAuthProvider(environment, new ObjectMapper()));
        assertEquals("legacy-app-id-test", field(provider, "appId"));
        assertEquals("legacy-app-secret-test", field(provider, "appSecret"));
        assertEquals(new HmacProviderSubjectHasher("legacy-hash-secret-test")
                        .digest("wechat:test", "subject-test"),
                configuration.c5ProviderSubjectHasher(environment).digest("wechat:test", "subject-test"));
    }

    @Test
    void enabledC5WithEnabledPersistenceAndMissingSecretSelectsUnavailableProvider() {
        runtimeContext("c5.auth.enabled=true", "c4.persistence.enabled=true",
                "c5.auth.app-id=app-id-test", "c5.auth.identity-hash-secret=hash-secret-test")
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    assertEquals(UnavailableWeChatAuthProvider.class,
                            context.getBean(WeChatAuthProvider.class).getClass());
                    assertEquals(JdbcAuthIdentitySessionRepository.class,
                            context.getBean(AuthIdentitySessionRepository.class).getClass());
                });
    }

    @Test
    void enabledC5WithDisabledPersistenceSelectsUnavailableProviderAndRepository() {
        runtimeContext("c5.auth.enabled=true", "c4.persistence.enabled=false",
                "c5.auth.app-id=app-id-test", "c5.auth.app-secret=app-secret-test",
                "c5.auth.identity-hash-secret=hash-secret-test")
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    assertEquals(UnavailableWeChatAuthProvider.class,
                            context.getBean(WeChatAuthProvider.class).getClass());
                    assertEquals(UnavailableAuthIdentitySessionRepository.class,
                            context.getBean(AuthIdentitySessionRepository.class).getClass());
                });
    }

    @Test
    void productionContextSelectsRealProviderAndJdbcRepositoryWithoutMocksOrDatabaseAccess() {
        runtimeContext("c5.auth.enabled=true", "c4.persistence.enabled=true",
                "c5.auth.app-id=app-id-test", "c5.auth.app-secret=app-secret-test",
                "c5.auth.identity-hash-secret=hash-secret-test")
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    WeChatAuthProvider provider = context.getBean(WeChatAuthProvider.class);
                    assertEquals(WeChatHttpAuthProvider.class, provider.getClass());
                    assertFalse(Mockito.mockingDetails(provider).isMock());
                    assertEquals(JdbcAuthIdentitySessionRepository.class,
                            context.getBean(AuthIdentitySessionRepository.class).getClass());
                });
    }

    @Test
    void c4MysqlPasswordIsPassedToHikariConfiguration() {
        ConfigurableEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().addFirst(new SystemEnvironmentPropertySource("testEnvironment",
                new HashMap<>(Map.of(
                        "C4_MYSQL_URL", "jdbc:mysql://localhost:3306/c4_test",
                        "C4_MYSQL_USERNAME", "c4_test_user",
                        "C4_MYSQL_PASSWORD", "c4-test-password-only"
                ))));

        try (HikariDataSource dataSource = (HikariDataSource)
                new PersistenceConfiguration().c4DataSource(environment)) {
            assertEquals("jdbc:mysql://localhost:3306/c4_test", dataSource.getJdbcUrl());
            assertEquals("c4_test_user", dataSource.getUsername());
            assertEquals("c4-test-password-only", dataSource.getPassword());
        }
    }

    @Test
    void c4MysqlPasswordMayBeEmpty() {
        ConfigurableEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().addFirst(new SystemEnvironmentPropertySource("testEnvironment",
                new HashMap<>(Map.of(
                        "C4_MYSQL_URL", "jdbc:mysql://localhost:3306/c4_test",
                        "C4_MYSQL_USERNAME", "c4_test_user"
                ))));

        try (HikariDataSource dataSource = (HikariDataSource)
                new PersistenceConfiguration().c4DataSource(environment)) {
            assertEquals("jdbc:mysql://localhost:3306/c4_test", dataSource.getJdbcUrl());
            assertEquals("c4_test_user", dataSource.getUsername());
            assertEquals("", dataSource.getPassword());
        }
    }

    private static ApplicationContextRunner runtimeContext(String... properties) {
        return new ApplicationContextRunner()
                .withUserConfiguration(C5AuthConfiguration.class)
                .withBean(ObjectMapper.class, ObjectMapper::new)
                .withBean(DataSource.class,
                        () -> new DriverManagerDataSource("jdbc:mysql://localhost:3306/c5_test",
                                "test-user", "test-pass"))
                .withPropertyValues(properties);
    }

    private static ConfigurableEnvironment applicationEnvironment(Map<String, String> environmentValues)
            throws Exception {
        ConfigurableEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        Map<String, Object> values = new HashMap<>(environmentValues);
        environment.getPropertySources().addFirst(new SystemEnvironmentPropertySource("testEnvironment", values));
        for (PropertySource<?> propertySource : new YamlPropertySourceLoader()
                .load("application.yml", new ClassPathResource("application.yml"))) {
            environment.getPropertySources().addLast(propertySource);
        }
        return environment;
    }

    private static String field(Object target, String name) throws ReflectiveOperationException {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(target);
    }
}
