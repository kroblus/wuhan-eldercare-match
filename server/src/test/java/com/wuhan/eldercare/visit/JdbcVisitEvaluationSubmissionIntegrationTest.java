package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.wuhan.eldercare.visit.application.VisitEvaluationContentNormalizer;
import com.wuhan.eldercare.visit.application.VisitEvaluationIdentitySource;
import com.wuhan.eldercare.visit.application.VisitEvaluationSubmissionService;
import com.wuhan.eldercare.visit.application.VisitEvaluationWriteRepository;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.ServerOpaquePrincipalSource;
import com.wuhan.eldercare.visit.auth.Sha256SessionEvidenceHasher;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteContentV1;
import com.wuhan.eldercare.visit.persistence.JdbcVisitEvaluationWriteRepository;
import com.wuhan.eldercare.visit.web.VisitEvaluationSubmissionController;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import javax.sql.DataSource;
import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real MySQL 8 evidence. Requires an explicitly marked disposable loopback schema and never falls back to C4_MYSQL_URL. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JdbcVisitEvaluationSubmissionIntegrationTest {
    private static final Instant NOW = Instant.parse("2026-09-24T12:00:00.123456789Z");
    private static final String PRESERVED_VISIT = "evaluation-migration-pre-v4";

    private HikariDataSource dataSource;
    private ObjectMapper objectMapper;
    private JdbcAuthIdentitySessionRepository authRepository;
    private VisitEvaluationSubmissionService service;
    private JdbcVisitEvaluationWriteRepository repository;
    private MockMvc mockMvc;
    private final AtomicLong sequence = new AtomicLong();
    private final AtomicInteger principalSequence = new AtomicInteger();
    private String sessionA;
    private String sessionB;

    @BeforeAll
    void migrateFromV3AndPreserveExistingVisit() throws Exception {
        String url = System.getenv("VISIT_EVALUATION_TEST_MYSQL_URL");
        String username = System.getenv("VISIT_EVALUATION_TEST_MYSQL_USERNAME");
        String disposableMarker = System.getenv("VISIT_EVALUATION_DISPOSABLE_MYSQL");
        assumeTrue("true".equalsIgnoreCase(disposableMarker),
                "explicit disposable MySQL marker is required; C4/Owner database fallback is forbidden");
        assumeTrue(url != null && !url.isBlank() && username != null && !username.isBlank(),
                "VISIT_EVALUATION_TEST_MYSQL_URL and VISIT_EVALUATION_TEST_MYSQL_USERNAME are required");
        URI uri = URI.create("http://" + url.substring("jdbc:mysql://".length()).split("\\?", 2)[0]);
        assumeTrue(("127.0.0.1".equals(uri.getHost()) || "localhost".equals(uri.getHost())) && uri.getPort() > 0,
                "disposable MySQL must be an explicitly addressed loopback service");
        assumeTrue(uri.getPort() != 3306, "Owner MySQL port 3306 is forbidden for disposable integration evidence");

        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("VISIT_EVALUATION_TEST_MYSQL_PASSWORD", ""));
        dataSource.setMaximumPoolSize(24);
        dataSource.setPoolName("visit-evaluation-disposable-test");

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("3")).load().migrate();
        assertEquals(3, migrationCount());
        insertVisit(PRESERVED_VISIT, "synthetic-migration-owner", "requested", "institution-revision-preserved");

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals(4, migrationCount());
        assertPreservedVisit();
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals(4, migrationCount(), "second startup must not apply a migration twice");
        assertEquals(0, pendingMigrationCount());

        objectMapper = new ObjectMapper().findAndRegisterModules()
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        Sha256SessionEvidenceHasher sessionHasher = new Sha256SessionEvidenceHasher();
        authRepository = new JdbcAuthIdentitySessionRepository(dataSource,
                () -> principalSequence.incrementAndGet() == 1 ? "synthetic-user-a" : "synthetic-user-b");
        repository = new JdbcVisitEvaluationWriteRepository(dataSource, objectMapper);
        var resolver = new C5AuthEvidenceResolver(authRepository, sessionHasher, Clock.fixed(NOW, ZoneOffset.UTC));
        var normalizer = new VisitEvaluationContentNormalizer(objectMapper);
        VisitEvaluationIdentitySource identitySource = new VisitEvaluationIdentitySource() {
            @Override public String newEvaluationId() { return "evaluation_test_" + sequence.incrementAndGet(); }
            @Override public Instant submittedAt() { return NOW.plusNanos(sequence.get()); }
        };
        service = new VisitEvaluationSubmissionService(resolver, repository, normalizer, identitySource);
        mockMvc = MockMvcBuilders.standaloneSetup(new VisitEvaluationSubmissionController(service))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .build();
        assertTrue(mysqlVersion().matches("^8\\..+"), "disposable integration requires a MySQL 8.x engine");
    }

    @BeforeEach
    void seedSyntheticUsersAndVisits() throws Exception {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM visit_evaluation_v1");
            statement.executeUpdate("DELETE FROM institution_visit_v1 WHERE visit_id LIKE 'evaluation-test-%'");
            statement.executeUpdate("DELETE FROM auth_session_v1");
            statement.executeUpdate("DELETE FROM auth_provider_identity_v1");
        }
        principalSequence.set(0);
        insertVisit("evaluation-test-a-completed-1", "synthetic-user-a", "completed", "visit-revision-a-7");
        insertVisit("evaluation-test-a-completed-2", "synthetic-user-a", "completed", "visit-revision-a-7");
        insertVisit("evaluation-test-a-requested", "synthetic-user-a", "requested", "visit-revision-a-7");
        insertVisit("evaluation-test-a-contacting", "synthetic-user-a", "contacting", "visit-revision-a-7");
        insertVisit("evaluation-test-a-scheduled", "synthetic-user-a", "scheduled", "visit-revision-a-7");
        insertVisit("evaluation-test-a-cancelled", "synthetic-user-a", "cancelled", "visit-revision-a-7");
        insertVisit("evaluation-test-b-completed", "synthetic-user-b", "completed", "visit-revision-b-3");

        Sha256SessionEvidenceHasher hasher = new Sha256SessionEvidenceHasher();
        long number = sequence.incrementAndGet();
        sessionA = "synthetic-session-a-" + number;
        sessionB = "synthetic-session-b-" + number;
        assertEquals(JdbcAuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                authRepository.createOrLogin("test:visit-evaluation", digest("subject-a"), hasher.digest(sessionA).orElseThrow(),
                        NOW.minusSeconds(10), NOW.plusSeconds(3600)).status());
        assertEquals(JdbcAuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                authRepository.createOrLogin("test:visit-evaluation", digest("subject-b"), hasher.digest(sessionB).orElseThrow(),
                        NOW.minusSeconds(10), NOW.plusSeconds(3600)).status());
    }

    @AfterAll
    void closeDataSource() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void preV4VisitSurvivesMigrationAndFiveFrozenStatusesAreDatabaseAccepted() throws SQLException {
        assertPreservedVisit();
        assertEquals(Set.of("requested", "contacting", "scheduled", "completed", "cancelled"),
                visitStatuses("evaluation-test-%"));
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO institution_visit_v1 (visit_id,user_id,elder_id,institution_id,institution_record_revision,"
                        + "visit_date,visit_time_preference,participant_count,pickup_requested,contact_name,phone,phone_purpose,"
                        + "status,accepted_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
            bindVisit(statement, "evaluation-test-invalid", "synthetic-user-a", "expired", "revision-invalid");
            org.junit.jupiter.api.Assertions.assertThrows(SQLException.class, statement::executeUpdate);
        }
        assertEquals(0, visitExists("evaluation-test-invalid"));
    }

    @Test
    void productionControllerServiceAndMySqlRepositoryAcceptFirstWriteWithServerBindings() throws Exception {
        mockMvc.perform(post("/api/v1/visits/evaluation-test-a-completed-1/evaluation")
                        .header("X-Auth-Evidence", sessionA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson("idem-key-first-001", validPayload())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contractVersion").value("visit-evaluation-production-write-contract-v1"))
                .andExpect(jsonPath("$.kind").value("visit_evaluation_submission_result_v1"))
                .andExpect(jsonPath("$.authResolution").value("authenticated"))
                .andExpect(jsonPath("$.outcome").value("accepted"))
                .andExpect(jsonPath("$.code").value("ACCEPTED"))
                .andExpect(jsonPath("$.receipt.state").value("submitted"))
                .andExpect(jsonPath("$.receipt.visitId").value("evaluation-test-a-completed-1"))
                .andExpect(jsonPath("$.receipt.evaluationId").isString())
                .andExpect(jsonPath("$.receipt.submittedAt").isString())
                .andExpect(jsonPath("$.receipt.phone").doesNotExist())
                .andExpect(jsonPath("$.receipt.comment").doesNotExist())
                .andExpect(jsonPath("$.receipt.userId").doesNotExist())
                .andExpect(jsonPath("$.fieldErrors").value(org.hamcrest.Matchers.nullValue()));

        PersistedRow row = persisted("evaluation-test-a-completed-1");
        assertEquals("synthetic-user-a", row.userId());
        assertEquals("institution-test", row.institutionId());
        assertEquals("visit-revision-a-7", row.institutionRecordRevision());
        assertEquals(5, row.overallRating());
        assertEquals("willing", row.consideration());
        assertEquals(5, row.content().path("overallRating").asInt());
        assertFalse(row.content().has("userId"));
        assertFalse(row.content().has("phone"));
        assertFalse(row.content().has("institutionRecordRevision"));
        assertEquals(1, rowCount("visit_evaluation_v1"));
    }

    @Test
    void normalizedSameKeyReplayChangedContentConflictAndNewKeyAlreadySubmittedAreDistinct() throws Exception {
        var first = submit("evaluation-test-a-completed-1", sessionA, request("idem-key-replay-001", validPayload()));
        Map<String, Object> equivalent = new LinkedHashMap<>(validPayload());
        @SuppressWarnings("unchecked") Map<String, Integer> reversedRatings = new LinkedHashMap<>();
        reversedRatings.put("hygiene", 4);
        reversedRatings.put("room_comfort", 3);
        equivalent.put("ratings", reversedRatings);
        equivalent.put("likedTags", List.of("medical", "care"));
        equivalent.put("concernTags", List.of("care"));

        var replayed = submit("evaluation-test-a-completed-1", sessionA, request("idem-key-replay-001", equivalent));
        assertEquals("accepted", first.outcome().name().toLowerCase(java.util.Locale.ROOT));
        assertEquals("replayed", replayed.outcome().name().toLowerCase(java.util.Locale.ROOT));
        assertEquals(first.receipt(), replayed.receipt());
        assertEquals(1, rowCount("visit_evaluation_v1"));

        Map<String, Object> changed = new LinkedHashMap<>(validPayload());
        changed.put("overallRating", 4);
        var conflict = submit("evaluation-test-a-completed-1", sessionA, request("idem-key-replay-001", changed));
        assertEquals("conflict", conflict.outcome().name().toLowerCase(java.util.Locale.ROOT));
        assertEquals("IDEMPOTENCY_CONFLICT", conflict.code());
        var alreadySubmitted = submit("evaluation-test-a-completed-1", sessionA,
                request("idem-key-independent-002", validPayload()));
        assertEquals("rejected", alreadySubmitted.outcome().name().toLowerCase(java.util.Locale.ROOT));
        assertEquals("ALREADY_SUBMITTED", alreadySubmitted.code());
        assertEquals(first.receipt(), persistedReceipt("evaluation-test-a-completed-1"));
        assertEquals(1, rowCount("visit_evaluation_v1"));
    }

    @Test
    void exactReplayRemainsAvailableAfterVisitStatusChangesButNewIntentDoesNotOverwrite() throws Exception {
        var accepted = submit("evaluation-test-a-completed-1", sessionA, request("idem-key-status-001", validPayload()));
        updateVisitStatus("evaluation-test-a-completed-1", "scheduled");
        var replay = submit("evaluation-test-a-completed-1", sessionA, request("idem-key-status-001", validPayload()));
        var newIntent = submit("evaluation-test-a-completed-1", sessionA, request("idem-key-status-002", validPayload()));
        assertEquals("REPLAYED", replay.code());
        assertEquals(accepted.receipt(), replay.receipt());
        assertEquals("ALREADY_SUBMITTED", newIntent.code());
        assertEquals(1, rowCount("visit_evaluation_v1"));
    }

    @Test
    void visitEligibilityIsServerAuthoritativeAndOtherOwnersAreHidden() throws Exception {
        for (String status : List.of("requested", "contacting", "scheduled", "cancelled")) {
            var rejected = submit("evaluation-test-a-" + status, sessionA, request("idem-key-status-" + status, validPayload()));
            assertEquals("NOT_COMPLETED", rejected.code(), status);
            assertEquals(0, rowCount("visit_evaluation_v1"));
        }
        var foreign = submit("evaluation-test-b-completed", sessionA, request("idem-key-foreign-001", validPayload()));
        var missing = submit("evaluation-test-does-not-exist", sessionA, request("idem-key-missing-001", validPayload()));
        assertEquals("NOT_FOUND", foreign.code());
        assertEquals("NOT_FOUND", missing.code());
        assertEquals(foreign, missing, "foreign and unknown resources are indistinguishable");
        assertEquals(0, rowCount("visit_evaluation_v1"));
    }

    @Test
    void missingInvalidSessionAndInvalidContentDoNotPersistRows() throws Exception {
        var missing = submit("evaluation-test-a-completed-1", null, request("idem-key-auth-missing-001", validPayload()));
        var invalidSession = submit("evaluation-test-a-completed-1", "not-issued-session",
                request("idem-key-auth-invalid-001", validPayload()));
        assertEquals("AUTH_REQUIRED", missing.code());
        assertEquals("missing", missing.authResolution());
        assertEquals("AUTH_REQUIRED", invalidSession.code());
        assertEquals("invalid", invalidSession.authResolution());

        Map<String, Object> invalid = new LinkedHashMap<>(validPayload());
        invalid.put("overallRating", 9);
        invalid.put("likedTags", List.of("care", "care"));
        invalid.put("comment", "x".repeat(201));
        invalid.put("careProcessObservations", Map.of("handoverTopics", List.of("unconfirmed", "follow_up")));
        var failed = submit("evaluation-test-a-completed-1", sessionA, request("idem-key-validation-001", invalid));
        assertEquals("VALIDATION_FAILED", failed.code());
        assertNotNull(failed.fieldErrors());
        assertFalse(failed.fieldErrors().isEmpty());
        assertEquals(0, rowCount("visit_evaluation_v1"));
    }

    @Test
    void mysqlRoundTripPreservesOptionalAbsenceNoVsUnconfirmedFeesAndCrossGroupTags() throws Exception {
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("overallRating", 5);
        content.put("consideration", "compare");
        content.put("ratings", Map.of("hygiene", 4, "room_comfort", 2));
        content.put("feeExplanationClear", "clear");
        content.put("feeTopicExplanations", Map.of(
                "bed_fee", "explained", "meal_fee", "not_explained", "care_fee", "unconfirmed",
                "management_fee", "explained", "special_care_fee", "not_explained",
                "deposit", "unconfirmed", "other_one_time_fee", "explained"));
        content.put("careProcessObservations", Map.of("careRecordLearned", "no", "handoverLearned", "unconfirmed",
                "handoverTopics", List.of("unconfirmed")));
        content.put("likedTags", List.of("care"));
        content.put("concernTags", List.of("care"));
        content.put("comment", "synthetic user observation");
        var result = submit("evaluation-test-a-completed-1", sessionA, request("idem-key-roundtrip-001", content));
        assertEquals("ACCEPTED", result.code());
        JsonNode saved = persisted("evaluation-test-a-completed-1").content();
        assertEquals("no", saved.path("careProcessObservations").path("careRecordLearned").asText());
        assertEquals("unconfirmed", saved.path("careProcessObservations").path("handoverLearned").asText());
        assertEquals("unconfirmed", saved.path("careProcessObservations").path("handoverTopics").get(0).asText());
        assertEquals("not_explained", saved.path("feeTopicExplanations").path("meal_fee").asText());
        assertEquals(7, saved.path("feeTopicExplanations").size());
        assertEquals("care", saved.path("likedTags").get(0).asText());
        assertEquals("care", saved.path("concernTags").get(0).asText());
        assertEquals("synthetic user observation", saved.path("comment").asText());
        assertFalse(saved.has("userId"));
        assertFalse(saved.has("institutionId"));
        assertFalse(saved.has("institutionRecordRevision"));
        assertFalse(saved.has("visitStatus"));
        assertFalse(saved.has("evaluationId"));
        assertFalse(saved.has("submittedAt"));
        PersistedRow row = persisted("evaluation-test-a-completed-1");
        assertEquals("visit-revision-a-7", row.institutionRecordRevision());
        assertEquals(1, rowCount("visit_evaluation_v1"));

        Map<String, Object> minimal = Map.of("overallRating", 3, "consideration", "not_considering");
        submit("evaluation-test-a-completed-2", sessionA, request("idem-key-optional-absent-001", minimal));
        JsonNode absent = persisted("evaluation-test-a-completed-2").content();
        assertFalse(absent.has("ratings"));
        assertFalse(absent.has("feeTopicExplanations"));
        assertFalse(absent.has("careProcessObservations"));
        assertFalse(absent.has("likedTags"));
        assertFalse(absent.has("concernTags"));
        assertFalse(absent.has("comment"));
    }

    @Test
    void concurrentSameIntentConvergesToAcceptedAndReplayedWithOneEvaluation() throws Exception {
        List<VisitEvaluationSubmissionService.Result> results = runConcurrent(
                "evaluation-test-a-completed-1", List.of(
                        request("idem-key-concurrent-same-001", validPayload()),
                        request("idem-key-concurrent-same-001", validPayload())));
        assertEquals(1, results.stream().filter(result -> "ACCEPTED".equals(result.code())).count());
        assertEquals(1, results.stream().filter(result -> "REPLAYED".equals(result.code())).count());
        assertEquals(results.get(0).receipt(), results.get(1).receipt());
        assertEquals(1, rowCount("visit_evaluation_v1"));
    }

    @Test
    void concurrentDifferentIntentsCreateAtMostOneAndReturnAlreadySubmittedToLoser() throws Exception {
        Map<String, Object> different = new LinkedHashMap<>(validPayload());
        different.put("overallRating", 4);
        List<VisitEvaluationSubmissionService.Result> results = runConcurrent(
                "evaluation-test-a-completed-1", List.of(
                        request("idem-key-concurrent-a-001", validPayload()),
                        request("idem-key-concurrent-b-002", different)));
        assertEquals(1, results.stream().filter(result -> "ACCEPTED".equals(result.code())).count(), results.toString());
        assertEquals(1, results.stream().filter(result -> "ALREADY_SUBMITTED".equals(result.code())).count(), results.toString());
        assertEquals(1, rowCount("visit_evaluation_v1"));
    }

    private List<VisitEvaluationSubmissionService.Result> runConcurrent(String visitId,
                                                                          List<VisitEvaluationSubmissionService.Request> requests)
            throws Exception {
        CountDownLatch ready = new CountDownLatch(requests.size());
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(requests.size());
        List<Future<VisitEvaluationSubmissionService.Result>> futures = new ArrayList<>();
        try {
            for (var request : requests) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    assertTrue(start.await(10, TimeUnit.SECONDS));
                    return service.submit(visitId, request, sessionA);
                }));
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            List<VisitEvaluationSubmissionService.Result> results = new ArrayList<>();
            for (Future<VisitEvaluationSubmissionService.Result> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            executor.shutdownNow();
        }
    }

    private VisitEvaluationSubmissionService.Result submit(String visitId, String session,
                                                            VisitEvaluationSubmissionService.Request request) {
        return service.submit(visitId, request, session);
    }

    private VisitEvaluationSubmissionService.Request request(String key, Map<String, Object> payload) {
        return new VisitEvaluationSubmissionService.Request(
                "visit-evaluation-production-write-contract-v1", "visit_evaluation_submission_request_v1", key,
                new VisitEvaluationWriteContentV1(
                        (Integer) payload.get("overallRating"), (String) payload.get("consideration"),
                        castMap(payload.get("ratings")), (String) payload.get("feeExplanationClear"),
                        castMap(payload.get("feeTopicExplanations")), observation(payload.get("careProcessObservations")),
                        castList(payload.get("likedTags")), castList(payload.get("concernTags")),
                        (String) payload.get("comment")));
    }

    @SuppressWarnings("unchecked")
    private static <T> Map<String, T> castMap(Object value) { return value == null ? null : (Map<String, T>) value; }
    @SuppressWarnings("unchecked")
    private static List<String> castList(Object value) { return value == null ? null : (List<String>) value; }

    private static VisitEvaluationWriteContentV1.CareProcessObservations observation(Object value) {
        if (!(value instanceof Map<?, ?> map)) return null;
        return new VisitEvaluationWriteContentV1.CareProcessObservations(
                (String) map.get("careRecordLearned"), (String) map.get("handoverLearned"),
                castList(map.get("handoverTopics")));
    }

    private static Map<String, Object> validPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("overallRating", 5);
        payload.put("consideration", "willing");
        payload.put("ratings", new LinkedHashMap<>(Map.of("room_comfort", 3, "hygiene", 4)));
        payload.put("feeTopicExplanations", new LinkedHashMap<>(Map.of("bed_fee", "explained")));
        payload.put("likedTags", new ArrayList<>(List.of("care", "medical")));
        payload.put("concernTags", new ArrayList<>(List.of("care")));
        payload.put("comment", "synthetic observation");
        return payload;
    }

    private String requestJson(String key, Map<String, Object> payload) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("contractVersion", "visit-evaluation-production-write-contract-v1");
        request.put("kind", "visit_evaluation_submission_request_v1");
        request.put("idempotencyKey", key);
        request.putAll(payload);
        return objectMapper.writeValueAsString(request);
    }

    private void insertVisit(String visitId, String owner, String status, String revision) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO institution_visit_v1 (visit_id,user_id,elder_id,institution_id,institution_record_revision,"
                        + "visit_date,visit_time_preference,participant_count,pickup_requested,contact_name,phone,phone_purpose,"
                        + "status,accepted_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
            bindVisit(statement, visitId, owner, status, revision);
            statement.executeUpdate();
        }
    }

    private static void bindVisit(PreparedStatement statement, String visitId, String owner, String status, String revision)
            throws SQLException {
        statement.setString(1, visitId);
        statement.setString(2, owner);
        statement.setString(3, "synthetic-elder-id");
        statement.setString(4, "institution-test");
        statement.setString(5, revision);
        statement.setString(6, "2026-10-01");
        statement.setString(7, "morning");
        statement.setInt(8, 1);
        statement.setNull(9, java.sql.Types.BOOLEAN);
        statement.setString(10, "Synthetic Contact");
        statement.setString(11, "0000000000");
        statement.setString(12, "appointment_or_consultant_contact");
        statement.setString(13, status);
        statement.setTimestamp(14, java.sql.Timestamp.from(NOW.minusSeconds(60)));
        statement.setNull(15, java.sql.Types.VARCHAR);
    }

    private PersistedRow persisted(String visitId) throws SQLException, java.io.IOException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT evaluation_id,visit_id,user_id,institution_id,institution_record_revision,overall_rating,"
                        + "consideration,content_json,idempotency_key_hash,content_fingerprint,submitted_at "
                        + "FROM visit_evaluation_v1 WHERE visit_id = ?")) {
            statement.setString(1, visitId);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), "persisted Evaluation expected");
                JsonNode content = objectMapper.readTree(result.getString("content_json"));
                return new PersistedRow(result.getString("evaluation_id"), result.getString("visit_id"),
                        result.getString("user_id"), result.getString("institution_id"),
                        result.getString("institution_record_revision"), result.getInt("overall_rating"),
                        result.getString("consideration"), content, result.getString("idempotency_key_hash"),
                        result.getString("content_fingerprint"), result.getTimestamp("submitted_at").toInstant());
            }
        }
    }

    private VisitEvaluationWriteRepository.Receipt persistedReceipt(String visitId) throws SQLException, java.io.IOException {
        PersistedRow row = persisted(visitId);
        return new VisitEvaluationWriteRepository.Receipt(row.evaluationId(), row.visitId(), "submitted", row.submittedAt());
    }

    private void assertPreservedVisit() throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT user_id,institution_id,institution_record_revision,status FROM institution_visit_v1 WHERE visit_id = ?")) {
            statement.setString(1, PRESERVED_VISIT);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), "pre-V4 Visit must remain present");
                assertEquals("synthetic-migration-owner", result.getString("user_id"));
                assertEquals("institution-test", result.getString("institution_id"));
                assertEquals("institution-revision-preserved", result.getString("institution_record_revision"));
                assertEquals("requested", result.getString("status"));
                assertFalse(result.next());
            }
        }
    }

    private Set<String> visitStatuses(String pattern) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT DISTINCT status FROM institution_visit_v1 WHERE visit_id LIKE ? AND visit_id NOT LIKE 'evaluation-migration-%'")) {
            statement.setString(1, pattern);
            try (ResultSet result = statement.executeQuery()) {
                java.util.HashSet<String> statuses = new java.util.HashSet<>();
                while (result.next()) statuses.add(result.getString(1));
                return Set.copyOf(statuses);
            }
        }
    }

    private int migrationCount() {
        return Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().info().applied().length;
    }

    private int pendingMigrationCount() {
        return Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().info().pending().length;
    }

    private String mysqlVersion() throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT VERSION()")) {
            result.next();
            return result.getString(1);
        }
    }

    private int rowCount(String table) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            result.next();
            return result.getInt(1);
        }
    }

    private int visitExists(String visitId) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM institution_visit_v1 WHERE visit_id = ?")) {
            statement.setString(1, visitId);
            try (ResultSet result = statement.executeQuery()) { result.next(); return result.getInt(1); }
        }
    }

    private void updateVisitStatus(String visitId, String status) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "UPDATE institution_visit_v1 SET status = ? WHERE visit_id = ?")) {
            statement.setString(1, status);
            statement.setString(2, visitId);
            assertEquals(1, statement.executeUpdate());
        }
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ignored) { throw new IllegalStateException("SHA-256 required"); }
    }

    private record PersistedRow(String evaluationId, String visitId, String userId, String institutionId,
                                String institutionRecordRevision, int overallRating, String consideration,
                                JsonNode content, String idempotencyKeyHash, String contentFingerprint,
                                Instant submittedAt) { }
}
