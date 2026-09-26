package com.wuhan.eldercare.visit.operations;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.application.AppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.persistence.JdbcAppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitEvaluationContextRepository;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.net.URI;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** MySQL 8 evidence on a uniquely named schema inside an explicitly disposable loopback service. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JdbcOperationsAuthorizationMySqlIntegrationTest {
    private static final Instant NOW = Instant.parse("2026-09-26T00:00:00Z");
    private final ObjectMapper mapper = new ObjectMapper();
    private HikariDataSource baseDataSource;
    private HikariDataSource dataSource;
    private String schemaName;
    private String preservedVisitId;
    private String visitA1;
    private String visitA2;
    private String visitB1;
    private String visitWithoutGrant;

    @BeforeAll
    void migrateFromV5AndPreserveRepresentativeVisit() throws Exception {
        String url = System.getenv("OPERATIONS_AUTH_TEST_MYSQL_URL");
        String username = System.getenv("OPERATIONS_AUTH_TEST_MYSQL_USERNAME");
        assumeTrue("true".equalsIgnoreCase(System.getenv("OPERATIONS_AUTH_DISPOSABLE_MYSQL")),
                "explicit disposable MySQL marker is required");
        assumeTrue(url != null && !url.isBlank() && username != null && !username.isBlank(),
                "OPERATIONS_AUTH_TEST_MYSQL_URL and username are required");
        URI uri = URI.create(url.substring("jdbc:".length()));
        String database = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
        assumeTrue("127.0.0.1".equals(uri.getHost()) || "localhost".equals(uri.getHost()),
                "Operations integration must use an explicitly addressed loopback MySQL service");
        assumeTrue(uri.getPort() > 0 && uri.getPort() != 3306 && database.contains("disposable"),
                "Owner MySQL 3306 is forbidden; schema must be marked disposable");

        baseDataSource = new HikariDataSource();
        baseDataSource.setJdbcUrl(url);
        baseDataSource.setUsername(username);
        baseDataSource.setPassword(System.getenv().getOrDefault("OPERATIONS_AUTH_TEST_MYSQL_PASSWORD", ""));
        baseDataSource.setMaximumPoolSize(8);
        baseDataSource.setMinimumIdle(0);
        baseDataSource.setPoolName("operations-auth-disposable-guard");

        schemaName = "operations_auth_disposable_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection connection = baseDataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE DATABASE `" + schemaName + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
        }
        String isolatedUrl = "jdbc:mysql://" + uri.getAuthority() + "/" + schemaName;
        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(isolatedUrl);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("OPERATIONS_AUTH_TEST_MYSQL_PASSWORD", ""));
        dataSource.setMaximumPoolSize(12);
        dataSource.setMinimumIdle(0);
        dataSource.setPoolName("operations-auth-disposable-test");

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("5")).load().migrate();
        assertTrue(mysqlVersion().matches("^8\\..+"), "operations integration requires MySQL 8.x");

        preservedVisitId = "visit_pre_v6_" + UUID.randomUUID().toString().replace("-", "");
        insertVisit(preservedVisitId, "synthetic-owner", "requested");
        visitA1 = "visit_a1_" + UUID.randomUUID().toString().replace("-", "");
        visitA2 = "visit_a2_" + UUID.randomUUID().toString().replace("-", "");
        visitB1 = "visit_b1_" + UUID.randomUUID().toString().replace("-", "");
        visitWithoutGrant = "visit_no_grant_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();

        assertEquals(1, rowCount("institution_visit_v1", "visit_id", preservedVisitId));
        assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", preservedVisitId));
        assertEquals("synthetic-owner", scalar("SELECT user_id FROM institution_visit_v1 WHERE visit_id = ?", preservedVisitId));
        assertEquals(0, tableCount("operations_principal_v1"));
        assertEquals(0, tableCount("operations_credential_v1"));
        assertEquals(0, tableCount("operations_visit_grant_v1"));
        for (int version = 1; version <= 6; version++) {
            assertEquals("1", scalar("SELECT COUNT(*) FROM flyway_schema_history WHERE version = ? AND success = 1",
                    Integer.toString(version)));
        }

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals("1", scalar("SELECT COUNT(*) FROM flyway_schema_history WHERE version = '6' AND success = 1"));

        insertVisit(visitA1, "synthetic-owner-a", "requested");
        insertVisit(visitA2, "synthetic-owner-a", "scheduled");
        insertVisit(visitB1, "synthetic-owner-b", "completed");
        insertVisit(visitWithoutGrant, "synthetic-owner-c", "contacting");
    }

    @AfterAll
    void closeDataSources() {
        if (dataSource != null) dataSource.close();
        if (baseDataSource != null) baseDataSource.close();
    }

    @Test
    void durableProvisioningAuthenticationGrantRevocationAndBoundaries() throws Exception {
        JdbcOperationsAuthorizationRepository repository = new JdbcOperationsAuthorizationRepository(dataSource);
        Sha256OperationsCredentialHasher hasher = new Sha256OperationsCredentialHasher();
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        OperationsProvisioningService provisioning = new OperationsProvisioningService(repository, hasher, clock);
        OperationsPrincipalResolver authentication = new OperationsPrincipalResolver(repository, hasher);
        OperationsVisitAuthorizationResolver authorization = new OperationsVisitAuthorizationResolver(repository);

        String tokenA = credential();
        String tokenB = credential();
        String principalA = principalId();
        String principalB = principalId();

        var first = provisioning.execute(provisionPackage("operation-enroll-a", principalA, visitA1), tokenA);
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED, first.status());
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.REPLAYED,
                provisioning.execute(provisionPackage("operation-enroll-a", principalA, visitA1), tokenA).status());
        ObjectNode conflictingReplay = provisionPackage("operation-enroll-a", principalA, visitA1);
        conflictingReplay.put("approvalReference", "approval:changed-list");
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.CONFLICT,
                provisioning.execute(conflictingReplay, tokenA).status());

        var authenticatedA = authentication.resolve(tokenA);
        assertEquals(OperationsPrincipalResolver.Resolution.Status.READY, authenticatedA.status());
        assertEquals(principalA, authenticatedA.principal().operationsPrincipalId());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.AUTH_REQUIRED_OR_INVALID,
                authentication.resolve(credential()).status());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.AUTH_REQUIRED_OR_INVALID,
                authentication.resolve("A".repeat(43)).status());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.AUTH_REQUIRED_OR_INVALID,
                authentication.resolve(null).status());

        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.AUTHORIZED,
                authorization.authorize(authenticatedA.principal(), visitA1).status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                authorization.authorize(authenticatedA.principal(), visitA2).status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                authorization.authorize(authenticatedA.principal(), visitB1).status());
        var hiddenExisting = authorization.authorize(authenticatedA.principal(), visitWithoutGrant).status();
        var hiddenUnknown = authorization.authorize(authenticatedA.principal(), "visit_unknown_" + UUID.randomUUID()).status();
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN, hiddenExisting);
        assertEquals(hiddenExisting, hiddenUnknown);

        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED,
                provisioning.execute(provisionPackage("operation-enroll-b", principalB, visitB1), tokenB).status());
        var authenticatedB = authentication.resolve(tokenB);
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.AUTHORIZED,
                authorization.authorize(authenticatedB.principal(), visitB1).status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                authorization.authorize(authenticatedB.principal(), visitA1).status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                authorization.authorize(authenticatedA.principal(), visitA2).status());

        String principalC = principalId();
        String tokenC = credential();
        ObjectNode unknownVisitPackage = provisionPackage("operation-enroll-c", principalC, visitA2,
                "visit_unknown_" + UUID.randomUUID());
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.UNKNOWN_VISIT,
                provisioning.execute(unknownVisitPackage, tokenC).status());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.AUTH_REQUIRED_OR_INVALID,
                authentication.resolve(tokenC).status());
        assertEquals(0, rowCount("operations_principal_v1", "operations_principal_id", principalC));

        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.CONFLICT,
                provisioning.execute(provisionPackage("operation-reuse-token", principalC, visitA2), tokenB).status());
        assertEquals(0, rowCount("operations_principal_v1", "operations_principal_id", principalC));

        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED,
                provisioning.execute(pairPackage("REVOKE_GRANT", "operation-revoke-grant-a", principalA, visitA1), null).status());
        ObjectNode revokeGrant = pairPackage("REVOKE_GRANT", "operation-revoke-grant-a", principalA, visitA1);
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.REPLAYED,
                provisioning.execute(revokeGrant, null).status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                authorization.authorize(authenticatedA.principal(), visitA1).status());

        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED,
                provisioning.execute(pairPackage("GRANT_VISIT", "operation-regrant-a", principalA, visitA1), null).status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.AUTHORIZED,
                authorization.authorize(authenticatedA.principal(), visitA1).status());

        ObjectNode revokePrincipal = principalActionPackage("REVOKE_PRINCIPAL", "operation-revoke-principal-a", principalA);
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED,
                provisioning.execute(revokePrincipal, null).status());
        assertEquals(OperationsAuthorizationRepository.ProvisioningResolution.Status.REPLAYED,
                provisioning.execute(revokePrincipal, null).status());

        JdbcOperationsAuthorizationRepository restartedRepository = new JdbcOperationsAuthorizationRepository(dataSource);
        OperationsPrincipalResolver restartedAuthentication = new OperationsPrincipalResolver(restartedRepository, hasher);
        OperationsVisitAuthorizationResolver restartedAuthorization =
                new OperationsVisitAuthorizationResolver(restartedRepository);
        assertEquals(OperationsPrincipalResolver.Resolution.Status.REVOKED_OR_DISABLED,
                restartedAuthentication.resolve(tokenA).status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                restartedAuthorization.authorize(authenticatedA.principal(), visitA1).status());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.READY,
                restartedAuthentication.resolve(tokenB).status());

        String storedDigest = scalar("SELECT credential_digest FROM operations_credential_v1 WHERE operations_principal_id = ?",
                principalA);
        assertEquals(hasher.digest(tokenA).orElseThrow(), storedDigest);
        assertNotEquals(tokenA, storedDigest);
        assertEquals(0, rowCount("operations_credential_v1", "credential_digest", tokenA));
        assertEquals(0, rowCount("operations_provisioning_operation_v1", "intent_fingerprint", tokenA));

        AppointmentOwnerReadRepository.Result ownerSnapshot = new JdbcAppointmentOwnerReadRepository(dataSource)
                .findAllOwned(new TrustedPrincipal("synthetic-owner"));
        assertEquals(AppointmentOwnerReadRepository.Result.Status.READY, ownerSnapshot.status());
        assertTrue(ownerSnapshot.visits().stream().anyMatch(visit -> visit.visitId().equals(preservedVisitId)));
        assertEquals(1, rowCount("institution_visit_v1", "visit_id", preservedVisitId));
        assertEquals("requested", scalar("SELECT status FROM institution_visit_v1 WHERE visit_id = ?", preservedVisitId));
        assertFalse(tableExists("institution_lifecycle_mutation_audit_v1"));
    }

    @Test
    void deploymentOnlyCommandCreatesAndReplaysCredentialWithoutLoggingIt() throws Exception {
        String visitId = "visit_cli_" + UUID.randomUUID().toString().replace("-", "");
        String principalId = principalId();
        insertVisit(visitId, "synthetic-cli-owner", "requested");
        Path directory = createPrivateExternalDirectory();
        assumeTrue(directory != null, "an external protected filesystem location is required for CLI evidence");
        Path input = directory.resolve("approved-operations-package.json");
        Path credentialOutput = directory.resolve("operations-credential.txt");
        ObjectNode packageJson = provisionPackage("operation-cli-" + UUID.randomUUID(), principalId, visitId);
        Files.writeString(input, mapper.writeValueAsString(packageJson), StandardCharsets.UTF_8);

        String jdbcUrl = "jdbc:mysql://" + URI.create(System.getenv("OPERATIONS_AUTH_TEST_MYSQL_URL")
                .substring("jdbc:".length())).getAuthority() + "/" + schemaName;
        String[] args = {
                "--operations.authorization.provisioning.command=apply",
                "--operations.authorization.provisioning.input=" + input,
                "--operations.authorization.provisioning.credential-output=" + credentialOutput,
                "--c4.persistence.enabled=true",
                "--C4_MYSQL_URL=" + jdbcUrl,
                "--C4_MYSQL_USERNAME=" + System.getenv("OPERATIONS_AUTH_TEST_MYSQL_USERNAME")
        };

        PrintStream originalOut = System.out;
        ByteArrayOutputStream firstOutput = new ByteArrayOutputStream();
        String credential = null;
        try {
            System.setOut(new PrintStream(firstOutput, true, StandardCharsets.UTF_8));
            assertEquals(0, OperationsProvisioningCommandRunner.run(args));
            credential = Files.readString(credentialOutput, StandardCharsets.US_ASCII);
            assertTrue(new Sha256OperationsCredentialHasher().digest(credential).isPresent());
            assertTrue(firstOutput.toString(StandardCharsets.UTF_8).contains("status=APPLIED"));
            assertTrue(!firstOutput.toString(StandardCharsets.UTF_8).contains(credential));
            ByteArrayOutputStream replayOutput = new ByteArrayOutputStream();
            System.setOut(new PrintStream(replayOutput, true, StandardCharsets.UTF_8));
            assertEquals(0, OperationsProvisioningCommandRunner.run(args));
            assertTrue(replayOutput.toString(StandardCharsets.UTF_8).contains("status=REPLAYED"));
            assertTrue(!replayOutput.toString(StandardCharsets.UTF_8).contains(credential));
        } finally {
            System.setOut(originalOut);
            Files.deleteIfExists(input);
            Files.deleteIfExists(credentialOutput);
            Files.deleteIfExists(directory);
        }

        assertEquals(1, rowCount("operations_principal_v1", "operations_principal_id", principalId));
        assertEquals(1, rowCount("operations_credential_v1", "operations_principal_id", principalId));
        assertEquals(1, rowCount("operations_visit_grant_v1", "visit_id", visitId));
        assertEquals(new Sha256OperationsCredentialHasher().digest(credential).orElseThrow(),
                scalar("SELECT credential_digest FROM operations_credential_v1 WHERE operations_principal_id = ?", principalId));
    }

    private ObjectNode provisionPackage(String operationId, String principalId, String... visits) {
        ObjectNode input = principalActionPackage("PROVISION_PRINCIPAL", operationId, principalId);
        input.put("verifiedActorReference", "verified-ops-actor:directory-record-" + principalId.substring(4, 12));
        var visitArray = input.putArray("visitIds");
        for (String visit : visits) visitArray.add(visit);
        return input;
    }

    private ObjectNode pairPackage(String action, String operationId, String principalId, String visitId) {
        ObjectNode input = basePackage(action, operationId, principalId);
        input.put("visitId", visitId);
        return input;
    }

    private ObjectNode principalActionPackage(String action, String operationId, String principalId) {
        return basePackage(action, operationId, principalId);
    }

    private ObjectNode basePackage(String action, String operationId, String principalId) {
        ObjectNode input = mapper.createObjectNode();
        input.put("packageVersion", "operations-provisioning-command-v1");
        input.put("operationId", operationId);
        input.put("operationType", action);
        input.put("approvalReference", "approval:owner-list-2026-09");
        input.put("provisioningActorReference", "deployment:job-integration-test");
        input.put("operationsPrincipalId", principalId);
        return input;
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
            statement.setString(5, "1");
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

    private int rowCount(String table, String column, String value) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?")) {
            statement.setString(1, value);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getInt(1);
            }
        }
    }

    private int tableCount(String table) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM " + table); ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getInt(1);
        }
    }

    private String scalar(String sql, String value) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getString(1);
            }
        }
    }

    private String scalar(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }

    private String mysqlVersion() throws SQLException {
        return scalar("SELECT VERSION()");
    }

    private boolean tableExists(String name) throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?")) {
            statement.setString(1, name);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getInt(1) > 0;
            }
        }
    }

    private String credential() {
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        return "ops1_" + Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    }

    private static Path createPrivateExternalDirectory() throws Exception {
        for (Path root : FileSystems.getDefault().getRootDirectories()) {
            Path candidate = null;
            try {
                candidate = Files.createTempDirectory(root, "operations-cli-smoke-");
                if (!OperationsProvisioningCommandRunner.isInsideGitCheckout(candidate.resolve("input.json"))
                        && OperationsProvisioningCommandRunner.makeDirectoryPrivate(candidate)) return candidate;
                Files.deleteIfExists(candidate);
            } catch (Exception ignored) {
                if (candidate != null) Files.deleteIfExists(candidate);
            }
        }
        return null;
    }

    private static String principalId() {
        return "ops_" + UUID.randomUUID();
    }

}
