package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.PurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.application.WeChatPurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationContractV1;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.SubmissionValidation;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class WeChatPurposeBoundContactVerifierTest {
    @Test
    void freshProviderPhoneMatchesOnlyWithinFrozenPurpose() {
        String syntheticPhone = "0".repeat(11);
        AtomicInteger exchangeCalls = new AtomicInteger();
        PhoneAuthorizationProvider provider = code -> {
            exchangeCalls.incrementAndGet();
            return PhoneAuthorizationProvider.ExchangeResult.authorized(syntheticPhone, syntheticPhone);
        };
        WeChatPurposeBoundContactVerifier verifier = new WeChatPurposeBoundContactVerifier(provider);

        PurposeBoundContactVerifier.Verification result = verifier.verify(
                "test-one-time-code-" + UUID.randomUUID(), PhoneAuthorizationContractV1.PURPOSE,
                "test-contact", syntheticPhone);
        PurposeBoundContactVerifier.Verification mismatch = verifier.verify(
                "test-one-time-code-" + UUID.randomUUID(), PhoneAuthorizationContractV1.PURPOSE,
                "test-contact", "1".repeat(11));
        PurposeBoundContactVerifier.Verification wrongPurpose = verifier.verify(
                "test-one-time-code-" + UUID.randomUUID(), "account_login", "test-contact", syntheticPhone);

        assertEquals(PurposeBoundContactVerifier.Verification.Status.AUTHORIZED, result.status());
        assertEquals(syntheticPhone, result.contact().phone());
        assertEquals(PurposeBoundContactVerifier.Verification.Status.INVALID, mismatch.status());
        assertNull(mismatch.contact());
        assertEquals(PurposeBoundContactVerifier.Verification.Status.INVALID, wrongPurpose.status());
        assertEquals(2, exchangeCalls.get());
    }

    @Test
    void missingExpiredInvalidAndUnavailableEvidenceFailClosed() {
        for (PhoneAuthorizationProvider.ExchangeResult.Status providerStatus : new PhoneAuthorizationProvider.ExchangeResult.Status[]{
                PhoneAuthorizationProvider.ExchangeResult.Status.MISSING,
                PhoneAuthorizationProvider.ExchangeResult.Status.EXPIRED,
                PhoneAuthorizationProvider.ExchangeResult.Status.INVALID,
                PhoneAuthorizationProvider.ExchangeResult.Status.UNAVAILABLE}) {
            WeChatPurposeBoundContactVerifier verifier = new WeChatPurposeBoundContactVerifier(
                    code -> PhoneAuthorizationProvider.ExchangeResult.failure(providerStatus));
            PurposeBoundContactVerifier.Verification result = verifier.verify(
                    "test-one-time-code-" + UUID.randomUUID(), PhoneAuthorizationContractV1.PURPOSE,
                    "test-contact", "0".repeat(11));
            assertEquals(providerStatus.name(), result.status().name());
            assertNull(result.contact());
        }
    }

    @Test
    void c4ConsumesFreshPhoneProofBeforeUnavailableReferenceAndNeverCreatesVisit() {
        String syntheticPhone = "0".repeat(11);
        String freshCode = "test-one-time-code-" + UUID.randomUUID();
        Set<String> consumedCodes = ConcurrentHashMap.newKeySet();
        AtomicInteger referenceCalls = new AtomicInteger();
        AtomicInteger visitCreates = new AtomicInteger();
        PhoneAuthorizationProvider provider = code -> {
            if (!consumedCodes.add(code)) {
                return PhoneAuthorizationProvider.ExchangeResult.failure(PhoneAuthorizationProvider.ExchangeResult.Status.INVALID);
            }
            return PhoneAuthorizationProvider.ExchangeResult.authorized(syntheticPhone, syntheticPhone);
        };
        VisitSubmissionService service = new VisitSubmissionService(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("test-principal")),
                new WeChatPurposeBoundContactVerifier(provider),
                (principal, elder, institution, revision) -> {
                    referenceCalls.incrementAndGet();
                    return ReferenceAuthorizer.Authorization.UNAVAILABLE;
                },
                (principal, command, contact) -> {
                    visitCreates.incrementAndGet();
                    return new VisitSubmissionRepository.Result(VisitSubmissionRepository.Result.Status.ACCEPTED, null);
                });
        SubmissionCommandV1 command = new SubmissionCommandV1(
                SubmissionValidation.CONTRACT_VERSION, SubmissionValidation.KIND,
                "c6-no-visit-" + UUID.randomUUID(), "institution-test", "revision-test", "elder-test",
                "2026-10-01", "morning", 1, false, "Synthetic Contact", syntheticPhone,
                SubmissionValidation.PHONE_PURPOSE, SubmissionValidation.PHONE_AUTHORIZATION, null);

        var first = service.submitBackend(command, "test-session-" + UUID.randomUUID(), freshCode);
        var replay = service.submitBackend(command, "test-session-" + UUID.randomUUID(), freshCode);

        assertEquals(SubmissionResultV1.Outcome.UNAVAILABLE, first.outcome());
        assertEquals("SERVICE_UNAVAILABLE", first.code());
        assertNull(first.candidate());
        assertEquals(SubmissionResultV1.Outcome.REJECTED, replay.outcome());
        assertEquals("CONTACT_REQUIRED", replay.code());
        assertNull(replay.candidate());
        assertEquals(1, referenceCalls.get());
        assertEquals(0, visitCreates.get());
    }
}
