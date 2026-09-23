package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.HmacProviderSubjectHasher;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.ServerOpaquePrincipalSource;
import com.wuhan.eldercare.visit.auth.Sha256SessionEvidenceHasher;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Real MySQL evidence for C5 durable identity/session truth. The class is
 * skipped unless a disposable database is explicitly supplied through either
 * C5_MYSQL_* or the existing C4_MYSQL_* environment variables.
 */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JdbcAuthIdentitySessionRepositoryIntegrationTest {
    private static final Instant NOW = Instant.parse("2026-09-18T00:00:00Z");

    private HikariDataSource dataSource;
    private JdbcAuthIdentitySessionRepository repository;
    private final AtomicInteger userSequence = new AtomicInteger();
    private final HmacProviderSubjectHasher subjectHasher = new HmacProviderSubjectHasher("c5-test-only-hash-secret");
    private final Sha256SessionEvidenceHasher sessionHasher = new Sha256SessionEvidenceHasher();

    @BeforeAll
    void migrateDisposableDatabase() {
        String url = env("C5_MYSQL_URL", "C4_MYSQL_URL");
        String username = env("C5_MYSQL_USERNAME", "C4_MYSQL_USERNAME");
        assumeTrue(url != null && !url.isBlank(), "C5_MYSQL_URL or C4_MYSQL_URL is required for real MySQL evidence");
        assumeTrue(username != null && !username.isBlank(), "C5_MYSQL_USERNAME or C4_MYSQL_USERNAME is required for real MySQL evidence");

        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(envOrEmpty("C5_MYSQL_PASSWORD", "C4_MYSQL_PASSWORD"));
        dataSource.setMaximumPoolSize(16);
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        repository = new JdbcAuthIdentitySessionRepository(dataSource, () -> "usr_c5_test_" + userSequence.incrementAndGet());
    }

    @BeforeEach
    void clearAuthTables() throws SQLException {
        assumeTrue(dataSource != null && !dataSource.isClosed(), "real MySQL evidence is not configured");
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM auth_session_v1");
            statement.executeUpdate("DELETE FROM auth_provider_identity_v1");
        }
    }

    @AfterAll
    void closeDataSource() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void migrationCreatesIdentityAndSessionTables() throws SQLException {
        assertEquals(1, tableCount("auth_provider_identity_v1"));
        assertEquals(1, tableCount("auth_session_v1"));
    }

    @Test
    void firstMappingIsDurableAndRepeatedMappingReturnsSameOpaqueUserId() throws SQLException {
        String digest = subjectDigest("openid-durable");
        String firstSession = sessionDigest("durable-session-one");
        String secondSession = sessionDigest("durable-session-two");

        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                repository.createOrLogin("wechat:test-app", digest, firstSession,
                        NOW, NOW.plusSeconds(3600)).status());
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                repository.createOrLogin("wechat:test-app", digest, secondSession,
                        NOW, NOW.plusSeconds(3600)).status());

        String userId = repository.resolveSession(firstSession, NOW).userId();
        assertEquals(userId, repository.resolveSession(secondSession, NOW).userId());
        assertEquals(1, rowCount("auth_provider_identity_v1"));
        assertEquals(2, rowCount("auth_session_v1"));
        assertTrue(!userId.equals("openid-durable"));
    }

    @Test
    void sessionsAreActiveExpiredRevokedOrUnknownByServerTime() {
        String subject = subjectDigest("openid-session");
        String activeDigest = sessionDigest("session-active");
        String expiredDigest = sessionDigest("session-expired");
        String revokedDigest = sessionDigest("session-revoked");

        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                repository.createOrLogin("wechat:test-app", subject, activeDigest,
                        NOW.minusSeconds(1), NOW.plusSeconds(3600)).status());
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                repository.createOrLogin("wechat:test-app", subject, expiredDigest,
                        NOW.minusSeconds(3600), NOW.minusSeconds(1)).status());
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                repository.createOrLogin("wechat:test-app", subject, revokedDigest,
                        NOW.minusSeconds(1), NOW.plusSeconds(3600)).status());

        assertEquals(AuthIdentitySessionRepository.SessionResolution.Status.ACTIVE,
                repository.resolveSession(activeDigest, NOW).status());
        assertEquals(AuthIdentitySessionRepository.SessionResolution.Status.EXPIRED,
                repository.resolveSession(expiredDigest, NOW).status());
        assertEquals(AuthIdentitySessionRepository.RevokeResult.Status.REVOKED,
                repository.revokeSession(revokedDigest, NOW).status());
        assertEquals(AuthIdentitySessionRepository.SessionResolution.Status.REVOKED,
                repository.resolveSession(revokedDigest, NOW).status());
        assertEquals(AuthIdentitySessionRepository.SessionResolution.Status.UNKNOWN,
                repository.resolveSession(sessionDigest("unknown"), NOW).status());
    }

    @Test
    void duplicateSessionDigestIsRejectedByDurableUniqueBoundary() throws SQLException {
        String subject = subjectDigest("openid-unique");
        String digest = sessionDigest("same-session");

        AuthIdentitySessionRepository.LoginResult first = repository.createOrLogin(
                "wechat:test-app", subject, digest, NOW, NOW.plusSeconds(3600));
        AuthIdentitySessionRepository.LoginResult duplicate = repository.createOrLogin(
                "wechat:test-app", subject, digest, NOW, NOW.plusSeconds(3600));

        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED, first.status());
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.SESSION_COLLISION, duplicate.status());
        assertEquals(1, rowCount("auth_session_v1"));
    }

    @Test
    void failedSessionInsertRollsBackNewIdentity() throws SQLException {
        String usedDigest = sessionDigest("already-issued-session");
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                repository.createOrLogin("wechat:test-app", subjectDigest("first-user"), usedDigest,
                        NOW, NOW.plusSeconds(3600)).status());

        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.SESSION_COLLISION,
                repository.createOrLogin("wechat:test-app", subjectDigest("second-user"), usedDigest,
                        NOW, NOW.plusSeconds(3600)).status());
        assertEquals(1, rowCount("auth_provider_identity_v1"));
        assertEquals(1, rowCount("auth_session_v1"));
    }

    @Test
    void concurrentAtomicLoginsConvergeOnOneIdentityAndIssueEverySession() throws Exception {
        int workers = 8;
        String digest = subjectDigest("atomic-concurrent-user");
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        List<Future<AuthIdentitySessionRepository.LoginResult>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < workers; i++) {
                final String session = sessionDigest("atomic-session-" + i);
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    assertTrue(start.await(10, TimeUnit.SECONDS));
                    return repository.createOrLogin("wechat:test-app", digest, session,
                            NOW, NOW.plusSeconds(3600));
                }));
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            for (Future<AuthIdentitySessionRepository.LoginResult> future : futures) {
                assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                        future.get(20, TimeUnit.SECONDS).status());
            }
            assertEquals(1, rowCount("auth_provider_identity_v1"));
            assertEquals(workers, rowCount("auth_session_v1"));
        } finally {
            executor.shutdownNow();
        }
    }

    private String subjectDigest(String subject) {
        return subjectHasher.digest("wechat:test-app", subject).orElseThrow();
    }

    private String sessionDigest(String evidence) {
        return sessionHasher.digest(evidence).orElseThrow();
    }

    private int rowCount(String table) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            result.next();
            return result.getInt(1);
        }
    }

    private int tableCount(String table) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM information_schema.tables "
                     + "WHERE table_schema = DATABASE() AND table_name = '" + table + "'")) {
            result.next();
            return result.getInt(1);
        }
    }

    private static String env(String preferred, String fallback) {
        String value = System.getenv(preferred);
        return value == null || value.isBlank() ? System.getenv(fallback) : value;
    }

    private static String envOrEmpty(String preferred, String fallback) {
        String value = env(preferred, fallback);
        return value == null ? "" : value;
    }
}
