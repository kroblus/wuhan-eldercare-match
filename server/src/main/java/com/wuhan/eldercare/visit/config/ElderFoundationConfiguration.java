package com.wuhan.eldercare.visit.config;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.AppointmentReferenceReader;
import com.wuhan.eldercare.visit.application.ProductionAppointmentReferenceReader;
import com.wuhan.eldercare.visit.elder.application.ElderIdentitySource;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;
import com.wuhan.eldercare.visit.elder.application.UuidElderIdentitySource;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import com.wuhan.eldercare.visit.elder.persistence.UnavailableElderRecordRepository;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationProvisioner;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationRepository;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentEligibilityResolver;
import com.wuhan.eldercare.visit.institution.appointment.persistence.JdbcInstitutionAppointmentAuthorizationRepository;
import com.wuhan.eldercare.visit.institution.appointment.persistence.UnavailableInstitutionAppointmentAuthorizationRepository;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.time.Clock;

@Configuration
public class ElderFoundationConfiguration {
    @Bean
    @ConditionalOnMissingBean(ElderIdentitySource.class)
    ElderIdentitySource elderIdentitySource(Clock c5Clock) {
        return new UuidElderIdentitySource(c5Clock);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(ElderRecordRepository.class)
    ElderRecordRepository jdbcElderRecordRepository(DataSource dataSource) {
        return new JdbcElderRecordRepository(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(ElderRecordRepository.class)
    ElderRecordRepository unavailableElderRecordRepository() {
        return new UnavailableElderRecordRepository();
    }

    @Bean
    ElderRecordService elderRecordService(AuthEvidenceResolver authentication, ElderRecordRepository repository,
                                          ElderIdentitySource identitySource) {
        return new ElderRecordService(authentication, repository, identitySource);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(InstitutionAppointmentAuthorizationRepository.class)
    InstitutionAppointmentAuthorizationRepository jdbcInstitutionAppointmentAuthorizationRepository(
            DataSource dataSource) {
        return new JdbcInstitutionAppointmentAuthorizationRepository(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(InstitutionAppointmentAuthorizationRepository.class)
    InstitutionAppointmentAuthorizationRepository unavailableInstitutionAppointmentAuthorizationRepository() {
        return new UnavailableInstitutionAppointmentAuthorizationRepository();
    }

    @Bean
    InstitutionAppointmentEligibilityResolver institutionAppointmentEligibilityResolver(
            InstitutionRevisionRepository revisions,
            InstitutionAppointmentAuthorizationRepository authorizations) {
        return new InstitutionAppointmentEligibilityResolver(revisions, authorizations);
    }

    @Bean
    InstitutionAppointmentAuthorizationProvisioner institutionAppointmentAuthorizationProvisioner(
            InstitutionAppointmentAuthorizationRepository authorizations,
            InstitutionAppointmentEligibilityResolver eligibility,
            Clock c5Clock) {
        return new InstitutionAppointmentAuthorizationProvisioner(authorizations, eligibility, c5Clock);
    }

    /** Future approved successors may consume this read-only port after defining atomicity; current C3 remains fail-closed. */
    @Bean
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    @ConditionalOnMissingBean(AppointmentReferenceReader.class)
    AppointmentReferenceReader productionAppointmentReferenceReader(ElderRecordService elders,
            InstitutionAppointmentEligibilityResolver institutions) {
        return new ProductionAppointmentReferenceReader(elders, institutions);
    }
}
