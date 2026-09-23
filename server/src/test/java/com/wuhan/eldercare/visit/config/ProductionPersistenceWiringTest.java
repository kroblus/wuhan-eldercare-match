package com.wuhan.eldercare.visit.config;

import com.wuhan.eldercare.visit.C4Application;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.C5AuthService;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.persistence.JdbcVisitSubmissionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductionPersistenceWiringTest {
    @Test
    void productionScanRegistersC4AndC5RepositoriesWhenPersistenceIsEnabledWithoutConnectingToDatabase() {
        AtomicBoolean flywayDefinition = new AtomicBoolean();
        new ApplicationContextRunner()
                .withUserConfiguration(C4Application.class)
                .withPropertyValues(
                        "c4.persistence.enabled=true",
                        "c5.auth.enabled=true",
                        "c5.auth.app-id=app-id-test",
                        "c5.auth.app-secret=app-secret-test",
                        "c5.auth.identity-hash-secret=hash-secret-test",
                        "C4_MYSQL_URL=jdbc:mysql://localhost:3306/c4_test",
                        "C4_MYSQL_USERNAME=c4_test_user",
                        "C4_MYSQL_PASSWORD=c4-test-password")
                .withInitializer(context -> context.addBeanFactoryPostProcessor(beanFactory -> {
                    BeanDefinitionRegistry registry = (BeanDefinitionRegistry) beanFactory;
                    flywayDefinition.set(registry.containsBeanDefinition("c4Flyway"));
                    if (flywayDefinition.get()) registry.removeBeanDefinition("c4Flyway");
                }))
                .run(context -> {
                    assertTrue(flywayDefinition.get(), "C4 Flyway config should be conditionally registered");
                    assertNull(context.getStartupFailure());
                    assertEquals(JdbcAuthIdentitySessionRepository.class,
                            context.getBean(AuthIdentitySessionRepository.class).getClass());
                    assertEquals(JdbcVisitSubmissionRepository.class,
                            context.getBean(VisitSubmissionRepository.class).getClass());
                    assertInstanceOf(C5AuthService.class, context.getBean(C5AuthService.class));
                });
    }
}
