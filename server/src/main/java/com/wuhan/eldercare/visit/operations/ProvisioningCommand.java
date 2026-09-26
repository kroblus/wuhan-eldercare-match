package com.wuhan.eldercare.visit.operations;

import java.util.List;

/** Validated provisioning intent. Credential material is represented only by its digest. */
public record ProvisioningCommand(
        String operationId,
        Action action,
        String intentFingerprint,
        String operationsPrincipalId,
        String credentialDigest,
        String verifiedActorReference,
        String approvalReference,
        String provisioningActorReference,
        List<String> visitIds
) {
    public ProvisioningCommand {
        if (operationId == null || action == null || intentFingerprint == null
                || operationsPrincipalId == null || approvalReference == null
                || provisioningActorReference == null || visitIds == null) {
            throw new IllegalArgumentException("validated provisioning fields required");
        }
        visitIds = List.copyOf(visitIds);
    }

    public enum Action { PROVISION_PRINCIPAL, GRANT_VISIT, REVOKE_GRANT, REVOKE_PRINCIPAL }

    public String singleVisitId() {
        return visitIds.size() == 1 ? visitIds.getFirst() : null;
    }
}
