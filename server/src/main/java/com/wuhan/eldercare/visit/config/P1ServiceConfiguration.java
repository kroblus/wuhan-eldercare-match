package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.p1.P1Service;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.UnavailableInstitutionRevisionRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import javax.sql.DataSource;
import java.time.Clock;
import java.util.Arrays;

@Configuration
public class P1ServiceConfiguration {
    @Bean P1Service p1Service(ObjectProvider<DataSource> databases,ObjectProvider<InstitutionRevisionRepository> institutionRepositories,AuthEvidenceResolver auth,ObjectMapper mapper,Clock c5Clock,Environment env){
        boolean synthetic=Arrays.asList(env.getActiveProfiles()).contains("p1-synthetic");
        boolean excluded=Arrays.stream(env.getActiveProfiles()).anyMatch(profile ->
                profile.equals("assessment-history-test-only")||profile.equals("demo")||profile.equals("test"));
        boolean formal=!excluded&&env.getProperty("c4.persistence.enabled",Boolean.class,false)&&env.getProperty("c5.auth.enabled",Boolean.class,false);
        boolean enabled=env.getProperty("p1.intake.enabled",Boolean.class,false)&&(synthetic||formal);
        return new P1Service(databases.getIfAvailable(),auth,mapper,c5Clock,new P1Service.Settings(enabled,synthetic,
                env.getProperty("p1.intake.notice-version",""),env.getProperty("p1.intake.notice-text",""),env.getProperty("p1.intake.notice-approval-ref",""),
                env.getProperty("p1.platform-phone",""),env.getProperty("p1.admin.username",""),env.getProperty("p1.admin.password-hash","")),
                institutionRepositories.getIfAvailable(UnavailableInstitutionRevisionRepository::new),
                env.getProperty("institution.publications.enabled",Boolean.class,false)&&!excluded&&(synthetic||env.getProperty("c4.persistence.enabled",Boolean.class,false)),
                env.getProperty("institution.publisher.node-executable","node"));
    }
}
