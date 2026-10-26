package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.auth.*;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.MockMvc;
import java.sql.*;
import java.time.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class HistoryMySqlIntegrationTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private HikariDataSource ds;
    private C5AuthEvidenceResolver auth;
    private JdbcElderRecordRepository elders;
    private HistoryRepository repo;
    private HistoryValidator validator;
    private HistoryService service;
    private MockMvc mvc;
    private String a,b,empty,elderA,elderB;
    private final Map<String,String> testIntentKeys=new HashMap<>();
    @BeforeAll void database() throws Exception {
        assumeTrue("true".equals(System.getenv("HISTORY_DISPOSABLE_MYSQL")),"explicit disposable database marker required");
        String url=System.getenv("HISTORY_TEST_MYSQL_URL");
        assumeTrue(url!=null,"isolated database URL required");
        ds=new HikariDataSource(); ds.setJdbcUrl(url); ds.setUsername("root"); ds.setPassword(""); ds.setMaximumPoolSize(8);
        HistoryRepository.requireDisposable(ds);
        try(var c=ds.getConnection();var p=c.createStatement();var rs=p.executeQuery("SELECT VERSION()")) {assertTrue(rs.next());assertTrue(rs.getString(1).startsWith("8."));}
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").load().migrate();
        Flyway.configure().dataSource(ds).locations("classpath:db/assessment-history-test-only").table("assessment_history_test_only_schema_history").baselineOnMigrate(true).baselineVersion("0").load().migrate();
        auth=new C5AuthEvidenceResolver(new JdbcAuthIdentitySessionRepository(ds,ServerOpaquePrincipalSource.production()),new Sha256SessionEvidenceHasher(),Clock.systemUTC());
        elders=new JdbcElderRecordRepository(ds); repo=new HistoryRepository(ds,mapper); validator=new HistoryValidator(mapper,"node");
    }
    @BeforeEach void accounts() throws Exception {
        testIntentKeys.clear();
        String prefix="TEST_ONLY_"+UUID.randomUUID();
        a=account(prefix+"a"); b=account(prefix+"b"); empty=account(prefix+"empty");
        elderA="TEST_ONLY_elder_"+prefix+"a"; elderB="TEST_ONLY_elder_"+prefix+"b";
        assertEquals(com.wuhan.eldercare.visit.elder.application.ElderRecordRepository.Establish.Status.CREATED,
                elders.establish(new ElderRecord(elderA,prefix+"a",Instant.now())).status());
        elders.establish(new ElderRecord(elderB,prefix+"b",Instant.now()));
        service=serviceAt("2026-10-13T00:00:00Z"); mvc=standaloneSetup(new HistoryController(service,mapper)).build();
    }
    @AfterAll void close() {if(ds!=null)ds.close();}
    private HistoryService serviceAt(String instant) {return new HistoryService(repo,auth,elders,validator,mapper,Clock.fixed(Instant.parse(instant),ZoneOffset.UTC));}
    private String account(String user) throws Exception {
        String evidence="TEST_ONLY_session_"+UUID.randomUUID();
        try(var c=ds.getConnection()) {
            try(var p=c.prepareStatement("INSERT INTO auth_provider_identity_v1 VALUES (?,?,?,?)")) {
                p.setString(1,"TEST_ONLY");p.setString(2,hash(user));p.setString(3,user);p.setTimestamp(4,Timestamp.from(Instant.now()));p.executeUpdate();
            }
            try(var p=c.prepareStatement("INSERT INTO auth_session_v1 VALUES (?,?,?,?,NULL)")) {
                p.setString(1,hash(evidence));p.setString(2,user);p.setTimestamp(3,Timestamp.from(Instant.now()));p.setTimestamp(4,Timestamp.from(Instant.now().plusSeconds(3600)));p.executeUpdate();
            }
        }return evidence;
    }
    private static String hash(String s)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
    private HistoryRequest request(String key) throws Exception {
        if(!key.startsWith("recover_")) {
            String logical=key;
            if(!testIntentKeys.containsKey(logical)) {
                var registry=new HistoryService(repo,auth,elders,validator,mapper,Clock.fixed(Instant.parse("2026-10-13T00:00:00Z").plusSeconds(testIntentKeys.size()*61L),ZoneOffset.UTC),true);
                testIntentKeys.put(logical,"recover_"+registry.prepareIntent(a).intentId());
            }
            key=testIntentKeys.get(logical);
        }
        JsonNode answers=mapper.readTree(getClass().getResourceAsStream("/assessment-history/test-only-answers.json"));
        return new HistoryRequest("completed_assessment_save_request_v1","SAVE_COMPLETED_ASSESSMENT","assessment-schema-v2",2,elderA,key,answers);
    }
    private int count(String evidence) {return service.list(evidence,50,null).items().size();}
    @Test void contextInspectionDoesNotAllocateAndExistingIntentCannotLookFresh() throws Exception {
        var loop=new HistoryService(repo,auth,elders,validator,mapper,Clock.systemUTC(),true);
        String context="TEST_ONLY_inspection_"+UUID.randomUUID();assertEquals("UNREGISTERED",loop.inspectSessionContext(a,context).state());
        var s=loop.registerSession(a,context,null);assertEquals("UNSAVED",loop.inspectSessionContext(a,context).state());
        assertNull(repo.transaction(c->repo.sessionIntent(c,s.id())));
        var intent=loop.prepareIntent(a,s.id());assertFalse(intent.replayed());
        assertEquals("PENDING_OR_UNCERTAIN",loop.inspectSessionContext(a,context).state());
        assertEquals("CONTEXT_UNAVAILABLE",loop.inspectSessionContext(b,context).state(),"no owner, Elder, intent or completed metadata is disclosed");
        assertEquals(409,assertThrows(HistoryFailure.class,()->loop.registerSession(b,context,null)).status());
        var http=standaloneSetup(new HistoryController(loop,mapper)).build();
        var replay=http.perform(post("/api/v1/completed-assessments/save-intents").header("X-Auth-Evidence",a).contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("sessionId",s.id())))).andReturn().getResponse();
        assertEquals(200,replay.getStatus());assertEquals("ALREADY_PREPARED",mapper.readTree(replay.getContentAsString()).path("state").asText());
        loop.create(a,request("recover_"+intent.intentId()));assertEquals("CONFIRMED",loop.inspectSessionContext(a,context).state());
        var detail=http.perform(post("/api/v1/completed-assessments/assessment-sessions/inspect-context").header("X-Auth-Evidence",a).contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("draftContext",context)))).andReturn().getResponse();
        var dto=mapper.readTree(detail.getContentAsString());assertEquals(200,detail.getStatus());assertEquals(5,dto.size());
        for(String key:List.of("answers","item","intentId","sessionId","ownerUserId","elderId","digest"))assertFalse(dto.has(key));
        assertEquals(401,assertThrows(HistoryFailure.class,()->loop.inspectSessionContext(null,context)).status());
        assertEquals(403,assertThrows(HistoryFailure.class,()->loop.inspectSessionContext(empty,context)).status());
    }
    @Test void distinctSessionsSameAnswersAndOneCompletionPerSession() throws Exception {
        var loop=new HistoryService(repo,auth,elders,validator,mapper,Clock.systemUTC(),true);
        var sa=loop.registerSession(a,"synthetic_context_A_"+UUID.randomUUID(),null);
        assertEquals(sa.id(),loop.registerSession(a,sa.context(),null).id());
        var ia=loop.prepareIntent(a,sa.id());
        assertEquals(ia.intentId(),loop.prepareIntent(a,sa.id()).intentId());assertFalse(ia.replayed());assertTrue(loop.prepareIntent(a,sa.id()).replayed());
        assertEquals(409,assertThrows(HistoryFailure.class,()->loop.registerSession(a,"early_B",sa.id())).status());
        var req=request("recover_"+ia.intentId());var ca=loop.create(a,req).item();
        assertEquals(409,assertThrows(HistoryFailure.class,()->loop.registerSession(a,"bypass_root",null)).status());
        String profile=loop.detail(a,ca.id()).profileDisplay().toString();
        var sb=loop.registerSession(a,"synthetic_context_B_"+UUID.randomUUID(),sa.id());
        assertNotEquals(sa.id(),sb.id());assertEquals(sb.id(),loop.registerSession(a,sb.context(),sa.id()).id());
        assertEquals(409,assertThrows(HistoryFailure.class,()->loop.registerSession(a,"duplicate_B",sa.id())).status());
        assertEquals(ia.intentId(),loop.prepareIntent(a,sa.id()).intentId(),"completed session never mints a second intent");
        var ib=loop.prepareIntent(a,sb.id());var cb=loop.create(a,request("recover_"+ib.intentId())).item();
        assertNotEquals(ca.id(),cb.id());assertEquals(ca,loop.create(a,req).item());assertEquals(2,count(a));
        assertEquals(profile,loop.detail(a,ca.id()).profileDisplay().toString());
        assertEquals(sa.id(),loop.reconcileIntent(a,ia.scopeId(),ia.intentId()).sessionId());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.checkedSession(b,sa.id())).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.prepareIntent(b,sa.id())).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.registerSession(b,"foreign",sa.id())).status());
        var raw=new HistoryRequest(req.kind(),req.intent(),req.assessmentContractVersion(),req.schemaVersion(),elderA,"new_raw_key",req.answers());
        assertEquals(400,assertThrows(HistoryFailure.class,()->loop.create(a,raw)).status());
        try(var c=ds.getConnection();var p=c.prepareStatement("INSERT INTO history_session_completion_test_only_v1 VALUES (?,?)")) {
            p.setString(1,sa.id());p.setString(2,cb.id());assertThrows(SQLException.class,p::executeUpdate);
        }
        var http=standaloneSetup(new HistoryController(loop,mapper)).build();
        assertEquals(400,http.perform(post("/api/v1/completed-assessments/save-intents").header("X-Auth-Evidence",a).contentType("application/json").content("{}")).andReturn().getResponse().getStatus());
    }
    @Test void concurrentContextClaimCannotCrossOwnerEvenWithoutClientMarkers() throws Exception {
        var loop=new HistoryService(repo,auth,elders,validator,mapper,Clock.systemUTC(),true);String context="TEST_ONLY_claim_"+UUID.randomUUID();
        assertEquals(400,assertThrows(HistoryFailure.class,()->loop.registerSession(a,"legacy_"+UUID.randomUUID(),null)).status(),"public registration cannot poison the server-reserved legacy fence");
        int accepted=0,rejected=0;HistoryRepository.Session winner=null;
        try(var pool=Executors.newFixedThreadPool(2)) {
            for(var future:List.of(pool.submit(()->loop.registerSession(a,context,null)),pool.submit(()->loop.registerSession(b,context,null)))) {
                try {winner=future.get(10,TimeUnit.SECONDS);accepted++;}catch(ExecutionException fail){assertInstanceOf(HistoryFailure.class,fail.getCause());rejected++;}
            }
        }
        assertEquals(1,accepted);assertEquals(1,rejected);assertNotNull(winner);assertEquals(0,count(a));assertEquals(0,count(b));
        var s=winner;repo.transaction(c->{try(var p=c.prepareStatement("DELETE FROM history_draft_context_claim_test_only_v1 WHERE draft_context=?")) {
            p.setString(1,s.context());assertThrows(SQLException.class,p::executeUpdate);}return null;});
    }
    @Test void previousVersionRowsAndPendingIntentsStayReadable() throws Exception {
        var loop=new HistoryService(repo,auth,elders,validator,mapper,Clock.systemUTC(),true);
        var original=loop.registerSession(a,"TEST_ONLY_original_"+UUID.randomUUID(),null);
        var scope=loop.recoveryScope(a).scopeId();String intent=UUID.randomUUID().toString();
        repo.transaction(c->{repo.prepareIntent(c,scope,intent,Instant.now());return null;});
        assertEquals("RECOVERY_REQUIRED",loop.inspectSessionContext(a,"TEST_ONLY_lost_context").state());
        assertEquals(409,assertThrows(HistoryFailure.class,()->loop.registerSession(a,"TEST_ONLY_lost_context",null)).status());
        assertEquals("LEGACY_RECOVERY_REQUIRED",assertThrows(HistoryFailure.class,()->loop.prepareIntent(a,original.id())).code());
        assertNull(loop.reconcileIntent(a,scope,intent).sessionId(),"old V4 pending has no session");
        var late=loop.create(a,request("recover_"+intent)).item();
        assertNotNull(loop.reconcileIntent(a,scope,intent).sessionId());
        assertEquals("RECOVERY_REQUIRED",loop.inspectSessionContext(a,original.context()).state(),"legacy completion cannot prove retained Draft belongs to unsaved V5 session");
        assertEquals("LEGACY_RECOVERY_REQUIRED",assertThrows(HistoryFailure.class,()->loop.prepareIntent(a,original.id())).code());
        assertEquals("LEGACY_RECOVERY_REQUIRED",assertThrows(HistoryFailure.class,()->loop.registerSession(a,"TEST_ONLY_after_import",loop.reconcileIntent(a,scope,intent).sessionId())).code());
        assertEquals(late,loop.create(a,request("recover_"+intent)).item(),"original legacy replay remains safe");
        assertEquals(1,count(a),"no extra legacy fixture may hide an automatically cleared fence");
        String oldId=UUID.randomUUID().toString();
        try(var c=ds.getConnection();var p=c.prepareStatement("INSERT INTO completed_assessment_history_test_only_v1 "
                +"SELECT ?,owner_user_id,elder_id,?,payload_digest,completed_at,schema_version,assessment_contract_version,source,snapshot_revision,status,JSON_SET(snapshot,'$.id',?) "
                +"FROM completed_assessment_history_test_only_v1 WHERE id=?")) {
            p.setString(1,oldId);p.setString(2,"TEST_ONLY_pre_session_"+oldId);p.setString(3,oldId);p.setString(4,late.id());assertEquals(1,p.executeUpdate());
        }
        assertNull(loop.detail(a,oldId).profileDisplay());assertEquals("unavailable",loop.recommendation(a,oldId).availability());
        assertEquals("RECOVERY_REQUIRED",loop.inspectSessionContext(a,"TEST_ONLY_lost_context").state());
        assertEquals(409,assertThrows(HistoryFailure.class,()->loop.registerSession(a,"TEST_ONLY_after_legacy",loop.reconcileIntent(a,scope,intent).sessionId())).status());
        assertEquals(2,count(a));assertEquals(404,assertThrows(HistoryFailure.class,()->loop.detail(b,oldId)).status());
        assertNotNull(service.recoveryScope(a),"read-only History may verify scope with user-loop disabled");
        assertEquals(503,assertThrows(HistoryFailure.class,()->service.prepareIntent(a,original.id())).status());
    }
    @Test void intentResourceBoundsSerializeConcurrentCreatesAndPreserveRecovery() throws Exception {
        var instant=Instant.parse("2026-10-14T00:00:00Z");var limits=new HistoryIntentLimits(3,2,60);
        var bounded=new HistoryService(repo,auth,elders,validator,mapper,Clock.fixed(instant,ZoneOffset.UTC),true,null,limits);
        var first=bounded.prepareIntent(a);assertNotNull(first.intentId());
        var pool=Executors.newFixedThreadPool(6);var created=new ArrayList<HistoryService.PreparedIntent>();int refused=0;
        try {
            var jobs=new ArrayList<Future<HistoryService.PreparedIntent>>();for(int i=0;i<6;i++)jobs.add(pool.submit(()->bounded.prepareIntent(a)));
            for(var job:jobs)try{created.add(job.get());}catch(ExecutionException failure){
                assertInstanceOf(HistoryFailure.class,failure.getCause());assertEquals(429,((HistoryFailure)failure.getCause()).status());
                assertEquals("INTENT_CREATE_LIMITED",((HistoryFailure)failure.getCause()).code());refused++;
            }
        }finally{pool.shutdownNow();}
        assertEquals(1,created.size());assertEquals(5,refused);
        assertEquals("PENDING_OR_UNCERTAIN",bounded.reconcileIntent(a,first.scopeId(),first.intentId()).state());
        var original=request("recover_"+first.intentId());var saved=bounded.create(a,original);
        assertEquals(saved.item(),bounded.create(a,original).item());assertEquals(1,count(a));
        assertEquals("CONFIRMED",bounded.reconcileIntent(a,first.scopeId(),first.intentId()).state());
        assertNotNull(bounded.prepareIntent(b));assertNotNull(bounded.prepareIntent(b));
        var later=new HistoryService(repo,auth,elders,validator,mapper,Clock.fixed(instant.plusSeconds(61),ZoneOffset.UTC),true,null,limits);
        assertNotNull(later.prepareIntent(a));assertEquals(429,assertThrows(HistoryFailure.class,()->later.prepareIntent(a)).status());
        var muchLater=new HistoryService(repo,auth,elders,validator,mapper,Clock.fixed(instant.plusSeconds(86400),ZoneOffset.UTC),true,null,limits);
        assertEquals(429,assertThrows(HistoryFailure.class,()->muchLater.prepareIntent(a)).status(),"total cap survives window and service recreation");
        assertEquals(saved.item(),muchLater.reconcileIntent(a,first.scopeId(),first.intentId()).item());
        assertEquals("PENDING_OR_UNCERTAIN",muchLater.reconcileIntent(a,created.get(0).scopeId(),created.get(0).intentId()).state(),"no pending record is deleted");
        assertNotNull(muchLater.detail(a,saved.item().id()).profileDisplay());
        var http=standaloneSetup(new HistoryController(muchLater,mapper)).build();
        var rejection=http.perform(post("/api/v1/completed-assessments/assessment-sessions/new").header("X-Auth-Evidence",a).contentType("application/json").content("{\"intent\":\"CONFIRMED_NEW_ASSESSMENT\",\"fromSessionId\":\""+first.sessionId()+"\",\"draftContext\":\"capacity-new\"}")).andReturn().getResponse();
        assertEquals(429,rejection.getStatus());var json=mapper.readTree(rejection.getContentAsString());
        assertEquals("INTENT_CREATE_LIMITED",json.path("code").asText());
        assertEquals(Set.of("contractVersion","kind","availability","code"),new HashSet<>(java.util.stream.StreamSupport.stream(
                java.util.Spliterators.spliteratorUnknownSize(json.fieldNames(),0),false).toList()));
        repo.transaction(c->{try(var p=c.prepareStatement("SELECT COUNT(*) FROM history_save_intent_test_only_v1 WHERE scope_id=?")) {
            p.setString(1,first.scopeId());try(var r=p.executeQuery()){assertTrue(r.next());assertEquals(3,r.getInt(1));}}
            return true;});
    }
    @Test void recoverableIntentAuthorizationDigestAndConcurrentCommit() throws Exception {
        var loop=new HistoryService(repo,auth,elders,validator,mapper,Clock.systemUTC(),true);
        var prepared=loop.prepareIntent(a);assertEquals(loop.recoveryScope(a).scopeId(),prepared.scopeId());
        assertTrue(prepared.intentId().matches("[0-9a-f-]{14}4[0-9a-f-]{21}"));
        assertEquals("PENDING_OR_UNCERTAIN",loop.reconcileIntent(a,prepared.scopeId(),prepared.intentId()).state());
        assertEquals(0,count(a));
        var req=request("recover_"+prepared.intentId());var pool=Executors.newFixedThreadPool(4);
        try {
            var jobs=new ArrayList<Future<HistoryService.Save>>();for(int i=0;i<4;i++)jobs.add(pool.submit(()->loop.create(a,req)));
            var id=jobs.get(0).get().item().id();for(var job:jobs)assertEquals(id,job.get().item().id());
            assertEquals(1,count(a));assertEquals(id,loop.reconcileIntent(a,prepared.scopeId(),prepared.intentId()).item().id());
        }finally{pool.shutdownNow();}
        var changed=req.answers().deepCopy();((ObjectNode)changed).put("basic.age",74);
        assertEquals(409,assertThrows(HistoryFailure.class,()->loop.create(a,new HistoryRequest(req.kind(),req.intent(),req.assessmentContractVersion(),2,elderA,req.idempotencyKey(),changed))).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.reconcileIntent(b,prepared.scopeId(),prepared.intentId())).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.reconcileIntent(b,loop.recoveryScope(b).scopeId(),prepared.intentId())).status());
        var stolen=new HistoryRequest(req.kind(),req.intent(),req.assessmentContractVersion(),2,elderB,req.idempotencyKey(),req.answers());
        assertEquals(403,assertThrows(HistoryFailure.class,()->loop.create(b,stolen)).status());
        assertEquals(401,assertThrows(HistoryFailure.class,()->loop.reconcileIntent(null,prepared.scopeId(),prepared.intentId())).status());
        var missing=UUID.randomUUID().toString();assertEquals(404,assertThrows(HistoryFailure.class,()->loop.reconcileIntent(a,prepared.scopeId(),missing)).status());
        assertEquals(403,assertThrows(HistoryFailure.class,()->loop.create(a,request("recover_"+missing))).status());
        assertEquals(1,count(a));
        var http=standaloneSetup(new HistoryController(loop,mapper)).build();
        String body=mapper.writeValueAsString(Map.of("scopeId",prepared.scopeId(),"intentId",prepared.intentId()));
        String dto=http.perform(post("/api/v1/completed-assessments/save-intents/reconcile").header("X-Auth-Evidence",a).contentType("application/json").content(body)).andReturn().getResponse().getContentAsString();
        assertEquals("CONFIRMED",mapper.readTree(dto).path("state").asText());
        for(String field:List.of("answers","elderId","owner_user_id","payload_digest","evidence"))assertFalse(dto.contains(field));
        assertEquals(400,http.perform(post("/api/v1/completed-assessments/save-intents/reconcile").header("X-Auth-Evidence",a).contentType("application/json").content("x".repeat(513))).andReturn().getResponse().getStatus());
        var disabled=new HistoryService(null,auth,elders,validator,mapper,Clock.systemUTC(),true);
        assertEquals(503,assertThrows(HistoryFailure.class,()->disabled.reconcileIntent(a,prepared.scopeId(),prepared.intentId())).status());
    }
    @Test void recoveryStopsOnRevocationAndChangedElderBinding() throws Exception {
        var loop=new HistoryService(repo,auth,elders,validator,mapper,Clock.systemUTC(),true);
        var prepared=loop.prepareIntent(a);
        String user;try(var c=ds.getConnection();var p=c.prepareStatement("SELECT responsible_user_id FROM elder_record_v1 WHERE elder_id=?")) {
            p.setString(1,elderA);try(var r=p.executeQuery()){assertTrue(r.next());user=r.getString(1);}
        }
        String alternate=account("TEST_ONLY_binding_"+UUID.randomUUID());
        String otherUser;try(var c=ds.getConnection();var p=c.prepareStatement("SELECT user_id FROM auth_session_v1 WHERE session_digest=?")) {
            p.setString(1,hash(alternate));try(var r=p.executeQuery()){assertTrue(r.next());otherUser=r.getString(1);}
        }
        try(var c=ds.getConnection();var p=c.prepareStatement("UPDATE elder_record_v1 SET responsible_user_id=? WHERE elder_id=?")) {
            p.setString(1,otherUser);p.setString(2,elderA);p.executeUpdate();
        }
        assertEquals(403,assertThrows(HistoryFailure.class,()->loop.reconcileIntent(a,prepared.scopeId(),prepared.intentId())).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.reconcileIntent(alternate,prepared.scopeId(),prepared.intentId())).status());
        assertEquals(403,assertThrows(HistoryFailure.class,()->loop.checkedSession(a,prepared.sessionId())).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.checkedSession(alternate,prepared.sessionId())).status());
        assertEquals(403,assertThrows(HistoryFailure.class,()->loop.registerSession(a,"changed_binding",prepared.sessionId())).status());
        try(var c=ds.getConnection();var p=c.prepareStatement("UPDATE elder_record_v1 SET responsible_user_id=? WHERE elder_id=?")) {
            p.setString(1,user);p.setString(2,elderA);p.executeUpdate();
        }
        try(var c=ds.getConnection();var p=c.prepareStatement("UPDATE auth_session_v1 SET revoked_at=CURRENT_TIMESTAMP WHERE session_digest=?")) {p.setString(1,hash(a));p.executeUpdate();}
        assertEquals(401,assertThrows(HistoryFailure.class,()->loop.reconcileIntent(a,prepared.scopeId(),prepared.intentId())).status());
        assertEquals(401,assertThrows(HistoryFailure.class,()->loop.checkedSession(a,prepared.sessionId())).status());
        var relogin=account(user+"_relogin"); // Different principal must not inherit the old scope.
        assertEquals(403,assertThrows(HistoryFailure.class,()->loop.recoveryScope(relogin)).status());
    }
    @Test void recommendationCaptureOwnerImmutabilityLegacyVersionAndReadWithoutRecalculation() throws Exception {
        var catalog=mapper.readTree(getClass().getResourceAsStream("/assessment-history/test-only-server-recommendation-catalog-v1.json"));
        var current=new java.util.concurrent.atomic.AtomicReference<JsonNode>(catalog);
        HistoryRecommendationSource source=()->new HistoryRecommendationSource.Capture(current.get().deepCopy(),"TEST_ONLY_SERVER_CATALOG_CURRENT_V121");
        var capturing=new HistoryService(repo,auth,elders,validator,mapper,Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"),ZoneOffset.UTC),true,source);
        var old=service.create(a,request("legacy-rec")).item();
        assertEquals("unavailable",capturing.recommendation(a,old.id()).availability());
        var req=request("formal-rec");var saved=capturing.create(a,req).item();
        var detail=capturing.recommendation(a,saved.id());assertEquals("ready",detail.availability());
        var display=detail.display();assertEquals(saved.id(),display.path("assessmentId").asText());
        assertEquals(saved.completedAt(),display.path("assessmentCompletedAt").asText());
        assertEquals("recommendation-contract-v2",display.path("versions").path("recommendationContractVersion").asText());
        assertTrue(display.path("source").path("digest").asText().matches("[0-9a-f]{64}"));
        assertFalse(display.path("cards").isEmpty());String original=mapper.writeValueAsString(display);
        current.set(mapper.createObjectNode());
        assertEquals(saved,capturing.create(a,req).item(),"replay never captures a changed Catalog");
        assertEquals(original,mapper.writeValueAsString(capturing.recommendation(a,saved.id()).display()));
        var readonly=new HistoryService(repo,auth,elders,new HistoryValidator(mapper,"MUST_NOT_EXECUTE_ON_READ"),mapper,Clock.systemUTC(),true,
                ()->{throw new AssertionError("read must not access current source");});
        assertEquals(original,mapper.writeValueAsString(readonly.recommendation(a,saved.id()).display()));
        int before=count(a);assertEquals(503,assertThrows(HistoryFailure.class,()->capturing.create(a,request("invalid-source"))).status());assertEquals(before,count(a));
        current.set(catalog);
        var unknown=request("no-safe-rec");((ObjectNode)unknown.answers()).set("cognitive.symptoms",mapper.createArrayNode().add("unknown"));
        var noSafe=capturing.create(a,unknown).item();
        assertEquals("ready",capturing.recommendation(a,noSafe.id()).availability());
        assertEquals("no_safe_recommendation",capturing.recommendation(a,noSafe.id()).display().path("state").asText());
        assertEquals(saved.id(),capturing.recommendation(a,saved.id()).display().path("assessmentId").asText());
        var future=service.create(a,request("future-rec")).item();
        var futureDisplay=display.deepCopy();((ObjectNode)futureDisplay).put("assessmentId",future.id());
        ((ObjectNode)futureDisplay).put("assessmentCompletedAt",future.completedAt());
        ((ObjectNode)futureDisplay.path("versions")).put("recommendationRulesetVersion","future-unsupported");
        repo.transaction(c->{repo.insertRecommendation(c,future.id(),futureDisplay);return true;});
        assertEquals("unsupported_version",capturing.recommendation(a,future.id()).availability());assertNull(capturing.recommendation(a,future.id()).display());
        var recMvc=standaloneSetup(new HistoryController(capturing,mapper)).build();
        String foreign=recMvc.perform(get("/api/v1/completed-assessments/"+saved.id()+"/recommendation").header("X-Auth-Evidence",b)).andReturn().getResponse().getContentAsString();
        var absent=recMvc.perform(get("/api/v1/completed-assessments/00000000-0000-0000-0000-000000000000/recommendation").header("X-Auth-Evidence",b)).andReturn().getResponse();
        assertEquals(404,absent.getStatus());assertEquals(foreign,absent.getContentAsString());
        assertEquals(401,recMvc.perform(get("/api/v1/completed-assessments/"+saved.id()+"/recommendation")).andReturn().getResponse().getStatus());
        String dto=recMvc.perform(get("/api/v1/completed-assessments/"+saved.id()+"/recommendation").header("X-Auth-Evidence",a)).andReturn().getResponse().getContentAsString();
        for(String forbidden:List.of("answers","elderId","elderSnapshot","rankTuple","ruleId","ownerUserId","合成验收样本"))assertFalse(dto.contains(forbidden),forbidden);
        try(var c=ds.getConnection();var p=c.prepareStatement("UPDATE historical_recommendation_display_test_only_v1 SET display_snapshot=? WHERE assessment_id=?")) {
            p.setString(1,original);p.setString(2,saved.id());assertThrows(SQLException.class,p::executeUpdate);
        }
        try(var c=ds.getConnection();var p=c.prepareStatement("DELETE FROM historical_recommendation_display_test_only_v1 WHERE assessment_id=?")) {
            p.setString(1,saved.id());assertThrows(SQLException.class,p::executeUpdate);
        }
    }
    @Test void createReplayConflictOwnerAndMetadataOnlyHttp() throws Exception {
        var capability=mapper.readTree(mvc.perform(get("/api/v1/completed-assessments/capability")).andReturn().getResponse().getContentAsString());
        assertEquals("ready",capability.path("availability").asText());assertEquals(HistoryMetadata.SOURCE,capability.path("source").asText());
        assertFalse(capability.has("items"));assertFalse(capability.has("userId"));
        var req=request("save"); var created=service.create(a,req);
        assertFalse(created.replayed()); assertEquals("2026-10-13T00:00:00Z",created.item().completedAt()); assertEquals(36,created.item().id().length());
        assertEquals(created.item(),service.create(a,req).item());assertTrue(service.create(a,req).replayed());assertEquals(1,count(a));assertEquals(0,count(b));
        var changed=req.answers().deepCopy(); ((ObjectNode)changed).put("basic.age",73);
        var conflict=new HistoryRequest(req.kind(),req.intent(),req.assessmentContractVersion(),2,elderA,req.idempotencyKey(),changed);
        assertEquals(409,assertThrows(HistoryFailure.class,()->service.create(a,conflict)).status());assertEquals(1,count(a));
        assertEquals(400,assertThrows(HistoryFailure.class,()->service.list(b,1,created.item().id())).status());
        String body=mvc.perform(get("/api/v1/completed-assessments?userId=forged&limit=20").header("X-Auth-Evidence",a)).andReturn().getResponse().getContentAsString();
        var json=mapper.readTree(body);assertEquals("ready",json.path("availability").asText());
        Set<String> keys=new HashSet<>(); json.path("items").get(0).fieldNames().forEachRemaining(keys::add);
        assertEquals(Set.of("kind","id","status","schemaVersion","completedAt","assessmentContractVersion","source","snapshotRevision"),keys);
        assertFalse(body.contains("health."));assertFalse(body.contains("elderId"));assertFalse(body.contains("owner"));
        assertEquals("HistoryRequest[REDACTED]",req.toString());
        var httpReq=mapper.valueToTree(req);
        assertEquals(200,mvc.perform(post("/api/v1/completed-assessments").header("X-Auth-Evidence",a).contentType("application/json").content(mapper.writeValueAsBytes(httpReq))).andReturn().getResponse().getStatus());
        ((ObjectNode)httpReq).put("completedAt","forged");
        assertEquals(400,mvc.perform(post("/api/v1/completed-assessments").header("X-Auth-Evidence",a).contentType("application/json").content(mapper.writeValueAsBytes(httpReq))).andReturn().getResponse().getStatus());
    }
    @Test void authBindingInvalidVersionDraftAndUnavailableGatesFailClosed() throws Exception {
        var req=request("save");
        assertEquals(401,assertThrows(HistoryFailure.class,()->service.create(null,req)).status());
        assertEquals(401,assertThrows(HistoryFailure.class,()->service.list("guessed",20,null)).status());
        assertEquals(403,assertThrows(HistoryFailure.class,()->service.create(b,req)).status());
        assertEquals(403,assertThrows(HistoryFailure.class,()->service.create(empty,req)).status());
        for(var invalid:List.of(new HistoryRequest("assessment_draft",req.intent(),req.assessmentContractVersion(),2,elderA,"draft",req.answers()),
                new HistoryRequest(req.kind(),req.intent(),"assessment-schema-v1",1,elderA,"version",req.answers()),
                new HistoryRequest(req.kind(),req.intent(),req.assessmentContractVersion(),2,elderA,"missing",mapper.createObjectNode())))
            assertEquals(400,assertThrows(HistoryFailure.class,()->service.create(a,invalid)).status());
        var disabled=new HistoryService(null,auth,elders,validator,mapper,Clock.systemUTC());
        assertEquals("UNAVAILABLE",assertThrows(HistoryFailure.class,()->disabled.create(a,req)).code());
        var disabledMvc=standaloneSetup(new HistoryController(disabled,mapper)).build();
        var capability=mapper.readTree(disabledMvc.perform(get("/api/v1/completed-assessments/capability")).andReturn().getResponse().getContentAsString());
        assertEquals("unavailable",capability.path("availability").asText());assertTrue(capability.path("source").isNull());
        assertEquals(503,disabledMvc.perform(post("/api/v1/completed-assessments?testOnly=true&productionWriteEnabled=true").header("X-Auth-Evidence",a)
                .header("X-Test-Owner","forged").contentType("application/json").content(mapper.writeValueAsBytes(req))).andReturn().getResponse().getStatus());
        assertEquals(0,count(a));
    }
    @Test void immutableSnapshotsStableKeysetAndConcurrentIdempotency() throws Exception {
        var r=request("same");
        try(var pool=Executors.newFixedThreadPool(2)) {
            var one=pool.submit(()->service.create(a,r));var two=pool.submit(()->service.create(a,r));
            assertEquals(one.get(15,TimeUnit.SECONDS).item().id(),two.get(15,TimeUnit.SECONDS).item().id());
        }
        service.create(a,request("tie"));
        var recent=serviceAt("2026-10-14T00:00:00.123456Z").create(a,request("recent")).item();
        var all=service.list(a,50,null);assertEquals(recent.id(),all.items().getFirst().id());
        assertTrue(all.items().get(1).id().compareTo(all.items().get(2).id())>0);
        var first=service.list(a,1,null);assertNotNull(first.nextCursor());
        var second=service.list(a,1,first.nextCursor());var third=service.list(a,1,second.nextCursor());
        assertNull(third.nextCursor());assertEquals(all.items(),List.of(first.items().getFirst(),second.items().getFirst(),third.items().getFirst()));
        try(var c=ds.getConnection();var s=c.createStatement()) {
            assertThrows(SQLException.class,()->s.executeUpdate("UPDATE completed_assessment_history_test_only_v1 SET snapshot_revision=2 WHERE id='"+recent.id()+"'"));
            assertThrows(SQLException.class,()->s.executeUpdate("DELETE FROM completed_assessment_history_test_only_v1 WHERE id='"+recent.id()+"'"));
            try(var p=c.prepareStatement("SELECT snapshot FROM completed_assessment_history_test_only_v1 WHERE id=?")) {
                p.setString(1,recent.id());try(var rs=p.executeQuery()){assertTrue(rs.next());assertEquals("合成验收样本",mapper.readTree(rs.getString(1)).path("answers").path("basic.elderName").asText());}
            }
        }
        ((ObjectNode)r.answers()).put("basic.elderName","修改后的合成样本");assertEquals(3,count(a));
    }
    @Test void failingInsertRollsBackWithoutCompletedRow() throws Exception {
        var failing=request("FAIL_ROLLBACK");
        String trigger="history_test_failure_"+UUID.randomUUID().toString().replace("-","");
        try(var c=ds.getConnection();var s=c.createStatement()) {
            s.execute("CREATE TRIGGER "+trigger+" BEFORE INSERT ON completed_assessment_history_test_only_v1 FOR EACH ROW BEGIN IF NEW.idempotency_key='"+failing.idempotencyKey()+"' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_ONLY rollback'; END IF; END");
        }
        assertEquals(503,assertThrows(HistoryFailure.class,()->service.create(a,failing)).status());
        assertEquals(0,count(a));
        assertFalse(service.create(a,request("retry-valid")).replayed());assertEquals(1,count(a));
    }
    @Test void userLoopReadsStoredProfileOnlyAndOldRowsRemainUnavailable() throws Exception {
        var loop=new HistoryService(repo,auth,elders,validator,mapper,Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"),ZoneOffset.UTC),true);
        var old=service.create(a,request("TEST_ONLY_legacy")).item();
        assertNull(loop.detail(a,old.id()).profileDisplay());
        var current=loop.create(a,request("TEST_ONLY_profile")).item();
        assertTrue(loop.create(a,request("TEST_ONLY_profile")).replayed());
        var stored=loop.detail(a,current.id()).profileDisplay();
        assertEquals(current.id(),stored.path("assessmentId").asText());
        assertEquals(current.completedAt(),stored.path("assessmentCompletedAt").asText());
        assertEquals("elder-profile-contract-v2",stored.path("profileContractVersion").asText());
        assertEquals(6,stored.path("rows").size());
        String original=stored.toString();
        assertFalse(original.contains("answers"));assertFalse(original.contains("elderId"));assertFalse(original.contains("health."));
        var changed=request("TEST_ONLY_next");((ObjectNode)changed.answers()).put("adl.mobility","bedridden");
        loop.create(a,changed);
        assertEquals(original,loop.detail(a,current.id()).profileDisplay().toString(),"later assessment cannot overwrite old display");
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.detail(b,current.id())).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.detail(b,UUID.randomUUID().toString())).status());
        assertEquals(404,assertThrows(HistoryFailure.class,()->loop.detail(a,"not-a-valid-id")).status());
        assertEquals(401,assertThrows(HistoryFailure.class,()->loop.detail(null,current.id())).status());
        assertEquals(503,assertThrows(HistoryFailure.class,()->service.detail(a,current.id())).status(),"loop switch cannot be bypassed");
        var loopMvc=standaloneSetup(new HistoryController(loop,mapper)).build();
        String own=loopMvc.perform(get("/api/v1/completed-assessments/"+current.id()).header("X-Auth-Evidence",a)).andReturn().getResponse().getContentAsString();
        assertFalse(own.contains("answers"));assertFalse(own.contains("ownerUserId"));assertFalse(own.contains("elderId"));
        var foreign=loopMvc.perform(get("/api/v1/completed-assessments/"+current.id()).header("X-Auth-Evidence",b)).andReturn().getResponse();
        var absent=loopMvc.perform(get("/api/v1/completed-assessments/"+UUID.randomUUID()).header("X-Auth-Evidence",b)).andReturn().getResponse();
        assertEquals(404,foreign.getStatus());assertEquals(absent.getContentAsString(),foreign.getContentAsString());
        try(var c=ds.getConnection();var p=c.createStatement()) {
            assertThrows(SQLException.class,()->p.executeUpdate("UPDATE historical_profile_display_test_only_v1 SET snapshot_version=2 WHERE assessment_id='"+current.id()+"'"));
            assertThrows(SQLException.class,()->p.executeUpdate("DELETE FROM historical_profile_display_test_only_v1 WHERE assessment_id='"+current.id()+"'"));
        }
    }
    @Test void profileFailureRollsBackOriginalCompletedInsert() throws Exception {
        String trigger="TEST_ONLY_profile_failure_"+UUID.randomUUID().toString().replace("-","");
        try(var c=ds.getConnection();var p=c.createStatement()) {
            p.execute("CREATE TRIGGER "+trigger+" BEFORE INSERT ON historical_profile_display_test_only_v1 FOR EACH ROW BEGIN IF JSON_UNQUOTE(JSON_EXTRACT(NEW.display_snapshot,'$.assessmentCompletedAt'))='2040-01-01T00:00:00Z' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_ONLY profile rollback'; END IF; END");
        }
        var loop=new HistoryService(repo,auth,elders,validator,mapper,Clock.fixed(Instant.parse("2040-01-01T00:00:00Z"),ZoneOffset.UTC),true);
        assertEquals(503,assertThrows(HistoryFailure.class,()->loop.create(a,request("TEST_ONLY_profile_fail"))).status());
        assertEquals(0,count(a));
    }
}
