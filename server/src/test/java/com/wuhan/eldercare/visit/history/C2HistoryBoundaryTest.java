package com.wuhan.eldercare.visit.history;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.config.C2HistoryConfiguration;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import javax.sql.DataSource;
import java.time.Clock;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class C2HistoryBoundaryTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private MockMvc http(C2HistoryService service) {
        return MockMvcBuilders.standaloneSetup(new C2HistoryController(service,mapper)).build();
    }
    @Test void disabledCollectionDoesNotReadHealthBodyOrTouchDatabase() throws Exception {
        var source=mock(DataSource.class);
        var auth=mock(AuthEvidenceResolver.class);
        var elders=mock(ElderRecordRepository.class);
        var engine=mock(C2SnapshotEngine.class);
        var service=new C2HistoryService(source,auth,elders,mapper,Clock.systemUTC(),engine,null,null,false);
        http(service).perform(post("/api/v1/formal-assessment-history/save-intents").contentType("application/json")
                .content("malformed health body"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("UNAVAILABLE"));
        verifyNoInteractions(source,engine);
        http(service).perform(get("/api/v1/formal-assessment-history/data-rights"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.result.availability").value("UNAVAILABLE"));
    }
    @Test void rejectsIdentityInjectionDuplicatesTrailingJsonAndOversizedBodies() throws Exception {
        var service=mock(C2HistoryService.class);
        var http=http(service);
        for(String body:new String[]{
                "{\"noticeVersion\":\"v1\",\"accepted\":true,\"userId\":\"forged\"}",
                "{\"noticeVersion\":\"v1\",\"accepted\":true,\"elderId\":\"forged\"}",
                "{\"noticeVersion\":\"v1\",\"noticeVersion\":\"v2\",\"accepted\":true}",
                "{\"noticeVersion\":\"v1\",\"accepted\":true}{}",
                "{\"noticeVersion\":\"v1\",\"accepted\":\"true\"}"
        })http.perform(post("/api/v1/formal-assessment-history/consents").contentType("application/json").content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        http.perform(post("/api/v1/formal-assessment-history/consents").contentType("application/json").content("x".repeat(1025)))
                .andExpect(status().isPayloadTooLarge());
        verifyNoInteractions(service);
    }
    @Test void errorsNeverEchoCredentialsPayloadOrDatabaseDiagnostics() throws Exception {
        var service=mock(C2HistoryService.class);
        when(service.list(any(),anyInt(),any())).thenThrow(new IllegalStateException("SECRET_CREDENTIAL_AND_SQL"));
        http(service).perform(get("/api/v1/formal-assessment-history").header("X-Auth-Evidence","PRIVATE_SESSION"))
                .andExpect(status().isServiceUnavailable()).andExpect(content().json("{\"contractVersion\":\"formal-single-elder-history-v1\",\"code\":\"ERROR\"}"));
    }
    @Test void clientResultsAndClientOwnerSelectorsAreNotAcceptedByPrepareOrConfirm() throws Exception {
        var service=mock(C2HistoryService.class);
        var http=http(service);
        for(String extra:new String[]{"userId","elderId","recommendation","datasetVersion"})
            http.perform(post("/api/v1/formal-assessment-history/save-intents").contentType("application/json")
                .content("{\"intentId\":\"a\",\"assessmentVersion\":\"assessment-contract-v2\",\"answers\":{},\"consentId\":\"b\",\""+extra+"\":\"forged\"}"))
                .andExpect(status().isBadRequest());
        verify(service,times(4)).notice();
        verifyNoMoreInteractions(service);
        http.perform(post("/api/v1/formal-assessment-history/confirm").contentType("application/json")
                .content("{\"intentId\":\"a\",\"resultVersion\":\"b\",\"displayBinding\":\"c\",\"answers\":{}}"))
                .andExpect(status().isBadRequest());
        verifyNoMoreInteractions(service);
    }
    private ApplicationContextRunner context() {
        var auth=mock(AuthEvidenceResolver.class);when(auth.supportsTransactionalResolution()).thenReturn(true);
        var elders=mock(ElderRecordRepository.class);when(elders.supportsTransactionScopedLookup()).thenReturn(true);
        return new ApplicationContextRunner().withUserConfiguration(C2HistoryConfiguration.class)
                .withBean(ObjectMapper.class,ObjectMapper::new).withBean(DataSource.class,()->mock(DataSource.class))
                .withBean(AuthEvidenceResolver.class,()->auth).withBean(ElderRecordRepository.class,()->elders)
                .withBean(Clock.class,Clock::systemUTC);
    }
    @Test void flagAloneCannotOpenCollectionAndTestProfilesCannotPromoteFormalService() {
        context().run(ctx->{assertFalse(ctx.getBean(C2HistoryService.class).capability().readsAvailable());});
        context().withPropertyValues("c4.persistence.enabled=true","c5.auth.enabled=true","c2.history.writes-enabled=true")
                .run(ctx->{var capability=ctx.getBean(C2HistoryService.class).capability();assertTrue(capability.readsAvailable());assertFalse(capability.writesAvailable());});
        for(String profile:new String[]{"assessment-history-test-only","demo","test"})
            context().withPropertyValues("c4.persistence.enabled=true","c5.auth.enabled=true","c2.history.writes-enabled=true","spring.profiles.active="+profile)
                .run(ctx->assertFalse(ctx.getBean(C2HistoryService.class).capability().readsAvailable()));
    }
    @Test void packagedNodeBridgeUsesActualRulesForAllThreeKindsWithoutDevelopmentProviders() throws Exception {
        var fixtures=mapper.readTree(getClass().getResourceAsStream("/c2-history/synthetic-inputs.json"));
        var engine=new C2NodeSnapshotEngine(mapper,"node");
        for(var fixture:fixtures.path("fixtures")) {
            var input=fixture.path("input");
            var source=new C2CatalogSource.Capture("C2_SYNTHETIC_ONLY","https://example.invalid/C2_SYNTHETIC_ONLY",input.path("catalog"));
            var snapshot=engine.generate(input.path("completed"),source,input.path("evaluationAsOf").asText());
            assertEquals(fixture.path("expected").asText(),snapshot.path("publicDisplay").path("state").asText());
            assertEquals(input.path("completed"),snapshot.path("completed"));
            String display=snapshot.path("publicDisplay").toString();
            for(String key:new String[]{"answers","rankTuple","priorityFitVector","elderId","ownerId"})assertFalse(display.contains("\""+key+"\""));
        }
        assertThrows(C2Failure.class,()->new C2NodeSnapshotEngine(mapper,"NODE_NOT_INSTALLED")
                .generate(fixtures.path("fixtures").get(0).path("input").path("completed"),
                new C2CatalogSource.Capture("test","test",fixtures.path("fixtures").get(0).path("input").path("catalog")),"2026-10-27T04:00:00Z"));
    }
}
