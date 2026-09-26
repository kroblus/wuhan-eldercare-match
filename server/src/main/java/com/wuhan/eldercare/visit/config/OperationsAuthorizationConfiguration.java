package com.wuhan.eldercare.visit.config;

import com.wuhan.eldercare.visit.operations.JdbcOperationsAuthorizationRepository;
import com.wuhan.eldercare.visit.operations.OperationsAuthorizationRepository;
import com.wuhan.eldercare.visit.operations.OperationsCredentialHasher;
import com.wuhan.eldercare.visit.operations.OperationsCredentialGenerator;
import com.wuhan.eldercare.visit.operations.OperationsPrincipalResolver;
import com.wuhan.eldercare.visit.operations.OperationsProvisioningService;
import com.wuhan.eldercare.visit.operations.OperationsVisitAuthorizationResolver;
import com.wuhan.eldercare.visit.operations.Sha256OperationsCredentialHasher;
import com.wuhan.eldercare.visit.operations.SecureRandomOperationsCredentialGenerator;
import com.wuhan.eldercare.visit.operations.UnavailableOperationsAuthorizationRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.time.Clock;

@Configuration
public class OperationsAuthorizationConfiguration {
    @Bean
    @ConditionalOnMissingBean(OperationsCredentialHasher.class)
    OperationsCredentialHasher operationsCredentialHasher() {
        return new Sha256OperationsCredentialHasher();
    }

    @Bean
    @ConditionalOnMissingBean(OperationsCredentialGenerator.class)
    OperationsCredentialGenerator operationsCredentialGenerator() {
        return new SecureRandomOperationsCredentialGenerator();
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(OperationsAuthorizationRepository.class)
    OperationsAuthorizationRepository jdbcOperationsAuthorizationRepository(DataSource dataSource) {
        return new JdbcOperationsAuthorizationRepository(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(OperationsAuthorizationRepository.class)
    OperationsAuthorizationRepository unavailableOperationsAuthorizationRepository() {
        return new UnavailableOperationsAuthorizationRepository();
    }

    @Bean
    OperationsPrincipalResolver operationsPrincipalResolver(
            OperationsAuthorizationRepository repository,
            OperationsCredentialHasher credentialHasher
    ) {
        return new OperationsPrincipalResolver(repository, credentialHasher);
    }

    @Bean
    OperationsVisitAuthorizationResolver operationsVisitAuthorizationResolver(
            OperationsAuthorizationRepository repository
    ) {
        return new OperationsVisitAuthorizationResolver(repository);
    }

    @Bean
    OperationsProvisioningService operationsProvisioningService(
            OperationsAuthorizationRepository repository,
            OperationsCredentialHasher credentialHasher,
            Clock c5Clock
    ) {
        return new OperationsProvisioningService(repository, credentialHasher, c5Clock);
    }
}
