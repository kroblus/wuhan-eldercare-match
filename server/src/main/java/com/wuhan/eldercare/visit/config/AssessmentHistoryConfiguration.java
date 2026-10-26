package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.assessment.*;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import javax.sql.DataSource;
import java.time.Clock;
import java.util.Arrays;

@Configuration
public class AssessmentHistoryConfiguration {
    @Bean HistoryService assessmentHistoryService(ObjectProvider<DataSource> sources,ObjectProvider<Flyway> migrations,AuthEvidenceResolver auth,
            ElderRecordRepository elders,ObjectMapper mapper,Clock c5Clock,Environment environment,ObjectProvider<HistoryRecommendationSource> recommendationSources,
            ObjectProvider<HistoryTrustedPreviewInputSource> trustedPreviewInputSources) {
        boolean isolated=Arrays.asList(environment.getActiveProfiles()).contains("assessment-history-test-only")
                && !Arrays.asList(environment.getActiveProfiles()).contains("production")
                && !environment.getProperty("c5.auth.enabled",Boolean.class,false)
                && environment.getProperty("assessment.history.test-only-enabled",Boolean.class,false)
                && environment.getProperty("assessment.history.disposable-mysql",Boolean.class,false);
        HistoryRepository repository=null;
        if(isolated) {
            DataSource source=sources.getIfAvailable();
            if(source==null) throw new IllegalStateException("isolated history requires disposable persistence");
            HistoryRepository.requireDisposable(source);
            migrations.getObject().migrate();
            // Default Flyway remains unchanged. This migration is never automatically deployed to production.
            Flyway.configure().dataSource(source).locations("classpath:db/assessment-history-test-only")
                    .table("assessment_history_test_only_schema_history").baselineOnMigrate(true).baselineVersion("0").load().migrate();
            repository=new HistoryRepository(source,mapper);
        }
        boolean userLoop=isolated&&environment.getProperty("assessment.history.user-loop-enabled",Boolean.class,false);
        HistoryRecommendationSource recommendation=isolated&&environment.getProperty("assessment.history.recommendation-snapshot-enabled",Boolean.class,false)
                ?recommendationSources.getIfAvailable():null;
        String namespace=environment.getProperty("assessment.history.test-only-environment-id");
        HistoryTrustedPreviewInputSource trustedPreviewInputs=isolated&&userLoop&&recommendation!=null
                &&environment.getProperty("assessment.history.trusted-preview-enabled",Boolean.class,false)
                ?trustedPreviewInputSources.getIfAvailable():null;
        boolean trustedPreview=userLoop&&recommendation!=null
                &&environment.getProperty("assessment.history.trusted-preview-enabled",Boolean.class,false)
                &&trustedPreviewInputs!=null&&namespace!=null&&namespace.matches("TEST_ONLY_[A-Za-z0-9_-]{1,72}");
        return new HistoryService(repository,auth,elders,new HistoryValidator(mapper,
                environment.getProperty("assessment.history.node-executable","node")),mapper,c5Clock,
                userLoop,recommendation,
                isolated?new HistoryIntentLimits(
                        environment.getProperty("assessment.history.test-only-intent-max-per-owner",Integer.class,256),
                        environment.getProperty("assessment.history.test-only-intent-max-per-window",Integer.class,16),
                        environment.getProperty("assessment.history.test-only-intent-window-seconds",Integer.class,60))
                        :HistoryIntentLimits.TEST_ONLY_DEFAULT,
                trustedPreview,namespace,trustedPreviewInputs);
    }
}
