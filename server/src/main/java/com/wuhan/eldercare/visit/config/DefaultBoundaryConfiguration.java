package com.wuhan.eldercare.visit.config;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.AppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.application.AppointmentOwnerReadService;
import com.wuhan.eldercare.visit.application.PurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.application.ServerIdentitySource;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.application.VisitEvaluationContextRepository;
import com.wuhan.eldercare.visit.application.VisitEvaluationContextService;
import com.wuhan.eldercare.visit.application.VisitEvaluationContentNormalizer;
import com.wuhan.eldercare.visit.application.VisitEvaluationIdentitySource;
import com.wuhan.eldercare.visit.application.VisitEvaluationSubmissionService;
import com.wuhan.eldercare.visit.application.VisitEvaluationWriteRepository;
import com.wuhan.eldercare.visit.institution.application.InstitutionCurrentHeadReader;
import com.wuhan.eldercare.visit.institution.application.InstitutionHistoricalPublicNameResolver;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionPublisher;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.application.InstitutionSnapshotValidator;
import com.wuhan.eldercare.visit.institution.persistence.JdbcInstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.NodeInstitutionSnapshotValidator;
import com.wuhan.eldercare.visit.institution.persistence.UnavailableInstitutionRevisionRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitEvaluationContextRepository;
import com.wuhan.eldercare.visit.persistence.JdbcAppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitEvaluationWriteRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

import javax.sql.DataSource;
import java.time.Instant;
import java.time.Clock;
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

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(VisitEvaluationContextRepository.class)
    VisitEvaluationContextRepository jdbcVisitEvaluationContextRepository(DataSource dataSource) {
        return new JdbcVisitEvaluationContextRepository(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(VisitEvaluationContextRepository.class)
    VisitEvaluationContextRepository unavailableVisitEvaluationContextRepository() {
        return (principal, visitId) -> VisitEvaluationContextRepository.Result.unavailable();
    }

    @Bean
    @ConditionalOnMissingBean(VisitEvaluationContextService.class)
    VisitEvaluationContextService visitEvaluationContextService(
            AuthEvidenceResolver authEvidenceResolver,
            VisitEvaluationContextRepository repository
    ) {
        return new VisitEvaluationContextService(authEvidenceResolver, repository);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(AppointmentOwnerReadRepository.class)
    AppointmentOwnerReadRepository jdbcAppointmentOwnerReadRepository(DataSource dataSource) {
        return new JdbcAppointmentOwnerReadRepository(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(AppointmentOwnerReadRepository.class)
    AppointmentOwnerReadRepository unavailableAppointmentOwnerReadRepository() {
        return principal -> AppointmentOwnerReadRepository.Result.unavailable();
    }

    @Bean
    AppointmentOwnerReadService appointmentOwnerReadService(
            AuthEvidenceResolver authEvidenceResolver,
            AppointmentOwnerReadRepository repository,
            InstitutionHistoricalPublicNameResolver institutionNameResolver
    ) {
        return new AppointmentOwnerReadService(authEvidenceResolver, repository, institutionNameResolver);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(VisitEvaluationWriteRepository.class)
    VisitEvaluationWriteRepository jdbcVisitEvaluationWriteRepository(DataSource dataSource, ObjectMapper objectMapper) {
        return new JdbcVisitEvaluationWriteRepository(dataSource, objectMapper);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(VisitEvaluationWriteRepository.class)
    VisitEvaluationWriteRepository unavailableVisitEvaluationWriteRepository() {
        return (principal, visitId, keyDigest, fingerprint, content, evaluationId, submittedAt) ->
                VisitEvaluationWriteRepository.Result.of(VisitEvaluationWriteRepository.Result.Status.UNAVAILABLE);
    }

    @Bean
    @ConditionalOnMissingBean(VisitEvaluationIdentitySource.class)
    VisitEvaluationIdentitySource visitEvaluationIdentitySource(Clock c5Clock) {
        return new VisitEvaluationIdentitySource() {
            @Override
            public String newEvaluationId() {
                return "evaluation_" + UUID.randomUUID();
            }

            @Override
            public Instant submittedAt() {
                return c5Clock.instant();
            }
        };
    }

    @Bean
    VisitEvaluationContentNormalizer visitEvaluationContentNormalizer(ObjectMapper objectMapper) {
        return new VisitEvaluationContentNormalizer(objectMapper);
    }

    @Bean
    VisitEvaluationSubmissionService visitEvaluationSubmissionService(
            AuthEvidenceResolver authEvidenceResolver,
            VisitEvaluationWriteRepository repository,
            VisitEvaluationContentNormalizer normalizer,
            VisitEvaluationIdentitySource identitySource
    ) {
        return new VisitEvaluationSubmissionService(authEvidenceResolver, repository, normalizer, identitySource);
    }

    @Bean
    @ConditionalOnMissingBean(InstitutionSnapshotValidator.class)
    InstitutionSnapshotValidator frozenInstitutionSnapshotValidator(
            @Value("${institution.publisher.node-executable:node}") String nodeExecutable,
            ObjectMapper objectMapper
    ) {
        return new NodeInstitutionSnapshotValidator(nodeExecutable, objectMapper);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(InstitutionRevisionRepository.class)
    InstitutionRevisionRepository jdbcInstitutionRevisionRepository(
            DataSource dataSource,
            ObjectMapper objectMapper,
            InstitutionSnapshotValidator validator
    ) {
        return new JdbcInstitutionRevisionRepository(dataSource, objectMapper, validator);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(InstitutionRevisionRepository.class)
    InstitutionRevisionRepository unavailableInstitutionRevisionRepository() {
        return new UnavailableInstitutionRevisionRepository();
    }

    @Bean
    InstitutionRevisionPublisher institutionRevisionPublisher(
            InstitutionRevisionRepository repository
    ) {
        return new InstitutionRevisionPublisher(repository, Clock.systemUTC());
    }

    @Bean
    InstitutionHistoricalPublicNameResolver institutionHistoricalPublicNameResolver(
            InstitutionRevisionRepository repository
    ) {
        return new InstitutionHistoricalPublicNameResolver(repository);
    }

    @Bean
    InstitutionCurrentHeadReader institutionCurrentHeadReader(InstitutionRevisionRepository repository) {
        return new InstitutionCurrentHeadReader(repository);
    }
}
