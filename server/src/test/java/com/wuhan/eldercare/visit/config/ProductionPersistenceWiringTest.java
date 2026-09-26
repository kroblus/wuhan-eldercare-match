package com.wuhan.eldercare.visit.config;

import com.wuhan.eldercare.visit.C4Application;
import com.wuhan.eldercare.visit.application.AppointmentReferenceReader;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.PurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.application.WeChatPurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.auth.AuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.C5AuthEvidenceResolver;
import com.wuhan.eldercare.visit.auth.C5AuthService;
import com.wuhan.eldercare.visit.auth.JdbcAuthIdentitySessionRepository;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.auth.WeChatHttpPhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.persistence.JdbcVisitSubmissionRepository;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductionPersistenceWiringTest {
    private static final AtomicInteger visitSubmissionAttempts = new AtomicInteger();

    @Test
    void productionScanSeparatesReadOnlyReferencePortFromCurrentC3Authorizer() {
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
                    assertEquals(JdbcElderRecordRepository.class,
                            context.getBean(ElderRecordRepository.class).getClass());
                    AppointmentReferenceReader reader = context.getBean(AppointmentReferenceReader.class);
                    assertInstanceOf(com.wuhan.eldercare.visit.application.ProductionAppointmentReferenceReader.class,
                            reader);
                    assertTrue(!(reader instanceof ReferenceAuthorizer),
                            "the read-only appointment port must not be injectable as the current C3 gate");
                    assertEquals(ReferenceAuthorizer.Authorization.UNAVAILABLE,
                            context.getBean(ReferenceAuthorizer.class).authorize(
                                    new TrustedPrincipal("synthetic-user"), "elder-1", "institution-1", "1"));
                    assertInstanceOf(C5AuthEvidenceResolver.class, context.getBean(AuthEvidenceResolver.class));
                    assertInstanceOf(C5AuthService.class, context.getBean(C5AuthService.class));
                    assertInstanceOf(WeChatHttpPhoneAuthorizationProvider.class,
                            context.getBean("c6PhoneAuthorizationProvider"));
                    assertInstanceOf(WeChatPurposeBoundContactVerifier.class,
                            context.getBean(PurposeBoundContactVerifier.class));
                });
    }

    @Test
    void completeC5AndC6ConfigurationStillCannotCreateAVisitThroughC3Submission() {
        visitSubmissionAttempts.set(0);
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
                    if (registry.containsBeanDefinition("c4Flyway")) registry.removeBeanDefinition("c4Flyway");
                    registry.removeBeanDefinition("jdbcAuthIdentitySessionRepository");
                    registry.removeBeanDefinition("c6PhoneAuthorizationProvider");
                    registry.removeBeanDefinition("jdbcRepository");
                    DefaultListableBeanFactory definitions = (DefaultListableBeanFactory) beanFactory;
                    definitions.registerSingleton("syntheticActiveC5Session", syntheticSessionRepository());
                    definitions.registerSingleton("syntheticAuthorizedC6Phone", syntheticPhoneProvider());
                    definitions.registerSingleton("recordingVisitSubmissionRepository", recordingVisitRepository());
                }))
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    assertInstanceOf(C5AuthEvidenceResolver.class, context.getBean(AuthEvidenceResolver.class));
                    assertEquals(AuthEvidenceResolver.Resolution.Status.AUTHENTICATED,
                            context.getBean(AuthEvidenceResolver.class)
                                    .resolve("synthetic-session-evidence").status());
                    assertInstanceOf(WeChatPurposeBoundContactVerifier.class,
                            context.getBean(PurposeBoundContactVerifier.class));
                    assertEquals(PurposeBoundContactVerifier.Verification.Status.AUTHORIZED,
                            context.getBean(PurposeBoundContactVerifier.class).verify(
                                    "synthetic-phone-code", "appointment_or_consultant_contact",
                                    "Synthetic Contact", "13800000000").status());
                    assertEquals(ReferenceAuthorizer.Authorization.UNAVAILABLE,
                            context.getBean(ReferenceAuthorizer.class).authorize(
                                    new TrustedPrincipal("synthetic-user"), "elder-1", "institution-1", "1"));

                    var result = context.getBean(VisitSubmissionService.class).submitBackend(
                            validCommand(), "synthetic-session-evidence", "synthetic-phone-code");
                    assertEquals(SubmissionResultV1.Outcome.UNAVAILABLE, result.outcome());
                    assertEquals("SERVICE_UNAVAILABLE", result.code());
                    assertNull(result.candidate());
                    assertEquals(0, visitSubmissionAttempts.get(),
                            "C3 must stop at the fail-closed reference gate before persistence");
                });
    }

    private static SubmissionCommandV1 validCommand() {
        return new SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", "synthetic-key-001",
                "institution-1", "1", "elder-1", "2026-10-01", "morning", 2, false,
                "Synthetic Contact", "13800000000", "appointment_or_consultant_contact", "explicit", null);
    }

    private static AuthIdentitySessionRepository syntheticSessionRepository() {
        return new AuthIdentitySessionRepository() {
            @Override
            public LoginResult createOrLogin(String providerNamespace, String providerSubjectDigest,
                                             String sessionDigest, Instant issuedAt, Instant expiresAt) {
                return new LoginResult(LoginResult.Status.ISSUED);
            }

            @Override
            public SessionResolution resolveSession(String sessionDigest, Instant now) {
                return new SessionResolution(SessionResolution.Status.ACTIVE, "synthetic-user");
            }

            @Override
            public RevokeResult revokeSession(String sessionDigest, Instant revokedAt) {
                return new RevokeResult(RevokeResult.Status.REVOKED);
            }
        };
    }

    private static PhoneAuthorizationProvider syntheticPhoneProvider() {
        return code -> "synthetic-phone-code".equals(code)
                ? PhoneAuthorizationProvider.ExchangeResult.authorized("+8613800000000", "13800000000")
                : PhoneAuthorizationProvider.ExchangeResult.failure(
                        PhoneAuthorizationProvider.ExchangeResult.Status.INVALID);
    }

    private static VisitSubmissionRepository recordingVisitRepository() {
        return (principal, command, contact) -> {
            visitSubmissionAttempts.incrementAndGet();
            return new VisitSubmissionRepository.Result(
                    VisitSubmissionRepository.Result.Status.TECHNICAL_FAILURE, null);
        };
    }
}
