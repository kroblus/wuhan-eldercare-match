package com.wuhan.eldercare.visit.elder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.AppointmentReferenceReader;
import com.wuhan.eldercare.visit.application.ProductionAppointmentReferenceReader;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.ServerOpaquePrincipalSource;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.elder.application.ElderIdentitySource;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;
import com.wuhan.eldercare.visit.elder.application.UuidElderIdentitySource;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationPackageV1;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationProvisioner;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationRepository;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentEligibilityResolver;
import com.wuhan.eldercare.visit.institution.appointment.persistence.JdbcInstitutionAppointmentAuthorizationRepository;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.JdbcInstitutionRevisionRepository;
import com.wuhan.eldercare.visit.persistence.JdbcAppointmentOwnerReadRepository;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
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
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Real MySQL 8 evidence. Only runs against an explicitly marked isolated disposable loopback schema. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElderFoundationMySqlIntegrationTest {
    private static final String LEGACY_VISIT = "synthetic-legacy-visit-v8-preserved";
    private static final String LEGACY_OWNER = "synthetic-legacy-owner-without-binding";
    private static final String LEGACY_ELDER_ID = "legacy-elder-reference-no-backfill";
    private static final String RESTART_USER = "synthetic-restart-probe-user";
    private static final String RESTART_ELDER_ID = "elder_restart_probe_expected";
    private static final String INSTITUTION = "synthetic-institution-appointment-eligibility";
    private static final String NO_GRANT_INSTITUTION = "synthetic-institution-without-grant";
    private static final String DRAFT_INSTITUTION = "synthetic-unpublished-institution";
    private final ObjectMapper mapper = new ObjectMapper();
    private HikariDataSource dataSource;
    private JdbcElderRecordRepository elderRepository;
    private JdbcInstitutionRevisionRepository institutionRepository;
    private JdbcInstitutionAppointmentAuthorizationRepository authorizationRepository;
    private InstitutionAppointmentEligibilityResolver eligibilityResolver;
    private InstitutionAppointmentAuthorizationProvisioner provisioner;
    private Clock clock;

    @BeforeAll
    void migrateFromConfiguredLegacyBaselineAndCapturePreservationEvidence() throws Exception {
        String url = System.getenv("ELDER_FOUNDATION_MYSQL_URL");
        String username = System.getenv("ELDER_FOUNDATION_MYSQL_USERNAME");
        assumeTrue("true".equalsIgnoreCase(System.getenv("ELDER_FOUNDATION_DISPOSABLE_MYSQL")),
                "explicit disposable MySQL marker required");
        assumeTrue(url != null && url.startsWith("jdbc:mysql://127.0.0.1:") && username != null,
                "isolated loopback MySQL URL and test username required");
        URI uri = URI.create("http://" + url.substring("jdbc:mysql://".length()).split("\\?", 2)[0]);
        assumeTrue(uri.getPort() > 0 && uri.getPort() != 3306 && uri.getPath().contains("disposable"),
                "Owner port/schema forbidden");

        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("ELDER_FOUNDATION_MYSQL_PASSWORD", ""));
        dataSource.setMaximumPoolSize(20);
        dataSource.setPoolName("elder-foundation-disposable-test");
        assertTrue(mysqlVersion().startsWith("8."));

        String startVersion = System.getenv().getOrDefault("ELDER_FOUNDATION_MYSQL_START_VERSION", "1");
        assumeTrue("1".equals(startVersion) || "7".equals(startVersion), "baseline must be V1 or V7");
        Flyway base = Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion(startVersion)).baselineOnMigrate(false).load();
        assumeTrue(base.info().current() == null, "integration schema must be fresh for migration baseline evidence");
        base.migrate();
        assertEquals(startVersion, base.info().current().getVersion().getVersion());
        insertLegacyVisit();
        int beforeVisitCount = rowCount("SELECT COUNT(*) FROM institution_visit_v1");
        String beforeLegacyElderId = scalarString("SELECT elder_id FROM institution_visit_v1 WHERE visit_id = ?", LEGACY_VISIT);

        Flyway latest = Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .baselineOnMigrate(false).load();
        latest.migrate();
        assertEquals("8", latest.info().current().getVersion().getVersion());
        assertEquals(beforeVisitCount, rowCount("SELECT COUNT(*) FROM institution_visit_v1"));
        assertEquals(1, rowCount("SELECT COUNT(*) FROM institution_visit_v1 WHERE visit_id = '" + LEGACY_VISIT + "'"));
        assertEquals(beforeLegacyElderId,
                scalarString("SELECT elder_id FROM institution_visit_v1 WHERE visit_id = ?", LEGACY_VISIT));
        assertEquals(0, rowCount("SELECT COUNT(*) FROM elder_record_v1 WHERE elder_id = '" + LEGACY_ELDER_ID + "'"));
        assertEquals(0, rowCount("SELECT COUNT(*) FROM elder_record_v1 WHERE responsible_user_id = '" + LEGACY_OWNER + "'"));
        assertEquals(0, rowCount("SELECT COUNT(*) FROM institution_appointment_authorization_event_v1"));
        assertEquals(0, rowCount("SELECT COUNT(*) FROM elder_record_v1"));

        latest.migrate();
        assertEquals("8", latest.info().current().getVersion().getVersion(), "repeat migration must be a no-op");
        assertEquals(1, rowCount("SELECT COUNT(*) FROM institution_visit_v1 WHERE visit_id = '" + LEGACY_VISIT + "'"));

        elderRepository = new JdbcElderRecordRepository(dataSource);
        clock = Clock.fixed(Instant.parse("2026-09-27T00:00:00Z"), ZoneOffset.UTC);
        institutionRepository = new JdbcInstitutionRevisionRepository(dataSource, mapper,
                (snapshot) -> null);
        authorizationRepository = new JdbcInstitutionAppointmentAuthorizationRepository(dataSource);
        eligibilityResolver = new InstitutionAppointmentEligibilityResolver(institutionRepository, authorizationRepository);
        provisioner = new InstitutionAppointmentAuthorizationProvisioner(authorizationRepository,
                eligibilityResolver, clock);
        seedAppointmentRevisions();
        seedRestartProbe();
    }

    @AfterAll
    void closePool() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void migrationPreservesOwnerReadOfOldVisitWithoutRequiringElderForeignKey() {
        var result = new JdbcAppointmentOwnerReadRepository(dataSource)
                .findAllOwned(new TrustedPrincipal(LEGACY_OWNER));
        assertEquals(com.wuhan.eldercare.visit.application.AppointmentOwnerReadRepository.Result.Status.READY,
                result.status());
        assertEquals(1, result.visits().size());
        assertEquals(LEGACY_VISIT, result.visits().getFirst().visitId());
        assertEquals(1, rowCount("SELECT COUNT(*) FROM institution_visit_v1 WHERE elder_id = '" + LEGACY_ELDER_ID + "'"));
        assertEquals(0, rowCount("SELECT COUNT(*) FROM elder_record_v1 WHERE elder_id = '" + LEGACY_ELDER_ID + "'"));
    }

    @Test
    void c5PrincipalCreatesOneStableRecordAndForeignOrUnknownAssertionsAreIndistinguishable() {
        C5Session owner = issueSession("binding-owner");
        C5Session foreign = issueSession("binding-foreign");
        ElderIdentitySource ids = new UuidElderIdentitySource(clock);
        ElderRecordService service = new ElderRecordService(owner.resolver(), elderRepository, ids);

        assertEquals(ElderRecordService.Availability.NOT_FOUND, service.resolveCurrent(owner.evidence()).availability());
        var created = service.establishCurrent(owner.evidence());
        var repeated = service.establishCurrent(owner.evidence());
        var resolved = service.resolveCurrent(owner.evidence());

        assertEquals(ElderRecordService.Establishment.Status.CREATED, created.status());
        assertEquals(ElderRecordService.Establishment.Status.ALREADY_BOUND, repeated.status());
        assertEquals(created.record().elderId(), repeated.record().elderId());
        assertEquals(created.record().elderId(), resolved.record().elderId());
        assertTrue(created.record().elderId().startsWith("elder_"));
        assertNotEquals(owner.principal().userId(), created.record().elderId());
        assertEquals(1, countOwner(created.record().responsibleUserId()));

        ElderRecordService foreignService = new ElderRecordService(foreign.resolver(), elderRepository, ids);
        assertEquals(ElderRecordService.Availability.NOT_FOUND,
                foreignService.resolveCurrent(foreign.evidence()).availability());
        assertEquals(ReferenceAuthorizer.Authorization.UNAUTHORIZED,
                service.authorizeAssertion(foreign.principal(), created.record().elderId()));
        assertEquals(ReferenceAuthorizer.Authorization.UNAUTHORIZED,
                service.authorizeAssertion(owner.principal(), "elder_unknown_synthetic"));
        assertEquals(ReferenceAuthorizer.Authorization.UNAUTHORIZED,
                service.authorizeAssertion(owner.principal(), "elder_foreign_synthetic"));
        assertEquals(ReferenceAuthorizer.Authorization.AUTHORIZED,
                service.authorizeAssertion(owner.principal(), created.record().elderId()));
    }

    @Test
    void c5ExpiredRevokedAndMissingSessionsCannotCreateOrResolvePrivateRecords() {
        C5Fixture owner = createIdentity("invalid-session-owner");
        String validEvidence = "synthetic-expiring-session-" + UUID.randomUUID();
        String digest = sha256(validEvidence);
        Instant issued = Instant.parse("2026-09-27T00:00:00Z");
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                owner.repository().createOrLogin("synthetic-elder-test", sha256("subject-expired"), digest,
                        issued, issued.plusSeconds(60)).status());
        AuthEvidenceResolver expiredResolver = new C5AuthEvidenceResolver(owner.repository(),
                evidence -> Optional.of(sha256(evidence)), Clock.fixed(issued.plusSeconds(60), ZoneOffset.UTC));
        ElderRecordService expiredService = new ElderRecordService(expiredResolver, elderRepository, new UuidElderIdentitySource(clock));
        var expired = expiredService.establishCurrent(validEvidence);
        assertEquals(AuthEvidenceResolver.Resolution.Status.EXPIRED, expired.authStatus());
        assertEquals(null, expired.status());
        assertEquals(0, countOwner(owner.userId()));

        String activeEvidence = "synthetic-revoked-session-" + UUID.randomUUID();
        Instant future = issued.plusSeconds(3600);
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                owner.repository().createOrLogin("synthetic-elder-test", sha256("subject-expired"),
                        sha256(activeEvidence), issued, future).status());
        assertEquals(AuthIdentitySessionRepository.RevokeResult.Status.REVOKED,
                owner.repository().revokeSession(sha256(activeEvidence), issued.plusSeconds(5)).status());
        AuthEvidenceResolver revokedResolver = new C5AuthEvidenceResolver(owner.repository(),
                evidence -> Optional.of(sha256(evidence)), Clock.fixed(issued.plusSeconds(10), ZoneOffset.UTC));
        ElderRecordService activeService = new ElderRecordService(revokedResolver, elderRepository,
                new UuidElderIdentitySource(clock));
        assertEquals(AuthEvidenceResolver.Resolution.Status.INVALID,
                activeService.resolveCurrent(activeEvidence).authStatus());
        assertEquals(0, countOwner(owner.userId()));
        assertEquals(AuthEvidenceResolver.Resolution.Status.MISSING,
                activeService.resolveCurrent(null).authStatus());
    }

    @Test
    void concurrentCreateAttemptsConvergeOnOneDatabaseBinding() throws Exception {
        C5Session owner = issueSession("concurrent-owner");
        AtomicInteger sequence = new AtomicInteger();
        ElderIdentitySource ids = new ElderIdentitySource() {
            @Override public String newElderId() { return "elder_concurrent_" + sequence.incrementAndGet(); }
            @Override public Instant createdAt() { return clock.instant(); }
        };
        ElderRecordService service = new ElderRecordService(owner.resolver(), elderRepository, ids);
        int workers = 2;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(workers);
        try {
            List<java.util.concurrent.Future<ElderRecordService.Establishment>> pending = new ArrayList<>();
            for (int index = 0; index < workers; index++) {
                pending.add(pool.submit(() -> {
                    ready.countDown();
                    assertTrue(start.await(10, TimeUnit.SECONDS));
                    return service.establishCurrent(owner.evidence());
                }));
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            List<ElderRecordService.Establishment> results = new ArrayList<>();
            for (var future : pending) results.add(future.get(30, TimeUnit.SECONDS));
            Set<String> elderIds = results.stream().map(result -> result.record().elderId()).collect(java.util.stream.Collectors.toSet());
            assertEquals(1, elderIds.size());
            assertEquals(1, countOwner(owner.principal().userId()));
            assertTrue(results.stream().anyMatch(result -> result.status() == ElderRecordService.Establishment.Status.CREATED));
            assertTrue(results.stream().allMatch(result -> result.status() == ElderRecordService.Establishment.Status.CREATED
                    || result.status() == ElderRecordService.Establishment.Status.ALREADY_BOUND));
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void databaseConstraintsAndSingleRowTransactionRejectDuplicateOrOrphanBinding() throws Exception {
        C5Session owner = issueSession("constraint-owner");
        C5Session second = issueSession("constraint-second-owner");
        ElderRecord first = new ElderRecord("elder_constraint_unique", owner.principal().userId(), clock.instant());
        assertEquals(ElderRecordRepository.Establish.Status.CREATED, elderRepository.establish(first).status());
        var duplicateOwner = elderRepository.establish(new ElderRecord(
                "elder_constraint_duplicate-owner", owner.principal().userId(), clock.instant()));
        assertEquals(ElderRecordRepository.Establish.Status.ALREADY_BOUND, duplicateOwner.status());
        assertEquals(first.elderId(), duplicateOwner.record().elderId());

        assertEquals(ElderRecordRepository.Establish.Status.TECHNICAL_FAILURE,
                elderRepository.establish(new ElderRecord("elder_constraint_unique",
                        second.principal().userId(), clock.instant())).status());
        assertEquals(ElderRecordRepository.Establish.Status.TECHNICAL_FAILURE,
                elderRepository.establish(new ElderRecord("elder_constraint_orphan",
                        "synthetic-nonexistent-c5-user", clock.instant())).status());
        C5Session rollbackOwner = issueSession("rollback-owner");
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TRIGGER trg_elder_foundation_test_reject_insert BEFORE INSERT ON elder_record_v1 "
                    + "FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic transaction rollback evidence'");
        }
        try {
            assertEquals(ElderRecordRepository.Establish.Status.TECHNICAL_FAILURE,
                    elderRepository.establish(new ElderRecord("elder_transaction_rollback", rollbackOwner.userId(),
                            clock.instant())).status());
            assertEquals(0, countOwner(rollbackOwner.userId()));
        } finally {
            try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP TRIGGER trg_elder_foundation_test_reject_insert");
            }
        }
        assertEquals(1, countOwner(owner.principal().userId()));
        assertEquals(0, countOwner(second.principal().userId()));
        assertThrows(IllegalArgumentException.class,
                () -> new ElderRecord("elder_constraint_null-owner", " ", clock.instant()));
        assertEquals(0, rowCount("SELECT COUNT(*) FROM institution_visit_v1 WHERE visit_id = 'elder_constraint_unique'"));
    }

    @Test
    void explicitAppointmentReferencesRequireExactCurrentPublishedAndAuthorizedRevision() throws Exception {
        C5Session owner = issueSession("reference-owner");
        ElderRecordService elderService = new ElderRecordService(owner.resolver(), elderRepository,
                new UuidElderIdentitySource(clock));
        ElderRecord elder = elderService.establishCurrent(owner.evidence()).record();

        appendEvent("synthetic-historical-grant", INSTITUTION, 1,
                InstitutionAppointmentAuthorizationRepository.Event.State.AUTHORIZED);
        seedRevision(NO_GRANT_INSTITUTION, 1, "published");
        seedRevision(DRAFT_INSTITUTION, 1, "draft");
        appendEvent("synthetic-draft-grant", DRAFT_INSTITUTION, 1,
                InstitutionAppointmentAuthorizationRepository.Event.State.AUTHORIZED);

        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_CURRENT,
                eligibilityResolver.resolve(INSTITUTION, "1").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_AUTHORIZED,
                eligibilityResolver.resolve(INSTITUTION, "2").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_PUBLISHED,
                eligibilityResolver.resolve(DRAFT_INSTITUTION, "1").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_AUTHORIZED,
                eligibilityResolver.resolve(NO_GRANT_INSTITUTION, "1").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_FOUND,
                eligibilityResolver.resolve("synthetic-missing-institution", "1").status());

        var grant = new InstitutionAppointmentAuthorizationPackageV1("synthetic-current-grant",
                InstitutionAppointmentAuthorizationPackageV1.Action.AUTHORIZE, INSTITUTION, 2,
                "controlled-approval-reference:synthetic", "operator:synthetic-reviewer");
        int revisionsBeforeGrant = rowCount("SELECT COUNT(*) FROM institution_record_revision_v1");
        assertEquals(InstitutionAppointmentAuthorizationProvisioner.Status.APPLIED, provisioner.apply(grant).status());
        assertEquals(InstitutionAppointmentAuthorizationProvisioner.Status.REPLAYED, provisioner.apply(grant).status());
        var sameOperationChangedInput = new InstitutionAppointmentAuthorizationPackageV1("synthetic-current-grant",
                InstitutionAppointmentAuthorizationPackageV1.Action.AUTHORIZE, INSTITUTION, 2,
                "different-provenance", "operator:synthetic-reviewer");
        assertEquals(InstitutionAppointmentAuthorizationProvisioner.Status.CONFLICT,
                provisioner.apply(sameOperationChangedInput).status());
        assertEquals(revisionsBeforeGrant, rowCount("SELECT COUNT(*) FROM institution_record_revision_v1"));
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.ELIGIBLE,
                eligibilityResolver.resolve(INSTITUTION, "2").status());

        AppointmentReferenceReader referenceReader = new ProductionAppointmentReferenceReader(elderService, eligibilityResolver);
        assertEquals(AppointmentReferenceReader.Status.AUTHORIZED,
                referenceReader.resolve(owner.principal(), elder.elderId(), INSTITUTION, "2").status());
        assertEquals(AppointmentReferenceReader.Status.UNAUTHORIZED,
                referenceReader.resolve(owner.principal(), "elder_foreign_or_unknown", INSTITUTION, "2").status());
        assertEquals(AppointmentReferenceReader.Status.UNAUTHORIZED,
                referenceReader.resolve(issueSession("reference-foreign").principal(), elder.elderId(),
                        INSTITUTION, "2").status());

        var revoke = new InstitutionAppointmentAuthorizationPackageV1("synthetic-current-revoke",
                InstitutionAppointmentAuthorizationPackageV1.Action.REVOKE, INSTITUTION, 2,
                "controlled-revocation-reference:synthetic", "operator:synthetic-reviewer");
        assertEquals(InstitutionAppointmentAuthorizationProvisioner.Status.APPLIED, provisioner.apply(revoke).status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_AUTHORIZED,
                eligibilityResolver.resolve(INSTITUTION, "2").status());
        assertEquals(AppointmentReferenceReader.Status.UNAUTHORIZED,
                referenceReader.resolve(owner.principal(), elder.elderId(), INSTITUTION, "2").status());
        assertEquals(1, countOwner(elder.responsibleUserId()));
        assertEquals(1, rowCount("SELECT COUNT(*) FROM institution_visit_v1 WHERE visit_id = '" + LEGACY_VISIT + "'"));
        assertEquals(0, rowCount("SELECT COUNT(*) FROM institution_visit_v1 WHERE visit_id LIKE 'visit_%' "
                + "AND visit_id <> '" + LEGACY_VISIT + "'"));
    }

    @Test
    void elderSchemaStoresOnlyOpaqueIdentityBindingAndServerTime() throws Exception {
        Set<String> columns = columns("elder_record_v1");
        assertEquals(Set.of("elder_id", "responsible_user_id", "created_at"), columns);
        assertFalse(columns.contains("phone"));
        assertFalse(columns.contains("assessment_id"));
        assertFalse(columns.contains("health_answers"));
        assertFalse(columns.contains("profile_id"));
        C5Session owner = issueSession("timestamp-owner");
        var created = new ElderRecordService(owner.resolver(), elderRepository, new UuidElderIdentitySource(clock))
                .establishCurrent(owner.evidence());
        assertNotNull(created.record().createdAt());
        assertEquals(Instant.parse("2026-09-27T00:00:00Z"), created.record().createdAt());
    }

    @Test
    void concurrentAuthorizationEventsResolveBySerializedAppendOrder() throws Exception {
        String institutionId = "synthetic-concurrent-authorization-institution";
        seedRevision(institutionId, 1, "published");
        int workers = 2;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(workers);
        try {
            List<java.util.concurrent.Future<InstitutionAppointmentAuthorizationRepository.Apply>> pending = new ArrayList<>();
            for (int index = 0; index < workers; index++) {
                final int eventIndex = index;
                pending.add(pool.submit(() -> {
                    ready.countDown();
                    assertTrue(start.await(10, TimeUnit.SECONDS));
                    return authorizationRepository.append(new InstitutionAppointmentAuthorizationRepository.Event(
                            "synthetic-concurrent-auth-event-" + eventIndex, institutionId, 1,
                            eventIndex == 0 ? InstitutionAppointmentAuthorizationRepository.Event.State.AUTHORIZED
                                    : InstitutionAppointmentAuthorizationRepository.Event.State.REVOKED,
                            "provenance:synthetic-" + eventIndex, "operator:synthetic", clock.instant()));
                }));
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            for (var future : pending) assertEquals(InstitutionAppointmentAuthorizationRepository.Apply.Status.APPLIED,
                    future.get(30, TimeUnit.SECONDS).status());
        } finally {
            pool.shutdownNow();
        }
        var latest = authorizationRepository.latest(institutionId, 1);
        assertTrue(latest.status() == InstitutionAppointmentAuthorizationRepository.Lookup.Status.AUTHORIZED
                || latest.status() == InstitutionAppointmentAuthorizationRepository.Lookup.Status.REVOKED);
        assertEquals(2, rowCount("SELECT COUNT(*) FROM institution_appointment_authorization_event_v1 "
                + "WHERE institution_id = '" + institutionId + "' AND record_revision = 1"));
    }

    private void seedRestartProbe() {
        C5Session probe = issueSessionWithIds(RESTART_USER, "restart-probe", () -> RESTART_USER);
        ElderIdentitySource deterministicForSyntheticProbe = new ElderIdentitySource() {
            @Override public String newElderId() { return RESTART_ELDER_ID; }
            @Override public Instant createdAt() { return clock.instant(); }
        };
        var result = new ElderRecordService(probe.resolver(), elderRepository, deterministicForSyntheticProbe)
                .establishCurrent(probe.evidence());
        assertEquals(ElderRecordService.Establishment.Status.CREATED, result.status());
        assertEquals(RESTART_ELDER_ID, result.record().elderId());
    }

    private C5Session issueSession(String suffix) {
        String userId = "synthetic-c5-" + suffix + "-" + UUID.randomUUID();
        return issueSessionWithIds(userId, suffix, () -> userId);
    }

    private C5Session issueSessionWithIds(String userId, String suffix, ServerOpaquePrincipalSource idSource) {
        AuthIdentitySessionRepository repository = new JdbcAuthIdentitySessionRepository(dataSource, idSource);
        String evidence = "synthetic-session-evidence-" + UUID.randomUUID();
        Instant issuedAt = Instant.parse("2026-09-27T00:00:00Z");
        assertEquals(AuthIdentitySessionRepository.LoginResult.Status.ISSUED,
                repository.createOrLogin("synthetic-provider", sha256("subject:" + suffix + ":" + UUID.randomUUID()),
                        sha256(evidence), issuedAt, issuedAt.plusSeconds(3600)).status());
        AuthEvidenceResolver resolver = new C5AuthEvidenceResolver(repository,
                value -> Optional.of(sha256(value)), clock);
        var authenticated = resolver.resolve(evidence);
        assertEquals(AuthEvidenceResolver.Resolution.Status.AUTHENTICATED, authenticated.status());
        assertEquals(userId, authenticated.principal().userId());
        return new C5Session(repository, resolver, authenticated.principal(), evidence, userId);
    }

    private C5Fixture createIdentity(String suffix) {
        String userId = "synthetic-c5-" + suffix + "-" + UUID.randomUUID();
        AuthIdentitySessionRepository repository = new JdbcAuthIdentitySessionRepository(dataSource, () -> userId);
        return new C5Fixture(repository, userId);
    }

    private void seedAppointmentRevisions() throws SQLException {
        seedRevision(INSTITUTION, 1, "published");
        seedRevision(INSTITUTION, 2, "published");
        updateHead(INSTITUTION, 2);
    }

    private void seedRevision(String institutionId, long revision, String recordStatus) throws SQLException {
        String json = "{\"institutionId\":\"" + institutionId + "\",\"recordRevision\":" + revision
                + ",\"recordStatus\":\"" + recordStatus + "\"}";
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("INSERT INTO institution_record_revision_v1 "
                     + "(institution_id, record_revision, contract_version, snapshot_json, operation_id, source_reference, "
                     + "operator_reference, published_at) VALUES (?, ?, 'institution-contract-v1.2.1', ?, ?, ?, ?, ?)")) {
            statement.setString(1, institutionId);
            statement.setLong(2, revision);
            statement.setString(3, json);
            statement.setString(4, "synthetic-publish-" + UUID.randomUUID());
            statement.setString(5, "synthetic:fixture-source");
            statement.setString(6, "operator:synthetic-fixture");
            statement.setTimestamp(7, java.sql.Timestamp.from(clock.instant()));
            statement.executeUpdate();
        }
        if (revision == 1) updateHead(institutionId, 1);
    }

    private void updateHead(String institutionId, long revision) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("INSERT INTO institution_current_head_v1 "
                     + "(institution_id, record_revision, promoted_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE "
                     + "record_revision = VALUES(record_revision), promoted_at = VALUES(promoted_at)")) {
            statement.setString(1, institutionId);
            statement.setLong(2, revision);
            statement.setTimestamp(3, java.sql.Timestamp.from(clock.instant()));
            statement.executeUpdate();
        }
    }

    private void appendEvent(String operationId, String institutionId, long revision,
                             InstitutionAppointmentAuthorizationRepository.Event.State state) {
        assertEquals(InstitutionAppointmentAuthorizationRepository.Apply.Status.APPLIED,
                authorizationRepository.append(new InstitutionAppointmentAuthorizationRepository.Event(
                        operationId, institutionId, revision, state, "provenance:synthetic-test",
                        "operator:synthetic-test", clock.instant())).status());
    }

    private void insertLegacyVisit() throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO institution_visit_v1 (visit_id,user_id,elder_id,institution_id,"
                    + "institution_record_revision,visit_date,visit_time_preference,participant_count,pickup_requested,"
                    + "contact_name,phone,phone_purpose,status,accepted_at) VALUES ('" + LEGACY_VISIT + "','" + LEGACY_OWNER
                    + "','" + LEGACY_ELDER_ID + "','synthetic-historical-institution','1','2026-10-01','morning',1,FALSE,"
                    + "'Synthetic Contact','00000000000','appointment_or_consultant_contact','requested','2026-09-27 00:00:00')");
        }
    }

    private long countOwner(String userId) {
        return scalarLong("SELECT COUNT(*) FROM elder_record_v1 WHERE responsible_user_id = ?", userId);
    }

    private int rowCount(String sql) {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(sql)) {
            assertTrue(rows.next());
            return rows.getInt(1);
        } catch (SQLException failure) {
            throw new IllegalStateException(failure);
        }
    }

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

    private Set<String> columns(String table) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?")) {
            statement.setString(1, table);
            try (ResultSet rows = statement.executeQuery()) {
                java.util.HashSet<String> names = new java.util.HashSet<>();
                while (rows.next()) names.add(rows.getString(1));
                return Set.copyOf(names);
            }
        }
    }

    private String mysqlVersion() throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT VERSION()")) {
            assertTrue(result.next());
            return result.getString(1);
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

    private record C5Session(AuthIdentitySessionRepository repository, AuthEvidenceResolver resolver,
                             TrustedPrincipal principal, String evidence, String userId) { }
    private record C5Fixture(AuthIdentitySessionRepository repository, String userId) { }
}
