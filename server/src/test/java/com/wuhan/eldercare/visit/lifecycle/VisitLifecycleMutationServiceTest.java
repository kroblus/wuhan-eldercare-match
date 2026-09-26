package com.wuhan.eldercare.visit.lifecycle;

import com.wuhan.eldercare.visit.operations.OperationsAuthorizationRepository;
import com.wuhan.eldercare.visit.operations.OperationsPrincipalResolver;
import com.wuhan.eldercare.visit.operations.OperationsVisitAuthorizationResolver;
import com.wuhan.eldercare.visit.operations.ProvisioningCommand;
import com.wuhan.eldercare.visit.operations.Sha256OperationsCredentialHasher;
import com.wuhan.eldercare.visit.operations.TrustedOperationsPrincipal;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VisitLifecycleMutationServiceTest {
    private static final String CREDENTIAL = "ops1_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
    private static final String VISIT = "visit_synthetic_01";
    private static final Instant NOW = Instant.parse("2026-09-26T10:00:00Z");

    @Test
    void authorizedCommandPassesExpectedStatusAsPreconditionAndUsesServerRecordedTime() {
        var repository = new FakeOperationsAuthorizationRepository();
        AtomicReference<VisitLifecycleMutationCommandV1> observedCommand = new AtomicReference<>();
        AtomicReference<Instant> observedRecordedAt = new AtomicReference<>();
        VisitLifecycleMutationRepository mutationRepository = (principal, visitId, command, recordedAt) -> {
            observedCommand.set(command);
            observedRecordedAt.set(recordedAt);
            assertEquals("ops_synthetic", principal.operationsPrincipalId());
            assertEquals(VISIT, visitId);
            return VisitLifecycleMutationRepository.Result.withReceipt(
                    VisitLifecycleMutationRepository.Result.Status.ACCEPTED,
                    new VisitLifecycleMutationRepository.Receipt(command.operationId(), visitId, "contacting",
                            null, null, recordedAt));
        };
        VisitLifecycleMutationService service = service(repository, mutationRepository);

        var result = service.mutate(VISIT, CREDENTIAL, request("requested", "contacting",
                "follow_up_underway", null, null));

        assertEquals(VisitLifecycleMutationService.Result.Status.ACCEPTED, result.status());
        assertEquals("requested", observedCommand.get().expectedStatus());
        assertEquals("contacting", observedCommand.get().targetStatus());
        assertEquals(NOW, observedRecordedAt.get());
        assertEquals(NOW, result.receipt().recordedAt());
    }

    @Test
    void missingInvalidOrRevokedPrincipalFailsBeforeMutationRepository() {
        var repository = new FakeOperationsAuthorizationRepository();
        AtomicReference<Boolean> mutationCalled = new AtomicReference<>(false);
        VisitLifecycleMutationRepository mutationRepository = (principal, visitId, command, recordedAt) -> {
            mutationCalled.set(true);
            return VisitLifecycleMutationRepository.Result.of(VisitLifecycleMutationRepository.Result.Status.ACCEPTED);
        };
        VisitLifecycleMutationService service = service(repository, mutationRepository);

        assertEquals(VisitLifecycleMutationService.Result.Status.AUTH_REQUIRED,
                service.mutate(VISIT, null, request("requested", "contacting", "follow_up_underway", null, null)).status());
        assertEquals(VisitLifecycleMutationService.Result.Status.AUTH_REQUIRED,
                service.mutate(VISIT, "invalid", request("requested", "contacting", "follow_up_underway", null, null)).status());
        repository.credentialState = "REVOKED";
        assertEquals(VisitLifecycleMutationService.Result.Status.AUTH_REQUIRED,
                service.mutate(VISIT, CREDENTIAL, request("requested", "contacting", "follow_up_underway", null, null)).status());
        assertFalse(mutationCalled.get());
    }

    @Test
    void hiddenObjectScopeAndMalformedInputsNeverReachMutationRepository() {
        var repository = new FakeOperationsAuthorizationRepository();
        AtomicReference<Boolean> mutationCalled = new AtomicReference<>(false);
        VisitLifecycleMutationRepository mutationRepository = (principal, visitId, command, recordedAt) -> {
            mutationCalled.set(true);
            return VisitLifecycleMutationRepository.Result.of(VisitLifecycleMutationRepository.Result.Status.TECHNICAL_FAILURE);
        };
        VisitLifecycleMutationService service = service(repository, mutationRepository);
        repository.authorization = OperationsAuthorizationRepository.AuthorizationResolution.Status.DENIED_OR_HIDDEN;
        assertEquals(VisitLifecycleMutationService.Result.Status.NOT_FOUND,
                service.mutate(VISIT, CREDENTIAL, request("requested", "contacting", "follow_up_underway", null, null)).status());

        repository.authorization = OperationsAuthorizationRepository.AuthorizationResolution.Status.AUTHORIZED;
        assertEquals(VisitLifecycleMutationService.Result.Status.VALIDATION_FAILED,
                service.mutate(VISIT, CREDENTIAL, request("requested", "completed", "user_says_visited", null, null)).status());
        assertEquals(VisitLifecycleMutationService.Result.Status.NOT_FOUND,
                service.mutate("*", CREDENTIAL, request("requested", "contacting", "follow_up_underway", null, null)).status());
        assertFalse(mutationCalled.get());
    }

    private static VisitLifecycleMutationService service(FakeOperationsAuthorizationRepository operations,
                                                         VisitLifecycleMutationRepository mutationRepository) {
        var hasher = new Sha256OperationsCredentialHasher();
        return new VisitLifecycleMutationService(new OperationsPrincipalResolver(operations, hasher),
                new OperationsVisitAuthorizationResolver(operations), mutationRepository,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static VisitLifecycleMutationService.Request request(String expected, String target,
                                                                 String evidenceKind, String evidenceReference,
                                                                 String factAt) {
        return new VisitLifecycleMutationService.Request("operation-synthetic-01", expected, target,
                evidenceKind, evidenceReference, factAt);
    }

    private static final class FakeOperationsAuthorizationRepository implements OperationsAuthorizationRepository {
        private String credentialState = "ACTIVE";
        private AuthorizationResolution.Status authorization = AuthorizationResolution.Status.AUTHORIZED;

        @Override
        public AuthenticationResolution resolveCredential(String digest) {
            assertFalse(digest.contains(CREDENTIAL), "repository receives only a digest");
            return new AuthenticationResolution("ACTIVE".equals(credentialState)
                    ? AuthenticationResolution.Status.ACTIVE : AuthenticationResolution.Status.REVOKED,
                    "ACTIVE".equals(credentialState) ? "ops_synthetic" : null);
        }

        @Override public AuthorizationResolution authorizeVisit(String operationsPrincipalId, String visitId) {
            assertEquals("ops_synthetic", operationsPrincipalId);
            return new AuthorizationResolution(authorization);
        }

        @Override public ProvisioningResolution applyProvisioning(ProvisioningCommand command, Instant acceptedAt) {
            return new ProvisioningResolution(ProvisioningResolution.Status.TECHNICAL_FAILURE);
        }
    }
}
