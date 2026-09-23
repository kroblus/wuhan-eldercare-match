package com.wuhan.eldercare.visit.config;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.PurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.application.ServerIdentitySource;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.UUID;

@Configuration
public class DefaultBoundaryConfiguration {
    @Bean
    @ConditionalOnMissingBean(AuthEvidenceResolver.class)
    AuthEvidenceResolver unavailableAuthEvidenceResolver() {
        return evidence -> evidence == null || evidence.isBlank()
                ? AuthEvidenceResolver.Resolution.failure(AuthEvidenceResolver.Resolution.Status.MISSING)
                : AuthEvidenceResolver.Resolution.failure(AuthEvidenceResolver.Resolution.Status.UNAVAILABLE);
    }

    @Bean
    @ConditionalOnMissingBean(PurposeBoundContactVerifier.class)
    PurposeBoundContactVerifier unavailableContactVerifier() {
        return (evidence, purpose, contactName, phone) -> evidence == null || evidence.isBlank()
                ? PurposeBoundContactVerifier.Verification.failure(PurposeBoundContactVerifier.Verification.Status.MISSING)
                : PurposeBoundContactVerifier.Verification.failure(PurposeBoundContactVerifier.Verification.Status.UNAVAILABLE);
    }

    @Bean
    @ConditionalOnMissingBean(ReferenceAuthorizer.class)
    ReferenceAuthorizer unavailableReferenceAuthorizer() {
        return (principal, elderId, institutionId, revision) -> ReferenceAuthorizer.Authorization.UNAVAILABLE;
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(VisitSubmissionRepository.class)
    VisitSubmissionRepository jdbcRepository(
            DataSource dataSource,
            ServerIdentitySource identitySource
    ) {
        return new com.wuhan.eldercare.visit.persistence.JdbcVisitSubmissionRepository(dataSource, identitySource);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(VisitSubmissionRepository.class)
    VisitSubmissionRepository unavailableRepository() {
        return (principal, command, contact) ->
                new VisitSubmissionRepository.Result(VisitSubmissionRepository.Result.Status.UNAVAILABLE, null);
    }

    @Bean
    @ConditionalOnMissingBean(ServerIdentitySource.class)
    ServerIdentitySource productionIdentitySource() {
        return new ServerIdentitySource() {
            @Override
            public String newVisitId() {
                return "visit_" + UUID.randomUUID();
            }

            @Override
            public Instant now() {
                return Instant.now();
            }
        };
    }

    @Bean
    VisitSubmissionService visitSubmissionService(
            AuthEvidenceResolver authEvidenceResolver,
            PurposeBoundContactVerifier contactVerifier,
            ReferenceAuthorizer referenceAuthorizer,
            VisitSubmissionRepository repository
    ) {
        return new VisitSubmissionService(authEvidenceResolver, contactVerifier, referenceAuthorizer, repository);
    }
}
