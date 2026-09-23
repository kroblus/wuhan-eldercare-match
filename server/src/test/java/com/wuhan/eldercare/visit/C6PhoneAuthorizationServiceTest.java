package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.PhoneAuthorizationService;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationContractV1;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.web.PhoneAuthorizationResultV1;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class C6PhoneAuthorizationServiceTest {
    @Test
    void authenticatedRequestExchangesCodeAndReturnsOnlyC3Outcome() throws Exception {
        String syntheticCode = "test-phone-code-" + UUID.randomUUID();
        AtomicInteger exchangeCalls = new AtomicInteger();
        PhoneAuthorizationProvider provider = code -> {
            exchangeCalls.incrementAndGet();
            assertEquals(syntheticCode, code);
            return PhoneAuthorizationProvider.ExchangeResult.authorized("0".repeat(11), "0".repeat(11));
        };
        PhoneAuthorizationService service = new PhoneAuthorizationService(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("test-principal")), provider);

        var result = service.verify("test-session-" + UUID.randomUUID(), request(syntheticCode));
        var wire = PhoneAuthorizationResultV1.from(result);
        String json = new ObjectMapper().writeValueAsString(wire);

        assertEquals(1, exchangeCalls.get());
        assertEquals("authenticated", result.authResolution().wireValue());
        assertEquals("authorized", result.phoneEvidenceOutcome().wireValue());
        assertTrue(json.contains("\"phoneEvidenceOutcome\":\"authorized\""));
        assertFalse(json.contains(syntheticCode));
        assertFalse(json.contains("0".repeat(11)));
    }

    @Test
    void unauthenticatedCallerDoesNotConsumePhoneCode() {
        String syntheticCode = "test-phone-code-" + UUID.randomUUID();
        AtomicInteger exchangeCalls = new AtomicInteger();
        PhoneAuthorizationProvider provider = code -> {
            exchangeCalls.incrementAndGet();
            return PhoneAuthorizationProvider.ExchangeResult.failure(PhoneAuthorizationProvider.ExchangeResult.Status.UNAVAILABLE);
        };
        PhoneAuthorizationService service = new PhoneAuthorizationService(
                evidence -> AuthEvidenceResolver.Resolution.failure(AuthEvidenceResolver.Resolution.Status.EXPIRED), provider);

        var result = service.verify("test-session-" + UUID.randomUUID(), request(syntheticCode));

        assertEquals("expired", result.authResolution().wireValue());
        assertNull(result.phoneEvidenceOutcome());
        assertEquals(0, exchangeCalls.get());
    }

    @Test
    void missingAndWrongPurposeFailClosedWithoutProviderExchange() {
        AtomicInteger exchangeCalls = new AtomicInteger();
        PhoneAuthorizationProvider provider = code -> {
            exchangeCalls.incrementAndGet();
            return PhoneAuthorizationProvider.ExchangeResult.failure(PhoneAuthorizationProvider.ExchangeResult.Status.UNAVAILABLE);
        };
        PhoneAuthorizationService service = new PhoneAuthorizationService(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("test-principal")), provider);

        var missing = service.verify("test-session-" + UUID.randomUUID(), request(null));
        var wrongPurpose = service.verify("test-session-" + UUID.randomUUID(), new PhoneAuthorizationService.PhoneAuthorizationRequest(
                PhoneAuthorizationContractV1.CONTRACT_VERSION,
                PhoneAuthorizationContractV1.REQUEST_KIND,
                "account_login",
                "test-phone-code-" + UUID.randomUUID()));

        assertEquals("missing", missing.phoneEvidenceOutcome().wireValue());
        assertEquals("invalid", wrongPurpose.phoneEvidenceOutcome().wireValue());
        assertEquals(0, exchangeCalls.get());
    }

    @Test
    void providerStatusesKeepC3ContactTaxonomyWithoutRawDetails() {
        for (PhoneAuthorizationProvider.ExchangeResult.Status status : new PhoneAuthorizationProvider.ExchangeResult.Status[]{
                PhoneAuthorizationProvider.ExchangeResult.Status.INVALID,
                PhoneAuthorizationProvider.ExchangeResult.Status.EXPIRED,
                PhoneAuthorizationProvider.ExchangeResult.Status.UNAVAILABLE,
                PhoneAuthorizationProvider.ExchangeResult.Status.TECHNICAL_FAILURE}) {
            PhoneAuthorizationService service = new PhoneAuthorizationService(
                    evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("test-principal")),
                    code -> PhoneAuthorizationProvider.ExchangeResult.failure(status));
            var result = service.verify("test-session-" + UUID.randomUUID(), request("test-phone-code-" + UUID.randomUUID()));
            assertEquals(status.name().toLowerCase(), result.phoneEvidenceOutcome().wireValue());
        }
    }

    private static PhoneAuthorizationService.PhoneAuthorizationRequest request(String code) {
        return new PhoneAuthorizationService.PhoneAuthorizationRequest(
                PhoneAuthorizationContractV1.CONTRACT_VERSION,
                PhoneAuthorizationContractV1.REQUEST_KIND,
                PhoneAuthorizationContractV1.PURPOSE,
                code);
    }
}
