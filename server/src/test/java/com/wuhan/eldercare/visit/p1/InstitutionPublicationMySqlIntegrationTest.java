package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.institution.application.*;
import com.wuhan.eldercare.visit.institution.persistence.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Actual isolated MySQL + HTTP controllers + frozen Node validator. Contains synthetic institutions only. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class InstitutionPublicationMySqlIntegrationTest {
    P1TestSupport s;P1Service.Login login;MockMvc mvc;ObjectNode source;
    @BeforeAll void start()throws Exception{
        assumeTrue("true".equals(System.getenv("P1_DISPOSABLE_MYSQL")),"isolated disposable MySQL required");
        s=new P1TestSupport(System.getenv());login=s.service.login("p1-synthetic-admin",s.adminPassword);
        mvc=MockMvcBuilders.standaloneSetup(new P1Controller(s.service,s.mapper),new InstitutionPublicationController(s.service,s.mapper)).build();
        try(var input=getClass().getResourceAsStream("/institution-synthetic-v121.json")){source=(ObjectNode)s.mapper.readTree(input);}
    }
    @AfterAll void stop(){if(s!=null)s.close();}
    String id(){return "synthetic-publication-"+UUID.randomUUID();}
    ObjectNode record(String id,String name){
        var r=source.deepCopy();r.put("institutionId",id).put("recordRevision",1).put("recordProvenance","PRODUCTION_CANDIDATE");
        ((ObjectNode)r.path("identity").path("name")).put("value",name);
        for(var evidence:r.path("evidence")){((ObjectNode)evidence).put("institutionId",id).put("recordRevision",1);
            if(evidence.path("fieldPath").asText().equals("identity.name"))((ObjectNode)evidence.path("valueSnapshot")).put("value",name);}
        return r;
    }
    ObjectNode profile(String id,String name){
        var p=s.mapper.createObjectNode().put("schemaVersion","institution-public-profile-v1").put("id",id).put("name",name)
                .put("source","合成价目表；不是机构资料").put("room","合成房型").put("address","地址未知，不据此前往").put("nature","性质待确认")
                .put("tagNote","合成展示标签不是护理能力").put("otherFees","其他费用未知").put("priceNote","合成月费，口径待确认").put("historyNote","仅用于隔离回归");
        p.putArray("tags").add("合成展示标签");p.putArray("prices").addObject().put("level","合成档位").put("bed",1000).put("care",1000).put("food",500).put("total",2500);return p;
    }
    ObjectNode create(String id,String name){var b=s.mapper.createObjectNode().put("institutionId",id);b.set("record",record(id,name));b.set("publicProfile",profile(id,name));return s.service.publications().save(login.token(),login.csrfToken(),id,b,true).withObject("item");}
    ObjectNode confirm(String id,long revision){return s.service.publications().confirm(login.token(),login.csrfToken(),id,s.mapper.createObjectNode().put("expectedDraftRevision",revision)
            .put("sourceReference","SYNTHETIC_TEST_ONLY_DOCUMENT").put("confirmedBy","合成确认人").put("confirmedOn","2026-10-20")).withObject("item");}
    ObjectNode pubBody(long revision){return s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("expectedDraftRevision",revision);}
    ObjectNode publish(String id,long revision){return s.service.publications().publish(login.token(),login.csrfToken(),id,pubBody(revision));}
    ObjectNode accessBody(long revision,boolean enabled){return s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("expectedAccessRevision",revision).put("enabled",enabled).put("sourceReference","SYNTHETIC_SERVICE_ACCESS_ONLY");}
    ObjectNode grant(String id){return s.service.publications().serviceAccess(login.token(),login.csrfToken(),id,accessBody(0,true));}
    void fail(String code,org.junit.jupiter.api.function.Executable action){assertEquals(code,assertThrows(P1Failure.class,action).code());}
    long count(String sql)throws Exception{try(var c=s.database.getConnection();var q=c.createStatement();var r=q.executeQuery(sql)){r.next();return r.getLong(1);}}
    P1Service.Input input(String id){var p=s.input("VISIT_INTENT");return new P1Service.Input(p.requestId(),p.inputVersion(),p.kind(),id,p.contactName(),p.contactPhone(),p.relationship(),p.serviceScenario(),p.preferredWindow(),p.partySize(),p.assistanceNote(),p.consentVersion(),true);}

    @Test void draftConfirmationModificationAndTwoImmutablePublishedVersions()throws Exception{
        String id=id();var first=create(id,"合成机构旧名");assertEquals(1,first.path("draftRevision").asLong());assertTrue(first.path("confirmation").isNull());
        fail("CONFIRMATION_REQUIRED",()->publish(id,1));
        var confirmed=confirm(id,1);assertEquals(2,confirmed.path("draftRevision").asLong());
        var saved=s.mapper.createObjectNode().put("expectedDraftRevision",2);saved.set("record",record(id,"合成机构新名"));saved.set("publicProfile",profile(id,"合成机构新名"));
        var changed=s.service.publications().save(login.token(),login.csrfToken(),id,saved,false).path("item");assertEquals("DRAFT",changed.path("status").asText());assertTrue(changed.path("confirmation").isNull());
        fail("CONFIRMATION_REQUIRED",()->publish(id,3));confirm(id,3);var result=publish(id,4);assertEquals(1,result.path("publication").path("recordRevision").asLong());
        var exact=s.service.publications().exact(id,1);assertEquals("合成机构新名",exact.path("publicProfile").path("name").asText());assertFalse(exact.has("confirmedBy"));
        var next=s.mapper.createObjectNode().put("expectedDraftRevision",5);next.set("record",record(id,"合成第三名称"));next.set("publicProfile",profile(id,"合成第三名称"));
        s.service.publications().save(login.token(),login.csrfToken(),id,next,false);confirm(id,6);publish(id,7);
        assertEquals("合成机构新名",s.service.publications().exact(id,1).path("record").path("identity").path("name").path("value").asText());
        assertEquals("合成第三名称",s.service.publications().exact(id,2).path("publicProfile").path("name").asText());
        fail("NOT_FOUND",()->s.service.publications().exact(id,999));
        assertThrows(SQLException.class,()->{try(var c=s.database.getConnection();var q=c.prepareStatement("UPDATE institution_publication_v1 SET source_reference='changed' WHERE institution_id=?")){q.setString(1,id);q.executeUpdate();}});
    }
    @Test void staleDraftAndFutureConfirmationDoNotLoseEdits(){
        String id=id();create(id,"合成机构");var bad=s.mapper.createObjectNode().put("expectedDraftRevision",1).put("sourceReference","合成来源").put("confirmedBy","合成人员").put("confirmedOn","2099-01-01");
        fail("INVALID_CONFIRMATION_DATE",()->s.service.publications().confirm(login.token(),login.csrfToken(),id,bad));confirm(id,1);fail("STALE_DRAFT_REVISION",()->confirm(id,1));
        var update=s.mapper.createObjectNode().put("expectedDraftRevision",1);update.set("record",record(id,"不应覆盖"));update.set("publicProfile",profile(id,"不应覆盖"));
        fail("STALE_DRAFT_REVISION",()->s.service.publications().save(login.token(),login.csrfToken(),id,update,false));
        assertEquals("合成机构",s.service.publications().getDraft(login.token(),id).path("item").path("publicProfile").path("name").asText());
    }
    @Test void publicationRetryAndConcurrentSameOperationCreateOneVersion()throws Exception{
        String id=id();create(id,"合成重试机构");confirm(id,1);var body=pubBody(2);var other=s.service.login("p1-synthetic-admin",s.adminPassword);var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        var a=pool.submit(()->{gate.await();return s.service.publications().publish(login.token(),login.csrfToken(),id,body).path("publication");});
        var b=pool.submit(()->{gate.await();return s.service.publications().publish(other.token(),other.csrfToken(),id,body).path("publication");});gate.countDown();
        var result=List.of(a.get(40,TimeUnit.SECONDS),b.get(40,TimeUnit.SECONDS));pool.shutdownNow();
        var statuses=result.stream().map(r->r.path("status").asText()).toList();assertTrue(statuses.contains("PUBLISHED"));assertTrue(statuses.contains("REPLAYED"));
        assertEquals(result.get(0).path("publishedAt"),result.get(1).path("publishedAt"),"Initial publication and retry expose the same stored timestamp precision");
        assertEquals(1,count("SELECT COUNT(*) FROM institution_record_revision_v1 WHERE institution_id='"+id+"'"));
        fail("IDEMPOTENCY_CONFLICT",()->s.service.publications().publish(login.token(),login.csrfToken(),id,body.deepCopy().put("expectedDraftRevision",3)));
    }
    @Test void originalPublisherAdvancingHeadBlocksStaleDraftAtomically()throws Exception{
        String id=id();create(id,"合成基础机构");confirm(id,1);
        var repository=new JdbcInstitutionRevisionRepository(s.database,s.mapper,new NodeInstitutionSnapshotValidator("node",s.mapper));
        var pack=s.mapper.createObjectNode().put("packageVersion","institution-publish-package-v1").put("operationId","cli-"+UUID.randomUUID()).put("sourceReference","SYNTHETIC_CLI_SOURCE").put("operatorReference","ops:synthetic-cli");pack.set("record",record(id,"合成CLI新版本"));
        assertEquals(InstitutionPublishResult.Status.PUBLISHED,new InstitutionRevisionPublisher(repository,s.clock).publish(pack).status());
        fail("BASE_REVISION_CONFLICT",()->publish(id,2));assertEquals(0,count("SELECT COUNT(*) FROM institution_publication_v1 WHERE institution_id='"+id+"'"));assertEquals(1,repository.currentHead(id).recordRevision());
    }
    @Test void invalidFullRecordAndPriceNeverPublishOrAdvanceHead()throws Exception{
        String id=id();create(id,"合成非法资料");var draft=s.service.publications().getDraft(login.token(),id).path("item");var update=s.mapper.createObjectNode().put("expectedDraftRevision",1);var r=(ObjectNode)draft.path("record").deepCopy();r.put("unexpectedClinicalShortcut",true);update.set("record",r);update.set("publicProfile",draft.path("publicProfile"));
        s.service.publications().save(login.token(),login.csrfToken(),id,update,false);confirm(id,2);fail("INVALID_RECORD",()->publish(id,3));assertEquals(0,count("SELECT COUNT(*) FROM institution_current_head_v1 WHERE institution_id='"+id+"'"));
        String priceId=id();var item=create(priceId,"合成价格错误");var p=(ObjectNode)item.path("publicProfile").deepCopy();((ObjectNode)p.path("prices").get(0)).put("total",1);
        var priceUpdate=s.mapper.createObjectNode().put("expectedDraftRevision",1);priceUpdate.set("record",item.path("record"));priceUpdate.set("publicProfile",p);s.service.publications().save(login.token(),login.csrfToken(),priceId,priceUpdate,false);
        fail("INVALID_PUBLIC_PROFILE",()->confirm(priceId,2));
    }
    @Test void publicPublicationDoesNotGrantServiceAndHistorySurvivesRenameAndDisable()throws Exception{
        String id=id();create(id,"合成接待旧名");confirm(id,1);publish(id,2);var original=input(id);
        fail("INSTITUTION_UNAVAILABLE",()->s.service.submit(s.alice,original));grant(id);var accepted=s.service.submit(s.alice,original);assertEquals("合成接待旧名",accepted.path("institutionName").asText());
        var update=s.mapper.createObjectNode().put("expectedDraftRevision",3);update.set("record",record(id,"合成接待新名"));update.set("publicProfile",profile(id,"合成接待新名"));s.service.publications().save(login.token(),login.csrfToken(),id,update,false);confirm(id,4);publish(id,5);
        var newer=s.service.submit(s.bob,input(id));assertEquals("合成接待新名",newer.path("institutionName").asText());
        var disable=accessBody(1,false);s.service.publications().serviceAccess(login.token(),login.csrfToken(),id,disable);s.service.publications().serviceAccess(login.token(),login.csrfToken(),id,disable);
        assertEquals("合成接待旧名",s.service.submit(s.alice,original).path("institutionName").asText());fail("INSTITUTION_UNAVAILABLE",()->s.service.submit(s.alice,input(id)));
        assertEquals("合成接待旧名",s.service.ownDetail(s.alice,original.requestId()).path("institutionName").asText());
        assertEquals("CANCELLED",s.service.cancel(s.alice,original.requestId()).path("status").asText());
        assertTrue(s.service.operations().institution(id),"Disabled institutions remain valid historical filter targets");
        assertFalse(s.service.config().path("institutions").findValuesAsText("institutionId").contains(id));
    }
    @Test void disabledIntakeCanMaintainPublicationsButNeverSubmit()throws Exception{
        var only=s.publicationService(false);var admin=only.login("p1-synthetic-admin",s.adminPassword);assertFalse(only.config().path("enabled").asBoolean());assertNotNull(only.publications().list(admin.token()));
        fail("SERVICE_UNAVAILABLE",()->only.submit(s.alice,input(null)));fail("SERVICE_UNAVAILABLE",()->only.operations().calendar(admin.token(),"2026-01-01","2026-01-02"));
    }
    @Test void exactAndCatalogHttpArePublicButDraftsAndWritesNeedSessionAndCsrf()throws Exception{
        String id=id();create(id,"合成HTTP机构");confirm(id,1);publish(id,2);
        mvc.perform(get("/api/v1/institution-publications/catalog")).andExpect(status().isOk()).andExpect(jsonPath("$.contractVersion").value(P1Publications.CONTRACT)).andExpect(jsonPath("$.dataEnvironment").value("SYNTHETIC_TEST_ONLY"));
        mvc.perform(get("/api/v1/institution-publications/"+id+"/revisions/1")).andExpect(status().isOk()).andExpect(jsonPath("$.recordRevision").value(1)).andExpect(jsonPath("$.confirmation").doesNotExist());
        mvc.perform(get("/api/v1/p1-service/admin/institutions/"+id+"/draft")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/p1-service/admin/institutions/"+id+"/publish").cookie(new Cookie("P1_ADMIN_SESSION",login.token())).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_REQUIRED"));
        mvc.perform(put("/api/v1/p1-service/admin/institutions/"+id+"/draft").cookie(new Cookie("P1_ADMIN_SESSION",login.token())).header("X-P1-CSRF",login.csrfToken()).contentType("application/json").content("{\"expectedDraftRevision\":1,\"expectedDraftRevision\":2}"))
                .andExpect(status().isBadRequest());
        assertFalse(s.service.publications().catalog().toString().contains("合成确认人"));
    }
    @Test void baselineImportPreservesRevisionEvidenceAndConflictsRollbackWholeBatch()throws Exception{
        String id=id();var r=record(id,"合成导入机构");r.put("recordRevision",8);for(var e:r.path("evidence"))((ObjectNode)e).put("recordRevision",8);
        var catalog=s.mapper.createObjectNode().put("datasetVersion","synthetic-baseline").put("datasetMode","PRODUCTION");catalog.putArray("records").add(r);catalog.putArray("currentPointers").addObject().put("institutionId",id).put("recordRevision",8);catalog.putObject("presentation").put("orderingPolicy","CANONICAL_IDENTITY_ASC_V1").putArray("displayOrder");
        var body=s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("sourceReference","SYNTHETIC_BASELINE_ARCHIVE").put("preserveExistingFacts",true);body.set("catalog",catalog);
        assertFalse(s.service.publications().importBaseline(login.token(),login.csrfToken(),body).path("replayed").asBoolean());
        assertTrue(s.service.publications().importBaseline(login.token(),login.csrfToken(),body).path("replayed").asBoolean());
        assertEquals(r,s.service.publications().exact(id,8).path("record"));
        var changed=body.deepCopy().put("operationId",UUID.randomUUID().toString());((ObjectNode)changed.path("catalog").path("records").get(0).path("identity").path("name")).put("value","不得覆盖");
        fail("BASELINE_REVISION_CONFLICT",()->s.service.publications().importBaseline(login.token(),login.csrfToken(),changed));
        assertEquals("合成导入机构",s.service.publications().exact(id,8).path("record").path("identity").path("name").path("value").asText());
        var row=s.service.publications().getDraft(login.token(),id).path("item");var update=s.mapper.createObjectNode().put("expectedDraftRevision",0);update.set("record",r);update.putNull("publicProfile");s.service.publications().save(login.token(),login.csrfToken(),id,update,false);confirm(id,1);assertEquals(9,publish(id,2).path("publication").path("recordRevision").asLong());
    }
    @Test void syntheticPublishedRecordsCannotBeReadOrAdoptedAsProduction()throws Exception{
        String id=id();create(id,"合成隔离机构");confirm(id,1);publish(id,2);
        var prodSettings=new P1Service.Settings(false,false,s.settings.noticeVersion(),s.settings.noticeText(),s.settings.noticeApprovalRef(),"",s.settings.adminUsername(),s.settings.adminPasswordHash());
        var prod=new P1Service(s.database,s.auth,s.mapper,s.clock,prodSettings,new JdbcInstitutionRevisionRepository(s.database,s.mapper,new NodeInstitutionSnapshotValidator("node",s.mapper)),true,"node");
        var prodAdmin=prod.login("p1-synthetic-admin",s.adminPassword);
        assertFalse(prod.publications().catalog().path("catalog").path("records").findValuesAsText("institutionId").contains(id));
        fail("NOT_FOUND",()->prod.publications().exact(id,1));fail("NOT_FOUND",()->prod.publications().getDraft(prodAdmin.token(),id));
    }
    @Test void baselineBatchFailureRollsBackEarlierValidRecords()throws Exception{
        String prefix=UUID.randomUUID().toString(),a="synthetic-import-a-"+prefix,z="synthetic-import-z-"+prefix;
        var catalog=s.mapper.createObjectNode().put("datasetVersion","synthetic-atomic-import").put("datasetMode","PRODUCTION");
        catalog.putArray("records").add(record(a,"合成有效导入")).add(record(z,"合成非法导入").put("illegalRoot",true));
        var pointers=catalog.putArray("currentPointers");pointers.addObject().put("institutionId",a).put("recordRevision",1);pointers.addObject().put("institutionId",z).put("recordRevision",1);
        catalog.putObject("presentation").put("orderingPolicy","CANONICAL_IDENTITY_ASC_V1").putArray("displayOrder");
        var body=s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("sourceReference","SYNTHETIC_ATOMIC_ARCHIVE").put("preserveExistingFacts",true);body.set("catalog",catalog);
        fail("INVALID_RECORD",()->s.service.publications().importBaseline(login.token(),login.csrfToken(),body));
        assertEquals(0,count("SELECT COUNT(*) FROM institution_record_revision_v1 WHERE institution_id IN ('"+a+"','"+z+"')"));
        assertEquals(0,count("SELECT COUNT(*) FROM institution_publication_scope_v1 WHERE institution_id IN ('"+a+"','"+z+"')"));
    }
    @Test void unknownTemplateHasNoVerifiedFactsAndNeedsNormalPublicationReview()throws Exception{
        String id=id();var result=s.service.publications().template(login.token(),id);assertEquals(id,result.path("record").path("institutionId").asText());
        assertEquals("unknown",result.path("record").path("identity").path("name").path("availability").asText());assertTrue(result.path("record").path("evidence").isEmpty());
        assertTrue(result.path("publicProfile").isNull());
    }
    @Test void concurrentFirstImportsBindExactlyOneEnvironment()throws Exception{
        String id=id();var catalog=s.mapper.createObjectNode().put("datasetVersion","synthetic-environment-race").put("datasetMode","PRODUCTION");
        catalog.putArray("records").add(record(id,"合成并发归属"));catalog.putArray("currentPointers").addObject().put("institutionId",id).put("recordRevision",1);
        catalog.putObject("presentation").put("orderingPolicy","CANONICAL_IDENTITY_ASC_V1").putArray("displayOrder");
        var left=s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("sourceReference","SYNTHETIC_SAME_ARCHIVE").put("preserveExistingFacts",true);left.set("catalog",catalog);
        var right=left.deepCopy().put("operationId",UUID.randomUUID().toString());
        var settings=new P1Service.Settings(false,false,s.settings.noticeVersion(),s.settings.noticeText(),s.settings.noticeApprovalRef(),"",s.settings.adminUsername(),s.settings.adminPasswordHash());
        var prod=new P1Service(s.database,s.auth,s.mapper,s.clock,settings,new JdbcInstitutionRevisionRepository(s.database,s.mapper,new NodeInstitutionSnapshotValidator("node",s.mapper)),true,"node");
        var admin=prod.login("p1-synthetic-admin",s.adminPassword);var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        Callable<String> a=()->{gate.await();try{s.service.publications().importBaseline(login.token(),login.csrfToken(),left);return "OK";}catch(P1Failure failure){return failure.code();}};
        Callable<String> b=()->{gate.await();try{prod.publications().importBaseline(admin.token(),admin.csrfToken(),right);return "OK";}catch(P1Failure failure){return failure.code();}};
        var one=pool.submit(a);var two=pool.submit(b);gate.countDown();var results=List.of(one.get(40,TimeUnit.SECONDS),two.get(40,TimeUnit.SECONDS));pool.shutdownNow();
        assertEquals(1,Collections.frequency(results,"OK"),results.toString());assertEquals(1,Collections.frequency(results,"PUBLICATION_ENVIRONMENT_CONFLICT"),results.toString());
        assertEquals(1,count("SELECT COUNT(*) FROM institution_publication_scope_v1 WHERE institution_id='"+id+"'"));
        boolean syntheticHas=s.service.publications().catalog().path("catalog").path("records").findValuesAsText("institutionId").contains(id);
        boolean productionHas=prod.publications().catalog().path("catalog").path("records").findValuesAsText("institutionId").contains(id);assertNotEquals(syntheticHas,productionHas);
    }
    @Test void baselineImportsExactHistoricalRecordsWithoutMixingThemIntoCurrentPool()throws Exception{
        String id=id();var previous=record(id,"合成历史名称");var current=record(id,"合成当前名称");current.put("recordRevision",2);for(var e:current.path("evidence"))((ObjectNode)e).put("recordRevision",2);
        var catalog=s.mapper.createObjectNode().put("datasetVersion","synthetic-current-and-history").put("datasetMode","PRODUCTION");catalog.putArray("records").add(current);
        catalog.putArray("currentPointers").addObject().put("institutionId",id).put("recordRevision",2);catalog.putObject("presentation").put("orderingPolicy","CANONICAL_IDENTITY_ASC_V1").putArray("displayOrder");
        var body=s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("sourceReference","SYNTHETIC_HISTORY_ARCHIVE").put("preserveExistingFacts",true);body.set("catalog",catalog);body.putArray("historicalRecords").add(previous);
        assertEquals(2,s.service.publications().importBaseline(login.token(),login.csrfToken(),body).path("imported").asInt());
        assertEquals(previous,s.service.publications().exact(id,1).path("record"));assertEquals(current,s.service.publications().exact(id,2).path("record"));
        var records=s.service.publications().catalog().path("catalog").path("records");int matches=0;
        for(var r:records)if(id.equals(r.path("institutionId").asText())){matches++;assertEquals(2,r.path("recordRevision").asLong());}
        assertEquals(1,matches);
        var bad=body.deepCopy().put("operationId",UUID.randomUUID().toString());((ObjectNode)bad.path("historicalRecords").get(0)).put("recordRevision",3);
        fail("INVALID_INPUT",()->s.service.publications().importBaseline(login.token(),login.csrfToken(),bad));
        var update=s.mapper.createObjectNode().put("expectedDraftRevision",0);update.set("record",current);update.putNull("publicProfile");s.service.publications().save(login.token(),login.csrfToken(),id,update,false);confirm(id,1);
        assertEquals(3,publish(id,2).path("publication").path("recordRevision").asLong());assertEquals(previous,s.service.publications().exact(id,1).path("record"));
    }
    @Test void realUnknownTemplateReportsMissingRegionsThenPublishesAfterExplicitUnverifiedInput()throws Exception{
        String id=id(),name="合成简表新建机构";String endpoint="/api/v1/p1-service/admin/institutions";
        var cookie=new Cookie("P1_ADMIN_SESSION",login.token());
        var templateResponse=mvc.perform(get(endpoint+"/template").param("institutionId",id).cookie(cookie)).andExpect(status().isOk()).andReturn().getResponse();
        var template=s.mapper.readTree(templateResponse.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        var record=(ObjectNode)template.path("record").deepCopy();
        ((ObjectNode)record.path("identity").path("name")).put("availability","provided").put("value",name);
        var profile=profile(id,name);var body=s.mapper.createObjectNode().put("institutionId",id);body.set("record",record);body.set("publicProfile",profile);
        mvc.perform(post(endpoint).cookie(cookie).header("X-P1-CSRF",login.csrfToken()).contentType("application/json").content(s.mapper.writeValueAsBytes(body)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.item.draftRevision").value(1));
        var confirmation=s.mapper.createObjectNode().put("expectedDraftRevision",1).put("sourceReference","SYNTHETIC_MINIMAL_TEMPLATE_SOURCE").put("confirmedBy","合成确认人员").put("confirmedOn","2026-10-20");
        mvc.perform(post(endpoint+"/"+id+"/confirm").cookie(cookie).header("X-P1-CSRF",login.csrfToken()).contentType("application/json").content(s.mapper.writeValueAsBytes(confirmation)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.item.draftRevision").value(2));
        var rejected=mvc.perform(post(endpoint+"/"+id+"/publish").cookie(cookie).header("X-P1-CSRF",login.csrfToken()).contentType("application/json").content(s.mapper.writeValueAsBytes(pubBody(2))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_RECORD")).andReturn().getResponse();
        var failure=s.mapper.readTree(rejected.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertEquals(3,failure.size());assertTrue(failure.path("validationIssues").isArray());var paths=new HashSet<String>();
        for(var issue:failure.path("validationIssues")){
            var keys=new HashSet<String>();issue.fieldNames().forEachRemaining(keys::add);assertEquals(Set.of("code","path"),keys);
            assertEquals("INVALID_FIELD",issue.path("code").asText());paths.add(issue.path("path").asText());
        }
        assertEquals(Set.of("identity.regionCode","identity.regionDisplayName"),paths);
        assertFalse(failure.toString().contains(name));assertFalse(failure.toString().contains("SYNTHETIC_MINIMAL_TEMPLATE_SOURCE"));
        assertFalse(failure.has("record"));assertEquals(0,count("SELECT COUNT(*) FROM institution_current_head_v1 WHERE institution_id='"+id+"'"));
        ((ObjectNode)record.path("identity").path("regionCode")).put("availability","provided").put("value","420103");
        ((ObjectNode)record.path("identity").path("regionDisplayName")).put("availability","provided").put("value","江汉区");
        var update=s.mapper.createObjectNode().put("expectedDraftRevision",2);update.set("record",record);update.set("publicProfile",profile);
        mvc.perform(put(endpoint+"/"+id+"/draft").cookie(cookie).header("X-P1-CSRF",login.csrfToken()).contentType("application/json").content(s.mapper.writeValueAsBytes(update)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.item.status").value("DRAFT")).andExpect(jsonPath("$.item.confirmation").isEmpty());
        confirmation.put("expectedDraftRevision",3);
        mvc.perform(post(endpoint+"/"+id+"/confirm").cookie(cookie).header("X-P1-CSRF",login.csrfToken()).contentType("application/json").content(s.mapper.writeValueAsBytes(confirmation)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.item.draftRevision").value(4));
        mvc.perform(post(endpoint+"/"+id+"/publish").cookie(cookie).header("X-P1-CSRF",login.csrfToken()).contentType("application/json").content(s.mapper.writeValueAsBytes(pubBody(4))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.publication.recordRevision").value(1));
        var exact=s.service.publications().exact(id,1).path("record");
        assertEquals("420103",exact.path("identity").path("regionCode").path("value").asText());
        assertEquals("unverified",exact.path("identity").path("regionCode").path("verification").path("status").asText());
        assertTrue(exact.path("evidence").isEmpty(),"A manual content confirmation must not manufacture verified field evidence");
        for(var capability:exact.path("capabilities").path("careLevelAcceptance"))assertEquals("unknown",capability.path("status").asText());
    }
}
