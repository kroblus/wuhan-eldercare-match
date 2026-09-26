package com.wuhan.eldercare.visit.config;

import com.wuhan.eldercare.visit.lifecycle.JdbcVisitLifecycleMutationRepository;
import com.wuhan.eldercare.visit.lifecycle.UnavailableVisitLifecycleMutationRepository;
import com.wuhan.eldercare.visit.lifecycle.VisitLifecycleMutationRepository;
import com.wuhan.eldercare.visit.lifecycle.VisitLifecycleMutationService;
import com.wuhan.eldercare.visit.lifecycle.VisitLifecycleTransitionEvaluatorV1;
import com.wuhan.eldercare.visit.operations.OperationsPrincipalResolver;
import com.wuhan.eldercare.visit.operations.OperationsVisitAuthorizationResolver;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.time.Clock;

@Configuration
public class VisitLifecycleMutationConfiguration {
    @Bean
    @ConditionalOnMissingBean(VisitLifecycleTransitionEvaluatorV1.class)
    VisitLifecycleTransitionEvaluatorV1 visitLifecycleTransitionEvaluatorV1() {
        return new VisitLifecycleTransitionEvaluatorV1();
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(VisitLifecycleMutationRepository.class)
    VisitLifecycleMutationRepository jdbcVisitLifecycleMutationRepository(
            DataSource dataSource, VisitLifecycleTransitionEvaluatorV1 evaluator) {
        return new JdbcVisitLifecycleMutationRepository(dataSource, evaluator);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(VisitLifecycleMutationRepository.class)
    VisitLifecycleMutationRepository unavailableVisitLifecycleMutationRepository() {
        return new UnavailableVisitLifecycleMutationRepository();
    }

    @Bean
    VisitLifecycleMutationService visitLifecycleMutationService(
            OperationsPrincipalResolver principalResolver,
            OperationsVisitAuthorizationResolver authorizationResolver,
            VisitLifecycleMutationRepository repository,
            @Qualifier("c5Clock") Clock clock) {
        return new VisitLifecycleMutationService(principalResolver, authorizationResolver, repository, clock);
    }
}
