package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.ServerOpaquePrincipalSource;
import com.wuhan.eldercare.visit.auth.Sha256SessionEvidenceHasher;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.MockMvc;

import java.security.MessageDigest;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class HistoryTrustedPreviewMySqlIntegrationTest {
    private static final String ENV_A="TEST_ONLY_HISTORY_TRUST_PREVIEW_A";
    private static final String ENV_B="TEST_ONLY_HISTORY_TRUST_PREVIEW_B";
    private final ObjectMapper mapper=new ObjectMapper();
    private HikariDataSource ds;
    private C5AuthEvidenceResolver auth;
    private JdbcElderRecordRepository elders;
    private HistoryRepository repo;
    private HistoryValidator validator;
    private String a,b,elderA,elderB,ownerA,ownerB;
    private JsonNode catalog;
    private List<JsonNode> approvedInputs;

    @BeforeAll void database() throws Exception {
        assumeTrue("true".equals(System.getenv("HISTORY_DISPOSABLE_MYSQL")),"explicit disposable database marker required");
        String url=System.getenv("HISTORY_TEST_MYSQL_URL");assumeTrue(url!=null,"isolated database URL required");
        ds=new HikariDataSource();ds.setJdbcUrl(url);
        ds.setUsername(System.getenv().getOrDefault("HISTORY_TEST_MYSQL_USERNAME","root"));
        ds.setPassword(System.getenv().getOrDefault("HISTORY_TEST_MYSQL_PASSWORD",""));ds.setMaximumPoolSize(10);
        HistoryRepository.requireDisposable(ds);
        try(var c=ds.getConnection();var p=c.createStatement();var rs=p.executeQuery("SELECT VERSION()")) {assertTrue(rs.next());assertTrue(rs.getString(1).startsWith("8."));}
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").load().migrate();
        Flyway.configure().dataSource(ds).locations("classpath:db/assessment-history-test-only").table("assessment_history_test_only_schema_history")
                .baselineOnMigrate(true).baselineVersion("0").load().migrate();
        auth=new C5AuthEvidenceResolver(new JdbcAuthIdentitySessionRepository(ds,ServerOpaquePrincipalSource.production()),new Sha256SessionEvidenceHasher(),Clock.systemUTC());
        elders=new JdbcElderRecordRepository(ds);repo=new HistoryRepository(ds,mapper);validator=new HistoryValidator(mapper,"node");
        catalog=mapper.readTree(getClass().getResourceAsStream("/assessment-history/test-only-server-recommendation-catalog-v1.json"));
        JsonNode standard=answers(),noSafe=standard.deepCopy();((ObjectNode)noSafe).set("cognitive.symptoms",mapper.createArrayNode().add("unknown"));
        approvedInputs=List.of(standard.deepCopy(),noSafe.deepCopy());
    }
    @BeforeEach void accounts() throws Exception {
        String suffix=UUID.randomUUID().toString();ownerA="TEST_ONLY_trust_owner_a_"+suffix;ownerB="TEST_ONLY_trust_owner_b_"+suffix;
        a=account(ownerA);b=account(ownerB);elderA="TEST_ONLY_trust_elder_a_"+suffix;elderB="TEST_ONLY_trust_elder_b_"+suffix;
        assertEquals(com.wuhan.eldercare.visit.elder.application.ElderRecordRepository.Establish.Status.CREATED,
                elders.establish(new ElderRecord(elderA,ownerA,Instant.now())).status());
        assertEquals(com.wuhan.eldercare.visit.elder.application.ElderRecordRepository.Establish.Status.CREATED,
                elders.establish(new ElderRecord(elderB,ownerB,Instant.now())).status());
    }
    @AfterAll void close() {if(ds!=null)ds.close();}
    private String account(String user) throws Exception {
        String evidence="TEST_ONLY_trusted_session_"+UUID.randomUUID();
        try(var c=ds.getConnection()) {
            try(var p=c.prepareStatement("INSERT INTO auth_provider_identity_v1 VALUES (?,?,?,?)")) {
                p.setString(1,"TEST_ONLY");p.setString(2,hash(user));p.setString(3,user);p.setTimestamp(4,Timestamp.from(Instant.now()));p.executeUpdate();
            }
            try(var p=c.prepareStatement("INSERT INTO auth_session_v1 VALUES (?,?,?,?,NULL)")) {
                p.setString(1,hash(evidence));p.setString(2,user);p.setTimestamp(3,Timestamp.from(Instant.now()));
                p.setTimestamp(4,Timestamp.from(Instant.now().plusSeconds(3600)));p.executeUpdate();
            }
        }return evidence;
    }
    private static String hash(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }
    private JsonNode answers() throws Exception {return mapper.readTree(getClass().getResourceAsStream("/assessment-history/test-only-answers.json"));}
    private HistoryTrustedPreviewInputSource approvedInputSource() {
        return ()->List.<JsonNode>of(approvedInputs.get(0).deepCopy(),approvedInputs.get(1).deepCopy());
    }
    private HistoryService service(Clock clock,String environment,HistoryRecommendationSource source) {
        return new HistoryService(repo,auth,elders,validator,mapper,clock,true,source,HistoryIntentLimits.TEST_ONLY_DEFAULT,true,environment,approvedInputSource());
    }
    private HistoryRecommendationSource source(AtomicReference<JsonNode> current) {
        return ()->new HistoryRecommendationSource.Capture(current.get().deepCopy(),"TEST_ONLY_SERVER_CATALOG_TRUST_V121");
    }
    private HistoryRepository.Session session(HistoryService service,String evidence) {
        return service.registerSession(evidence,"TEST_ONLY_trusted_"+UUID.randomUUID(),null);
    }
    private TrustedPreviewRequest previewRequest(String sessionId,String elder,JsonNode answers) {
        return new TrustedPreviewRequest("trusted_recommendation_preview_request_v1",sessionId,"assessment-schema-v2",2,elder,answers);
    }
    private HistoryRequest saveRequest(String intent,HistoryService.TrustedPreviewResult preview,String elder,JsonNode answers) {
        return new HistoryRequest("completed_assessment_save_with_trusted_preview_request_v1","SAVE_COMPLETED_ASSESSMENT",
                "assessment-schema-v2",2,elder,"recover_"+intent,answers,preview.previewId(),preview.displayBinding());
    }
    private int count(HistoryService service,String evidence) {return service.list(evidence,50,null).items().size();}
    private int trustedPreviewCount(String sessionId) {
        return repo.transaction(c->{try(var p=c.prepareStatement("SELECT COUNT(*) FROM history_trusted_preview_test_only_v1 WHERE session_id=?")) {
            p.setString(1,sessionId);try(var r=p.executeQuery()){r.next();return r.getInt(1);}}});
    }
    private JsonNode withoutIdentity(JsonNode value) {
        ObjectNode copy=(ObjectNode)value.deepCopy();copy.remove(List.of("assessmentId","assessmentCompletedAt"));return copy;
    }

    @Test void authenticatedPreviewBindsDisplayedProjectionToImmutableHistory() throws Exception {
        AtomicReference<JsonNode> catalogRef=new AtomicReference<>(catalog.deepCopy());
        var service=service(Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"),ZoneOffset.UTC),ENV_A,source(catalogRef));
        var current=session(service,a);var request=previewRequest(current.id(),elderA,answers());
        var absentAllowlist=new HistoryService(repo,auth,elders,validator,mapper,Clock.systemUTC(),true,source(catalogRef),
                HistoryIntentLimits.TEST_ONLY_DEFAULT,true,ENV_A,null);
        assertFalse(absentAllowlist.trustedPreviewAvailable());
        assertEquals("UNAVAILABLE",assertThrows(HistoryFailure.class,()->absentAllowlist.createTrustedPreview(a,request)).code());
        JsonNode unapproved=answers();((ObjectNode)unapproved).put("basic.age",75);
        assertEquals("INVALID_INPUT",assertThrows(HistoryFailure.class,()->service.createTrustedPreview(a,
                previewRequest(current.id(),elderA,unapproved))).code());
        assertEquals(0,trustedPreviewCount(current.id()));assertEquals(0,count(service,a));
        var preview=service.createTrustedPreview(a,request);
        assertEquals("READY",preview.state());assertEquals(43,preview.displayBinding().length());assertNotEquals(preview.sessionId(),preview.previewId());
        assertEquals(6,preview.profileDisplay().path("rows").size());assertFalse(preview.recommendationDisplay().path("cards").isEmpty());
        assertEquals(preview.previewId(),preview.profileDisplay().path("assessmentId").asText());
        assertEquals(preview.previewId(),preview.recommendationDisplay().path("assessmentId").asText());
        assertFalse(preview.profileDisplay().toString().contains("answers"));assertFalse(preview.recommendationDisplay().toString().contains("answers"));
        assertFalse(preview.recommendationDisplay().toString().contains(elderA));assertFalse(preview.recommendationDisplay().toString().contains(ownerA));
        assertEquals("READY",service.inspectTrustedPreview(a,current.id(),preview.previewId(),preview.displayBinding()).state());
        assertEquals(404,assertThrows(HistoryFailure.class,()->service.inspectTrustedPreview(b,current.id(),preview.previewId(),preview.displayBinding())).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->service.inspectTrustedPreview(a,current.id(),preview.previewId(),"A".repeat(43))).status());
        assertEquals(403,assertThrows(HistoryFailure.class,()->service.createTrustedPreview(a,previewRequest(current.id(),elderB,answers()))).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->service.createTrustedPreview(b,previewRequest(current.id(),elderB,answers()))).status());
        var otherEnvironment=service(Clock.systemUTC(),ENV_B,source(catalogRef));
        assertEquals(404,assertThrows(HistoryFailure.class,()->otherEnvironment.inspectTrustedPreview(a,current.id(),preview.previewId(),preview.displayBinding())).status());
        assertEquals("PREVIEW_ENVIRONMENT_MISMATCH",assertThrows(HistoryFailure.class,
                ()->otherEnvironment.createTrustedPreview(a,request)).code());
        assertFalse(service(Clock.systemUTC(),"production",source(catalogRef)).trustedPreviewAvailable());

        assertEquals("TRUSTED_PREVIEW_REQUIRED",assertThrows(HistoryFailure.class,()->service.prepareIntent(a,current.id())).code());
        var prepared=service.prepareIntent(a,current.id(),preview.previewId(),preview.displayBinding());assertFalse(prepared.replayed());
        var req=saveRequest(prepared.intentId(),preview,elderA,answers());var saved=service.create(a,req);assertFalse(saved.replayed());assertEquals(1,count(service,a));
        var profile=service.detail(a,saved.item().id()).profileDisplay();var recommendation=service.recommendation(a,saved.item().id()).display();
        assertEquals(saved.item().id(),profile.path("assessmentId").asText());assertEquals(saved.item().completedAt(),profile.path("assessmentCompletedAt").asText());
        assertEquals(saved.item().id(),recommendation.path("assessmentId").asText());assertEquals(saved.item().completedAt(),recommendation.path("assessmentCompletedAt").asText());
        assertEquals(withoutIdentity(preview.profileDisplay()),withoutIdentity(profile));
        assertEquals(withoutIdentity(preview.recommendationDisplay()),withoutIdentity(recommendation));
        assertEquals(saved.item(),service.create(a,req).item(),"same body replays even though the candidate is consumed");
        assertEquals(404,assertThrows(HistoryFailure.class,()->otherEnvironment.create(a,req)).status(),
                "a matching completion digest does not authorize replay from another TEST_ONLY namespace");
        var expiredSameEnvironment=service(Clock.fixed(Instant.parse("2026-10-14T00:11:00Z"),ZoneOffset.UTC),ENV_A,source(catalogRef));
        var expiredReplay=expiredSameEnvironment.create(a,req);
        assertTrue(expiredReplay.replayed());assertEquals(saved.item(),expiredReplay.item(),"exact authorized replay survives candidate expiry without recalculation");
        var changedBinding=new HistoryRequest(req.kind(),req.intent(),req.assessmentContractVersion(),req.schemaVersion(),req.elderId(),
                req.idempotencyKey(),answers(),req.previewId(),"A".repeat(43));
        assertEquals("IDEMPOTENCY_CONFLICT",assertThrows(HistoryFailure.class,()->service.create(a,changedBinding)).code());
        var oldSave=new HistoryRequest("completed_assessment_save_request_v1","SAVE_COMPLETED_ASSESSMENT","assessment-schema-v2",2,elderA,
                req.idempotencyKey(),answers());
        assertEquals("IDEMPOTENCY_CONFLICT",assertThrows(HistoryFailure.class,()->service.create(a,oldSave)).code());
        var mvc=standaloneSetup(new HistoryController(service,mapper)).build();
        var body=mapper.createObjectNode().put("kind","trusted_recommendation_preview_request_v1").put("sessionId",current.id())
                .put("assessmentContractVersion","assessment-schema-v2").put("schemaVersion",2).put("elderId",elderA).set("answers",answers());
        var refused=mvc.perform(post("/api/v1/completed-assessments/trusted-previews").header("X-Auth-Evidence",a)
                .contentType("application/json").content(mapper.writeValueAsBytes(body))).andReturn().getResponse();
        assertEquals(409,refused.getStatus());assertFalse(refused.getContentAsString().contains("answers"));

        var next=service.registerSession(a,"TEST_ONLY_http_preview_"+UUID.randomUUID().toString().replace("-",""),current.id());
        var httpRequest=mapper.createObjectNode().put("kind","trusted_recommendation_preview_request_v1").put("sessionId",next.id())
                .put("assessmentContractVersion","assessment-schema-v2").put("schemaVersion",2).put("elderId",elderA).set("answers",answers());
        var created=mvc.perform(post("/api/v1/completed-assessments/trusted-previews").header("X-Auth-Evidence",a)
                .contentType("application/json").content(mapper.writeValueAsBytes(httpRequest))).andReturn().getResponse();
        assertEquals(200,created.getStatus());JsonNode trusted=mapper.readTree(created.getContentAsByteArray());
        assertEquals(Set.of("contractVersion","kind","previewId","displayBinding","sessionId","scopeId","environment","createdAt","expiresAt","state","profileDisplay","recommendationDisplay"),fieldNames(trusted));
        assertEquals("trusted_recommendation_preview_v1",trusted.path("kind").asText());assertEquals("READY",trusted.path("state").asText());
        assertEquals(6,trusted.path("profileDisplay").path("rows").size());assertTrue(trusted.path("recommendationDisplay").path("cards").isArray());
        assertFalse(trusted.toString().contains("answers"));assertFalse(trusted.toString().contains(ownerA));assertFalse(trusted.toString().contains(elderA));
        var checkBody=mapper.createObjectNode().put("sessionId",next.id()).put("previewId",trusted.path("previewId").asText())
                .put("displayBinding",trusted.path("displayBinding").asText());
        var checked=mvc.perform(post("/api/v1/completed-assessments/trusted-previews/check").header("X-Auth-Evidence",a)
                .contentType("application/json").content(mapper.writeValueAsBytes(checkBody))).andReturn().getResponse();
        assertEquals(200,checked.getStatus());JsonNode checkedDto=mapper.readTree(checked.getContentAsByteArray());
        assertEquals(Set.of("contractVersion","kind","sessionId","previewId","state"),fieldNames(checkedDto));assertEquals("READY",checkedDto.path("state").asText());
        var preparedHttp=mvc.perform(post("/api/v1/completed-assessments/save-intents").header("X-Auth-Evidence",a)
                .contentType("application/json").content(mapper.writeValueAsBytes(checkBody))).andReturn().getResponse();
        assertEquals(200,preparedHttp.getStatus());JsonNode intent=mapper.readTree(preparedHttp.getContentAsByteArray());
        assertEquals("PREPARED",intent.path("state").asText());assertEquals("UNAVAILABLE",service.inspectTrustedPreview(a,next.id(),
                trusted.path("previewId").asText(),trusted.path("displayBinding").asText()).state());
        ObjectNode saveBody=mapper.createObjectNode().put("kind","completed_assessment_save_with_trusted_preview_request_v1")
                .put("intent","SAVE_COMPLETED_ASSESSMENT").put("assessmentContractVersion","assessment-schema-v2").put("schemaVersion",2)
                .put("elderId",elderA).put("idempotencyKey","recover_"+intent.path("intentId").asText())
                .put("previewId",trusted.path("previewId").asText()).put("displayBinding",trusted.path("displayBinding").asText());
        saveBody.set("answers",answers());
        var savedHttp=mvc.perform(post("/api/v1/completed-assessments").header("X-Auth-Evidence",a).contentType("application/json")
                .content(mapper.writeValueAsBytes(saveBody))).andReturn().getResponse();
        assertEquals(201,savedHttp.getStatus());JsonNode savedDto=mapper.readTree(savedHttp.getContentAsByteArray());
        assertEquals("created",savedDto.path("availability").asText());assertFalse(savedDto.toString().contains("answers"));
        String savedId=savedDto.path("item").path("id").asText();
        var historical=mvc.perform(get("/api/v1/completed-assessments/"+savedId+"/recommendation").header("X-Auth-Evidence",a))
                .andReturn().getResponse();assertEquals(200,historical.getStatus());
        JsonNode historicalDto=mapper.readTree(historical.getContentAsByteArray());
        assertEquals(withoutIdentity(trusted.path("recommendationDisplay")),withoutIdentity(historicalDto.path("display")));
    }

    private Set<String> fieldNames(JsonNode value) {Set<String> names=new HashSet<>();value.fieldNames().forEachRemaining(names::add);return names;}

    @Test void changedAssessmentRevokesPriorPreviewAndNoSafeSnapshotRemainsNoSafe() throws Exception {
        AtomicReference<JsonNode> catalogRef=new AtomicReference<>(catalog.deepCopy());
        var service=service(Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"),ZoneOffset.UTC),ENV_A,source(catalogRef));
        var current=session(service,a);JsonNode originalAnswers=answers();
        var first=service.createTrustedPreview(a,previewRequest(current.id(),elderA,originalAnswers));
        JsonNode noSafeAnswers=originalAnswers.deepCopy();((ObjectNode)noSafeAnswers).set("cognitive.symptoms",mapper.createArrayNode().add("unknown"));
        var second=service.createTrustedPreview(a,previewRequest(current.id(),elderA,noSafeAnswers));
        assertNotEquals(first.previewId(),second.previewId());
        assertEquals("recommendation-contract-v2",first.recommendationDisplay().path("versions").path("recommendationContractVersion").asText());
        assertEquals(first.recommendationDisplay().path("versions").path("recommendationRulesetVersion").asText(),
                second.recommendationDisplay().path("versions").path("recommendationRulesetVersion").asText());
        assertNotEquals(first.recommendationDisplay(),second.recommendationDisplay(),"same ruleset may produce distinct captured results");
        assertEquals("UNAVAILABLE",service.inspectTrustedPreview(a,current.id(),first.previewId(),first.displayBinding()).state());
        assertEquals("PREVIEW_UNAVAILABLE",assertThrows(HistoryFailure.class,
                ()->service.prepareIntent(a,current.id(),first.previewId(),first.displayBinding())).code());
        assertEquals("no_safe_recommendation",second.recommendationDisplay().path("state").asText());
        var prepared=service.prepareIntent(a,current.id(),second.previewId(),second.displayBinding());
        var saved=service.create(a,saveRequest(prepared.intentId(),second,elderA,noSafeAnswers)).item();
        var history=service.recommendation(a,saved.id());assertEquals("ready",history.availability());
        assertEquals("no_safe_recommendation",history.display().path("state").asText());assertTrue(history.display().path("cards").isEmpty());
        assertEquals(withoutIdentity(second.recommendationDisplay()),withoutIdentity(history.display()));
    }

    @Test void commitUsesCapturedCatalogRevisionAfterLiveCatalogChanges() throws Exception {
        Instant instant=Instant.parse("2026-10-14T00:00:00Z");AtomicReference<JsonNode> catalogRef=new AtomicReference<>(catalog.deepCopy());
        AtomicInteger captures=new AtomicInteger();
        HistoryRecommendationSource counting=()->{captures.incrementAndGet();return new HistoryRecommendationSource.Capture(
                catalogRef.get().deepCopy(),"TEST_ONLY_SERVER_CATALOG_TRUST_V121");};
        var service=service(Clock.fixed(instant,ZoneOffset.UTC),ENV_A,counting);var current=session(service,a);var assessment=answers();
        var preview=service.createTrustedPreview(a,previewRequest(current.id(),elderA,assessment));
        JsonNode capturedProfile=preview.profileDisplay().deepCopy(),capturedRecommendation=preview.recommendationDisplay().deepCopy();
        assertEquals(1,captures.get());

        ObjectNode revised=(ObjectNode)catalog.deepCopy();revised.put("datasetVersion","institution-catalog-development-v1.2.999-test");
        ((ObjectNode)revised.path("records").get(0)).put("recordRevision",9);catalogRef.set(revised);
        var prepared=service.prepareIntent(a,current.id(),preview.previewId(),preview.displayBinding());
        var request=saveRequest(prepared.intentId(),preview,elderA,assessment);var saved=service.create(a,request);
        assertFalse(saved.replayed());assertEquals(1,captures.get(),"commit does not query the changed current Catalog");
        var profile=service.detail(a,saved.item().id()).profileDisplay();var recommendation=service.recommendation(a,saved.item().id()).display();
        assertEquals(withoutIdentity(capturedProfile),withoutIdentity(profile));
        assertEquals(withoutIdentity(capturedRecommendation),withoutIdentity(recommendation));
        assertEquals("institution-catalog-development-v1.2.1",recommendation.path("source").path("datasetVersion").asText());
        assertEquals(2,recommendation.path("poolRevisions").get(0).path("recordRevision").asInt());
        assertEquals(9,revised.path("records").get(0).path("recordRevision").asInt());

        catalogRef.set(mapper.createObjectNode());
        assertEquals(withoutIdentity(capturedProfile),withoutIdentity(service.detail(a,saved.item().id()).profileDisplay()));
        assertEquals(withoutIdentity(capturedRecommendation),withoutIdentity(service.recommendation(a,saved.item().id()).display()));
        var replay=service.create(a,request);assertTrue(replay.replayed());assertEquals(saved.item(),replay.item());
        assertEquals(1,captures.get(),"historical read and idempotent replay do not recapture a later Catalog");
    }

    @Test void catalogChangesStayPinnedExpiryBlocksConsumptionAndRecoveryNeverAllocatesAnotherIntent() throws Exception {
        Instant start=Instant.parse("2026-10-14T00:00:00Z");AtomicReference<JsonNode> catalogRef=new AtomicReference<>(catalog.deepCopy());
        var initial=service(Clock.fixed(start,ZoneOffset.UTC),ENV_A,source(catalogRef));var current=session(initial,a);var assessment=answers();
        var preview=initial.createTrustedPreview(a,previewRequest(current.id(),elderA,assessment));String pinned=preview.recommendationDisplay().toString();
        catalogRef.set(mapper.createObjectNode());var retried=initial.createTrustedPreview(a,previewRequest(current.id(),elderA,assessment));
        assertEquals(preview.previewId(),retried.previewId());assertEquals(mapper.readTree(pinned),retried.recommendationDisplay());
        var prepared=initial.prepareIntent(a,current.id(),preview.previewId(),preview.displayBinding());var request=saveRequest(prepared.intentId(),preview,elderA,assessment);
        var later=service(Clock.fixed(start.plusSeconds(601),ZoneOffset.UTC),ENV_A,source(catalogRef));
        assertEquals("EXPIRED",later.inspectTrustedPreview(a,current.id(),preview.previewId(),preview.displayBinding()).state());
        assertEquals("PREVIEW_UNAVAILABLE",assertThrows(HistoryFailure.class,()->later.create(a,request)).code());
        assertEquals(0,count(later,a));assertEquals("PENDING_OR_UNCERTAIN",later.reconcileIntent(a,prepared.scopeId(),prepared.intentId()).state());
        var replayPrepared=later.prepareIntent(a,current.id(),preview.previewId(),preview.displayBinding());
        assertTrue(replayPrepared.replayed());assertEquals(prepared.intentId(),replayPrepared.intentId());
        assertEquals("PREVIEW_UNAVAILABLE",assertThrows(HistoryFailure.class,()->later.create(a,request)).code());
        assertEquals(0,count(later,a),"expiry leaves original intent pending and creates no replacement key or completion");
    }

    @Test void trustedCommitIsAtomicAndConcurrentReplayCreatesOneImmutableCompletion() throws Exception {
        var service=service(Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"),ZoneOffset.UTC),ENV_A,()->new HistoryRecommendationSource.Capture(catalog.deepCopy(),"TEST_ONLY_SERVER_CATALOG_TRUST_V121"));
        var current=session(service,a);var preview=service.createTrustedPreview(a,previewRequest(current.id(),elderA,answers()));
        var prepared=service.prepareIntent(a,current.id(),preview.previewId(),preview.displayBinding());var request=saveRequest(prepared.intentId(),preview,elderA,answers());
        String trigger="history_trusted_fail_"+UUID.randomUUID().toString().replace("-","");
        try(var c=ds.getConnection();var p=c.createStatement()) {
            p.execute("CREATE TRIGGER "+trigger+" BEFORE INSERT ON completed_assessment_history_test_only_v1 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_ONLY trusted rollback'");
        }
        try {assertEquals(503,assertThrows(HistoryFailure.class,()->service.create(a,request)).status());}
        finally {try(var c=ds.getConnection();var p=c.createStatement()){p.execute("DROP TRIGGER "+trigger);}}
        assertEquals(0,count(service,a));
        var afterRollback=repo.transaction(c->repo.trustedPreviewForIntent(c,prepared.scopeId(),prepared.intentId()));
        assertEquals("BOUND",afterRollback.state());assertNull(afterRollback.completion());
        var pool=Executors.newFixedThreadPool(4);
        try {
            var calls=new ArrayList<Future<HistoryService.Save>>();for(int i=0;i<4;i++)calls.add(pool.submit(()->service.create(a,request)));
            var first=calls.get(0).get(30,TimeUnit.SECONDS);for(var call:calls)assertEquals(first.item(),call.get(30,TimeUnit.SECONDS).item());
            assertEquals(1,count(service,a));
        }finally{pool.shutdownNow();}
        var consumed=repo.transaction(c->repo.trustedPreviewForIntent(c,prepared.scopeId(),prepared.intentId()));
        assertEquals("CONSUMED",consumed.state());assertEquals(consumed.completion(),service.reconcileIntent(a,prepared.scopeId(),prepared.intentId()).item().id());
        var immutable=assertThrows(HistoryFailure.class,()->repo.transaction(c->{try(var p=c.prepareStatement("UPDATE history_trusted_preview_test_only_v1 SET recommendation_display=? WHERE preview_id=?")) {
            p.setString(1,"{}");p.setString(2,preview.previewId());p.executeUpdate();}return null;}));
        assertEquals(503,immutable.status());assertEquals("ERROR",immutable.code());
    }
}
