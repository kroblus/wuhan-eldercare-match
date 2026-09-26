package com.wuhan.eldercare.visit.institution;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.institution.application.InstitutionHistoricalPublicNameResolver;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishResult;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionPublisher;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.JdbcInstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.NodeInstitutionSnapshotValidator;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.io.InputStream;
import java.net.URI;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Real MySQL evidence. Requires an explicit disposable loopback database; never uses C4/Owner DB. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class InstitutionRevisionMySqlIntegrationTest {
    private static final String PRESERVED_VISIT = "synthetic-institution-v5-preserved-visit";
    private static final String INSTITUTION = "synthetic-institution-revision-test";
    private final ObjectMapper mapper = new ObjectMapper();
    private HikariDataSource dataSource;
    private JdbcInstitutionRevisionRepository repository;
    private InstitutionRevisionPublisher publisher;
    private InstitutionHistoricalPublicNameResolver resolver;
    private ObjectNode fixture;

    @BeforeAll
    void migrateOfficialChainFromV4() throws Exception {
        String url = System.getenv("INSTITUTION_TEST_MYSQL_URL");
        String username = System.getenv("INSTITUTION_TEST_MYSQL_USERNAME");
        assumeTrue("true".equalsIgnoreCase(System.getenv("INSTITUTION_DISPOSABLE_MYSQL")),
                "explicit disposable MySQL marker required");
        assumeTrue(url != null && url.startsWith("jdbc:mysql://127.0.0.1:") && username != null,
                "explicit isolated loopback MySQL URL and test username required");
        URI uri = URI.create("http://" + url.substring("jdbc:mysql://".length()).split("\\?", 2)[0]);
        assumeTrue(uri.getPort() > 0 && uri.getPort() != 3306
                        && uri.getPath().contains("disposable"),
                "Owner port/schema forbidden");

        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("INSTITUTION_TEST_MYSQL_PASSWORD", ""));
        dataSource.setMaximumPoolSize(8);
        dataSource.setPoolName("institution-revision-disposable-test");
        assertTrue(mysqlVersion().startsWith("8."));

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("4")).load().migrate();
        assertEquals(4, migrationCount());
        insertRepresentativeVisit();

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals(5, migrationCount());
        assertEquals(1, count("SELECT COUNT(*) FROM institution_visit_v1 WHERE visit_id = '" + PRESERVED_VISIT + "'"));
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals(5, migrationCount(), "second startup must not replay V5");

        try (InputStream input = getClass().getResourceAsStream("/institution-synthetic-v121.json")) {
            if (input == null) throw new IllegalStateException("test-only Institution fixture missing");
            fixture = (ObjectNode) mapper.readTree(input);
        }
        repository = new JdbcInstitutionRevisionRepository(dataSource, mapper,
                new NodeInstitutionSnapshotValidator("node", mapper));
        publisher = new InstitutionRevisionPublisher(repository,
                Clock.fixed(Instant.parse("2026-09-25T03:00:00.123456789Z"), ZoneOffset.UTC));
        resolver = new InstitutionHistoricalPublicNameResolver(repository);
    }

    @AfterAll
    void closePool() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void publishTwoFullRevisionsAndResolveOnlyExactNames() throws Exception {
        var firstPackage = publishPackage(INSTITUTION, "Synthetic Home Old", "publish-old");
        firstPackage.with("record").put("recordRevision", 999);
        firstPackage.with("record").put("recordStatus", "draft");
        firstPackage.with("record").withArray("evidence").forEach(item ->
                ((ObjectNode) item).put("recordRevision", 999));
        var first = publisher.publish(firstPackage);
        assertEquals(InstitutionPublishResult.Status.PUBLISHED, first.status());
        assertEquals(1L, first.recordRevision());
        assertEquals(1L, repository.currentHead(INSTITUTION).recordRevision());
        assertEquals("Synthetic Home Old", resolver.resolve(INSTITUTION, 1).publicName());

        var replay = publisher.publish(firstPackage);
        assertEquals(InstitutionPublishResult.Status.REPLAYED, replay.status());
        assertEquals(first.recordRevision(), replay.recordRevision());
        assertEquals(first.publishedAt(), replay.publishedAt());
        assertEquals(InstitutionPublishResult.Status.OPERATION_ID_CONFLICT,
                publisher.publish(publishPackage(INSTITUTION, "Different content", "publish-old")).status());

        var second = publisher.publish(publishPackage(INSTITUTION, "Synthetic Home New", "publish-new"));
        assertEquals(InstitutionPublishResult.Status.PUBLISHED, second.status());
        assertEquals(2L, second.recordRevision());
        assertEquals(2L, repository.currentHead(INSTITUTION).recordRevision());
        assertEquals("Synthetic Home Old", resolver.resolve(INSTITUTION, 1).publicName());
        assertEquals("Synthetic Home New", resolver.resolve(INSTITUTION, 2).publicName());
        assertEquals(InstitutionRevisionRepository.ExactPublicNameResult.Status.UNAVAILABLE,
                resolver.resolve(INSTITUTION, 999).status());
        assertEquals(InstitutionRevisionRepository.ExactPublicNameResult.Status.UNAVAILABLE,
                resolver.resolve("synthetic-unknown-institution", 1).status());

        // A synthetic test-only head change proves the reader does not infer MAX(revision).
        updateHead(INSTITUTION, 1);
        assertEquals(1L, repository.currentHead(INSTITUTION).recordRevision());
        assertEquals("Synthetic Home New", resolver.resolve(INSTITUTION, 2).publicName());
        updateHead(INSTITUTION, 2);

        assertEquals(2, count("SELECT COUNT(*) FROM institution_record_revision_v1 WHERE institution_id = '" + INSTITUTION + "'"));
        assertFullSnapshotAndAudit(1, "Synthetic Home Old", "publish-old");
        assertFullSnapshotAndAudit(2, "Synthetic Home New", "publish-new");
        assertThrows(SQLException.class, () -> modifyPublishedRevision("UPDATE institution_record_revision_v1 SET source_reference='changed' WHERE institution_id='" + INSTITUTION + "' AND record_revision=1"));
        assertThrows(SQLException.class, () -> modifyPublishedRevision("DELETE FROM institution_record_revision_v1 WHERE institution_id='" + INSTITUTION + "' AND record_revision=1"));
    }

    @Test
    void invalidRecordRollsBackRevisionAndHead() throws Exception {
        String id = "synthetic-invalid-revision-test";
        ObjectNode input = publishPackage(id, "Synthetic Invalid Home", "publish-invalid");
        input.with("record").with("identity").with("name").put("value", "");
        assertEquals(InstitutionPublishResult.Status.INVALID_RECORD, publisher.publish(input).status());
        assertEquals(InstitutionRevisionRepository.CurrentHeadResult.Status.UNAVAILABLE,
                repository.currentHead(id).status());
        assertEquals(0, count("SELECT COUNT(*) FROM institution_record_revision_v1 WHERE institution_id = '" + id + "'"));
        assertEquals(0, count("SELECT COUNT(*) FROM institution_revision_sequence_v1 WHERE institution_id = '" + id + "'"));
    }

    @Test
    void failedHeadPromotionRollsBackFullSnapshotAndAudit() throws Exception {
        String id = "synthetic-head-rollback-test";
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TRIGGER trg_institution_test_reject_head BEFORE INSERT ON institution_current_head_v1 "
                    + "FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic head failure'");
        }
        try {
            assertEquals(InstitutionPublishResult.Status.TECHNICAL_FAILURE,
                    publisher.publish(publishPackage(id, "Synthetic Rollback Home", "publish-rollback")).status());
            assertEquals(0, count("SELECT COUNT(*) FROM institution_record_revision_v1 WHERE institution_id = '" + id + "'"));
            assertEquals(0, count("SELECT COUNT(*) FROM institution_revision_sequence_v1 WHERE institution_id = '" + id + "'"));
            assertEquals(InstitutionRevisionRepository.CurrentHeadResult.Status.UNAVAILABLE,
                    repository.currentHead(id).status());
        } finally {
            try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP TRIGGER trg_institution_test_reject_head");
            }
        }
    }

    @Test
    void concurrentPublishKeepsDistinctImmutableRevisionsAndOneValidHead() throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        try {
            for (int attempt = 0; attempt < 5; attempt++) {
                String id = "synthetic-concurrent-revision-test-" + attempt;
                String firstOperation = "concurrent-one-" + attempt;
                String secondOperation = "concurrent-two-" + attempt;
                var start = new CountDownLatch(1);
                var one = pool.submit(() -> { start.await(); return publisher.publish(publishPackage(id, "Synthetic Concurrent One", firstOperation)); });
                var two = pool.submit(() -> { start.await(); return publisher.publish(publishPackage(id, "Synthetic Concurrent Two", secondOperation)); });
                start.countDown();
                var first = one.get(60, TimeUnit.SECONDS);
                var second = two.get(60, TimeUnit.SECONDS);
                assertEquals(InstitutionPublishResult.Status.PUBLISHED, first.status());
                assertEquals(InstitutionPublishResult.Status.PUBLISHED, second.status());
                assertNotEquals(first.recordRevision(), second.recordRevision());
                assertEquals(2, count("SELECT COUNT(*) FROM institution_record_revision_v1 WHERE institution_id = '" + id + "'"));
                long head = repository.currentHead(id).recordRevision();
                assertTrue(head == first.recordRevision() || head == second.recordRevision());
                assertEquals(InstitutionRevisionRepository.ExactPublicNameResult.Status.READY,
                        resolver.resolve(id, first.recordRevision()).status());
                assertEquals(InstitutionRevisionRepository.ExactPublicNameResult.Status.READY,
                        resolver.resolve(id, second.recordRevision()).status());
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentReplayOfOneOperationCreatesOnlyOneRevision() throws Exception {
        String id = "synthetic-concurrent-replay-test";
        var input = publishPackage(id, "Synthetic Replay Home", "concurrent-replay");
        var pool = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            var one = pool.submit(() -> { start.await(); return publisher.publish(input); });
            var two = pool.submit(() -> { start.await(); return publisher.publish(input); });
            start.countDown();
            var first = one.get(60, TimeUnit.SECONDS);
            var second = two.get(60, TimeUnit.SECONDS);
            assertTrue((first.status() == InstitutionPublishResult.Status.PUBLISHED
                    && second.status() == InstitutionPublishResult.Status.REPLAYED)
                    || (first.status() == InstitutionPublishResult.Status.REPLAYED
                    && second.status() == InstitutionPublishResult.Status.PUBLISHED));
            assertEquals(first.recordRevision(), second.recordRevision());
            assertEquals(1, count("SELECT COUNT(*) FROM institution_record_revision_v1 WHERE institution_id = '" + id + "'"));
            assertEquals(first.recordRevision(), repository.currentHead(id).recordRevision());
        } finally {
            pool.shutdownNow();
        }
    }

    private ObjectNode publishPackage(String institutionId, String name, String operationId) {
        ObjectNode record = fixture.deepCopy();
        record.put("institutionId", institutionId);
        record.with("identity").with("name").put("value", name);
        record.withArray("evidence").forEach(item -> ((ObjectNode) item).put("institutionId", institutionId));
        ObjectNode wrapper = mapper.createObjectNode();
        wrapper.put("packageVersion", "institution-publish-package-v1");
        wrapper.put("operationId", operationId);
        wrapper.put("sourceReference", "synthetic:test-source");
        wrapper.put("operatorReference", "ops:synthetic-reviewer");
        wrapper.set("record", record);
        return wrapper;
    }

    private void assertFullSnapshotAndAudit(long revision, String name, String operationId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT snapshot_json, operation_id, source_reference, operator_reference, published_at FROM institution_record_revision_v1 WHERE institution_id = ? AND record_revision = ?")) {
            statement.setString(1, INSTITUTION);
            statement.setLong(2, revision);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                JsonNode actual = mapper.readTree(result.getString("snapshot_json"));
                ObjectNode expected = (ObjectNode) publishPackage(INSTITUTION, name, operationId).get("record");
                expected.put("recordRevision", revision);
                expected.put("recordStatus", "published");
                expected.withArray("evidence").forEach(item -> ((ObjectNode) item).put("recordRevision", revision));
                assertTrue(actual.equals((left, right) -> {
                    if (left.isNumber() && right.isNumber()) {
                        return left.decimalValue().compareTo(right.decimalValue());
                    }
                    return left.equals(right) ? 0 : 1;
                }, expected), "full Frozen record must round-trip without dropped fields");
                assertEquals(operationId, result.getString("operation_id"));
                assertEquals("synthetic:test-source", result.getString("source_reference"));
                assertEquals("ops:synthetic-reviewer", result.getString("operator_reference"));
                assertTrue(result.getTimestamp("published_at") != null);
                assertFalse(result.next());
            }
        }
    }

    private void insertRepresentativeVisit() throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO institution_visit_v1 (visit_id,user_id,elder_id,institution_id,institution_record_revision,visit_date,visit_time_preference,participant_count,pickup_requested,contact_name,phone,phone_purpose,status,accepted_at) VALUES ('"
                    + PRESERVED_VISIT + "','synthetic-owner','synthetic-elder','synthetic-old-reference','1','2026-10-01','morning',1,FALSE,'synthetic-contact','00000000000','appointment_or_consultant_contact','requested','2026-09-25 03:00:00')");
        }
    }

    private String mysqlVersion() throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT VERSION()")) {
            result.next();
            return result.getString(1);
        }
    }

    private int migrationCount() {
        return Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().info().applied().length;
    }

    private int count(String query) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(query)) {
            result.next();
            return result.getInt(1);
        }
    }

    private void updateHead(String id, long revision) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "UPDATE institution_current_head_v1 SET record_revision = ? WHERE institution_id = ?")) {
            statement.setLong(1, revision);
            statement.setString(2, id);
            assertEquals(1, statement.executeUpdate());
        }
    }

    private void modifyPublishedRevision(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate(sql);
        }
    }
}
