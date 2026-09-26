package com.wuhan.eldercare.visit.operations;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OperationsVisitAuthorizationResolverTest {
    @Test
    void exactGrantAuthorizesAndAllMissingOrOutOfScopeCasesAreHidden() {
        OperationsAuthorizationRepository repository = mock(OperationsAuthorizationRepository.class);
        TrustedOperationsPrincipal principal = new TrustedOperationsPrincipal("ops_0123456789abcdef");
        when(repository.authorizeVisit(principal.operationsPrincipalId(), "visit_exact"))
                .thenReturn(new OperationsAuthorizationRepository.AuthorizationResolution(
                        OperationsAuthorizationRepository.AuthorizationResolution.Status.AUTHORIZED));
        when(repository.authorizeVisit(principal.operationsPrincipalId(), "visit-other"))
                .thenReturn(new OperationsAuthorizationRepository.AuthorizationResolution(
                        OperationsAuthorizationRepository.AuthorizationResolution.Status.DENIED_OR_HIDDEN));
        var resolver = new OperationsVisitAuthorizationResolver(repository);

        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.AUTHORIZED,
                resolver.authorize(principal, "visit_exact").status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                resolver.authorize(principal, "visit-other").status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                resolver.authorize(principal, "*").status());
        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.DENIED_OR_HIDDEN,
                resolver.authorize(null, "visit_exact").status());
        verify(repository, never()).authorizeVisit(principal.operationsPrincipalId(), "*");
    }

    @Test
    void repositoryFailureNeverBecomesAuthorization() {
        OperationsAuthorizationRepository repository = mock(OperationsAuthorizationRepository.class);
        TrustedOperationsPrincipal principal = new TrustedOperationsPrincipal("ops_0123456789abcdef");
        when(repository.authorizeVisit(principal.operationsPrincipalId(), "visit_1"))
                .thenReturn(new OperationsAuthorizationRepository.AuthorizationResolution(
                        OperationsAuthorizationRepository.AuthorizationResolution.Status.UNAVAILABLE));

        assertEquals(OperationsVisitAuthorizationResolver.Resolution.Status.UNAVAILABLE,
                new OperationsVisitAuthorizationResolver(repository).authorize(principal, "visit_1").status());
    }
}
