package com.wuhan.eldercare.visit;

import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.application.ServerIdentitySource;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.persistence.JdbcVisitSubmissionRepository;
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
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Real MySQL evidence for migration, durable replay/conflict and the
 * concurrent same-key transaction boundary. It is skipped unless the caller
 * explicitly supplies a disposable integration database through C4_MYSQL_*.
 */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JdbcVisitSubmissionRepositoryIntegrationTest {
    private HikariDataSource dataSource;
    private JdbcVisitSubmissionRepository repository;
    private final AtomicLong idSequence = new AtomicLong();

    @BeforeAll
    void migrateDisposableDatabase() {
        String url = System.getenv("C4_MYSQL_URL");
        String username = System.getenv("C4_MYSQL_USERNAME");
        assumeTrue(url != null && !url.isBlank(), "C4_MYSQL_URL is required for real MySQL evidence");
        assumeTrue(username != null && !username.isBlank(), "C4_MYSQL_USERNAME is required for real MySQL evidence");

        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("C4_MYSQL_PASSWORD", ""));
        dataSource.setMaximumPoolSize(16);
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        repository = new JdbcVisitSubmissionRepository(dataSource, new ServerIdentitySource() {
            @Override
            public String newVisitId() {
                return "visit_test_" + idSequence.incrementAndGet();
            }

            @Override
            public Instant now() {
                return Instant.parse("2026-09-17T00:00:00Z").plusMillis(idSequence.get());
            }
        });
    }

    @BeforeEach
    void clearDatabase() throws SQLException {
        assumeTrue(dataSource != null && !dataSource.isClosed(), "real MySQL evidence is not configured");
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM appointment_idempotency_v1");
            statement.executeUpdate("DELETE FROM institution_visit_v1");
        }
    }

    @AfterAll
    void closeDataSource() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void migrationCreatesAuthoritativeTables() throws SQLException {
        assertEquals(1, tableCount("institution_visit_v1"));
        assertEquals(1, tableCount("appointment_idempotency_v1"));
    }

    @Test
    void sameOwnerKeyAndPayloadReplaysOriginalVisit() throws SQLException {
        TrustedPrincipal principal = new TrustedPrincipal("user-real-1");
        SubmissionCommandV1 command = TestFixtures.command("replay-key");
        PrivateContact contact = new PrivateContact(command.contactName(), command.phone());

        VisitSubmissionRepository.Result accepted = repository.createOrReplay(principal, command, contact);
        VisitSubmissionRepository.Result replayed = repository.createOrReplay(principal, command, contact);

        assertEquals(VisitSubmissionRepository.Result.Status.ACCEPTED, accepted.status());
        assertEquals(VisitSubmissionRepository.Result.Status.REPLAYED, replayed.status());
        assertEquals(accepted.candidate().visitId(), replayed.candidate().visitId());
        assertEquals(Instant.parse("2026-09-17T00:00:00Z").plusMillis(
                        Long.parseLong(accepted.candidate().visitId().substring("visit_test_".length()))),
                accepted.candidate().acceptedAt());
        assertEquals(accepted.candidate().acceptedAt(), replayed.candidate().acceptedAt());
        assertEquals(1, rowCount("institution_visit_v1"));
        assertEquals(1, rowCount("appointment_idempotency_v1"));
    }

    @Test
    void sameOwnerKeyChangedPayloadReturnsConflictWithoutSecondVisit() throws SQLException {
        TrustedPrincipal principal = new TrustedPrincipal("user-real-2");
        SubmissionCommandV1 first = TestFixtures.command("conflict-key");
        SubmissionCommandV1 changed = new SubmissionCommandV1(
                first.contractVersion(), first.kind(), first.idempotencyKey(), first.institutionId(),
                first.institutionRecordRevision(), first.elderId(), first.visitDate(),
                first.visitTimePreference(), first.participantCount(), first.pickupRequested(),
                first.contactName(), first.phone(), first.phonePurpose(), first.phoneAuthorization(),
                "changed payload");
        PrivateContact contact = new PrivateContact(first.contactName(), first.phone());

        VisitSubmissionRepository.Result accepted = repository.createOrReplay(principal, first, contact);
        VisitSubmissionRepository.Result conflict = repository.createOrReplay(principal, changed, contact);

        assertEquals(VisitSubmissionRepository.Result.Status.ACCEPTED, accepted.status());
        assertEquals(VisitSubmissionRepository.Result.Status.CONFLICT, conflict.status());
        assertEquals(1, rowCount("institution_visit_v1"));
    }

    @Test
    void distinctIdempotencyKeysCreateDistinctVisits() throws SQLException {
        TrustedPrincipal principal = new TrustedPrincipal("user-real-3");
        SubmissionCommandV1 first = TestFixtures.command("distinct-1");
        SubmissionCommandV1 second = TestFixtures.command("distinct-2");
        PrivateContact contact = new PrivateContact(first.contactName(), first.phone());

        VisitSubmissionRepository.Result one = repository.createOrReplay(principal, first, contact);
        VisitSubmissionRepository.Result two = repository.createOrReplay(principal, second, contact);

        assertEquals(VisitSubmissionRepository.Result.Status.ACCEPTED, one.status());
        assertEquals(VisitSubmissionRepository.Result.Status.ACCEPTED, two.status());
        assertNotNull(one.candidate());
        assertNotNull(two.candidate());
        assertTrue(!one.candidate().visitId().equals(two.candidate().visitId()));
        assertEquals(2, rowCount("institution_visit_v1"));
    }

    @Test
    void concurrentSameKeyConvergesToOneAuthoritativeVisit() throws Exception {
        TrustedPrincipal principal = new TrustedPrincipal("user-real-concurrent");
        SubmissionCommandV1 command = TestFixtures.command("concurrent-key");
        PrivateContact contact = new PrivateContact(command.contactName(), command.phone());
        int workers = 8;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        List<Future<VisitSubmissionRepository.Result>> futures = new ArrayList<>();
        for (int i = 0; i < workers; i++) {
            futures.add(executor.submit(() -> {
                ready.countDown();
                assertTrue(start.await(10, TimeUnit.SECONDS));
                return repository.createOrReplay(principal, command, contact);
            }));
        }
        assertTrue(ready.await(10, TimeUnit.SECONDS));
        start.countDown();

        Set<String> visitIds = new HashSet<>();
        List<VisitSubmissionRepository.Result.Status> statuses = new ArrayList<>();
        int accepted = 0;
        int replayed = 0;
        for (Future<VisitSubmissionRepository.Result> future : futures) {
            VisitSubmissionRepository.Result result = future.get(20, TimeUnit.SECONDS);
            statuses.add(result.status());
            if (result.status() == VisitSubmissionRepository.Result.Status.ACCEPTED) accepted++;
            if (result.status() == VisitSubmissionRepository.Result.Status.REPLAYED) replayed++;
            if (result.candidate() != null) visitIds.add(result.candidate().visitId());
        }
        executor.shutdownNow();

        assertEquals(1, accepted, statuses.toString());
        assertEquals(workers - 1, replayed, statuses.toString());
        assertEquals(1, visitIds.size());
        assertEquals(1, rowCount("institution_visit_v1"));
        assertEquals(1, rowCount("appointment_idempotency_v1"));
    }

    @Test
    void failedCreateRollsBackVisitAndIdempotencyRows() throws SQLException {
        JdbcVisitSubmissionRepository failingRepository = new JdbcVisitSubmissionRepository(dataSource,
                new ServerIdentitySource() {
                    @Override
                    public String newVisitId() {
                        return "visit_test_rollback";
                    }

                    @Override
                    public Instant now() {
                        return null;
                    }
                });
        SubmissionCommandV1 command = TestFixtures.command("rollback-key");
        VisitSubmissionRepository.Result result = failingRepository.createOrReplay(
                new TrustedPrincipal("user-real-rollback"), command,
                new PrivateContact(command.contactName(), command.phone()));

        assertEquals(VisitSubmissionRepository.Result.Status.TECHNICAL_FAILURE, result.status());
        assertEquals(0, rowCount("institution_visit_v1"));
        assertEquals(0, rowCount("appointment_idempotency_v1"));
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
}
