package com.wuhan.eldercare.visit.operations;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OperationsPrincipalResolverTest {
    private static final String CREDENTIAL = "ops1_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
    private static final String PRINCIPAL_ID = "ops_0123456789abcdef";

    @Test
    void validCredentialResolvesStableOpaquePrincipalWithoutExposingEvidence() {
        OperationsAuthorizationRepository repository = mock(OperationsAuthorizationRepository.class);
        OperationsCredentialHasher hasher = new Sha256OperationsCredentialHasher();
        String digest = hasher.digest(CREDENTIAL).orElseThrow();
        when(repository.resolveCredential(digest)).thenReturn(new OperationsAuthorizationRepository.AuthenticationResolution(
                OperationsAuthorizationRepository.AuthenticationResolution.Status.ACTIVE, PRINCIPAL_ID));

        var first = new OperationsPrincipalResolver(repository, hasher).resolve(CREDENTIAL);
        var second = new OperationsPrincipalResolver(repository, hasher).resolve(CREDENTIAL);

        assertEquals(OperationsPrincipalResolver.Resolution.Status.READY, first.status());
        assertEquals(PRINCIPAL_ID, first.principal().operationsPrincipalId());
        assertEquals(first.principal().operationsPrincipalId(), second.principal().operationsPrincipalId());
        assertTrue(first.principal().toString().contains("resolved"));
        assertTrue(!first.principal().toString().contains(CREDENTIAL));
    }

    @Test
    void missingInvalidAndC5EvidenceCannotResolveAnOperationsPrincipal() {
        OperationsAuthorizationRepository repository = mock(OperationsAuthorizationRepository.class);
        var resolver = new OperationsPrincipalResolver(repository, new Sha256OperationsCredentialHasher());

        assertEquals(OperationsPrincipalResolver.Resolution.Status.AUTH_REQUIRED_OR_INVALID,
                resolver.resolve(null).status());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.AUTH_REQUIRED_OR_INVALID,
                resolver.resolve("c5-session-like-evidence").status());
        verify(repository, never()).resolveCredential(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void revokedUnavailableAndTechnicalResultsAreStable() {
        OperationsAuthorizationRepository repository = mock(OperationsAuthorizationRepository.class);
        String digest = new Sha256OperationsCredentialHasher().digest(CREDENTIAL).orElseThrow();
        when(repository.resolveCredential(digest)).thenReturn(
                new OperationsAuthorizationRepository.AuthenticationResolution(
                        OperationsAuthorizationRepository.AuthenticationResolution.Status.REVOKED, null),
                new OperationsAuthorizationRepository.AuthenticationResolution(
                        OperationsAuthorizationRepository.AuthenticationResolution.Status.UNAVAILABLE, null),
                new OperationsAuthorizationRepository.AuthenticationResolution(
                        OperationsAuthorizationRepository.AuthenticationResolution.Status.TECHNICAL_FAILURE, null));
        var resolver = new OperationsPrincipalResolver(repository, new Sha256OperationsCredentialHasher());

        assertEquals(OperationsPrincipalResolver.Resolution.Status.REVOKED_OR_DISABLED,
                resolver.resolve(CREDENTIAL).status());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.UNAVAILABLE,
                resolver.resolve(CREDENTIAL).status());
        assertEquals(OperationsPrincipalResolver.Resolution.Status.TECHNICAL_FAILURE,
                resolver.resolve(CREDENTIAL).status());
    }
}
