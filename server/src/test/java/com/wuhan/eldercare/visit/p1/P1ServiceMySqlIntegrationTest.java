package com.wuhan.eldercare.visit.p1;

import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class P1ServiceMySqlIntegrationTest {
    private P1TestSupport support;
    private MockMvc mvc;
    @BeforeAll void start()throws Exception{
        assumeTrue("true".equals(System.getenv("P1_DISPOSABLE_MYSQL")),"explicit P1 isolated MySQL required");
        support=new P1TestSupport(System.getenv());mvc=MockMvcBuilders.standaloneSetup(new P1Controller(support.service,support.mapper)).build();
    }
    @AfterAll void stop(){if(support!=null)support.close();}
    private void failure(int status,String code,org.junit.jupiter.api.function.Executable action){var error=assertThrows(P1Failure.class,action);assertEquals(status,error.status());assertEquals(code,error.code());}
    @Test void legitimateConsultationAndVisitRemainSeparatePendingIntents(){
        var consultation=support.service.submit(support.alice,support.input("CONSULTATION"));assertEquals("PENDING_CONTACT",consultation.path("status").asText());
        var visit=support.service.submit(support.alice,support.input("VISIT_INTENT"));assertEquals("PENDING_ARRANGEMENT",visit.path("status").asText());
        assertTrue(visit.path("scheduledStart").isNull());assertTrue(visit.path("scheduledEnd").isNull());assertEquals("SYNTHETIC_TEST_ONLY",visit.path("datasetMode").asText());
        assertTrue(visit.path("assignedTo").isNull());assertEquals("SYNTHETIC_TEST_ONLY",visit.path("source").asText());
    }
    @Test void sameIntentRetransmissionIsSameRecordAndDifferentContentConflicts(){
        var input=support.input("VISIT_INTENT");var first=support.service.submit(support.alice,input);assertEquals(first,support.service.submit(support.alice,input));
        var changed=new P1Service.Input(input.requestId(),input.inputVersion(),"CONSULTATION",input.institutionId(),input.contactName(),input.contactPhone(),input.relationship(),input.serviceScenario(),input.preferredWindow(),input.partySize(),null,input.consentVersion(),true);
        failure(409,"IDEMPOTENCY_CONFLICT",()->support.service.submit(support.alice,changed));
        assertEquals(first,support.service.ownDetail(support.alice,input.requestId()));
    }
    @Test void concurrentSameIntentCreatesOnlyOneSubmittedEvent()throws Exception{
        var input=support.input("VISIT_INTENT");var gate=new CountDownLatch(1);var workers=Executors.newFixedThreadPool(4);var results=new ArrayList<Future<String>>();
        for(int i=0;i<4;i++)results.add(workers.submit(()->{gate.await();return support.service.submit(support.alice,input).path("id").asText();}));
        gate.countDown();for(var future:results)assertEquals(input.requestId(),future.get(20,TimeUnit.SECONDS));workers.shutdown();
        var login=support.service.login("p1-synthetic-admin",support.adminPassword);
        assertEquals(1,support.service.adminDetail(login.token(),input.requestId()).path("events").size());
    }
    @Test void sameUnconfirmedWindowIsNotReservedForOneFamily(){
        var first=support.service.submit(support.alice,support.input("VISIT_INTENT"));var second=support.service.submit(support.bob,support.input("VISIT_INTENT"));
        assertEquals(first.path("preferredWindow"),second.path("preferredWindow"));assertNotEquals(first.path("id"),second.path("id"));assertEquals("PENDING_ARRANGEMENT",second.path("status").asText());
    }
    @Test void ownerIsolationAndStableIdDoNotRevealOtherFamilies(){
        var input=support.input("CONSULTATION");support.service.submit(support.alice,input);
        failure(404,"NOT_FOUND",()->support.service.ownDetail(support.bob,input.requestId()));
        failure(404,"NOT_FOUND",()->support.service.cancel(support.bob,input.requestId()));
        failure(404,"NOT_FOUND",()->support.service.submit(support.bob,input));
        assertTrue(support.service.ownList(support.bob).stream().noneMatch(x->x.path("id").asText().equals(input.requestId())));
    }
    @Test void cancellationIsExplicitIdempotentAndRecordedWithoutVisitClaims(){
        var input=support.input("VISIT_INTENT");support.service.submit(support.alice,input);var cancelled=support.service.cancel(support.alice,input.requestId());
        assertEquals("CANCELLED",cancelled.path("status").asText());assertEquals(cancelled,support.service.cancel(support.alice,input.requestId()));assertEquals(cancelled,support.service.submit(support.alice,input));
        var login=support.service.login("p1-synthetic-admin",support.adminPassword);var events=support.service.adminDetail(login.token(),input.requestId()).path("events");assertEquals(2,events.size());
        assertTrue(events.toString().contains("REQUEST_CANCELLED"));assertFalse(events.toString().contains("VISITED"));
    }
    @Test void revokedAndMissingC5SessionsCannotReadOrWrite()throws Exception{
        failure(401,"AUTH_REQUIRED",()->support.service.ownList(null));failure(401,"AUTH_REQUIRED",()->support.service.submit("unknown",support.input("CONSULTATION")));
        String revoked="P1_SYNTHETIC_REVOKED_"+UUID.randomUUID();
        try(var c=support.database.getConnection();var statement=c.prepareStatement("INSERT INTO auth_session_v1 SELECT ?,user_id,?,?,? FROM auth_session_v1 WHERE session_digest=?")){
            var now=Timestamp.from(Instant.now());statement.setString(1,P1Service.digest(revoked));statement.setTimestamp(2,now);statement.setTimestamp(3,Timestamp.from(Instant.now().plusSeconds(120)));statement.setTimestamp(4,now);statement.setString(5,P1Service.digest(support.alice));statement.executeUpdate();
        }
        failure(401,"AUTH_REQUIRED",()->support.service.submit(revoked,support.input("CONSULTATION")));
    }
    @Test void adminRequiresIndependentCredentialCookieAndCsrf()throws Exception{
        failure(401,"ADMIN_AUTH_REQUIRED",()->support.service.adminList(support.alice,null,null,null,null,null,50));
        failure(401,"ADMIN_AUTH_REQUIRED",()->support.service.login("p1-synthetic-admin","wrong-password"));
        var login=support.service.login("p1-synthetic-admin",support.adminPassword);assertEquals(login.csrfToken(),support.service.admin(login.token(),null,false).csrfToken());
        failure(403,"CSRF_REQUIRED",()->support.service.logout(login.token(),"wrong"));
        assertNotNull(support.service.admin(login.token(),null,false));support.service.logout(login.token(),login.csrfToken());failure(401,"ADMIN_AUTH_REQUIRED",()->support.service.admin(login.token(),null,false));
    }
    @Test void adminFiltersAreBoundedParameterizedAndTimezoneExplicit(){
        var login=support.service.login("p1-synthetic-admin",support.adminPassword);var today=LocalDate.now(ZoneId.of("Asia/Shanghai")).toString();
        var input=support.input("CONSULTATION");support.service.submit(support.alice,input);
        var list=support.service.adminList(login.token(),"PENDING_CONTACT","CONSULTATION",P1Service.INSTITUTION,today,today,100);
        assertTrue(list.stream().anyMatch(x->x.path("id").asText().equals(input.requestId())));
        failure(400,"INVALID_FILTER",()->support.service.adminList(login.token(),"' OR 1=1",null,null,null,null,50));
        failure(400,"INVALID_FILTER",()->support.service.adminList(login.token(),null,null,null,"2026-02-30",null,50));
        failure(400,"INVALID_FILTER",()->support.service.adminList(login.token(),null,null,null,null,null,101));
    }
    @Test void syntheticRowsExcludedFromProductionScope(){
        var input=support.input("CONSULTATION");support.service.submit(support.alice,input);var settings=new P1Service.Settings(true,false,support.settings.noticeVersion(),support.settings.noticeText(),support.settings.noticeApprovalRef(),"","p1-synthetic-admin",support.passwordHash);
        var production=new P1Service(support.database,support.auth,support.mapper,support.clock,settings);
        assertTrue(production.ownList(support.alice).isEmpty());failure(404,"NOT_FOUND",()->production.ownDetail(support.alice,input.requestId()));
        var syntheticAdmin=support.service.login("p1-synthetic-admin",support.adminPassword);
        failure(401,"ADMIN_AUTH_REQUIRED",()->production.adminList(syntheticAdmin.token(),null,null,null,null,null,100));
        var admin=production.login("p1-synthetic-admin",support.adminPassword);assertTrue(production.adminList(admin.token(),null,null,null,null,null,100).isEmpty());
    }
    @Test void restartReadsPersistedRequestAndOriginalState(){
        var input=support.input("VISIT_INTENT");var initial=support.service.submit(support.alice,input);
        var restarted=new P1Service(support.database,support.auth,support.mapper,support.clock,support.settings);
        assertEquals(initial,restarted.ownDetail(support.alice,input.requestId()));
    }
    @Test void databaseFailureRollsBackCreationAndFailedCancellationKeepsPriorState()throws Exception{
        var first=support.input("CONSULTATION");var second=support.input("VISIT_INTENT");support.service.submit(support.alice,second);
        try(var connection=support.database.getConnection();var statement=connection.createStatement()){
            statement.execute("CREATE TRIGGER p1_synthetic_event_failure BEFORE INSERT ON p1_service_event_v1 FOR EACH ROW BEGIN IF NEW.request_id='"+first.requestId()+"' OR (NEW.request_id='"+second.requestId()+"' AND NEW.event_type='REQUEST_CANCELLED') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SYNTHETIC_ROLLBACK'; END IF; END");
            try{
                failure(503,"SERVICE_UNAVAILABLE",()->support.service.submit(support.alice,first));
                failure(404,"NOT_FOUND",()->support.service.ownDetail(support.alice,first.requestId()));
                failure(503,"SERVICE_UNAVAILABLE",()->support.service.cancel(support.alice,second.requestId()));
                assertEquals("PENDING_ARRANGEMENT",support.service.ownDetail(support.alice,second.requestId()).path("status").asText());
            }finally{statement.execute("DROP TRIGGER p1_synthetic_event_failure");}
        }
    }
    @Test void missingNoticeIsFailClosedAndDoesNotCollectBody(){
        var closed=new P1Service(support.database,support.auth,support.mapper,support.clock,new P1Service.Settings(true,false,"","","","13900000000","",""));
        assertFalse(closed.config().path("enabled").asBoolean());assertTrue(closed.config().path("notice").isNull());assertEquals("平台咨询",closed.config().path("platformContact").path("label").asText());
        failure(503,"SERVICE_UNAVAILABLE",()->closed.submit(support.alice,support.input("CONSULTATION")));
    }
    @Test void controllerRejectsAuthorityFieldsDuplicateJsonAndOrdinaryTokenAdminAccess()throws Exception{
        var body=support.mapper.valueToTree(support.input("CONSULTATION"));((com.fasterxml.jackson.databind.node.ObjectNode)body).put("datasetMode","PRODUCTION");
        mvc.perform(post("/api/v1/p1-service/requests").header("X-Auth-Evidence",support.alice).contentType("application/json").content(body.toString())).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        mvc.perform(post("/api/v1/p1-service/requests").contentType("application/json").content("{\"requestId\":\"a\",\"requestId\":\"b\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/p1-service/admin/requests").header("X-Auth-Evidence",support.alice)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/p1-service/admin/login").contentType("application/json").content("{}")).andExpect(status().isForbidden());
    }
    @Test void controllerCookieIsHttpOnlyAndAdminSessionHasNoUserToken()throws Exception{
        var result=mvc.perform(post("/api/v1/p1-service/admin/login").header("X-P1-Admin-Request","1").contentType("application/json")
                .content(support.mapper.writeValueAsString(Map.of("username","p1-synthetic-admin","password",support.adminPassword))))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store, private")).andReturn();
        String cookie=result.getResponse().getHeader("Set-Cookie");assertTrue(cookie.contains("HttpOnly"));assertTrue(cookie.contains("SameSite=Strict"));assertFalse(result.getResponse().getContentAsString().contains("sessionEvidence"));
        var session=new Cookie("P1_ADMIN_SESSION",cookie.split(";",2)[0].split("=",2)[1]);
        mvc.perform(get("/api/v1/p1-service/admin/session").cookie(session)).andExpect(status().isOk()).andExpect(jsonPath("$.authenticated").value(true));
    }
    @Test void syntheticHttpAuthUsesCurrentC5WireAndIsoExpiry()throws Exception{
        P1SyntheticServer.support=support;
        var authMvc=MockMvcBuilders.standaloneSetup(new P1SyntheticServer.SyntheticAuth())
                .setMessageConverters(new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(support.mapper)).build();
        var response=authMvc.perform(post("/api/v1/auth/wechat").contentType("application/json").content("{\"contractVersion\":\"wechat-authenticated-principal-contract-v1\",\"kind\":\"wechat_authentication_request_v1\",\"loginCode\":\"P1_SYNTHETIC_CODE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("AUTHENTICATED")).andReturn();
        var body=support.mapper.readTree(response.getResponse().getContentAsString());assertEquals(6,body.size());assertTrue(body.path("expiresAt").isTextual());Instant.parse(body.path("expiresAt").asText());
    }
}
