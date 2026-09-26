package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.application.AppointmentOwnerReadService;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.ServerOpaquePrincipalSource;
import com.wuhan.eldercare.visit.auth.Sha256SessionEvidenceHasher;
import com.wuhan.eldercare.visit.institution.application.InstitutionHistoricalPublicNameResolver;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishResult;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionPublisher;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.JdbcInstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.NodeInstitutionSnapshotValidator;
import com.wuhan.eldercare.visit.persistence.JdbcAppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.web.AppointmentOwnerReadController;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Uses real MySQL, the JDBC C5 resolver, the V5 exact-revision reader and the production route. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AppointmentOwnerReadMySqlIntegrationTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private HikariDataSource dataSource;
    private MockMvc mockMvc;
    private String ownerSession;
    private String otherSession;
    private String emptySession;
    private String expiredSession;
    private String prefix;
    private String institutionId;

    @BeforeAll
    void prepareDisposableMySqlAndAuthenticatedFixtures() throws Exception {
        String url = System.getenv("APPOINTMENT_OWNER_READ_TEST_MYSQL_URL");
        String username = System.getenv("APPOINTMENT_OWNER_READ_TEST_MYSQL_USERNAME");
        assumeTrue("true".equalsIgnoreCase(System.getenv("APPOINTMENT_OWNER_READ_DISPOSABLE_MYSQL")),
                "explicit disposable MySQL marker required");
        assumeTrue(url != null && url.startsWith("jdbc:mysql://127.0.0.1:") && username != null,
                "explicit isolated loopback MySQL URL and test username required");
        URI uri = URI.create("http://" + url.substring("jdbc:mysql://".length()).split("\\?", 2)[0]);
        assumeTrue(uri.getPort() > 0 && uri.getPort() != 3306 && uri.getPath().contains("disposable"),
                "Owner port/schema forbidden");

        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("APPOINTMENT_OWNER_READ_TEST_MYSQL_PASSWORD", ""));
        dataSource.setMaximumPoolSize(8);
        dataSource.setPoolName("appointment-owner-read-disposable-test");
        assertTrue(mysqlVersion().startsWith("8."), "the evidence requires MySQL 8");

        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals(5, appliedMigrationCount(), "official V1-V5 migration chain must be present");
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        assertEquals(5, appliedMigrationCount(), "repeat startup must keep migration history stable");

        prefix = "synthetic-appt-owner-" + UUID.randomUUID().toString().substring(0, 8);
        institutionId = prefix + "-institution";
        publishTwoSyntheticInstitutionRevisions();

        String ownerUserId = prefix + "-user-a";
        String otherUserId = prefix + "-user-b";
        String emptyUserId = prefix + "-user-c";
        insertSyntheticIdentity(ownerUserId);
        insertSyntheticIdentity(otherUserId);
        insertSyntheticIdentity(emptyUserId);
        ownerSession = insertSession(ownerUserId, prefix + "-opaque-session-a", Instant.now().plusSeconds(3600));
        otherSession = insertSession(otherUserId, prefix + "-opaque-session-b", Instant.now().plusSeconds(3600));
        emptySession = insertSession(emptyUserId, prefix + "-opaque-session-c", Instant.now().plusSeconds(3600));
        expiredSession = insertSession(ownerUserId, prefix + "-opaque-session-expired", Instant.now().minusSeconds(5));

        insertVisit(ownerUserId, "requested", "1", "morning", null);
        insertVisit(ownerUserId, "contacting", "1", "afternoon", true);
        insertVisit(ownerUserId, "scheduled", "2", "evening", false);
        insertVisit(ownerUserId, "scheduled-past", "1", "morning", null);
        insertVisit(ownerUserId, "completed", "1", "morning", null);
        insertVisit(ownerUserId, "cancelled", "1", "afternoon", false);
        insertVisit(ownerUserId, "display-missing", "999", "morning", null);
        insertVisit(otherUserId, "other-completed", "1", "morning", false);

        AuthEvidenceResolver auth = new C5AuthEvidenceResolver(
                new JdbcAuthIdentitySessionRepository(dataSource, ServerOpaquePrincipalSource.production()),
                new Sha256SessionEvidenceHasher(), Clock.systemUTC());
        var institutionRepository = new JdbcInstitutionRevisionRepository(dataSource, mapper,
                new NodeInstitutionSnapshotValidator("node", mapper));
        var service = new AppointmentOwnerReadService(auth, new JdbcAppointmentOwnerReadRepository(dataSource),
                new InstitutionHistoricalPublicNameResolver(institutionRepository));
        mockMvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                .standaloneSetup(new AppointmentOwnerReadController(service)).build();
    }

    @AfterAll
    void closePool() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void authenticatedOwnerGetsAllStatusesAndExactHistoricalDisplayOverHttpRoute() throws Exception {
        JsonNode response = getJson(ownerSession, "?status=requested&userId=forged-user");

        assertEquals("appointment-production-owner-read-contract-v1", response.path("contractVersion").asText());
        assertEquals("appointment_owner_read_result_v1", response.path("kind").asText());
        assertEquals("authenticated", response.path("authResolution").asText());
        assertEquals("ready", response.path("availability").asText());
        Map<String, JsonNode> byStatus = new HashMap<>();
        Set<String> visitIds = new HashSet<>();
        for (JsonNode item : response.path("items")) {
            byStatus.put(item.path("visitStatus").asText(), item);
            visitIds.add(item.path("visitId").asText());
            assertFalse(item.has("userId"));
            assertFalse(item.has("ownerId"));
            assertFalse(item.has("elderId"));
            assertFalse(item.has("phone"));
            assertFalse(item.has("contactName"));
            assertFalse(item.has("contactPhone"));
            assertFalse(item.has("assessment"));
            assertFalse(item.has("elderProfile"));
            assertFalse(item.has("notes"));
            assertFalse(item.has("evaluationId"));
        }
        assertEquals(Set.of("requested", "contacting", "scheduled", "completed", "cancelled"), byStatus.keySet());
        assertEquals(7, visitIds.size(), "per-item display unavailability must not remove its Visit");
        assertFalse(visitIds.contains(prefix + "-other-completed"), "foreign owner row must not be returned");
        assertEquals("Synthetic Owner Read Revision One", itemById(response, prefix + "-completed")
                .path("institutionDisplay").path("name").asText());
        assertEquals("1", itemById(response, prefix + "-completed").path("institutionRecordRevision").asText());
        assertEquals("unavailable", itemById(response, prefix + "-display-missing")
                .path("institutionDisplay").path("availability").asText());
        assertTrue(itemById(response, prefix + "-display-missing").path("institutionDisplay").path("name").isNull());
        assertEquals("ready", itemById(response, prefix + "-scheduled")
                .path("institutionDisplay").path("availability").asText());
        assertEquals("Synthetic Owner Read Revision Two", itemById(response, prefix + "-scheduled")
                .path("institutionDisplay").path("name").asText());
        JsonNode pastScheduled = itemById(response, prefix + "-scheduled-past");
        assertEquals("2026-09-25", pastScheduled.path("visitDate").asText());
        assertEquals("scheduled", pastScheduled.path("visitStatus").asText(),
                "a past visit date must not infer a new Visit status");
        assertFalse(byStatus.get("requested").has("pickupRequested"), "null pickup stays absent");
        assertFalse(itemById(response, prefix + "-scheduled").path("pickupRequested").asBoolean());

        Set<String> topLevelFields = new HashSet<>();
        response.fieldNames().forEachRemaining(topLevelFields::add);
        assertEquals(Set.of("contractVersion", "kind", "authResolution", "availability", "items"), topLevelFields);
        Set<String> itemFields = new HashSet<>();
        itemById(response, prefix + "-completed").fieldNames().forEachRemaining(itemFields::add);
        assertEquals(Set.of("visitId", "institutionId", "institutionRecordRevision", "visitStatus", "visitDate",
                "visitTimePreference", "participantCount", "institutionDisplay"), itemFields);
        assertEquals(2, currentInstitutionHead(), "the fixture's current revision is newer than the Visit revision");
    }

    @Test
    void legitimateEmptyAndInvalidOrExpiredSessionsRemainDistinctFromReadyEmpty() throws Exception {
        JsonNode empty = getJson(emptySession, "");
        assertEquals("authenticated", empty.path("authResolution").asText());
        assertEquals("ready", empty.path("availability").asText());
        assertTrue(empty.path("items").isArray());
        assertEquals(0, empty.path("items").size());

        JsonNode missing = getJson(null, "");
        assertEquals("missing", missing.path("authResolution").asText());
        assertTrue(missing.path("availability").isNull());
        assertTrue(missing.path("items").isNull());

        JsonNode invalid = getJson("opaque-synthetic-unknown-session", "");
        assertEquals("invalid", invalid.path("authResolution").asText());
        assertTrue(invalid.path("items").isNull());

        JsonNode expired = getJson(expiredSession, "");
        assertEquals("expired", expired.path("authResolution").asText());
        assertTrue(expired.path("items").isNull());
    }

    @Test
    void changingSessionSelectsAnotherOwnerWithoutAnyOwnerParameter() throws Exception {
        JsonNode response = getJson(otherSession, "?userId=" + prefix + "-user-a");
        assertEquals(1, response.path("items").size());
        assertEquals(prefix + "-other-completed", response.path("items").get(0).path("visitId").asText());
    }

    private JsonNode getJson(String evidence, String query) throws Exception {
        var request = get("/api/v1/visits" + query);
        if (evidence != null) request.header("X-Auth-Evidence", evidence);
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private JsonNode itemById(JsonNode response, String visitId) {
        for (JsonNode item : response.path("items")) {
            if (visitId.equals(item.path("visitId").asText())) return item;
        }
        throw new AssertionError("expected synthetic Visit was absent");
    }

    private void publishTwoSyntheticInstitutionRevisions() throws Exception {
        ObjectNode fixture;
        try (InputStream input = getClass().getResourceAsStream("/institution-synthetic-v121.json")) {
            assertNotNull(input, "test-only Institution snapshot is required");
            fixture = (ObjectNode) mapper.readTree(input);
        }
        var repository = new JdbcInstitutionRevisionRepository(dataSource, mapper,
                new NodeInstitutionSnapshotValidator("node", mapper));
        var publisher = new InstitutionRevisionPublisher(repository,
                Clock.fixed(Instant.parse("2026-09-26T00:00:00Z"), ZoneOffset.UTC));
        var first = publisher.publish(publishPackage(fixture, "Synthetic Owner Read Revision One", "old"));
        var second = publisher.publish(publishPackage(fixture, "Synthetic Owner Read Revision Two", "new"));
        assertEquals(InstitutionPublishResult.Status.PUBLISHED, first.status());
        assertEquals(1L, first.recordRevision());
        assertEquals(InstitutionPublishResult.Status.PUBLISHED, second.status());
        assertEquals(2L, second.recordRevision());
    }

    private ObjectNode publishPackage(ObjectNode fixture, String name, String suffix) {
        ObjectNode record = fixture.deepCopy();
        record.put("institutionId", institutionId);
        record.with("identity").with("name").put("value", name);
        record.withArray("evidence").forEach(item -> ((ObjectNode) item).put("institutionId", institutionId));
        ObjectNode wrapper = mapper.createObjectNode();
        wrapper.put("packageVersion", "institution-publish-package-v1");
        wrapper.put("operationId", prefix + "-revision-" + suffix);
        wrapper.put("sourceReference", "synthetic:appointment-owner-read");
        wrapper.put("operatorReference", "ops:synthetic-owner-read-test");
        wrapper.set("record", record);
        return wrapper;
    }

    private void insertSyntheticIdentity(String userId) throws Exception {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO auth_provider_identity_v1 "
                        + "(provider_namespace, provider_subject_digest, user_id, created_at) VALUES (?, ?, ?, ?)")) {
            statement.setString(1, "synthetic-appointment-owner-read");
            statement.setString(2, sha256(prefix + ":subject:" + userId));
            statement.setString(3, userId);
            statement.setTimestamp(4, Timestamp.from(Instant.now()));
            statement.executeUpdate();
        }
    }

    private String insertSession(String userId, String evidence, Instant expiresAt) throws Exception {
        String digest = sha256(evidence);
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO auth_session_v1 (session_digest, user_id, issued_at, expires_at, revoked_at) "
                        + "VALUES (?, ?, ?, ?, NULL)")) {
            statement.setString(1, digest);
            statement.setString(2, userId);
            statement.setTimestamp(3, Timestamp.from(Instant.now().minusSeconds(10)));
            statement.setTimestamp(4, Timestamp.from(expiresAt));
            statement.executeUpdate();
        }
        return evidence;
    }

    private void insertVisit(String userId, String suffix, String revision, String timePreference, Boolean pickup)
            throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO institution_visit_v1 (visit_id, user_id, elder_id, institution_id, "
                        + "institution_record_revision, visit_date, visit_time_preference, participant_count, "
                        + "pickup_requested, contact_name, phone, phone_purpose, status, accepted_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            statement.setString(1, prefix + "-" + suffix);
            statement.setString(2, userId);
            statement.setString(3, prefix + "-synthetic-elder");
            statement.setString(4, institutionId);
            statement.setString(5, revision);
            statement.setString(6, "scheduled-past".equals(suffix) ? "2026-09-25" : "2026-10-01");
            statement.setString(7, timePreference);
            statement.setInt(8, 2);
            if (pickup == null) statement.setNull(9, java.sql.Types.BOOLEAN);
            else statement.setBoolean(9, pickup);
            statement.setString(10, "synthetic-contact");
            statement.setString(11, "synthetic-phone-placeholder");
            statement.setString(12, "appointment_or_consultant_contact");
            statement.setString(13, switch (suffix) {
                case "requested" -> "requested";
                case "contacting" -> "contacting";
                case "scheduled" -> "scheduled";
                case "scheduled-past" -> "scheduled";
                case "completed" -> "completed";
                case "cancelled" -> "cancelled";
                case "other-completed" -> "completed";
                case "display-missing" -> "completed";
                default -> throw new IllegalArgumentException("unknown synthetic status fixture");
            });
            statement.setTimestamp(14, Timestamp.from(Instant.now()));
            statement.executeUpdate();
        }
    }

    private int currentInstitutionHead() throws SQLException {
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT record_revision FROM institution_current_head_v1 WHERE institution_id = ?")) {
            statement.setString(1, institutionId);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getInt(1);
            }
        }
    }

    private String mysqlVersion() throws SQLException {
        try (Connection connection = dataSource.getConnection(); var statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT VERSION()")) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }

    private int appliedMigrationCount() {
        return Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().info().applied().length;
    }

    private static String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
