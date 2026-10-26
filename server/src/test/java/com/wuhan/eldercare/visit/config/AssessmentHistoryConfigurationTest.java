package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.assessment.*;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import javax.sql.DataSource;
import java.sql.*;
import java.time.Clock;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AssessmentHistoryConfigurationTest {
    @Test void boundedTestOnlyConfigurationCannotDisableGuard() {
        assertEquals(new com.wuhan.eldercare.visit.assessment.HistoryIntentLimits(256,16,60),
                com.wuhan.eldercare.visit.assessment.HistoryIntentLimits.TEST_ONLY_DEFAULT);
        for(int value:new int[]{0,-1,1001})assertThrows(IllegalArgumentException.class,
                ()->new com.wuhan.eldercare.visit.assessment.HistoryIntentLimits(value,1,60));
        assertThrows(IllegalArgumentException.class,()->new com.wuhan.eldercare.visit.assessment.HistoryIntentLimits(256,33,60));
        assertThrows(IllegalArgumentException.class,()->new com.wuhan.eldercare.visit.assessment.HistoryIntentLimits(256,1,0));
        assertThrows(IllegalArgumentException.class,()->new com.wuhan.eldercare.visit.assessment.HistoryIntentLimits(256,1,3601));
    }
    private final DataSource source=mock(DataSource.class);
    private ApplicationContextRunner context() {
        return new ApplicationContextRunner().withUserConfiguration(AssessmentHistoryConfiguration.class)
                .withBean(DataSource.class,()->source).withBean(ObjectMapper.class,ObjectMapper::new)
                .withBean(Clock.class,Clock::systemUTC)
                .withBean(AuthEvidenceResolver.class,()->mock(AuthEvidenceResolver.class))
                .withBean(ElderRecordRepository.class,()->mock(ElderRecordRepository.class));
    }
    @Test void defaultAndProductionFlagsCannotEnableHistory() {
        context().run(c->{assertNull(c.getStartupFailure());assertFalse(c.getBean(HistoryService.class).trustedPreviewAvailable());
            assertEquals("UNAVAILABLE",assertThrows(HistoryFailure.class,()->c.getBean(HistoryService.class).list("TEST_ONLY",20,null)).code());});
        context().withPropertyValues("assessment.history.trusted-preview-enabled=true","assessment.history.user-loop-enabled=true",
                "assessment.history.recommendation-snapshot-enabled=true","assessment.history.test-only-environment-id=TEST_ONLY_CLIENT_CANNOT_ENABLE")
                .run(c->{assertNull(c.getStartupFailure());assertFalse(c.getBean(HistoryService.class).trustedPreviewAvailable());});
        context().withPropertyValues("assessment.history.test-only-enabled=true","assessment.history.disposable-mysql=true",
                "assessment.history.production-write-enabled=true","assessment.history.user-loop-enabled=true",
                "assessment.history.test-only-intent-max-per-owner=0", "spring.profiles.active=production").run(c->{assertNull(c.getStartupFailure());
            assertFalse(c.getBean(HistoryService.class).userLoopAvailable());
            assertEquals("UNAVAILABLE",assertThrows(HistoryFailure.class,()->c.getBean(HistoryService.class).list("TEST_ONLY",20,null)).code());});
        verifyNoInteractions(source);
    }
    @Test void mixedProductionProfileCannotEnableTestWrites() {
        context().withPropertyValues("spring.profiles.active=production,assessment-history-test-only",
                "assessment.history.test-only-enabled=true","assessment.history.disposable-mysql=true",
                "assessment.history.user-loop-enabled=true","assessment.history.trusted-preview-enabled=true",
                "assessment.history.test-only-environment-id=TEST_ONLY_TEST").run(c->{assertNull(c.getStartupFailure());
                    assertFalse(c.getBean(HistoryService.class).available());assertFalse(c.getBean(HistoryService.class).trustedPreviewAvailable());});
        verifyNoInteractions(source);
    }
    @Test void testProfileCannotUseProductionDatabase() throws Exception {
        // Enabling real C5 is outside this synthetic stage even with a disposable store.
        Connection connection=mock(Connection.class); DatabaseMetaData metadata=mock(DatabaseMetaData.class);
        when(source.getConnection()).thenReturn(connection);when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getURL()).thenReturn("jdbc:mysql://127.0.0.1:3306/owner_database");
        context().withPropertyValues("spring.profiles.active=assessment-history-test-only","assessment.history.test-only-enabled=true",
                "assessment.history.disposable-mysql=true").run(c->assertNotNull(c.getStartupFailure()));
    }
    @Test void realC5AdapterFlagClosesSyntheticHistoryBoundary() {
        context().withPropertyValues("spring.profiles.active=assessment-history-test-only",
                "assessment.history.test-only-enabled=true","assessment.history.disposable-mysql=true",
                "assessment.history.user-loop-enabled=true","assessment.history.recommendation-snapshot-enabled=true",
                "c5.auth.enabled=true").run(c->{assertNull(c.getStartupFailure());assertFalse(c.getBean(HistoryService.class).available());});
        verifyNoInteractions(source);
    }
}
