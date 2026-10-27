package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.flywaydb.core.Flyway;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import jakarta.servlet.http.Cookie;
import java.time.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class P1OperationsMySqlIntegrationTest {
    P1TestSupport s; P1Service.Login login; MockMvc mvc;
    Instant start; String staff; static AtomicInteger sequence=new AtomicInteger();
    @BeforeAll void setup()throws Exception{
        assumeTrue("true".equals(System.getenv("P1_DISPOSABLE_MYSQL")),"isolated real MySQL required");
        s=new P1TestSupport(System.getenv());login=s.service.login("p1-synthetic-admin",s.adminPassword);
        mvc=MockMvcBuilders.standaloneSetup(new P1Controller(s.service,s.mapper)).build();
    }
    @BeforeEach void isolate(){start=Instant.parse("2020-01-01T02:00:00Z").plusSeconds(sequence.incrementAndGet()*86400L*3);staff="synthetic-staff-"+UUID.randomUUID();}
    @AfterAll void close(){if(s!=null)s.close();}
    String request(String owner){var input=s.input("VISIT_INTENT");s.service.submit(owner,input);return input.requestId();}
    ObjectNode visit(String action,Instant low,Instant high){return s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("visitId",UUID.randomUUID().toString())
            .put("action",action).put("expectedRevision",0).put("institutionId",P1Service.INSTITUTION).put("staffId",staff)
            .put("start",low.toString()).put("end",high.toString()).put("bufferBefore",0).put("bufferAfter",0)
            .put("familyConfirmed",true).put("institutionConfirmed",true).put("meetingNote","合成集合点，不是真实院址");}
    ObjectNode save(String id,ObjectNode b){return s.service.operations().visit(login.token(),login.csrfToken(),id,b);}
    ObjectNode action(ObjectNode original,String action,int revision){return s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("visitId",original.path("visitId").asText()).put("action",action).put("expectedRevision",revision);}
    ObjectNode follow(String result){return s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("result",result).put("note","=合成内部备注+@仅内部").putNull("nextContactAt").putNull("nextAction").putNull("feedbackSource").putNull("institutionId");}
    void fails(String code,org.junit.jupiter.api.function.Executable run){assertEquals(code,assertThrows(P1Failure.class,run).code());}
    @Test void multipleFollowupsAndRetryAndRefusalKeepTrueHistory(){
        String id=request(s.alice);var first=follow("NO_ANSWER").put("nextContactAt",Instant.now().plusSeconds(86400).toString()).put("nextAction","明天再联系");
        s.service.operations().followup(login.token(),login.csrfToken(),id,first);s.service.operations().followup(login.token(),login.csrfToken(),id,first);
        var second=follow("CONNECTED");s.service.operations().followup(login.token(),login.csrfToken(),id,second);
        var detail=s.service.adminDetail(login.token(),id);assertEquals(3,detail.path("events").size());assertEquals("PENDING_ARRANGEMENT",detail.path("item").path("status").asText());
        fails("IDEMPOTENCY_CONFLICT",()->s.service.operations().followup(login.token(),login.csrfToken(),id,first.deepCopy().put("note","different")));
        s.service.operations().followup(login.token(),login.csrfToken(),id,follow("REFUSED"));
        detail=s.service.adminDetail(login.token(),id);assertEquals("CLOSED",detail.path("item").path("status").asText());assertTrue(detail.path("nextContact").path("nextContactAt").isNull());
        fails("REQUEST_CLOSED",()->s.service.operations().followup(login.token(),login.csrfToken(),id,follow("NO_ANSWER")));
        var own=s.service.ownDetail(s.alice,id);assertFalse(own.toString().contains("内部备注"));assertFalse(own.toString().contains("nextContact"));
    }
    @Test void draftOverlapDoesNotOccupyAndBothConfirmationsRequired(){
        String a=request(s.alice),b=request(s.bob);var draft=visit("SAVE_DRAFT",start,start.plusSeconds(3600)).put("familyConfirmed",false);
        save(a,draft);var own=s.service.ownDetail(s.alice,a);assertTrue(own.path("visits").get(0).path("start").isNull());
        save(b,visit("CONFIRM",start,start.plusSeconds(3600)));
        var confirm=draft.deepCopy().put("operationId",UUID.randomUUID().toString()).put("action","CONFIRM").put("expectedRevision",1);
        fails("BOTH_CONFIRMATIONS_REQUIRED",()->save(a,confirm));
        fails("STAFF_CONFLICT",()->save(a,confirm.deepCopy().put("familyConfirmed",true)));
    }
    @Test void emptyCalendarConcurrentConfirmCannotDoubleSucceed()throws Exception{
        String a=request(s.alice),b=request(s.bob);var first=visit("CONFIRM",start,start.plusSeconds(3600));var second=visit("CONFIRM",start,start.plusSeconds(3600));
        var another=s.service.login("p1-synthetic-admin",s.adminPassword);var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        Callable<String> left=()->{gate.await();try{save(a,first);return "OK";}catch(P1Failure e){return e.code();}};
        Callable<String> right=()->{gate.await();try{s.service.operations().visit(another.token(),another.csrfToken(),b,second);return "OK";}catch(P1Failure e){return e.code();}};
        var f=pool.submit(left);var g=pool.submit(right);gate.countDown();var results=List.of(f.get(15,TimeUnit.SECONDS),g.get(15,TimeUnit.SECONDS));pool.shutdownNow();
        assertEquals(1,Collections.frequency(results,"OK"));assertEquals(1,Collections.frequency(results,"STAFF_CONFLICT"));
    }
    @Test void sameOwnerAcrossRequestsIsProtectedButSamePhoneAcrossOwnersIsNot(){
        String a=request(s.alice),b=request(s.alice),c=request(s.bob);save(a,visit("CONFIRM",start,start.plusSeconds(3600)));
        var another=visit("CONFIRM",start,start.plusSeconds(3600)).put("staffId","other-"+staff);
        fails("SUBJECT_CONFLICT",()->save(b,another));save(c,another);
    }
    @Test void halfOpenAdjacentAndBuffersAndCancelRelease(){
        String a=request(s.alice),b=request(s.bob);var first=visit("CONFIRM",start,start.plusSeconds(3600)).put("bufferAfter",30);save(a,first);
        fails("STAFF_CONFLICT",()->save(b,visit("CONFIRM",start.plusSeconds(3600),start.plusSeconds(7200))));
        var next=visit("CONFIRM",start.plusSeconds(5400),start.plusSeconds(9000));save(b,next);
        save(a,action(first,"CANCEL",1));save(a,visit("CONFIRM",start,start.plusSeconds(5400))); // exact adjacency to second, no buffer
    }
    @Test void rescheduleRollbackAndRevisionAndIdempotency(){
        String a=request(s.alice),b=request(s.bob);var old=visit("CONFIRM",start,start.plusSeconds(3600));save(a,old);
        save(b,visit("CONFIRM",start.plusSeconds(7200),start.plusSeconds(10800)));
        var moved=old.deepCopy().put("operationId",UUID.randomUUID().toString()).put("action","RESCHEDULE").put("expectedRevision",1).put("start",start.plusSeconds(7200).toString()).put("end",start.plusSeconds(10800).toString());
        fails("STAFF_CONFLICT",()->save(a,moved));assertEquals(start.toString(),s.service.ownDetail(s.alice,a).path("visits").get(0).path("start").asText());
        moved.put("start",start.plusSeconds(3600).toString()).put("end",start.plusSeconds(7200).toString());save(a,moved);save(a,moved);
        var actual=s.service.adminDetail(login.token(),a).path("item").path("visits").get(0);assertEquals(2,actual.path("revision").asInt());
        fails("STALE_REVISION",()->save(a,action(old,"CANCEL",1)));
    }
    @Test void oneRequestMultipleInstitutionsCancelOnlyOneAndArrivalHistoryCannotBeErased(){
        String id=request(s.alice);var a=visit("CONFIRM",start,start.plusSeconds(3600));var b=visit("CONFIRM",start.plusSeconds(7200),start.plusSeconds(10800)).put("institutionId",P1Operations.SECOND_INSTITUTION);
        save(id,a);save(id,b);save(id,action(a,"CANCEL",1));
        var own=s.service.ownDetail(s.alice,id);assertEquals("CONFIRMED",own.path("status").asText());assertEquals(2,own.path("visits").size());
        save(id,action(b,"ARRIVE",1).put("actualAt",start.plusSeconds(7500).toString()));
        own=s.service.ownDetail(s.alice,id);assertEquals("VISITED",own.path("status").asText());assertFalse(own.path("canCancel").asBoolean());
        fails("VISIT_HISTORY_EXISTS",()->s.service.cancel(s.alice,id));fails("VISIT_ENDED",()->save(id,action(b,"CANCEL",2)));
        var feedback=follow("MOVED_IN").put("institutionId",P1Operations.SECOND_INSTITUTION).put("feedbackSource","FAMILY");s.service.operations().followup(login.token(),login.csrfToken(),id,feedback);
    }
    @Test void noShowIsExplicitAndNeverAutomatic(){
        String id=request(s.alice);var v=visit("CONFIRM",start,start.plusSeconds(3600));save(id,v);
        assertEquals("CONFIRMED",s.service.ownDetail(s.alice,id).path("status").asText());
        save(id,action(v,"NO_SHOW",1).put("actualAt",start.plusSeconds(4000).toString()));
        assertEquals("NO_SHOW",s.service.ownDetail(s.alice,id).path("status").asText());
    }
    @Test void rescheduleAndCancelRaceUseOneRevisionAndKeepEventAndRequestConsistent()throws Exception{
        String id=request(s.alice);var v=visit("CONFIRM",start,start.plusSeconds(3600));save(id,v);
        var moved=v.deepCopy().put("operationId",UUID.randomUUID().toString()).put("action","RESCHEDULE").put("expectedRevision",1).put("start",start.plusSeconds(7200).toString()).put("end",start.plusSeconds(10800).toString());
        var cancelled=action(v,"CANCEL",1);var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);var results=new ArrayList<Future<String>>();
        for(var body:List.of(moved,cancelled))results.add(pool.submit(()->{gate.await();try{save(id,body);return "OK";}catch(P1Failure e){return e.code();}}));
        gate.countDown();int successes=0;for(var result:results)if(result.get(15,TimeUnit.SECONDS).equals("OK"))successes++;pool.shutdownNow();assertEquals(1,successes);
        var actual=s.service.adminDetail(login.token(),id);assertEquals(3,actual.path("events").size());assertEquals(2,actual.path("item").path("visits").get(0).path("revision").asInt());
        String status=actual.path("item").path("visits").get(0).path("status").asText();assertEquals(status.equals("CONFIRMED")?"CONFIRMED":"PENDING_ARRANGEMENT",actual.path("item").path("status").asText());
    }
    @Test void retryContactAfterItsDueTimeDoesNotDuplicateOrRejectAlreadyRecordedOperation(){
        String id=request(s.alice);var body=follow("NO_ANSWER").put("nextContactAt",Instant.now().plusSeconds(60).toString()).put("nextAction","合成回访");
        s.service.operations().followup(login.token(),login.csrfToken(),id,body);
        var later=new P1Service(s.database,s.auth,s.mapper,Clock.offset(s.clock,Duration.ofMinutes(2)),s.settings);
        later.operations().followup(login.token(),login.csrfToken(),id,body);assertEquals(2,s.service.adminDetail(login.token(),id).path("events").size());
    }
    @Test void cancelRequestAndConfirmRaceCannotResurrect()throws Exception{
        String id=request(s.alice);var v=visit("CONFIRM",start,start.plusSeconds(3600));var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        var f=pool.submit(()->{gate.await();return s.service.cancel(s.alice,id);});
        var g=pool.submit(()->{gate.await();try{save(id,v);return "OK";}catch(P1Failure e){return e.code();}});
        gate.countDown();f.get(15,TimeUnit.SECONDS);g.get(15,TimeUnit.SECONDS);pool.shutdownNow();
        var own=s.service.ownDetail(s.alice,id);assertEquals("CANCELLED",own.path("status").asText());for(var entry:own.path("visits"))assertEquals("CANCELLED",entry.path("status").asText());
        fails("REQUEST_CLOSED",()->save(id,visit("CONFIRM",start,start.plusSeconds(3600))));
    }
    @Test void unavailableStaffAndExplicitCapacityOnly(){
        String a=request(s.alice);var block=s.mapper.createObjectNode().put("action","BLOCK").put("blockId",UUID.randomUUID().toString()).put("staffId",staff).put("start",start.toString()).put("end",start.plusSeconds(3600).toString());
        s.service.operations().resources(login.token(),login.csrfToken(),block);s.service.operations().resources(login.token(),login.csrfToken(),block);
        fails("STAFF_UNAVAILABLE",()->save(a,visit("CONFIRM",start,start.plusSeconds(3600))));
        s.service.operations().resources(login.token(),login.csrfToken(),s.mapper.createObjectNode().put("action","REMOVE_BLOCK").put("blockId",block.path("blockId").asText()));
        // Capacity is explicit on a synthetic site and cleaned after the test.
        var capacity=s.mapper.createObjectNode().put("action","CAPACITY").put("institutionId",P1Operations.SECOND_INSTITUTION).put("capacity",1);
        s.service.operations().resources(login.token(),login.csrfToken(),capacity);
        String date=start.atZone(ZoneId.of("Asia/Shanghai")).toLocalDate().toString();
        assertTrue(s.service.operations().calendar(login.token(),date,date).path("capacities").toString().contains("\"capacity\":1"));
        var v=visit("CONFIRM",start,start.plusSeconds(3600)).put("institutionId",P1Operations.SECOND_INSTITUTION);save(a,v);
        fails("INSTITUTION_CAPACITY_CONFLICT",()->save(request(s.bob),visit("CONFIRM",start,start.plusSeconds(3600)).put("staffId","other-"+staff).put("institutionId",P1Operations.SECOND_INSTITUTION)));
        save(a,action(v,"CANCEL",1));s.service.operations().resources(login.token(),login.csrfToken(),capacity.put("capacity",0));
    }
    @Test void allNewWritesRequireAdminAndCsrfAndUserProjectionHasNoInternalFields()throws Exception{
        String id=request(s.alice);var b=follow("CONNECTED");
        mvc.perform(post("/api/v1/p1-service/admin/requests/"+id+"/followups").contentType("application/json").content(b.toString()).header("X-Auth-Evidence",s.alice)).andExpect(status().isUnauthorized());
        for(String path:List.of("/requests/"+id+"/followups","/requests/"+id+"/visits","/resources")){
            String json=path.endsWith("followups")?b.toString():path.endsWith("visits")?visit("CONFIRM",start,start.plusSeconds(3600)).toString():s.mapper.createObjectNode().put("action","REMOVE_BLOCK").put("blockId",UUID.randomUUID().toString()).toString();
            mvc.perform(post("/api/v1/p1-service/admin"+path).cookie(new Cookie("P1_ADMIN_SESSION",login.token())).contentType("application/json").content(json)).andExpect(status().isForbidden());
        }
        save(id,visit("CONFIRM",start,start.plusSeconds(3600)));var own=s.service.ownDetail(s.alice,id).toString();assertFalse(own.contains("staffId"));assertFalse(own.contains("revision"));assertFalse(own.contains("operationId"));
        fails("NOT_FOUND",()->s.service.ownDetail(s.bob,id));
    }
    @Test void freshAndV10WithDataUpgradeWithoutChangingOldMigration()throws Exception{
        String original=System.getenv("P1_MYSQL_URL");int slash=original.indexOf('/',"jdbc:mysql://".length());String server=original.substring(0,slash+1),query=original.substring(original.indexOf('?'));
        String[] schemas=Objects.requireNonNull(System.getenv("P1_MIGRATION_SCHEMAS"),"runner must provision isolated migration schemas").split(",");assertEquals(2,schemas.length);
        for(int path=0;path<2;path++){
            boolean existing=path==1;String schema=schemas[path];assertTrue(schema.matches("p1_intake_disposable_ops[a-f0-9]{32}"));String url=server+schema+query;
                var conf=Flyway.configure().dataSource(url,System.getenv("P1_MYSQL_USERNAME"),System.getenv("P1_MYSQL_PASSWORD")).locations("classpath:db/migration");
                String id=UUID.randomUUID().toString();
                if(existing){
                    conf.target("10").load().migrate();try(var c=DriverManager.getConnection(url,System.getenv("P1_MYSQL_USERNAME"),System.getenv("P1_MYSQL_PASSWORD"));var q=c.prepareStatement("INSERT INTO p1_service_request_v1(request_id,owner_user_id,input_digest,input_json,request_kind,institution_id,request_status,dataset_mode,request_source,created_at,updated_at) VALUES(?,'synthetic-owner',?,?,'VISIT_INTENT',?,'PENDING_ARRANGEMENT','SYNTHETIC_TEST_ONLY','SYNTHETIC_TEST_ONLY',NOW(),NOW())")){
                        q.setString(1,id);q.setString(2,"a".repeat(64));q.setString(3,s.mapper.writeValueAsString(s.input("VISIT_INTENT")));q.setString(4,P1Service.INSTITUTION);q.executeUpdate();
                        try(var event=c.prepareStatement("INSERT INTO p1_service_event_v1 VALUES(?,'REQUEST_SUBMITTED',NOW(),'synthetic-owner')")){event.setString(1,id);event.executeUpdate();}
                    }
                }
                Flyway.configure().dataSource(url,System.getenv("P1_MYSQL_USERNAME"),System.getenv("P1_MYSQL_PASSWORD")).locations("classpath:db/migration").load().migrate();
                try(var c=DriverManager.getConnection(url,System.getenv("P1_MYSQL_USERNAME"),System.getenv("P1_MYSQL_PASSWORD"));var q=c.createStatement()){
                    try(var r=q.executeQuery("SELECT COUNT(*) FROM p1_operations_mutex_v1")){r.next();assertEquals(2,r.getInt(1));}
                    if(existing){try(var r=q.executeQuery("SELECT request_status,workflow_status FROM p1_service_request_v1")){assertTrue(r.next());assertEquals("PENDING_ARRANGEMENT",r.getString(1));assertEquals(r.getString(1),r.getString(2));}
                        try(var r=q.executeQuery("SELECT COUNT(*) FROM p1_service_event_v1")){r.next();assertEquals(1,r.getInt(1));}}
                }
        }
    }
}
