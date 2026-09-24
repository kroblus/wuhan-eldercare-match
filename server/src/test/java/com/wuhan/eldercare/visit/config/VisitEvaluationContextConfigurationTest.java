package com.wuhan.eldercare.visit.config;

import com.wuhan.eldercare.visit.application.VisitEvaluationContextRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitEvaluationContextRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;

class VisitEvaluationContextConfigurationTest {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(DefaultBoundaryConfiguration.class);

    @Test
    void persistenceEnabledSelectsJdbcOwnerReadRepository() {
        contextRunner
                .withPropertyValues("c4.persistence.enabled=true")
                .withBean(DataSource.class, () -> mock(DataSource.class))
                .run(context -> assertInstanceOf(JdbcVisitEvaluationContextRepository.class,
                        context.getBean(VisitEvaluationContextRepository.class)));
    }

    @Test
    void persistenceDisabledSelectsUnavailableRepository() {
        contextRunner
                .withPropertyValues("c4.persistence.enabled=false")
                .run(context -> {
                    VisitEvaluationContextRepository repository =
                            context.getBean(VisitEvaluationContextRepository.class);
                    assertFalse(repository instanceof JdbcVisitEvaluationContextRepository);
                    var result = repository.findOwned(null, "visit-1");
                    org.junit.jupiter.api.Assertions.assertEquals(
                            VisitEvaluationContextRepository.Result.Status.UNAVAILABLE, result.status());
                });
    }
}
