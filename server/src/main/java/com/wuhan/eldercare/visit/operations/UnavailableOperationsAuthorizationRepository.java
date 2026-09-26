package com.wuhan.eldercare.visit.operations;

import java.time.Instant;

/** Fail-closed repository boundary when durable persistence is disabled. */
public final class UnavailableOperationsAuthorizationRepository implements OperationsAuthorizationRepository {
    @Override
    public AuthenticationResolution resolveCredential(String credentialDigest) {
        return new AuthenticationResolution(AuthenticationResolution.Status.UNAVAILABLE, null);
    }

    @Override
    public AuthorizationResolution authorizeVisit(String operationsPrincipalId, String visitId) {
        return new AuthorizationResolution(AuthorizationResolution.Status.UNAVAILABLE);
    }

    @Override
    public ProvisioningResolution applyProvisioning(ProvisioningCommand command, Instant acceptedAt) {
        return new ProvisioningResolution(ProvisioningResolution.Status.UNAVAILABLE);
    }
}
