package com.wuhan.eldercare.visit.lifecycle;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.application.AppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.VisitEvaluationContextService;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.operations.JdbcOperationsAuthorizationRepository;
import com.wuhan.eldercare.visit.operations.OperationsAuthorizationRepository;
import com.wuhan.eldercare.visit.operations.OperationsPrincipalResolver;
import com.wuhan.eldercare.visit.operations.OperationsProvisioningService;
import com.wuhan.eldercare.visit.operations.OperationsVisitAuthorizationResolver;
import com.wuhan.eldercare.visit.operations.Sha256OperationsCredentialHasher;
import com.wuhan.eldercare.visit.operations.TrustedOperationsPrincipal;
import com.wuhan.eldercare.visit.persistence.JdbcAppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitEvaluationContextRepository;
import com.wuhan.eldercare.visit.web.VisitLifecycleMutationController;
import com.wuhan.eldercare.visit.web.VisitLifecycleMutationRequestV1;
import com.wuhan.eldercare.visit.web.VisitLifecycleMutationResultV1;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.http.ResponseEntity;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Forward V7 and lifecycle persistence evidence on an explicitly disposable MySQL 8 service. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JdbcVisitLifecycleMutationMySqlIntegrationTest {
    private static final Instant NOW = Instant.parse("2026-09-26T10:00:00Z");
    private final ObjectMapper mapper = new ObjectMapper();
    private HikariDataSource baseDataSource;
    private HikariDataSource dataSource;
    private String schemaName;
    private String preMigrationVisitId;
    private String legacyCompletedVisitId;

    @BeforeAll
    void migrateV1ThroughV6ThenV7WithoutFabricatingHistory() throws Exception {
        String url = System.getenv("VISIT_LIFECYCLE_TEST_MYSQL_URL");
        String username = System.getenv("VISIT_LIFECYCLE_TEST_MYSQL_USERNAME");
        assumeTrue("true".equalsIgnoreCase(System.getenv("VISIT_LIFECYCLE_DISPOSABLE_MYSQL")),
                "explicit disposable MySQL marker is required");
        assumeTrue(url != null && !url.isBlank() && username != null && !username.isBlank(),
                "VISIT_LIFECYCLE_TEST_MYSQL_URL and username are required");
        URI uri = URI.create(url.substring("jdbc:".length()));
        String database = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
        assumeTrue(("127.0.0.1".equals(uri.getHost()) || "localhost".equals(uri.getHost()))
                        && uri.getPort() > 0 && uri.getPort() != 3306 && database.contains("disposable"),
                "lifecycle integration requires loopback disposable MySQL on a non-3306 port");

        baseDataSource = dataSource(url, username, System.getenv().getOrDefault("VISIT_LIFECYCLE_TEST_MYSQL_PASSWORD", ""),
                "visit-lifecycle-disposable-guard");
        schemaName = "visit_lifecycle_disposable_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection connection = baseDataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE DATABASE `" + schemaName + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
        }
        dataSource = dataSource("jdbc:mysql://" + uri.getAuthority() + "/" + schemaName, username,
                System.getenv().getOrDefault("VISIT_LIFECYCLE_TEST_MYSQL_PASSWORD", ""),
                "visit-lifecycle-disposable-test");

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("6")).load().migrate();
        assertTrue(mysqlVersion().matches("^8\\..+"), "lifecycle evidence requires MySQL 8.x");

        preMigrationVisitId = id("visit_pre_v7");
        legacyCompletedVisitId = id("visit_legacy_completed");
        insertVisit(preMigrationVisitId, "synthetic-owner-a", "requested");
        insertVisit(legacyCompletedVisitId, "synthetic-owner-b", "completed");

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals(1, rowCount("institution_visit_v1", "visit_id", preMigrationVisitId));
        assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", preMigrationVisitId));
        assertEquals("synthetic-owner-a", scalar("SELECT user_id FROM institution_visit_v1 WHERE visit_id = ?", preMigrationVisitId));
        assertEquals("synthetic-institution", scalar("SELECT institution_id FROM institution_visit_v1 WHERE visit_id = ?", preMigrationVisitId));
        assertEquals("rev-7", scalar("SELECT institution_record_revision FROM institution_visit_v1 WHERE visit_id = ?", preMigrationVisitId));
        assertEquals(0L, longScalar("SELECT lifecycle_version FROM institution_visit_v1 WHERE visit_id = ?", preMigrationVisitId));
        assertNull(nullableScalar("SELECT scheduled_at FROM institution_visit_v1 WHERE visit_id = ?", preMigrationVisitId));
        assertNull(nullableScalar("SELECT completed_at FROM institution_visit_v1 WHERE visit_id = ?", preMigrationVisitId));
        assertEquals("completed", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", legacyCompletedVisitId));
        assertNull(nullableScalar("SELECT completed_at FROM institution_visit_v1 WHERE visit_id = ?", legacyCompletedVisitId));
        assertEquals(0, tableCount("institution_visit_lifecycle_audit_v1"));
        for (int version = 1; version <= 7; version++) {
            assertEquals("1", scalar("SELECT COUNT(*) FROM flyway_schema_history WHERE version = ? AND success = 1",
                    Integer.toString(version)));
        }

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals("1", scalar("SELECT COUNT(*) FROM flyway_schema_history WHERE version = '7' AND success = 1"));
    }

    @AfterAll
    void closeAndDropOnlyTheGeneratedDisposableSchema() throws Exception {
        if (dataSource != null) dataSource.close();
        if (baseDataSource != null && schemaName != null && schemaName.matches("visit_lifecycle_disposable_[0-9a-f]{32}")) {
            try (Connection connection = baseDataSource.getConnection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP DATABASE IF EXISTS `" + schemaName + "`");
            }
        }
        if (baseDataSource != null) baseDataSource.close();
    }

    @Test
    void currentStatusEvidenceTimestampsNoOpReplayAndStableAuditRoundTrip() throws Exception {
        String visitId = id("visit_chain");
        insertVisit(visitId, "synthetic-owner", "requested");
        ProvisionedOperations operations = provision(visitId);
        VisitLifecycleMutationController controller = controller();

        var first = send(controller, operations.credential(), visitId,
                request("op-contact", "requested", "contacting", "follow_up_underway", "ops-log:contact-01", "2026-09-26T09:30:00Z"));
        assertEquals("accepted", first.result());
        assertEquals("contacting", first.receipt().status());
        assertEquals(NOW.toString(), first.receipt().recordedAt());
        assertEquals(1L, longScalar("SELECT lifecycle_version FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals(1, auditCount(visitId));

        var replay = send(controller, operations.credential(), visitId,
                request("op-contact", "requested", "contacting", "follow_up_underway", "ops-log:contact-01", "2026-09-26T09:30:00Z"));
        assertEquals("replayed", replay.result());
        assertEquals(first.receipt(), replay.receipt());
        assertEquals(1, auditCount(visitId));

        var differentReplay = send(controller, operations.credential(), visitId,
                request("op-contact", "requested", "scheduled", "confirmed_visit_plan", "ops-log:plan-02", "2026-10-02T09:00:00Z"));
        assertEquals("idempotency_conflict", differentReplay.result());
        assertEquals("contacting", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals(1, auditCount(visitId));

        var noOpRequest = request("op-noop", "contacting", "contacting", null, null, null);
        var noOp = send(controller, operations.credential(), visitId, noOpRequest);
        var repeatedNoOp = send(controller, operations.credential(), visitId, noOpRequest);
        assertEquals("no_op", noOp.result());
        assertEquals("no_op", repeatedNoOp.result(), "same-status C1 no-op stays distinct from accepted-command replay");
        assertEquals(noOp.receipt(), repeatedNoOp.receipt());
        assertEquals(2, auditCount(visitId));
        assertEquals(1L, longScalar("SELECT lifecycle_version FROM institution_visit_v1 WHERE visit_id = ?", visitId));

        var stale = send(controller, operations.credential(), visitId,
                request("op-stale", "requested", "scheduled", "confirmed_visit_plan", "ops-log:plan-stale", "2026-10-02T09:00:00Z"));
        assertEquals("conflict", stale.result());
        assertEquals("contacting", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals("CONFLICT", outcome("op-stale", operations.principalId()));

        var illegal = send(controller, operations.credential(), visitId,
                request("op-illegal", "contacting", "completed", "in_person_visit_occurred", "ops-log:completion-01", "2026-09-26T09:45:00Z"));
        assertEquals("illegal_transition", illegal.result());
        var missingEvidence = send(controller, operations.credential(), visitId,
                request("op-no-evidence", "contacting", "scheduled", null, null, null));
        assertEquals("evidence_insufficient", missingEvidence.result());
        assertEquals("contacting", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));

        Instant appointmentAt = Instant.parse("2026-10-02T09:00:00Z");
        var scheduled = send(controller, operations.credential(), visitId,
                request("op-schedule", "contacting", "scheduled", "confirmed_visit_plan", "ops-log:plan-03", appointmentAt.toString()));
        assertEquals("accepted", scheduled.result());
        assertEquals(appointmentAt.toString(), scheduled.receipt().scheduledAt());
        assertEquals(NOW.toString(), scheduled.receipt().recordedAt());
        assertNull(scheduled.receipt().completedAt());

        Instant actualVisitAt = NOW.minusSeconds(900);
        var completed = send(controller, operations.credential(), visitId,
                request("op-complete", "scheduled", "completed", "in_person_visit_occurred", "ops-log:actual-visit-03", actualVisitAt.toString()));
        assertEquals("accepted", completed.result());
        assertEquals("completed", completed.receipt().status());
        assertEquals(appointmentAt, instantScalar("SELECT scheduled_at FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals(actualVisitAt, instantScalar("SELECT completed_at FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals(NOW, instantScalar("SELECT recorded_at FROM institution_visit_lifecycle_audit_v1 WHERE operations_principal_id = ? AND operation_id = ?",
                operations.principalId(), "op-complete"));
        assertEquals("in_person_visit_occurred", outcomeEvidenceKind("op-complete", operations.principalId()));
        assertEquals("ops-log:actual-visit-03", outcomeEvidenceReference("op-complete", operations.principalId()));
        assertEquals(7, auditCount(visitId));

        // C1 status mutation remains the single server authority observed by existing read consumers.
        TrustedPrincipal owner = new TrustedPrincipal("synthetic-owner");
        AppointmentOwnerReadRepository.Result ownerRead = new JdbcAppointmentOwnerReadRepository(dataSource)
                .findAllOwned(owner);
        assertEquals(AppointmentOwnerReadRepository.Result.Status.READY, ownerRead.status());
        assertEquals("completed", ownerRead.visits().stream().filter(item -> item.visitId().equals(visitId))
                .findFirst().orElseThrow().visitStatus());

        AuthEvidenceResolver syntheticSession = ignored -> AuthEvidenceResolver.Resolution.authenticated(owner);
        VisitEvaluationContextService evaluationContext = new VisitEvaluationContextService(syntheticSession,
                new JdbcVisitEvaluationContextRepository(dataSource));
        VisitEvaluationContextService.Result eligibility = evaluationContext.load(visitId, "synthetic-session-evidence");
        assertEquals(VisitEvaluationContextService.AuthResolution.AUTHENTICATED, eligibility.authResolution());
        assertEquals(VisitEvaluationContextService.Availability.ELIGIBLE, eligibility.availability());
        assertEquals("completed", eligibility.context().visitStatus());
    }

    @Test
    void missingInvalidAndHiddenAuthorityFailClosedAndDoNotCreateMutationRows() throws Exception {
        String ownedVisit = id("visit_auth_owned");
        String ungrantedVisit = id("visit_auth_ungranted");
        insertVisit(ownedVisit, "synthetic-owner", "requested");
        insertVisit(ungrantedVisit, "synthetic-owner-b", "requested");
        ProvisionedOperations operations = provision(ownedVisit);
        VisitLifecycleMutationController controller = controller();
        var valid = request("op-auth-valid", "requested", "contacting", "follow_up_underway", null, null);

        assertEquals("auth_required", send(controller, null, ownedVisit, valid).result());
        assertEquals("auth_required", send(controller, "invalid-credential", ownedVisit, valid).result());
        var hiddenExisting = send(controller, operations.credential(), ungrantedVisit, valid);
        var hiddenUnknown = send(controller, operations.credential(), id("visit_unknown"), valid);
        assertEquals("not_found", hiddenExisting.result());
        assertEquals(hiddenExisting.result(), hiddenUnknown.result());
        assertEquals(0, auditCount(ownedVisit));
        assertEquals(0, auditCount(ungrantedVisit));
    }

    @Test
    void cancellationRequiresConfirmedOutcomeAndCancelledIsTerminal() throws Exception {
        String visitId = id("visit_cancellation");
        insertVisit(visitId, "synthetic-owner", "requested");
        ProvisionedOperations operations = provision(visitId);
        VisitLifecycleMutationController controller = controller();

        var missingEvidence = send(controller, operations.credential(), visitId,
                request("op-cancel-missing", "requested", "cancelled", null, null, null));
        assertEquals("evidence_insufficient", missingEvidence.result());
        assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals("EVIDENCE_INSUFFICIENT", outcome("op-cancel-missing", operations.principalId()));

        var wrongEvidence = send(controller, operations.credential(), visitId,
                request("op-cancel-wrong", "requested", "cancelled", "follow_up_underway",
                        "ops-log:not-a-cancellation", null));
        assertEquals("evidence_insufficient", wrongEvidence.result());
        assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals("EVIDENCE_INSUFFICIENT", outcome("op-cancel-wrong", operations.principalId()));

        var cancelled = send(controller, operations.credential(), visitId,
                request("op-cancel-confirmed", "requested", "cancelled", "cancellation_confirmed",
                        "ops-log:cancellation-09", null));
        assertEquals("accepted", cancelled.result());
        assertEquals("cancelled", cancelled.receipt().status());
        assertEquals("cancelled", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals("cancellation_confirmed", outcomeEvidenceKind("op-cancel-confirmed", operations.principalId()));

        var reopenTerminal = send(controller, operations.credential(), visitId,
                request("op-cancel-reopen", "cancelled", "contacting", "follow_up_underway",
                        "ops-log:attempt-reopen", null));
        assertEquals("illegal_transition", reopenTerminal.result());
        assertEquals("cancelled", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals("ILLEGAL_TRANSITION", outcome("op-cancel-reopen", operations.principalId()));
        assertEquals(4, auditCount(visitId));
    }

    @Test
    void contactingAndCompletionRequireMatchingOperationalEvidenceAndCompletedIsTerminal() throws Exception {
        String requestedVisitId = id("visit_contacting_evidence");
        String scheduledVisitId = id("visit_completion_evidence");
        insertVisit(requestedVisitId, "synthetic-owner", "requested");
        insertVisit(scheduledVisitId, "synthetic-owner", "scheduled");
        setVisitDate(scheduledVisitId, "2026-09-01");
        ProvisionedOperations operations = provision(requestedVisitId, scheduledVisitId);
        VisitLifecycleMutationController controller = controller();
        assertTrue(LocalDate.parse(scalar("SELECT visit_date FROM institution_visit_v1 WHERE visit_id = ?",
                scheduledVisitId)).isBefore(NOW.atZone(ZoneOffset.UTC).toLocalDate()));

        var missingContactFact = send(controller, operations.credential(), requestedVisitId,
                request("op-contact-missing-fact", "requested", "contacting", null, null, null));
        assertEquals("evidence_insufficient", missingContactFact.result());
        assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", requestedVisitId));
        assertEquals("EVIDENCE_INSUFFICIENT", outcome("op-contact-missing-fact", operations.principalId()));

        var wrongContactFact = send(controller, operations.credential(), requestedVisitId,
                request("op-contact-wrong-fact", "requested", "contacting", "cancellation_confirmed",
                        "ops-log:not-follow-up", null));
        assertEquals("evidence_insufficient", wrongContactFact.result());
        assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", requestedVisitId));
        assertEquals("EVIDENCE_INSUFFICIENT", outcome("op-contact-wrong-fact", operations.principalId()));
        assertEquals(2, auditCount(requestedVisitId));

        var missingCompletionFact = send(controller, operations.credential(), scheduledVisitId,
                request("op-complete-missing-fact", "scheduled", "completed", null, null, null));
        assertEquals("evidence_insufficient", missingCompletionFact.result());
        assertEquals("scheduled", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", scheduledVisitId));
        assertEquals("EVIDENCE_INSUFFICIENT", outcome("op-complete-missing-fact", operations.principalId()));

        var wrongCompletionFact = send(controller, operations.credential(), scheduledVisitId,
                request("op-complete-wrong-fact", "scheduled", "completed", "cancellation_confirmed",
                        "ops-log:not-in-person-visit", null));
        assertEquals("evidence_insufficient", wrongCompletionFact.result());
        assertEquals("scheduled", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", scheduledVisitId));
        assertEquals("EVIDENCE_INSUFFICIENT", outcome("op-complete-wrong-fact", operations.principalId()));

        Instant actualVisitAt = NOW.minusSeconds(600);
        var completed = send(controller, operations.credential(), scheduledVisitId,
                request("op-complete-valid", "scheduled", "completed", "in_person_visit_occurred",
                        "ops-log:actual-visit-10", actualVisitAt.toString()));
        assertEquals("accepted", completed.result());
        assertEquals("completed", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", scheduledVisitId));
        assertEquals(actualVisitAt, instantScalar("SELECT completed_at FROM institution_visit_v1 WHERE visit_id = ?",
                scheduledVisitId));

        var reopenCompleted = send(controller, operations.credential(), scheduledVisitId,
                request("op-complete-reopen", "completed", "contacting", "follow_up_underway",
                        "ops-log:attempt-reopen-completed", null));
        assertEquals("illegal_transition", reopenCompleted.result());
        assertEquals("completed", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", scheduledVisitId));
        assertEquals("ILLEGAL_TRANSITION", outcome("op-complete-reopen", operations.principalId()));
        assertEquals(4, auditCount(scheduledVisitId));
    }

    @Test
    void nanosecondClockAndFactInputsReturnStableMicrosecondReplayReceipt() throws Exception {
        String visitId = id("visit_precision");
        insertVisit(visitId, "synthetic-owner", "contacting");
        ProvisionedOperations operations = provision(visitId);
        Instant clockValue = Instant.parse("2026-09-26T10:00:00.123456789Z");
        Instant appointmentValue = Instant.parse("2026-10-02T09:00:00.987654321Z");
        VisitLifecycleMutationController controller = controller(Clock.fixed(clockValue, ZoneOffset.UTC));
        var request = request("op-precision", "contacting", "scheduled", "confirmed_visit_plan",
                "ops-log:precision-plan", appointmentValue.toString());

        var accepted = send(controller, operations.credential(), visitId, request);
        var replayed = send(controller, operations.credential(), visitId, request);

        Instant storedClock = clockValue.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        Instant storedAppointment = appointmentValue.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        assertEquals("accepted", accepted.result());
        assertEquals("replayed", replayed.result());
        assertEquals(accepted.receipt(), replayed.receipt());
        assertEquals(storedClock.toString(), accepted.receipt().recordedAt());
        assertEquals(storedAppointment.toString(), accepted.receipt().scheduledAt());
        assertEquals(storedClock, instantScalar(
                "SELECT recorded_at FROM institution_visit_lifecycle_audit_v1 "
                        + "WHERE operations_principal_id = ? AND operation_id = ?",
                operations.principalId(), "op-precision"));
        assertEquals(storedAppointment, instantScalar(
                "SELECT scheduled_at FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals(storedAppointment, instantScalar(
                "SELECT fact_at FROM institution_visit_lifecycle_audit_v1 "
                        + "WHERE operations_principal_id = ? AND operation_id = ?",
                operations.principalId(), "op-precision"));

        Instant actualVisitValue = Instant.parse("2026-09-26T09:58:00.123456789Z");
        Instant storedActualVisit = actualVisitValue.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        var completionRequest = request("op-completion-precision", "scheduled", "completed",
                "in_person_visit_occurred", "ops-log:precision-completion", actualVisitValue.toString());
        var completionAccepted = send(controller, operations.credential(), visitId, completionRequest);
        var completionReplay = send(controller, operations.credential(), visitId, completionRequest);
        assertEquals("accepted", completionAccepted.result());
        assertEquals("replayed", completionReplay.result());
        assertEquals(completionAccepted.receipt(), completionReplay.receipt());
        assertEquals(storedClock.toString(), completionAccepted.receipt().recordedAt());
        assertEquals(storedAppointment.toString(), completionAccepted.receipt().scheduledAt());
        assertEquals(storedActualVisit.toString(), completionAccepted.receipt().completedAt());
        assertEquals(storedAppointment, instantScalar(
                "SELECT scheduled_at FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals(storedActualVisit, instantScalar(
                "SELECT completed_at FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals(storedClock, instantScalar(
                "SELECT recorded_at FROM institution_visit_lifecycle_audit_v1 "
                        + "WHERE operations_principal_id = ? AND operation_id = ?",
                operations.principalId(), "op-completion-precision"));
        assertEquals(storedActualVisit, instantScalar(
                "SELECT fact_at FROM institution_visit_lifecycle_audit_v1 "
                        + "WHERE operations_principal_id = ? AND operation_id = ?",
                operations.principalId(), "op-completion-precision"));
        assertEquals(2, auditCount(visitId));
    }

    @Test
    void credentialRevokedAfterResolutionIsRecheckedInsideMutationTransaction() throws Exception {
        String visitId = id("visit_revoke_race");
        insertVisit(visitId, "synthetic-owner", "requested");
        ProvisionedOperations operations = provision(visitId);
        OperationsPrincipalResolver resolver = new OperationsPrincipalResolver(
                new JdbcOperationsAuthorizationRepository(dataSource), new Sha256OperationsCredentialHasher());
        var resolved = resolver.resolve(operations.credential());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.READY, resolved.status());
        TrustedOperationsPrincipal trustedPrincipal = resolved.principal();

        revokePrincipal(operations.principalId());
        VisitLifecycleMutationCommandV1 command = VisitLifecycleMutationCommandV1.create("op-after-revoke",
                "requested", "contacting", "follow_up_underway", "ops-log:after-revoke", null);
        var result = new JdbcVisitLifecycleMutationRepository(dataSource, new VisitLifecycleTransitionEvaluatorV1())
                .mutate(trustedPrincipal, visitId, command, NOW);

        assertEquals(VisitLifecycleMutationRepository.Result.Status.AUTH_REQUIRED, result.status());
        assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));
        assertEquals(0, auditCount(visitId));
    }

    @Test
    void auditInsertFailureRollsBackTheStatusUpdate() throws Exception {
        String visitId = id("visit_atomic");
        insertVisit(visitId, "synthetic-owner", "requested");
        ProvisionedOperations operations = provision(visitId);
        String trigger = "reject_lifecycle_audit_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TRIGGER `" + trigger + "` BEFORE INSERT ON institution_visit_lifecycle_audit_v1 "
                    + "FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic audit failure'");
        }
        try {
            var response = send(controller(), operations.credential(), visitId,
                    request("op-atomic", "requested", "contacting", "follow_up_underway", "ops-log:atomic", null));
            assertEquals("technical_failure", response.result());
            assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId));
            assertEquals(0, auditCount(visitId));
        } finally {
            try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP TRIGGER IF EXISTS `" + trigger + "`");
            }
        }
    }

    @Test
    void concurrentCommandsAgainstSameExpectedStatusProduceOneTransitionAndOneConflict() throws Exception {
        String visitId = id("visit_concurrent");
        insertVisit(visitId, "synthetic-owner", "requested");
        ProvisionedOperations operations = provision(visitId);
        VisitLifecycleMutationController controller = controller();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<ResponseEntity<VisitLifecycleMutationResultV1>> first = pool.submit(() -> {
                ready.countDown();
                start.await();
                return controller.mutate(visitId, operations.credential(), wireRequest(request("op-race-contact", "requested",
                        "contacting", "follow_up_underway", "ops-log:race-contact", null)));
            });
            Future<ResponseEntity<VisitLifecycleMutationResultV1>> second = pool.submit(() -> {
                ready.countDown();
                start.await();
                return controller.mutate(visitId, operations.credential(), wireRequest(request("op-race-schedule", "requested",
                        "scheduled", "confirmed_visit_plan", "ops-log:race-plan", "2026-10-02T09:00:00Z")));
            });
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            List<String> outcomes = List.of(first.get(15, TimeUnit.SECONDS).getBody().result(),
                    second.get(15, TimeUnit.SECONDS).getBody().result());

            assertEquals(1, outcomes.stream().filter("accepted"::equals).count(), outcomes.toString());
            assertEquals(1, outcomes.stream().filter("conflict"::equals).count(), outcomes.toString());
            assertTrue(List.of("contacting", "scheduled").contains(scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", visitId)));
            assertEquals(1L, longScalar("SELECT lifecycle_version FROM institution_visit_v1 WHERE visit_id = ?", visitId));
            assertEquals(2, auditCount(visitId));
            assertEquals(1, outcomeCount(visitId, "ACCEPTED"));
            assertEquals(1, outcomeCount(visitId, "CONFLICT"));
        } finally {
            pool.shutdownNow();
        }
    }

    private VisitLifecycleMutationController controller() {
        return controller(Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private VisitLifecycleMutationController controller(Clock clock) {
        var operationsRepository = new JdbcOperationsAuthorizationRepository(dataSource);
        var hasher = new Sha256OperationsCredentialHasher();
        var service = new VisitLifecycleMutationService(new OperationsPrincipalResolver(operationsRepository, hasher),
                new OperationsVisitAuthorizationResolver(operationsRepository),
                new JdbcVisitLifecycleMutationRepository(dataSource, new VisitLifecycleTransitionEvaluatorV1()),
                clock);
        return new VisitLifecycleMutationController(service);
    }

    private ProvisionedOperations provision(String... visitIds) {
        String principalId = "ops_" + UUID.randomUUID().toString().replace("-", "");
        String credential = credential();
        ObjectNode input = mapper.createObjectNode();
        input.put("packageVersion", "operations-provisioning-command-v1");
        input.put("operationId", id("operation-enroll"));
        input.put("operationType", "PROVISION_PRINCIPAL");
        input.put("approvalReference", "approval:lifecycle-synthetic-test");
        input.put("provisioningActorReference", "deployment:lifecycle-mysql-test");
        input.put("operationsPrincipalId", principalId);
        input.put("verifiedActorReference", "verified-ops-actor:synthetic-fixture-" + principalId.substring(4, 12));
        var visits = input.putArray("visitIds");
        for (String visitId : visitIds) visits.add(visitId);

        var repository = new JdbcOperationsAuthorizationRepository(dataSource);
        var provisioner = new OperationsProvisioningService(repository, new Sha256OperationsCredentialHasher(),
                Clock.fixed(NOW, ZoneOffset.UTC));
        OperationsAuthorizationRepository.ProvisioningResolution result = provisioner.execute(input, credential);
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED, result.status());
        return new ProvisionedOperations(principalId, credential);
    }

    private void revokePrincipal(String principalId) {
        ObjectNode input = mapper.createObjectNode();
        input.put("packageVersion", "operations-provisioning-command-v1");
        input.put("operationId", id("operation-revoke"));
        input.put("operationType", "REVOKE_PRINCIPAL");
        input.put("approvalReference", "approval:lifecycle-synthetic-revoke");
        input.put("provisioningActorReference", "deployment:lifecycle-mysql-test");
        input.put("operationsPrincipalId", principalId);
        var result = new OperationsProvisioningService(new JdbcOperationsAuthorizationRepository(dataSource),
                new Sha256OperationsCredentialHasher(), Clock.fixed(NOW.plusSeconds(1), ZoneOffset.UTC))
                .execute(input, null);
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED, result.status());
    }

    private static VisitLifecycleMutationService.Request request(String operationId, String expected, String target,
                                                                 String kind, String reference, String factAt) {
        return new VisitLifecycleMutationService.Request(operationId, expected, target, kind, reference, factAt);
    }

    private static VisitLifecycleMutationResultV1 send(VisitLifecycleMutationController controller, String credential,
                                                       String visitId, VisitLifecycleMutationService.Request request) {
        return controller.mutate(visitId, credential, wireRequest(request)).getBody();
    }

    private static VisitLifecycleMutationRequestV1 wireRequest(VisitLifecycleMutationService.Request request) {
        VisitLifecycleMutationRequestV1.EvidenceV1 evidence = request.evidenceKind() == null
                ? null : new VisitLifecycleMutationRequestV1.EvidenceV1(request.evidenceKind(),
                request.evidenceReference(), request.factAt());
        return new VisitLifecycleMutationRequestV1(request.operationId(), request.expectedStatus(),
                request.targetStatus(), evidence);
    }

    private void insertVisit(String visitId, String ownerId, String status) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO institution_visit_v1 (visit_id, user_id, elder_id, institution_id, "
                        + "institution_record_revision, visit_date, visit_time_preference, participant_count, "
                        + "pickup_requested, contact_name, phone, phone_purpose, status, accepted_at, notes) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            statement.setString(1, visitId);
            statement.setString(2, ownerId);
            statement.setString(3, "synthetic-elder");
            statement.setString(4, "synthetic-institution");
            statement.setString(5, "rev-7");
            statement.setString(6, "2026-10-01");
            statement.setString(7, "morning");
            statement.setInt(8, 1);
            statement.setBoolean(9, false);
            statement.setString(10, "Synthetic Fixture");
            statement.setString(11, "0000000000");
            statement.setString(12, "appointment_or_consultant_contact");
            statement.setString(13, status);
            statement.setTimestamp(14, java.sql.Timestamp.from(NOW));
            statement.setString(15, null);
            statement.executeUpdate();
        }
    }

    private void setVisitDate(String visitId, String visitDate) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "UPDATE institution_visit_v1 SET visit_date = ? WHERE visit_id = ?")) {
            statement.setString(1, visitDate);
            statement.setString(2, visitId);
            assertEquals(1, statement.executeUpdate());
        }
    }

    private int auditCount(String visitId) throws SQLException {
        return intScalar("SELECT COUNT(*) FROM institution_visit_lifecycle_audit_v1 WHERE visit_id = ?", visitId);
    }

    private int outcomeCount(String visitId, String outcome) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM institution_visit_lifecycle_audit_v1 WHERE visit_id = ? AND outcome = ?")) {
            statement.setString(1, visitId);
            statement.setString(2, outcome);
            try (ResultSet result = statement.executeQuery()) { result.next(); return result.getInt(1); }
        }
    }

    private String outcome(String operationId, String principalId) throws SQLException {
        return scalar("SELECT outcome FROM institution_visit_lifecycle_audit_v1 WHERE operations_principal_id = ? AND operation_id = ?",
                principalId, operationId);
    }

    private String outcomeEvidenceKind(String operationId, String principalId) throws SQLException {
        return scalar("SELECT evidence_kind FROM institution_visit_lifecycle_audit_v1 WHERE operations_principal_id = ? AND operation_id = ?",
                principalId, operationId);
    }

    private String outcomeEvidenceReference(String operationId, String principalId) throws SQLException {
        return scalar("SELECT evidence_reference FROM institution_visit_lifecycle_audit_v1 WHERE operations_principal_id = ? AND operation_id = ?",
                principalId, operationId);
    }

    private int rowCount(String table, String column, String value) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?")) {
            statement.setString(1, value);
            try (ResultSet result = statement.executeQuery()) { result.next(); return result.getInt(1); }
        }
    }

    private int tableCount(String table) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            result.next(); return result.getInt(1);
        }
    }

    private int intScalar(String sql, String value) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet result = statement.executeQuery()) { result.next(); return result.getInt(1); }
        }
    }

    private long longScalar(String sql, String value) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet result = statement.executeQuery()) { result.next(); return result.getLong(1); }
        }
    }

    private String scalar(String sql, String value) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet result = statement.executeQuery()) { result.next(); return result.getString(1); }
        }
    }

    private String scalar(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            result.next(); return result.getString(1);
        }
    }

    private String scalar(String sql, String first, String second) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, first);
            statement.setString(2, second);
            try (ResultSet result = statement.executeQuery()) { result.next(); return result.getString(1); }
        }
    }

    private String nullableScalar(String sql, String value) throws SQLException {
        return scalar(sql, value);
    }

    private Instant instantScalar(String sql, String value) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                java.sql.Timestamp timestamp = result.getTimestamp(1);
                return timestamp == null ? null : timestamp.toInstant();
            }
        }
    }

    private Instant instantScalar(String sql, String first, String second) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, first);
            statement.setString(2, second);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                java.sql.Timestamp timestamp = result.getTimestamp(1);
                return timestamp == null ? null : timestamp.toInstant();
            }
        }
    }

    private String mysqlVersion() throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT VERSION()")) {
            result.next(); return result.getString(1);
        }
    }

    private static HikariDataSource dataSource(String url, String username, String password, String poolName) {
        HikariDataSource source = new HikariDataSource();
        source.setJdbcUrl(url);
        source.setUsername(username);
        source.setPassword(password);
        source.setMaximumPoolSize(12);
        source.setMinimumIdle(0);
        source.setPoolName(poolName);
        return source;
    }

    private static String credential() {
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        return "ops1_" + Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    }

    private static String id(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "");
    }

    private record ProvisionedOperations(String principalId, String credential) { }
}
