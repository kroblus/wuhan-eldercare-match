package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.application.AppointmentReferenceReader;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.ProductionAppointmentReferenceReader;
import com.wuhan.eldercare.visit.application.ProductionReferenceAuthorizer;
import com.wuhan.eldercare.visit.application.PurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.application.ServerIdentitySource;
import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;
import com.wuhan.eldercare.visit.elder.application.UuidElderIdentitySource;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationRepository;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentEligibilityResolver;
import com.wuhan.eldercare.visit.institution.appointment.persistence.JdbcInstitutionAppointmentAuthorizationRepository;
import com.wuhan.eldercare.visit.institution.persistence.JdbcInstitutionRevisionRepository;
import com.wuhan.eldercare.visit.persistence.JdbcAppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitSubmissionRepository;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Synthetic C3 write evidence. Requires a separately started, explicitly disposable MySQL 8 schema. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class C3TransactionalSubmissionMySqlIntegrationTest {
    private static final Instant NOW = Instant.parse("2026-09-27T00:00:00Z");
    private static final String PURPOSE = "appointment_or_consultant_contact";
    private static final String CONTACT_NAME = "Synthetic Contact";
    private static final String CONTACT_PHONE = "13800000000";
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private HikariDataSource dataSource;
    private JdbcElderRecordRepository elders;
    private JdbcInstitutionAppointmentAuthorizationRepository grants;
    private InstitutionAppointmentEligibilityResolver eligibility;
    private JdbcVisitSubmissionRepository visits;

    @BeforeAll
    void configureFreshDisposableSchema() throws Exception {
        String url = System.getenv("C4_MYSQL_URL");
        String username = System.getenv("C4_MYSQL_USERNAME");
        assumeTrue("true".equalsIgnoreCase(System.getenv("C3_TRANSACTION_DISPOSABLE_MYSQL")),
                "explicit disposable C3 marker required");
        assumeTrue(url != null && url.startsWith("jdbc:mysql://127.0.0.1:")
                        && username != null && !username.isBlank(), "loopback test database required");
        URI uri = URI.create("http://" + url.substring("jdbc:mysql://".length()).split("\\?", 2)[0]);
        assumeTrue(uri.getPort() > 0 && uri.getPort() != 3306 && uri.getPath().contains("disposable"),
                "Owner port/schema forbidden");

        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("C4_MYSQL_PASSWORD", ""));
        dataSource.setPoolName("c3-transaction-disposable-test");
        dataSource.setMaximumPoolSize(16);
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet version = statement.executeQuery("SELECT VERSION()")) {
            assertTrue(version.next());
            assertTrue(version.getString(1).startsWith("8."));
        }
        Flyway flyway = Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .baselineOnMigrate(false).load();
        assumeTrue(flyway.info().current() == null, "C3 integration schema must start empty");
        flyway.migrate();
        assertEquals("8", flyway.info().current().getVersion().getVersion());

        elders = new JdbcElderRecordRepository(dataSource);
        JdbcInstitutionRevisionRepository revisions = new JdbcInstitutionRevisionRepository(
                dataSource, new ObjectMapper(), snapshot -> null);
        grants = new JdbcInstitutionAppointmentAuthorizationRepository(dataSource);
        eligibility = new InstitutionAppointmentEligibilityResolver(revisions, grants);
        ServerIdentitySource visitIds = new ServerIdentitySource() {
            @Override public String newVisitId() { return "visit_c3_synthetic_" + UUID.randomUUID(); }
            @Override public Instant now() { return clock.instant(); }
        };
        visits = new JdbcVisitSubmissionRepository(dataSource, visitIds);
    }

    @AfterAll
    void closePool() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void staleEligiblePreflightCannotAuthorizeAfterGrantRevocation() throws Exception {
        Fixture fixture = fixture("stale-preflight");
        AppointmentReferenceReader reader = new ProductionAppointmentReferenceReader(fixture.elderService(), eligibility);
        assertEquals(AppointmentReferenceReader.Status.AUTHORIZED,
                reader.resolve(fixture.owner(), fixture.elderId(), fixture.institutionId(), "1").status());

        appendGrant(fixture.institutionId(), InstitutionAppointmentAuthorizationRepository.Event.State.REVOKED);
        SubmissionResultV1 result = fixture.service().submit(command("stale-preflight-key", fixture, fixture.elderId()),
                fixture.evidence(), "synthetic-proof");

        assertEquals(SubmissionResultV1.Outcome.REJECTED, result.outcome());
        assertEquals(0, visitCount(fixture.owner().userId()));
    }

    @Test
    void omittedAssertionUsesServerElderAndCommittedReplaySurvivesLaterRevocation() throws Exception {
        Fixture fixture = fixture("server-elder-replay");
        AtomicInteger contactCalls = new AtomicInteger();
        VisitSubmissionService service = service(fixture.resolver(), (evidence, purpose, name, phone) -> {
            if (contactCalls.incrementAndGet() > 1) {
                return PurposeBoundContactVerifier.Verification.failure(
                        PurposeBoundContactVerifier.Verification.Status.EXPIRED);
            }
            return PurposeBoundContactVerifier.Verification.authorized(new PrivateContact(name, phone));
        }, fixture.elderService());
        SubmissionCommandV1 command = command("server-elder-replay-key", fixture, null);

        SubmissionResultV1 accepted = service.submit(command, fixture.evidence(), "synthetic-proof");
        assertEquals(SubmissionResultV1.Outcome.ACCEPTED, accepted.outcome());
        assertEquals("requested", accepted.receipt().status());
        assertEquals(fixture.elderId(), scalarString(
                "SELECT elder_id FROM institution_visit_v1 WHERE visit_id = ?", accepted.receipt().visitId()));
        assertEquals(1, visitCount(fixture.owner().userId()));

        appendGrant(fixture.institutionId(), InstitutionAppointmentAuthorizationRepository.Event.State.REVOKED);
        SubmissionResultV1 replay = service.submit(command, fixture.evidence(), "expired-synthetic-proof");
        assertEquals(SubmissionResultV1.Outcome.REPLAYED, replay.outcome());
        assertEquals(accepted.receipt().visitId(), replay.receipt().visitId());
        assertEquals(1, contactCalls.get(), "committed replay must not exchange contact proof again");
        assertEquals(1, visitCount(fixture.owner().userId()));

        SubmissionResultV1 conflict = service.submit(command("server-elder-replay-key", fixture, "elder_wrong_assertion"),
                fixture.evidence(), "expired-synthetic-proof");
        assertEquals(SubmissionResultV1.Outcome.CONFLICT, conflict.outcome());
        assertEquals(1, visitCount(fixture.owner().userId()));
    }

    @Test
    void replayReturnsOriginalRequestedReceiptAfterVisitLifecycleAdvances() throws Exception {
        Fixture fixture = fixture("lifecycle-replay");
        SubmissionCommandV1 command = command("lifecycle-replay-key", fixture, fixture.elderId());
        SubmissionResultV1 accepted = fixture.service().submit(command, fixture.evidence(), "synthetic-proof");
        assertEquals(SubmissionResultV1.Outcome.ACCEPTED, accepted.outcome());
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "UPDATE institution_visit_v1 SET status = 'contacting' WHERE visit_id = ?")) {
            statement.setString(1, accepted.receipt().visitId());
            assertEquals(1, statement.executeUpdate());
        }

        SubmissionResultV1 replay = fixture.service().submit(command, fixture.evidence(), "synthetic-proof");
        assertEquals(SubmissionResultV1.Outcome.REPLAYED, replay.outcome());
        assertEquals(accepted.receipt().visitId(), replay.receipt().visitId());
        assertEquals("requested", replay.receipt().status(), "idempotent receipt retains original submission meaning");
        assertEquals("contacting", scalarString("SELECT status FROM institution_visit_v1 WHERE visit_id = ?",
                accepted.receipt().visitId()), "replay must not mutate lifecycle truth");
        assertEquals(1, visitCount(fixture.owner().userId()));
    }

    @Test
    void missingElderAndForeignOrUnknownAssertionsWriteNothingAndDoNotEnumerate() throws Exception {
        Fixture owner = fixture("assertion-owner");
        Fixture foreign = fixture("assertion-foreign");
        SubmissionResultV1 mismatch = owner.service().submit(command("mismatch-assertion-key", owner,
                "elder_unknown_synthetic"), owner.evidence(), "synthetic-proof");
        SubmissionResultV1 foreignId = owner.service().submit(command("foreign-assertion-key", owner,
                foreign.elderId()), owner.evidence(), "synthetic-proof");
        assertEquals(SubmissionResultV1.Outcome.REJECTED, mismatch.outcome());
        assertEquals(mismatch.code(), foreignId.code());
        assertEquals(0, visitCount(owner.owner().userId()));

        Session unbound = issueSession("no-bound-elder");
        VisitSubmissionService service = service(unbound.resolver(), authorizedContact(),
                new ElderRecordService(unbound.resolver(), elders, new UuidElderIdentitySource(clock)));
        SubmissionResultV1 missing = service.submit(command("missing-elder-key", owner, null),
                unbound.evidence(), "synthetic-proof");
        assertEquals(SubmissionResultV1.Outcome.REJECTED, missing.outcome());
        assertEquals(0, visitCount(unbound.owner().userId()));
        assertEquals(0, ownerBindingCount(unbound.owner().userId()), "C3 authorization must not establish Elder");
    }

    @Test
    void historicalUnpublishedAndMissingGrantAreEachRejectedByFinalTransaction() throws Exception {
        Fixture fixture = fixture("institution-negative-gates");
        seedRevision(fixture.institutionId(), 2, "published");
        updateHead(fixture.institutionId(), 2);
        SubmissionResultV1 historical = fixture.service().submit(commandForInstitution(
                "historical-revision-key", fixture, fixture.elderId(), fixture.institutionId(), "1"),
                fixture.evidence(), "synthetic-proof");

        String unpublishedId = "synthetic-c3-unpublished-" + UUID.randomUUID();
        seedRevision(unpublishedId, 1, "draft");
        updateHead(unpublishedId, 1);
        appendGrant(unpublishedId, InstitutionAppointmentAuthorizationRepository.Event.State.AUTHORIZED);
        SubmissionResultV1 unpublished = fixture.service().submit(commandForInstitution(
                "unpublished-revision-key", fixture, fixture.elderId(), unpublishedId, "1"),
                fixture.evidence(), "synthetic-proof");

        String noGrantId = "synthetic-c3-no-grant-" + UUID.randomUUID();
        seedRevision(noGrantId, 1, "published");
        updateHead(noGrantId, 1);
        SubmissionResultV1 missingGrant = fixture.service().submit(commandForInstitution(
                "missing-grant-key", fixture, fixture.elderId(), noGrantId, "1"),
                fixture.evidence(), "synthetic-proof");

        assertEquals(SubmissionResultV1.Outcome.REJECTED, historical.outcome());
        assertEquals(SubmissionResultV1.Outcome.REJECTED, unpublished.outcome());
        assertEquals(SubmissionResultV1.Outcome.REJECTED, missingGrant.outcome());
        assertEquals(0, visitCount(fixture.owner().userId()));
    }

    @Test
    void sessionRevokedAfterInitialResolutionIsRejectedInsideWriteTransaction() throws Exception {
        Fixture fixture = fixture("session-revocation");
        AuthIdentitySessionRepository sessionRepository = new JdbcAuthIdentitySessionRepository(
                dataSource, () -> fixture.owner().userId());
        AuthEvidenceResolver revokeAfterFirstCheck = new AuthEvidenceResolver() {
            @Override
            public Resolution resolve(String evidence) {
                Resolution initiallyActive = fixture.resolver().resolve(evidence);
                assertEquals(AuthIdentitySessionRepository.RevokeResult.Status.REVOKED,
                        sessionRepository.revokeSession(sha256(evidence), NOW.plusSeconds(1)).status());
                return initiallyActive;
            }

            @Override
            public Resolution resolve(Connection connection, String evidence) {
                return fixture.resolver().resolve(connection, evidence);
            }

            @Override
            public boolean supportsTransactionalResolution() { return true; }
        };
        VisitSubmissionService service = new VisitSubmissionService(revokeAfterFirstCheck, authorizedContact(),
                new ProductionReferenceAuthorizer(fixture.elderService(), eligibility), visits);
        SubmissionResultV1 result = service.submit(command("revoked-session-key", fixture, fixture.elderId()),
                fixture.evidence(), "synthetic-proof");

        assertEquals(SubmissionResultV1.Outcome.REJECTED, result.outcome());
        assertEquals(0, visitCount(fixture.owner().userId()));
    }

    @Test
    void missingContactAndIdempotencyConflictWriteNoSecondVisit() throws Exception {
        Fixture fixture = fixture("contact-conflict");
        VisitSubmissionService noContact = service(fixture.resolver(), (evidence, purpose, name, phone) ->
                PurposeBoundContactVerifier.Verification.failure(PurposeBoundContactVerifier.Verification.Status.MISSING),
                fixture.elderService());
        assertEquals(SubmissionResultV1.Outcome.REJECTED,
                noContact.submit(command("missing-contact-key", fixture, fixture.elderId()),
                        fixture.evidence(), null).outcome());
        assertEquals(0, visitCount(fixture.owner().userId()));

        SubmissionCommandV1 original = command("conflict-key", fixture, fixture.elderId());
        SubmissionResultV1 accepted = fixture.service().submit(original, fixture.evidence(), "synthetic-proof");
        assertEquals(SubmissionResultV1.Outcome.ACCEPTED, accepted.outcome());
        SubmissionCommandV1 changed = new SubmissionCommandV1(original.contractVersion(), original.kind(),
                original.idempotencyKey(), original.institutionId(), original.institutionRecordRevision(),
                original.elderId(), original.visitDate(), original.visitTimePreference(), original.participantCount(),
                original.pickupRequested(), original.contactName(), original.phone(), original.phonePurpose(),
                original.phoneAuthorization(), "different intent note");
        assertEquals(SubmissionResultV1.Outcome.CONFLICT,
                fixture.service().submit(changed, fixture.evidence(), "synthetic-proof").outcome());
        assertEquals(1, visitCount(fixture.owner().userId()));
    }

    @Test
    void concurrentSameKeySubmissionsConvergeOnOneVisit() throws Exception {
        Fixture fixture = fixture("concurrent-submit");
        String secondSessionEvidence = addSecondSessionFor(fixture.owner().userId());
        SubmissionCommandV1 command = command("concurrent-same-key", fixture, fixture.elderId());
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(() -> {
                ready.countDown();
                assertTrue(start.await(10, TimeUnit.SECONDS));
                return fixture.service().submit(command, fixture.evidence(), "synthetic-proof");
            });
            var second = pool.submit(() -> {
                ready.countDown();
                assertTrue(start.await(10, TimeUnit.SECONDS));
                return fixture.service().submit(command, secondSessionEvidence, "synthetic-proof");
            });
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            SubmissionResultV1 one = first.get(30, TimeUnit.SECONDS);
            SubmissionResultV1 two = second.get(30, TimeUnit.SECONDS);
            assertTrue((one.outcome() == SubmissionResultV1.Outcome.ACCEPTED
                    && two.outcome() == SubmissionResultV1.Outcome.REPLAYED)
                    || (two.outcome() == SubmissionResultV1.Outcome.ACCEPTED
                    && one.outcome() == SubmissionResultV1.Outcome.REPLAYED));
            assertEquals(one.receipt().visitId(), two.receipt().visitId());
            assertEquals(1, visitCount(fixture.owner().userId()));
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void grantRevocationWaitsForAnEarlierAuthorizedWriteToCommit() throws Exception {
        Fixture fixture = fixture("grant-write-race");
        ReferenceAuthorizer canonical = new ProductionReferenceAuthorizer(fixture.elderService(), eligibility);
        CountDownLatch authorizedAndLocked = new CountDownLatch(1);
        CountDownLatch releaseWrite = new CountDownLatch(1);
        CountDownLatch revokeStarted = new CountDownLatch(1);
        ReferenceAuthorizer pausedAfterCanonicalCheck = new ReferenceAuthorizer() {
            @Override
            public Authorization authorize(TrustedPrincipal principal, String elderId, String institutionId,
                                            String institutionRecordRevision) {
                return canonical.authorize(principal, elderId, institutionId, institutionRecordRevision);
            }

            @Override
            public Resolution authorize(Connection connection, TrustedPrincipal principal, String elderId,
                                        String institutionId, String institutionRecordRevision) {
                Resolution result = canonical.authorize(connection, principal, elderId,
                        institutionId, institutionRecordRevision);
                if (result.status() == Authorization.AUTHORIZED) {
                    authorizedAndLocked.countDown();
                    try {
                        if (!releaseWrite.await(10, TimeUnit.SECONDS)) return Resolution.of(Authorization.TECHNICAL_FAILURE);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        return Resolution.of(Authorization.TECHNICAL_FAILURE);
                    }
                }
                return result;
            }

            @Override
            public boolean supportsTransactionalAuthorization() { return true; }
        };
        VisitSubmissionService service = new VisitSubmissionService(fixture.resolver(), authorizedContact(),
                pausedAfterCanonicalCheck, visits);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var submit = pool.submit(() -> service.submit(command("grant-race-key", fixture, fixture.elderId()),
                    fixture.evidence(), "synthetic-proof"));
            assertTrue(authorizedAndLocked.await(10, TimeUnit.SECONDS));
            var revoke = pool.submit(() -> {
                revokeStarted.countDown();
                return grants.append(new InstitutionAppointmentAuthorizationRepository.Event(
                        "synthetic-c3-race-revoke-" + UUID.randomUUID(), fixture.institutionId(), 1,
                        InstitutionAppointmentAuthorizationRepository.Event.State.REVOKED,
                        "synthetic:controlled-revocation", "operator:synthetic", NOW));
            });
            assertTrue(revokeStarted.await(10, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> revoke.get(300, TimeUnit.MILLISECONDS),
                    "revocation must wait for the earlier transaction's exact-revision lock");
            releaseWrite.countDown();
            assertEquals(SubmissionResultV1.Outcome.ACCEPTED, submit.get(20, TimeUnit.SECONDS).outcome());
            assertEquals(InstitutionAppointmentAuthorizationRepository.Apply.Status.APPLIED,
                    revoke.get(20, TimeUnit.SECONDS).status());
            assertEquals(1, visitCount(fixture.owner().userId()));
            assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_AUTHORIZED,
                    eligibility.resolve(fixture.institutionId(), "1").status());
        } finally {
            releaseWrite.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void idempotencyInsertFailureRollsBackVisitAndReceipt() throws Exception {
        Fixture fixture = fixture("rollback");
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TRIGGER trg_c3_synthetic_reject_idempotency BEFORE INSERT "
                    + "ON appointment_idempotency_v1 FOR EACH ROW SIGNAL SQLSTATE '45000' "
                    + "SET MESSAGE_TEXT = 'synthetic C3 rollback evidence'");
        }
        try {
            SubmissionResultV1 result = fixture.service().submit(command("rollback-key", fixture,
                    fixture.elderId()), fixture.evidence(), "synthetic-proof");
            assertEquals(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, result.outcome());
            assertEquals(0, visitCount(fixture.owner().userId()));
            assertEquals(0, scalarLong("SELECT COUNT(*) FROM appointment_idempotency_v1 WHERE user_id = ?",
                    fixture.owner().userId()));
        } finally {
            try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP TRIGGER trg_c3_synthetic_reject_idempotency");
            }
        }
    }

    @Test
    void historicalVisitRemainsOwnerReadableWithoutElderBackfill() throws Exception {
        String oldOwner = "synthetic-old-owner-c3-" + UUID.randomUUID();
        String oldElder = "legacy-elder-without-record-" + UUID.randomUUID();
        String oldVisit = "legacy-visit-c3-" + UUID.randomUUID();
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO institution_visit_v1 (visit_id,user_id,elder_id,institution_id,"
                        + "institution_record_revision,visit_date,visit_time_preference,participant_count,"
                        + "pickup_requested,contact_name,phone,phone_purpose,status,accepted_at) "
                        + "VALUES (?,?,?,?,?,'2026-10-01','morning',1,FALSE,?,?,?,'completed',?)")) {
            statement.setString(1, oldVisit);
            statement.setString(2, oldOwner);
            statement.setString(3, oldElder);
            statement.setString(4, "synthetic-historical-institution");
            statement.setString(5, "1");
            statement.setString(6, CONTACT_NAME);
            statement.setString(7, CONTACT_PHONE);
            statement.setString(8, PURPOSE);
            statement.setTimestamp(9, Timestamp.from(NOW));
            statement.executeUpdate();
        }
        var ownerRead = new JdbcAppointmentOwnerReadRepository(dataSource).findAllOwned(new TrustedPrincipal(oldOwner));
        assertEquals(com.wuhan.eldercare.visit.application.AppointmentOwnerReadRepository.Result.Status.READY,
                ownerRead.status());
        assertEquals(1, ownerRead.visits().size());
        assertEquals(oldVisit, ownerRead.visits().getFirst().visitId());
        assertEquals(oldElder, scalarString("SELECT elder_id FROM institution_visit_v1 WHERE visit_id = ?", oldVisit));
        assertEquals(0, scalarLong("SELECT COUNT(*) FROM elder_record_v1 WHERE elder_id = ?", oldElder));
    }

    private Fixture fixture(String label) throws Exception {
        Session session = issueSession(label);
        ElderRecordService elderService = new ElderRecordService(session.resolver(), elders,
                new UuidElderIdentitySource(clock));
        var established = elderService.establishCurrent(session.evidence());
        assertEquals(ElderRecordService.Establishment.Status.CREATED, established.status());
        String institutionId = "synthetic-c3-institution-" + UUID.randomUUID();
        seedPublishedInstitution(institutionId);
        appendGrant(institutionId, InstitutionAppointmentAuthorizationRepository.Event.State.AUTHORIZED);
        return new Fixture(session.owner(), session.evidence(), session.resolver(), elderService,
                established.record().elderId(), institutionId,
                service(session.resolver(), authorizedContact(), elderService));
    }

    private Session issueSession(String label) {
        String userId = "synthetic-c3-user-" + UUID.randomUUID();
        AuthIdentitySessionRepository repository = new JdbcAuthIdentitySessionRepository(dataSource, () -> userId);
        String evidence = "synthetic-c3-session-" + UUID.randomUUID();
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                repository.createOrLogin("synthetic-c3-provider", sha256(label + UUID.randomUUID()),
                        sha256(evidence), NOW, NOW.plusSeconds(3600)).status());
        C5AuthEvidenceResolver resolver = new C5AuthEvidenceResolver(repository,
                value -> value == null ? Optional.empty() : Optional.of(sha256(value)), clock);
        var principal = resolver.resolve(evidence);
        assertEquals(com.wuhan.eldercare.visit.application.AuthEvidenceResolver.Resolution.Status.AUTHENTICATED,
                principal.status());
        return new Session(principal.principal(), evidence, resolver);
    }

    private String addSecondSessionFor(String userId) throws SQLException {
        String evidence = "synthetic-c3-second-session-" + UUID.randomUUID();
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO auth_session_v1 (session_digest,user_id,issued_at,expires_at) VALUES (?,?,?,?)")) {
            statement.setString(1, sha256(evidence));
            statement.setString(2, userId);
            statement.setTimestamp(3, Timestamp.from(NOW));
            statement.setTimestamp(4, Timestamp.from(NOW.plusSeconds(3600)));
            statement.executeUpdate();
        }
        return evidence;
    }

    private VisitSubmissionService service(C5AuthEvidenceResolver resolver, PurposeBoundContactVerifier contact,
                                           ElderRecordService elderService) {
        return new VisitSubmissionService(resolver, contact,
                new ProductionReferenceAuthorizer(elderService, eligibility), visits);
    }

    private static PurposeBoundContactVerifier authorizedContact() {
        return (evidence, purpose, name, phone) -> PURPOSE.equals(purpose) && "synthetic-proof".equals(evidence)
                ? PurposeBoundContactVerifier.Verification.authorized(new PrivateContact(name, phone))
                : PurposeBoundContactVerifier.Verification.failure(PurposeBoundContactVerifier.Verification.Status.MISSING);
    }

    private SubmissionCommandV1 command(String key, Fixture fixture, String elderAssertion) {
        return commandForInstitution(key, fixture, elderAssertion, fixture.institutionId(), "1");
    }

    private SubmissionCommandV1 commandForInstitution(String key, Fixture fixture, String elderAssertion,
                                                       String institutionId, String revision) {
        return new SubmissionCommandV1("appointment-institution-visit-contract-v1", "appointment_submission_v1",
                key, institutionId, revision, elderAssertion, "2026-10-01", "morning", 1, false,
                CONTACT_NAME, CONTACT_PHONE, PURPOSE, "explicit", "synthetic appointment intent");
    }

    private void seedPublishedInstitution(String institutionId) throws SQLException {
        seedRevision(institutionId, 1, "published");
        updateHead(institutionId, 1);
    }

    private void seedRevision(String institutionId, long revisionNumber, String recordStatus) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement revision = connection.prepareStatement(
                "INSERT INTO institution_record_revision_v1 (institution_id,record_revision,contract_version,"
                        + "snapshot_json,operation_id,source_reference,operator_reference,published_at) "
                        + "VALUES (?,?,'institution-contract-v1.2.1',?,?,?,?,?)")) {
            revision.setString(1, institutionId);
            revision.setLong(2, revisionNumber);
            revision.setString(3, "{\"institutionId\":\"" + institutionId
                    + "\",\"recordRevision\":" + revisionNumber + ",\"recordStatus\":\""
                    + recordStatus + "\"}");
            revision.setString(4, "synthetic-publish-" + UUID.randomUUID());
            revision.setString(5, "synthetic:fixture-source");
            revision.setString(6, "operator:synthetic-fixture");
            revision.setTimestamp(7, Timestamp.from(NOW));
            revision.executeUpdate();
        }
    }

    private void updateHead(String institutionId, long revisionNumber) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement head = connection.prepareStatement(
                "INSERT INTO institution_current_head_v1 (institution_id,record_revision,promoted_at) "
                        + "VALUES (?,?,?) ON DUPLICATE KEY UPDATE record_revision = VALUES(record_revision), "
                        + "promoted_at = VALUES(promoted_at)")) {
            head.setString(1, institutionId);
            head.setLong(2, revisionNumber);
            head.setTimestamp(3, Timestamp.from(NOW));
            head.executeUpdate();
        }
    }

    private void appendGrant(String institutionId, InstitutionAppointmentAuthorizationRepository.Event.State state) {
        assertEquals(InstitutionAppointmentAuthorizationRepository.Apply.Status.APPLIED,
                grants.append(new InstitutionAppointmentAuthorizationRepository.Event("synthetic-c3-event-" + UUID.randomUUID(),
                        institutionId, 1, state, "synthetic:controlled-authorization", "operator:synthetic",
                        NOW)).status());
    }

    private int visitCount(String userId) { return (int) scalarLong(
            "SELECT COUNT(*) FROM institution_visit_v1 WHERE user_id = ?", userId); }

    private int ownerBindingCount(String userId) { return (int) scalarLong(
            "SELECT COUNT(*) FROM elder_record_v1 WHERE responsible_user_id = ?", userId); }

    private long scalarLong(String sql, String value) {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet rows = statement.executeQuery()) {
                assertTrue(rows.next());
                return rows.getLong(1);
            }
        } catch (SQLException failure) {
            throw new IllegalStateException(failure);
        }
    }

    private String scalarString(String sql, String value) {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet rows = statement.executeQuery()) {
                assertTrue(rows.next());
                return rows.getString(1);
            }
        } catch (SQLException failure) {
            throw new IllegalStateException(failure);
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    private record Session(TrustedPrincipal owner, String evidence, C5AuthEvidenceResolver resolver) { }
    private record Fixture(TrustedPrincipal owner, String evidence, C5AuthEvidenceResolver resolver,
                           ElderRecordService elderService, String elderId, String institutionId,
                           VisitSubmissionService service) { }
}
