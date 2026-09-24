package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.VisitEvaluationSubmissionService;
import com.wuhan.eldercare.visit.application.VisitEvaluationWriteRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitEvaluationWriteRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import javax.sql.DataSource;
import java.time.Clock;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

class VisitEvaluationWriteConfigurationTest {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(DefaultBoundaryConfiguration.class)
            .withBean(DataSource.class, () -> mock(DataSource.class))
            .withBean(ObjectMapper.class, ObjectMapper::new)
            .withBean(Clock.class, Clock::systemUTC);

    @Test
    void persistenceEnabledSelectsProductionJdbcRepositoryAndService() {
        contextRunner.withPropertyValues("c4.persistence.enabled=true").run(context -> {
            assertInstanceOf(JdbcVisitEvaluationWriteRepository.class,
                    context.getBean(VisitEvaluationWriteRepository.class));
            assertNotNull(context.getBean(VisitEvaluationSubmissionService.class));
        });
    }

    @Test
    void persistenceDisabledSelectsUnavailableRepositoryWithoutTestFallback() {
        contextRunner.withPropertyValues("c4.persistence.enabled=false").run(context -> {
            VisitEvaluationWriteRepository repository = context.getBean(VisitEvaluationWriteRepository.class);
            assertFalse(repository instanceof JdbcVisitEvaluationWriteRepository);
            assertEquals(VisitEvaluationWriteRepository.Result.Status.UNAVAILABLE,
                    repository.createOrResolve(null, "visit", "key", "fingerprint", null, "id", java.time.Instant.now())
                            .status());
            assertNotNull(context.getBean(VisitEvaluationSubmissionService.class));
        });
    }
}
