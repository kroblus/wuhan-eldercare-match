package com.wuhan.eldercare.visit.history;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.ServerOpaquePrincipalSource;
import com.wuhan.eldercare.visit.auth.Sha256SessionEvidenceHasher;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Real MySQL evidence, synthetic inputs only; no production C5 provider or source is installed. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class C2HistoryMySqlIntegrationTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final Clock clock = Clock.systemUTC();
    private HikariDataSource dataSource;
    private JdbcAuthIdentitySessionRepository sessions;
    private C5AuthEvidenceResolver auth;
    private JdbcElderRecordRepository elders;
    private final Sha256SessionEvidenceHasher hasher = new Sha256SessionEvidenceHasher();

    @BeforeAll void database() throws Exception {
        assumeTrue("true".equals(System.getenv("C2_HISTORY_DISPOSABLE_MYSQL")), "explicit disposable marker required");
        String url = System.getenv("C2_HISTORY_MYSQL_URL");
        String username = System.getenv("C2_HISTORY_MYSQL_USERNAME");
        assumeTrue(url != null && url.startsWith("jdbc:mysql://127.0.0.1:") && username != null,
                "isolated loopback URL and restricted test user required");
        URI uri = URI.create("http://" + url.substring("jdbc:mysql://".length()).split("\\?", 2)[0]);
        assumeTrue(uri.getPort() > 0 && uri.getPort() != 3306 && uri.getPath().contains("disposable"),
                "Owner port/schema forbidden");
        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("C2_HISTORY_MYSQL_PASSWORD", ""));
        dataSource.setMaximumPoolSize(12);
        dataSource.setPoolName("c2-synthetic-disposable-test");
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT VERSION()")) {
            assertTrue(rows.next());
            assertTrue(rows.getString(1).startsWith("8."));
        }
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        sessions = new JdbcAuthIdentitySessionRepository(dataSource, ServerOpaquePrincipalSource.production());
        auth = new C5AuthEvidenceResolver(sessions, hasher, clock);
        elders = new JdbcElderRecordRepository(dataSource);
    }

    @AfterAll void close() { if (dataSource != null) dataSource.close(); }

    private Account account(boolean bindElder) {
        String evidence = "C2_SYNTHETIC_SESSION_" + UUID.randomUUID();
        Instant now = clock.instant();
        String digest = hasher.digest(evidence).orElseThrow();
        var login = sessions.createOrLogin("C2_SYNTHETIC", hasher.digest(UUID.randomUUID().toString()).orElseThrow(),
                digest, now, now.plusSeconds(3600));
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED, login.status());
        String owner = auth.resolve(evidence).principal().userId();
        String elder = "C2_SYNTHETIC_ELDER_" + UUID.randomUUID();
        if (bindElder) {
            assertEquals(com.wuhan.eldercare.visit.elder.application.ElderRecordRepository.Establish.Status.CREATED,
                    elders.establish(new ElderRecord(elder, owner, now)).status());
        }
        return new Account(evidence, owner, elder);
    }

    private JsonNode answers() throws Exception {
        return mapper.readTree(getClass().getResourceAsStream("/assessment-history/test-only-answers.json"));
    }

    private int count(String table, String owner) throws Exception {
        if (!table.matches("c2_history_(consent|intent|record)_v1")) throw new IllegalArgumentException("controlled table required");
        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement("SELECT COUNT(*) FROM " + table + " WHERE owner_id=?")) {
            statement.setString(1, owner);
            try (var rows = statement.executeQuery()) { assertTrue(rows.next()); return rows.getInt(1); }
        }
    }

    private record Account(String evidence, String owner, String elder) { }

    private final C2DataPolicy policy = () -> new C2DataPolicy.Notice("C2_SYNTHETIC_NOTICE_V1",
            "Synthetic test notice; never approved for real people", "Synthetic test retention only",
            "Synthetic test rights handling only", "C2_SYNTHETIC_APPROVAL_NOT_PRODUCTION");

    private C2CatalogSource.Capture capture(String release) {
        return new C2CatalogSource.Capture(release, "C2_SYNTHETIC_NOT_VERIFIED_FOR_REAL_USE",
                mapper.createObjectNode().put("datasetMode", "PRODUCTION").put("datasetVersion", release));
    }

    private static final class Source implements C2CatalogSource {
        private final Capture pin;
        private boolean approved = true;
        private Source(Capture pin) { this.pin = pin; }
        @Override public Capture capture() { return pin; }
        @Override public boolean authorizes(Capture pinned) { return approved && pin.equals(pinned); }
    }

    private C2SnapshotEngine engine(String state, AtomicInteger invocations) {
        return (completed, capture, asOf) -> {
            invocations.incrementAndGet();
            var snapshot = mapper.createObjectNode().put("snapshotVersion", 1);
            snapshot.set("completed", completed.deepCopy());
            snapshot.set("profile", mapper.createObjectNode().put("rulesVersion", "C2_SYNTHETIC_PROFILE"));
            var display = mapper.createObjectNode().put("snapshotVersion", 1).put("state", state)
                    .put("datasetVersion", capture.catalog().path("datasetVersion").asText())
                    .put("datasetMode", "PRODUCTION").put("evaluationAsOf", asOf);
            display.putArray("candidateIds").add("C2_SYNTHETIC_FIRST").add("C2_SYNTHETIC_SECOND");
            display.putArray("risks").add("C2_SYNTHETIC_RISK_NOT_HEALTH_DATA");
            display.putArray("clarifications").add("C2_SYNTHETIC_CLARIFICATION");
            display.putArray("preferenceGaps").add("C2_SYNTHETIC_PREFERENCE_GAP");
            if (state.equals("NO_PERSONALIZED_CANDIDATE")) {
                display.putArray("candidateIds");
                display.put("reason", "C2_SYNTHETIC_LEGAL_NO_CANDIDATES");
            }
            snapshot.set("publicDisplay", display);
            return snapshot;
        };
    }

    private C2HistoryService service(C2SnapshotEngine engine, C2CatalogSource source) {
        return new C2HistoryService(dataSource, auth, elders, mapper, clock, engine, source, policy, true);
    }

    private C2HistoryService service(String state) {
        return service(engine(state, new AtomicInteger()), new Source(capture("C2_SYNTHETIC_RELEASE_V1")));
    }

    private C2HistoryService.Consent consent(C2HistoryService service, Account account) {
        return service.consent(account.evidence(), policy.approvedNotice().version(), true);
    }

    private C2HistoryService.Prepared prepare(C2HistoryService service, Account account) throws Exception {
        return service.prepare(account.evidence(), UUID.randomUUID().toString(), "assessment-contract-v2",
                answers(), consent(service, account).consentId());
    }

    private C2HistoryService.Item confirm(C2HistoryService service, Account account, C2HistoryService.Prepared pending) {
        return service.confirm(account.evidence(), pending.intentId(), pending.resultVersion(), pending.displayBinding());
    }

    private void failure(int status, String code, org.junit.jupiter.api.function.Executable action) {
        C2Failure failure = assertThrows(C2Failure.class, action);
        assertEquals(status, failure.status());
        assertEquals(code, failure.code());
    }

    @Test void noRecordExistsUntilAnExplicitPreparedResultIsConfirmed() throws Exception {
        Account owner = account(true);
        var service = service("LEGACY_V2_DISPLAY");
        assertTrue(service.list(owner.evidence(), 20, null).items().isEmpty());
        assertEquals(0, count("c2_history_record_v1", owner.owner()));
        var consent = consent(service, owner);
        assertEquals(consent, consent(service, owner), "consent retry preserves the original evidence");
        assertEquals(0, count("c2_history_intent_v1", owner.owner()));
        var pending = service.prepare(owner.evidence(), UUID.randomUUID().toString(), "assessment-contract-v2",
                answers(), consent.consentId());
        assertEquals("REQUIRES_REDISPLAY_AND_CONFIRMATION", pending.status());
        assertEquals(0, count("c2_history_record_v1", owner.owner()));
        assertEquals(1, count("c2_history_intent_v1", owner.owner()));
        assertTrue(service.list(owner.evidence(), 20, null).items().isEmpty());
        var receipt = confirm(service, owner, pending);
        assertEquals("SERVER_SAVED", receipt.trustedStatus());
        assertEquals(1, count("c2_history_record_v1", owner.owner()));
        assertEquals(pending.display(), service.detail(owner.evidence(), receipt.recordId()).display());
        assertEquals(List.of(receipt), service.list(owner.evidence(), 20, null).items());
    }

    @Test void missingLoginAndMissingSoleElderDenySavingAndQuerying() throws Exception {
        Account unbound = account(false);
        var service = service("LEGACY_V2_DISPLAY");
        String id = UUID.randomUUID().toString();
        failure(401, "AUTH_REQUIRED", () -> service.list(null, 20, null));
        failure(401, "AUTH_REQUIRED", () -> service.consent(null, policy.approvedNotice().version(), true));
        failure(401, "AUTH_REQUIRED", () -> service.prepare(null, id, "assessment-contract-v2", answers(), id));
        failure(401, "AUTH_REQUIRED", () -> service.confirm(null, id, id, id));
        failure(403, "ELDER_BINDING_REQUIRED", () -> service.list(unbound.evidence(), 20, null));
        failure(403, "ELDER_BINDING_REQUIRED", () -> consent(service, unbound));
        failure(403, "ELDER_BINDING_REQUIRED", () -> service.prepare(unbound.evidence(), id, "assessment-contract-v2", answers(), id));
        assertEquals(0, count("c2_history_record_v1", unbound.owner()));
    }

    @Test void allThreeLegalResultKindsKeepTheirOriginalDisplayWithoutConversion() throws Exception {
        Account owner = account(true);
        for (String state : List.of("LEGACY_V2_DISPLAY", "INITIAL_REFERENCE_ONLY", "NO_PERSONALIZED_CANDIDATE")) {
            var service = service(state);
            var pending = prepare(service, owner);
            var receipt = confirm(service, owner, pending);
            var detail = service.detail(owner.evidence(), receipt.recordId());
            assertEquals("READY", detail.availability());
            assertEquals(state, detail.item().state());
            assertEquals(pending.display(), detail.display());
            assertEquals(state, detail.display().path("state").asText());
            if (state.equals("NO_PERSONALIZED_CANDIDATE")) {
                assertTrue(detail.display().path("candidateIds").isEmpty());
                assertEquals("C2_SYNTHETIC_LEGAL_NO_CANDIDATES", detail.display().path("reason").asText());
            } else {
                assertEquals("C2_SYNTHETIC_FIRST", detail.display().path("candidateIds").get(0).asText());
                assertEquals("C2_SYNTHETIC_SECOND", detail.display().path("candidateIds").get(1).asText());
                assertEquals(pending.display().path("risks"), detail.display().path("risks"));
                assertEquals(pending.display().path("clarifications"), detail.display().path("clarifications"));
                assertEquals(pending.display().path("preferenceGaps"), detail.display().path("preferenceGaps"));
            }
        }
        assertEquals(3, count("c2_history_record_v1", owner.owner()));
    }

    @Test void unsupportedVersionTechnicalFailuresAndSourceMismatchCannotBecomeZeroCandidateHistory() throws Exception {
        Account owner = account(true);
        var source = new Source(capture("C2_SYNTHETIC_RELEASE_V1"));
        var service = service("LEGACY_V2_DISPLAY");
        String consent = consent(service, owner).consentId();
        failure(422, "UNSUPPORTED_VERSION", () -> service.prepare(owner.evidence(), UUID.randomUUID().toString(),
                "unsupported-assessment", answers(), consent));
        var errors = service((completed, capture, asOf) -> { throw new C2Failure(503, "ENGINE_UNAVAILABLE"); }, source);
        failure(503, "ENGINE_UNAVAILABLE", () -> errors.prepare(owner.evidence(), UUID.randomUUID().toString(),
                "assessment-contract-v2", answers(), consent));
        var invalid = service((completed, capture, asOf) -> {
            var snapshot = engine("NO_PERSONALIZED_CANDIDATE", new AtomicInteger()).generate(completed, capture, asOf);
            ((com.fasterxml.jackson.databind.node.ObjectNode) snapshot.path("publicDisplay")).put("datasetVersion", "different-release");
            return snapshot;
        }, source);
        failure(409, "RESULT_SOURCE_MISMATCH", () -> invalid.prepare(owner.evidence(), UUID.randomUUID().toString(),
                "assessment-contract-v2", answers(), consent));
        var technicalState = service(engine("TECHNICAL_ERROR", new AtomicInteger()), source);
        failure(409, "RESULT_SOURCE_MISMATCH", () -> technicalState.prepare(owner.evidence(), UUID.randomUUID().toString(),
                "assessment-contract-v2", answers(), consent));
        assertEquals(0, count("c2_history_intent_v1", owner.owner()));
        assertEquals(0, count("c2_history_record_v1", owner.owner()));
    }

    @Test void wrongConfirmationAndRevokedSourceCannotSilentlySaveAnotherResult() throws Exception {
        Account owner = account(true);
        var source = new Source(capture("C2_SYNTHETIC_RELEASE_V1"));
        var service = service(engine("INITIAL_REFERENCE_ONLY", new AtomicInteger()), source);
        var pending = prepare(service, owner);
        failure(409, "RESULT_CONFIRMATION_MISMATCH", () -> service.confirm(owner.evidence(), pending.intentId(),
                UUID.randomUUID().toString(), pending.displayBinding()));
        failure(409, "RESULT_CONFIRMATION_MISMATCH", () -> service.confirm(owner.evidence(), pending.intentId(),
                pending.resultVersion(), UUID.randomUUID().toString()));
        source.approved = false;
        failure(409, "RESULT_SOURCE_CHANGED", () -> confirm(service, owner, pending));
        assertEquals(0, count("c2_history_record_v1", owner.owner()));
        assertEquals(pending.display(), service.reconcile(owner.evidence(), pending.intentId()).display());
        source.approved = true;
        assertEquals("INITIAL_REFERENCE_ONLY", confirm(service, owner, pending).state());
    }

    @Test void retriesConcurrencyAndLostReceiptUseOneOriginalIntent() throws Exception {
        Account owner = account(true);
        var calculations = new AtomicInteger();
        var service = service(engine("LEGACY_V2_DISPLAY", calculations), new Source(capture("C2_SYNTHETIC_RELEASE_V1")));
        var pending = prepare(service, owner);
        String consent = consent(service, owner).consentId();
        var retry = service.prepare(owner.evidence(), pending.intentId(), "assessment-contract-v2", answers(), consent);
        assertEquals(pending, retry);
        assertEquals(1, calculations.get());
        var changed = (com.fasterxml.jackson.databind.node.ObjectNode) answers();
        changed.put("C2_SYNTHETIC_DIFFERENT_ANSWER", "different");
        failure(409, "INTENT_CONFLICT", () -> service.prepare(owner.evidence(), pending.intentId(),
                "assessment-contract-v2", changed, consent));
        List<C2HistoryService.Item> results = new ArrayList<>();
        try (var pool = Executors.newFixedThreadPool(6)) {
            var futures = new ArrayList<java.util.concurrent.Future<C2HistoryService.Item>>();
            for (int n = 0; n < 6; n++) futures.add(pool.submit(() -> confirm(service, owner, pending)));
            for (var future : futures) results.add(future.get(15, TimeUnit.SECONDS));
        }
        assertEquals(1, results.stream().map(C2HistoryService.Item::recordId).distinct().count());
        assertEquals(1, count("c2_history_record_v1", owner.owner()));
        var recovered = service.reconcile(owner.evidence(), pending.intentId());
        assertEquals("SAVED", recovered.status());
        assertEquals(results.getFirst(), recovered.receipt());
        assertNull(recovered.display());
        assertEquals(recovered.receipt(), confirm(service, owner, pending));
        assertEquals(1, calculations.get());
    }

    @Test void otherAccountsCannotReadReplayOrConfirmAndCredentialsAreRechecked() throws Exception {
        Account owner = account(true), other = account(true);
        var service = service("INITIAL_REFERENCE_ONLY");
        var pending = prepare(service, owner);
        failure(404, "INTENT_NOT_FOUND", () -> service.reconcile(other.evidence(), pending.intentId()));
        failure(404, "INTENT_NOT_FOUND", () -> confirm(service, other, pending));
        var receipt = confirm(service, owner, pending);
        failure(404, "NOT_FOUND", () -> service.detail(other.evidence(), receipt.recordId()));
        assertTrue(service.list(other.evidence(), 20, null).items().isEmpty());
        assertEquals(AuthIdentitySessionRepository.RevokeResult.Status.REVOKED,
                sessions.revokeSession(hasher.digest(owner.evidence()).orElseThrow(), clock.instant()).status());
        failure(401, "AUTH_REQUIRED", () -> service.detail(owner.evidence(), receipt.recordId()));
        failure(401, "AUTH_REQUIRED", () -> confirm(service, owner, pending));
        failure(401, "AUTH_REQUIRED", () -> service.reconcile(owner.evidence(), pending.intentId()));
    }

    @Test void changedElderBindingDoesNotExposeOrConfirmPreviousEldersHistory() throws Exception {
        Account owner = account(true), newResponsibleUser = account(false);
        var service = service("LEGACY_V2_DISPLAY");
        var pending = prepare(service, owner);
        var receipt = confirm(service, owner, pending);
        try (var connection = dataSource.getConnection(); var update = connection.prepareStatement(
                "UPDATE elder_record_v1 SET responsible_user_id=? WHERE elder_id=?")) {
            update.setString(1, newResponsibleUser.owner()); update.setString(2, owner.elder());
            assertEquals(1, update.executeUpdate());
        }
        failure(403, "ELDER_BINDING_REQUIRED", () -> service.detail(owner.evidence(), receipt.recordId()));
        failure(403, "ELDER_BINDING_REQUIRED", () -> confirm(service, owner, pending));
        failure(404, "NOT_FOUND", () -> service.detail(newResponsibleUser.evidence(), receipt.recordId()));
        failure(404, "INTENT_NOT_FOUND", () -> service.reconcile(newResponsibleUser.evidence(), pending.intentId()));
        assertTrue(service.list(newResponsibleUser.evidence(), 20, null).items().isEmpty());
    }

    @Test void reassessmentCannotUpdateExistingSnapshotsAndReadsNeverRunCurrentEngine() throws Exception {
        Account owner = account(true);
        var firstService = service("LEGACY_V2_DISPLAY");
        var first = prepare(firstService, owner);
        var firstReceipt = confirm(firstService, owner, first);
        var laterService = service("INITIAL_REFERENCE_ONLY");
        var later = prepare(laterService, owner);
        var laterReceipt = confirm(laterService, owner, later);
        assertNotEquals(firstReceipt.recordId(), laterReceipt.recordId());
        var readOnly = new C2HistoryService(dataSource, auth, elders, mapper, clock,
                (completed, source, asOf) -> { fail("History reads/replays must never invoke the current engine"); return null; },
                null, null, false);
        assertEquals(first.display(), readOnly.detail(owner.evidence(), firstReceipt.recordId()).display());
        assertEquals(2, readOnly.list(owner.evidence(), 20, null).items().size());
        assertEquals(firstReceipt, readOnly.reconcile(owner.evidence(), first.intentId()).receipt());
        assertEquals(firstReceipt, confirm(readOnly, owner, first));
        try (var connection = dataSource.getConnection(); var update = connection.prepareStatement(
                "UPDATE c2_history_record_v1 SET result_state='NO_PERSONALIZED_CANDIDATE' WHERE record_id=?")) {
            update.setString(1, firstReceipt.recordId());
            assertThrows(SQLException.class, update::executeUpdate);
        }
        assertEquals(first.display(), readOnly.detail(owner.evidence(), firstReceipt.recordId()).display());
        assertFalse(readOnly.capability().writesAvailable());
    }

    @Test void receiptBindingFailureRollsBackInsertedRecordAndAllowsOriginalIntentRetry() throws Exception {
        Account owner = account(true);
        var service = service("LEGACY_V2_DISPLAY");
        var pending = prepare(service, owner);
        String trigger = "trg_c2_synthetic_failure_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TRIGGER " + trigger + " BEFORE UPDATE ON c2_history_intent_v1 FOR EACH ROW "
                    + "BEGIN IF NEW.owner_id='" + owner.owner() + "' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic rollback'; END IF; END");
        }
        try {
            failure(503, "ERROR", () -> confirm(service, owner, pending));
            assertEquals(0, count("c2_history_record_v1", owner.owner()));
            assertEquals(1, count("c2_history_intent_v1", owner.owner()));
            assertEquals("REQUIRES_REDISPLAY_AND_CONFIRMATION", service.reconcile(owner.evidence(), pending.intentId()).status());
        } finally {
            try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
                statement.execute("DROP TRIGGER " + trigger);
            }
        }
        assertNotNull(confirm(service, owner, pending).recordId());
        assertEquals(1, count("c2_history_record_v1", owner.owner()));
    }

    @Test void unsupportedStoredVersionIsExplicitAndDoesNotCallEngine() throws Exception {
        Account owner = account(true);
        var service = service("LEGACY_V2_DISPLAY");
        var pending = prepare(service, owner);
        String recordId = UUID.randomUUID().toString();
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var insert = connection.prepareStatement("INSERT INTO c2_history_record_v1(record_id,owner_id,elder_id,intent_id,saved_at,result_state,snapshot_version,snapshot_json) VALUES(?,?,?,?,?,'LEGACY_V2_DISPLAY',99,'{}')")) {
                insert.setString(1, recordId); insert.setString(2, owner.owner()); insert.setString(3, owner.elder());
                insert.setString(4, pending.intentId()); insert.setTimestamp(5, Timestamp.from(clock.instant()));
                insert.executeUpdate();
            }
            try (var update = connection.prepareStatement("UPDATE c2_history_intent_v1 SET record_id=? WHERE owner_id=? AND intent_id=?")) {
                update.setString(1, recordId); update.setString(2, owner.owner()); update.setString(3, pending.intentId()); update.executeUpdate();
            }
            connection.commit();
        }
        var detail = service.detail(owner.evidence(), recordId);
        assertEquals("UNSUPPORTED_VERSION", detail.availability());
        assertNull(detail.display());
        assertEquals(recordId, detail.item().recordId());
    }

    @Test void consentRevocationAndResultExpiryPreventPendingConfirmation() throws Exception {
        Account owner = account(true);
        var service = service("LEGACY_V2_DISPLAY");
        var pending = prepare(service, owner);
        String consent = consent(service, owner).consentId();
        try (var connection = dataSource.getConnection(); var update = connection.prepareStatement(
                "UPDATE c2_history_consent_v1 SET revoked_at=? WHERE consent_id=?")) {
            update.setTimestamp(1, Timestamp.from(clock.instant())); update.setString(2, consent); update.executeUpdate();
        }
        failure(403, "CONSENT_REQUIRED", () -> confirm(service, owner, pending));
        failure(403, "CONSENT_REVOKED", () -> consent(service, owner));
        assertEquals(0, count("c2_history_record_v1", owner.owner()));
        Account expiring = account(true);
        var expiringIntent = prepare(service, expiring);
        Clock future = Clock.fixed(clock.instant().plusSeconds(901), ZoneOffset.UTC);
        var later = new C2HistoryService(dataSource, auth, elders, mapper, future,
                engine("LEGACY_V2_DISPLAY", new AtomicInteger()), new Source(capture("C2_SYNTHETIC_RELEASE_V1")), policy, true);
        assertEquals("RESULT_EXPIRED", later.reconcile(expiring.evidence(), expiringIntent.intentId()).status());
        failure(409, "RESULT_EXPIRED", () -> confirm(later, expiring, expiringIntent));
        assertEquals(0, count("c2_history_record_v1", expiring.owner()));
    }

    @Test void separatelyConstructedConnectionPoolAndServiceReadAndReplayOriginalDurableSnapshot() throws Exception {
        Account owner = account(true);
        var original = service("INITIAL_REFERENCE_ONLY");
        var pending = prepare(original, owner);
        var receipt = confirm(original, owner, pending);
        try (var newPool = new HikariDataSource()) {
            newPool.setJdbcUrl(dataSource.getJdbcUrl());
            newPool.setUsername(dataSource.getUsername());
            newPool.setPassword(dataSource.getPassword());
            newPool.setMaximumPoolSize(3);
            newPool.setPoolName("c2-separate-instance-read-test");
            var newSessions = new JdbcAuthIdentitySessionRepository(newPool, ServerOpaquePrincipalSource.production());
            var newAuth = new C5AuthEvidenceResolver(newSessions, new Sha256SessionEvidenceHasher(), Clock.systemUTC());
            var rebuilt = new C2HistoryService(newPool, newAuth, new JdbcElderRecordRepository(newPool),
                    new ObjectMapper(), Clock.systemUTC(), (completed, source, asOf) -> {
                        fail("Independent reader must not reconstruct an old result"); return null;
                    }, null, null, false);
            assertEquals(receipt, rebuilt.list(owner.evidence(), 20, null).items().getFirst());
            assertEquals(pending.display(), rebuilt.detail(owner.evidence(), receipt.recordId()).display());
            assertEquals(receipt, rebuilt.reconcile(owner.evidence(), pending.intentId()).receipt());
            assertEquals(receipt, confirm(rebuilt, owner, pending));
        }
    }

    @Test void missingFalseOrChangedConsentCannotAuthorizeCollection() throws Exception {
        Account owner = account(true);
        var currentNotice = new AtomicReference<>(policy.approvedNotice());
        var service = new C2HistoryService(dataSource, auth, elders, mapper, clock,
                engine("LEGACY_V2_DISPLAY", new AtomicInteger()), new Source(capture("C2_SYNTHETIC_RELEASE_V1")),
                currentNotice::get, true);
        failure(400, "INVALID_INPUT", () -> service.consent(owner.evidence(), currentNotice.get().version(), false));
        failure(409, "NOTICE_CHANGED", () -> service.consent(owner.evidence(), "C2_OLD_NOTICE", true));
        failure(403, "CONSENT_REQUIRED", () -> service.prepare(owner.evidence(), UUID.randomUUID().toString(),
                "assessment-contract-v2", answers(), UUID.randomUUID().toString()));
        assertEquals(0, count("c2_history_consent_v1", owner.owner()));
        assertEquals(0, count("c2_history_intent_v1", owner.owner()));
        var pending = prepare(service, owner);
        currentNotice.set(new C2DataPolicy.Notice(currentNotice.get().version(), "Changed synthetic notice under same version",
                "Synthetic retention only", "Synthetic rights only", "C2_SYNTHETIC_CHANGED_NOTICE"));
        failure(409, "NOTICE_CHANGED", () -> confirm(service, owner, pending));
        currentNotice.set(new C2DataPolicy.Notice("C2_SYNTHETIC_NOTICE_V2", "New synthetic version",
                "Synthetic retention only", "Synthetic rights only", "C2_SYNTHETIC_NOTICE_V2_APPROVAL"));
        failure(403, "CONSENT_REQUIRED", () -> confirm(service, owner, pending));
        failure(409, "NOTICE_CHANGED", () -> service.consent(owner.evidence(), policy.approvedNotice().version(), true));
        assertEquals(0, count("c2_history_record_v1", owner.owner()));
    }

    @Test void expiredServerSessionCannotReadOrConfirmSavedReceipt() throws Exception {
        Account owner = account(true);
        var service = service("LEGACY_V2_DISPLAY");
        var pending = prepare(service, owner);
        var receipt = confirm(service, owner, pending);
        try (var connection = dataSource.getConnection(); var update = connection.prepareStatement(
                "UPDATE auth_session_v1 SET expires_at=? WHERE session_digest=?")) {
            update.setTimestamp(1, Timestamp.from(clock.instant().minusSeconds(1)));
            update.setString(2, hasher.digest(owner.evidence()).orElseThrow()); update.executeUpdate();
        }
        failure(401, "AUTH_REQUIRED", () -> service.detail(owner.evidence(), receipt.recordId()));
        failure(401, "AUTH_REQUIRED", () -> service.list(owner.evidence(), 20, null));
        failure(401, "AUTH_REQUIRED", () -> confirm(service, owner, pending));
        failure(401, "AUTH_REQUIRED", () -> service.reconcile(owner.evidence(), pending.intentId()));
        assertEquals(1, count("c2_history_record_v1", owner.owner()));
    }

    @Test void realPackagedNodeEngineAndMySqlPreserveAllThreeSyntheticResultKinds() throws Exception {
        JsonNode fixtures = mapper.readTree(getClass().getResourceAsStream("/c2-history/synthetic-inputs.json"));
        assertEquals("SYNTHETIC_TEST_ONLY_NOT_REAL", fixtures.path("policy").asText());
        Account owner = account(true);
        Clock evaluatedAt = Clock.fixed(Instant.parse("2026-10-27T04:00:00Z"), ZoneOffset.UTC);
        for (JsonNode fixture : fixtures.path("fixtures")) {
            var catalog = new C2CatalogSource.Capture("C2_SYNTHETIC_NODE_" + fixture.path("name").asText(),
                    "C2_SYNTHETIC_NOT_A_PRODUCTION_VERIFICATION", fixture.path("input").path("catalog"));
            var node = new C2NodeSnapshotEngine(mapper, "node");
            var service = new C2HistoryService(dataSource, auth, elders, mapper, evaluatedAt,
                    node, new Source(catalog), policy, true);
            var pending = service.prepare(owner.evidence(), UUID.randomUUID().toString(), "assessment-contract-v2",
                    fixture.path("input").path("completed").path("answers"), consent(service, owner).consentId());
            assertEquals(fixture.path("expected").asText(), pending.display().path("state").asText());
            assertEquals("C2_SYNTHETIC_TEST_ONLY", pending.display().path("datasetVersion").asText());
            assertEquals("2026-10-27T04:00:00Z", pending.display().path("evaluationAsOf").asText());
            var receipt = confirm(service, owner, pending);
            var detail = service.detail(owner.evidence(), receipt.recordId());
            assertEquals(pending.display(), detail.display());
            assertEquals("READY", detail.availability());
            assertTrue(detail.display().path("profileView").isObject());
            assertTrue(detail.display().path("resultView").isObject());
            assertTrue(detail.display().path("poolRevisions").isArray());
            String publicJson = mapper.writeValueAsString(detail.display());
            for (String privateField : List.of("answers", "ownerId", "elderId", "rankTuple", "priorityFitVector", "sessionEvidence"))
                assertFalse(publicJson.contains("\"" + privateField + "\""), "Private field leaked: " + privateField);
            try (var connection = dataSource.getConnection(); var query = connection.prepareStatement(
                    "SELECT snapshot_json FROM c2_history_record_v1 WHERE record_id=?")) {
                query.setString(1, receipt.recordId());
                try (var rows = query.executeQuery()) {
                    assertTrue(rows.next()); JsonNode saved = mapper.readTree(rows.getString(1));
                    assertEquals(fixture.path("input").path("completed").path("answers"), saved.path("completed").path("answers"));
                    assertTrue(saved.path("profile").isObject());
                    assertEquals(pending.display(), saved.path("publicDisplay"));
                }
            }
        }
        assertEquals(3, count("c2_history_record_v1", owner.owner()));
        try (var connection = dataSource.getConnection(); var query = connection.prepareStatement(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE '%test_only%'")) {
            try (var rows = query.executeQuery()) { assertTrue(rows.next()); assertEquals(0, rows.getInt(1)); }
        }
    }
}
