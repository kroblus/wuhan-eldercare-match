package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitSubmissionRepository;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;

/** The default production profile must fail closed without real adapters/DB. */
@SpringBootTest(properties = "c4.persistence.enabled=false", webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ProductionProfileBoundaryTest {
    @Autowired
    private VisitSubmissionService service;

    @Autowired
    private VisitSubmissionRepository repository;

    @Test
    void persistenceDisabledDoesNotRegisterJdbcRepository() {
        assertEquals(false, repository instanceof JdbcVisitSubmissionRepository);
    }

    @Test
    void missingProductionAdaptersCannotCreateSyntheticSuccess() {
        SubmissionResultV1 result = service.submit(TestFixtures.command("production-missing"), null, null);
        assertEquals(SubmissionResultV1.Outcome.REJECTED, result.outcome());
        assertEquals("AUTH_REQUIRED", result.code());
        assertNull(result.receipt());
    }

    @Test
    void configuredLookingEvidenceStillCannotBypassUnavailableAdapter() {
        SubmissionResultV1 result = service.submit(TestFixtures.command("production-unavailable"), "opaque", "opaque");
        assertEquals(SubmissionResultV1.Outcome.UNAVAILABLE, result.outcome());
        assertEquals("SERVICE_UNAVAILABLE", result.code());
        assertNull(result.receipt());
    }

    @Test
    void jdbcRepositoryRequiresExplicitPersistenceEnablement() throws Exception {
        var method = com.wuhan.eldercare.visit.config.DefaultBoundaryConfiguration.class
                .getDeclaredMethod("jdbcRepository", javax.sql.DataSource.class,
                        com.wuhan.eldercare.visit.application.ServerIdentitySource.class);
        ConditionalOnProperty condition = method.getAnnotation(ConditionalOnProperty.class);
        assertArrayEquals(new String[]{"c4.persistence.enabled"}, condition.name());
        assertEquals("true", condition.havingValue());
        assertEquals(false, condition.matchIfMissing());
    }
}
