package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import jakarta.servlet.http.Cookie;
import java.time.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import javax.xml.parsers.DocumentBuilderFactory;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class P1ReportsMySqlIntegrationTest {
    P1TestSupport s;P1Service service;P1Service.Login login;P1Reports reports;Instant now;String day;static AtomicInteger sequence=new AtomicInteger();
    @BeforeAll void setup()throws Exception{assumeTrue("true".equals(System.getenv("P1_DISPOSABLE_MYSQL")));s=new P1TestSupport(System.getenv());}
    @BeforeEach void isolate(){now=Instant.parse("2040-01-01T02:00:00Z").plusSeconds(86400L*sequence.incrementAndGet()*3);day=now.atZone(ZoneId.of("Asia/Shanghai")).toLocalDate().toString();useClock(now);}
    @AfterAll void close(){if(s!=null)s.close();}
    void useClock(Instant instant){service=new P1Service(s.database,s.auth,s.mapper,Clock.fixed(instant,ZoneOffset.UTC),s.settings);login=service.login("p1-synthetic-admin",s.adminPassword);reports=new P1Reports(service);}
    String request(){var input=s.input("VISIT_INTENT");service.submit(s.alice,input);return input.requestId();}
    ObjectNode scope(String from,String to,String institution){return s.mapper.createObjectNode().put("from",from).put("to",to).put("institutionId",institution).putNull("source");}
    ObjectNode preview(){return reports.preview(login.token(),login.csrfToken(),scope(day,day,null));}
    ObjectNode schedule(String id,String institution,Instant start){var b=s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("visitId",UUID.randomUUID().toString()).put("action","CONFIRM").put("expectedRevision",0).put("institutionId",institution).put("staffId","合成报告负责人")
        .put("start",start.toString()).put("end",start.plusSeconds(3600).toString()).put("bufferBefore",0).put("bufferAfter",0).put("familyConfirmed",true).put("institutionConfirmed",true).put("meetingNote","=合成集合信息，不进报表");service.operations().visit(login.token(),login.csrfToken(),id,b);return b;}
    void arrive(String id,ObjectNode v,Instant actual){service.operations().visit(login.token(),login.csrfToken(),id,s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("visitId",v.path("visitId").asText()).put("expectedRevision",1).put("action","ARRIVE").put("actualAt",actual.toString()));}
    @Test void completeRangeBeyond100AndPagingAndSnapshotDoesNotDrift(){
        for(int i=0;i<155;i++)request();var report=preview();assertEquals("p1-aggregate-v2-k5",report.path("policyVersion").asText());assertEquals(155,report.path("metrics").path("newRequests").asInt());
        var page=service.operations().page(login.token(),null,null,null,day,day,100,0);var next=service.operations().page(login.token(),null,null,null,day,day,100,100);
        assertEquals(155,page.path("total").asInt());assertEquals(100,page.path("items").size());assertTrue(page.path("hasMore").asBoolean());assertEquals(55,next.path("items").size());assertFalse(next.path("hasMore").asBoolean());
        var ids=new HashSet<String>();for(var item:page.path("items"))assertTrue(ids.add(item.path("id").asText()));for(var item:next.path("items"))assertTrue(ids.add(item.path("id").asText()));
        request();var snapshot=reports.snapshot(login.token(),login.csrfToken(),report.path("snapshotId").asText());
        assertTrue(report.equals((left,right)->left.isNumber()&&right.isNumber()?new java.math.BigDecimal(left.asText()).compareTo(new java.math.BigDecimal(right.asText())):left.equals(right)?0:1,snapshot));
        assertEquals(156,preview().path("metrics").path("newRequests").asInt());
    }
    @Test void distinctRequestsVersusSessionsAndInstitutionScopeAndSourceBackedFeedback(){
        String id=request();var a=schedule(id,P1Service.INSTITUTION,now.minusSeconds(10800));arrive(id,a,now.minusSeconds(10000));
        var b=schedule(id,P1Operations.SECOND_INSTITUTION,now.minusSeconds(7200));arrive(id,b,now.minusSeconds(7000));
        var c=schedule(id,P1Service.INSTITUTION,now.minusSeconds(3600));arrive(id,c,now.minusSeconds(3000));
        service.operations().followup(login.token(),login.csrfToken(),id,s.mapper.createObjectNode().put("operationId",UUID.randomUUID().toString()).put("result","MOVED_IN").put("feedbackSource","FAMILY").put("institutionId",P1Operations.SECOND_INSTITUTION));
        var platform=preview();assertEquals(1,platform.path("metrics").path("newRequests").asInt());assertEquals(3,platform.path("metrics").path("arrivedSessions").asInt());assertEquals(1,platform.path("metrics").path("arrivedRequests").asInt());assertEquals(2,platform.path("institutions").size());
        var first=reports.preview(login.token(),login.csrfToken(),scope(day,day,P1Service.INSTITUTION));var second=reports.preview(login.token(),login.csrfToken(),scope(day,day,P1Operations.SECOND_INSTITUTION));
        assertEquals(2,first.path("metrics").path("arrivedSessions").asInt());assertEquals(1,second.path("metrics").path("arrivedSessions").asInt());assertEquals(0,first.path("metrics").path("movedInFeedbackEvents").asInt());assertEquals(1,second.path("metrics").path("movedInFeedbackEvents").asInt());
        assertEquals(2,first.path("metrics").path("newRequests").asInt()+second.path("metrics").path("newRequests").asInt());
    }
    @Test void beijingMidnightAndPeriodActivityAreNotCohortConversion(){
        // 23:59:59 Beijing, followed by an arrival next Beijing day from an older request.
        var date=LocalDate.parse(day);Instant prior=date.atStartOfDay(ZoneId.of("Asia/Shanghai")).toInstant().minusSeconds(1);useClock(prior);
        String older=request();var v=schedule(older,P1Service.INSTITUTION,prior.minusSeconds(1800));
        useClock(prior.plusSeconds(3600));arrive(older,v,prior.plusSeconds(2));String fresh=request();
        var report=reports.preview(login.token(),login.csrfToken(),scope(day,day,null));assertEquals(1,report.path("metrics").path("newRequests").asInt());assertEquals(1,report.path("metrics").path("arrivedSessions").asInt());
        assertEquals(0,report.path("metrics").path("cohortArrivedRequests").asInt());assertEquals(0.0,report.path("metrics").path("cohortArrivalRate").asDouble());
        var previous=reports.preview(login.token(),login.csrfToken(),scope(date.minusDays(1).toString(),date.minusDays(1).toString(),null));assertEquals(1,previous.path("metrics").path("newRequests").asInt());assertEquals(0,previous.path("metrics").path("arrivedSessions").asInt());
    }
    @Test void missingProfilesAndSmallSampleAndZeroStayExplicit(){
        var zero=preview();assertEquals(0,zero.path("metrics").path("newRequests").asInt());assertTrue(zero.path("metrics").path("cohortArrivalRate").isNull());
        request();var small=preview();assertTrue(small.path("profiles").toString().contains("小样本分布已抑制"));assertTrue(small.path("profiles").toString().contains("未采集"));
        assertFalse(small.toString().contains("contactPhone"));assertFalse(small.toString().contains("assistanceNote"));assertFalse(small.toString().contains("合成联系人"));
    }
    @Test void sourcesAndDatasetAreSeparatedWithoutFakeOfflineNumbers()throws Exception{
        String a=request(),b=request();try(var c=s.database.getConnection();var q=c.prepareStatement("UPDATE p1_service_request_v1 SET request_source='OFFLINE_MANUAL' WHERE request_id=?")){q.setString(1,a);q.executeUpdate();}
        var report=preview();assertEquals(2,report.path("metrics").path("newRequests").asInt());
        var offline=reports.preview(login.token(),login.csrfToken(),scope(day,day,null).put("source","OFFLINE_MANUAL"));assertEquals(1,offline.path("metrics").path("newRequests").asInt());
        var productionSettings=new P1Service.Settings(true,false,s.settings.noticeVersion(),s.settings.noticeText(),s.settings.noticeApprovalRef(),"","p1-synthetic-admin",s.passwordHash);
        var prod=new P1Service(s.database,s.auth,s.mapper,Clock.fixed(now,ZoneOffset.UTC),productionSettings);var prodLogin=prod.login("p1-synthetic-admin",s.adminPassword);
        assertEquals(0,new P1Reports(prod).preview(prodLogin.token(),prodLogin.csrfToken(),scope(day,day,null)).path("metrics").path("newRequests").asInt());
        assertThrows(P1Failure.class,()->new P1Reports(prod).snapshot(prodLogin.token(),prodLogin.csrfToken(),report.path("snapshotId").asText()));
    }
    @Test void reportAndExportRequireAdminCsrfAndNeverAcceptOrdinaryEvidence()throws Exception{
        useClock(LocalDate.parse(day).atTime(2,15).atZone(ZoneId.of("Asia/Shanghai")).toInstant());
        MockMvc mvc=MockMvcBuilders.standaloneSetup(new P1Controller(service,s.mapper)).build();var body=scope(day,day,null);
        mvc.perform(post("/api/v1/p1-service/admin/reports").header("X-Auth-Evidence",s.alice).contentType("application/json").content(body.toString())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/p1-service/admin/reports").cookie(new Cookie("P1_ADMIN_SESSION",login.token())).contentType("application/json").content(body.toString())).andExpect(status().isForbidden());
        var report=preview();String endpoint="/api/v1/p1-service/admin/reports/"+report.path("snapshotId").asText()+"/xlsx";
        mvc.perform(get(endpoint).header("X-Auth-Evidence",s.alice)).andExpect(status().isUnauthorized());mvc.perform(get(endpoint).cookie(new Cookie("P1_ADMIN_SESSION",login.token()))).andExpect(status().isForbidden());
        var response=mvc.perform(get(endpoint).cookie(new Cookie("P1_ADMIN_SESSION",login.token())).header("X-P1-CSRF",login.csrfToken())).andExpect(status().isOk()).andReturn().getResponse();
        assertTrue(response.getContentType().contains("spreadsheetml"));assertTrue(response.getHeader("Content-Disposition").endsWith("-"+day+".xlsx\""));assertTrue(response.getContentAsByteArray().length>5000);
    }
    @Test void exportedWorkbookHasFourVisibleSheetsChartsPrintSettingsAndNoPersonalDetailsOrFormulaInjection()throws Exception{
        request();var report=preview();var zip=unzip(P1Workbook.create(report));assertEquals(4,zip.keySet().stream().filter(n->n.matches("xl/worksheets/sheet[1-4]\\.xml")).count());
        assertFalse(zip.get("xl/workbook.xml").contains("hidden"));assertTrue(zip.get("xl/workbook.xml").contains("_xlnm.Print_Area"));assertTrue(zip.containsKey("xl/charts/chart1.xml"));
        for(var entry:zip.entrySet()){
            assertFalse(entry.getValue().contains("13800000000"));assertFalse(entry.getValue().contains("13900000000"));assertFalse(entry.getValue().contains("合成联系人"));assertFalse(entry.getValue().contains("External"));assertFalse(entry.getKey().contains("externalLink"));
            var factory=DocumentBuilderFactory.newInstance();factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);factory.newDocumentBuilder().parse(new ByteArrayInputStream(entry.getValue().getBytes(StandardCharsets.UTF_8)));
        }
        assertTrue(zip.get("xl/worksheets/sheet1.xml").contains("state=\"frozen\""));assertTrue(zip.get("xl/worksheets/sheet1.xml").contains("orientation=\"landscape\""));
        assertTrue(zip.get("xl/worksheets/sheet1.xml").contains("IF(C23=0"));
        for(String danger:List.of("=1+1","+SUM(1,2)","-2+3","@SUM(1,2)","=HYPERLINK(\"https://example.invalid\",\"click\")")){
            var injected=unzip(P1Workbook.create(report.deepCopy().put("warning",danger))).get("xl/worksheets/sheet1.xml");
            assertTrue(injected.contains("r=\"B3\" s=\"7\" t=\"inlineStr\""));assertFalse(injected.contains("<f>"+danger));
        }
    }
    Map<String,String> unzip(byte[] data)throws Exception{var files=new LinkedHashMap<String,String>();try(var zip=new ZipInputStream(new ByteArrayInputStream(data),StandardCharsets.UTF_8)){ZipEntry entry;while((entry=zip.getNextEntry())!=null)files.put(entry.getName(),new String(zip.readAllBytes(),StandardCharsets.UTF_8));}return files;}
}
