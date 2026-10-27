package com.wuhan.eldercare.visit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.history.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import javax.sql.DataSource;
import java.time.Clock;
import java.util.Arrays;

@Configuration
public class C2HistoryConfiguration {
    @Bean C2HistoryService c2HistoryService(ObjectProvider<DataSource> databases, AuthEvidenceResolver auth,
            ElderRecordRepository elders, ObjectMapper mapper, Clock c5Clock, Environment env,
            ObjectProvider<C2CatalogSource> sources, ObjectProvider<C2DataPolicy> policies) {
        // TEST_ONLY and Demo cannot be promoted by flipping the formal write flag.
        boolean formal = env.getProperty("c4.persistence.enabled", Boolean.class, false)
                && env.getProperty("c5.auth.enabled", Boolean.class, false)
                && Arrays.stream(env.getActiveProfiles()).noneMatch(profile ->
                    profile.equals("assessment-history-test-only") || profile.equals("demo") || profile.equals("test"));
        return new C2HistoryService(formal ? databases.getIfAvailable() : null, auth, elders, mapper, c5Clock,
                new C2NodeSnapshotEngine(mapper, env.getProperty("c2.history.node-executable", "node")),
                formal ? sources.getIfAvailable() : null, formal ? policies.getIfAvailable() : null,
                formal && env.getProperty("c2.history.writes-enabled", Boolean.class, false));
    }
}
