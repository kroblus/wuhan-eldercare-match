package com.wuhan.eldercare.visit.operations;

import java.time.Instant;

/** Durable Operations identity, exact Visit grant, and controlled-provisioning port. */
public interface OperationsAuthorizationRepository {
    AuthenticationResolution resolveCredential(String credentialDigest);

    AuthorizationResolution authorizeVisit(String operationsPrincipalId, String visitId);

    ProvisioningResolution applyProvisioning(ProvisioningCommand command, Instant acceptedAt);

    record AuthenticationResolution(Status status, String operationsPrincipalId) {
        public enum Status { ACTIVE, REVOKED, UNKNOWN, UNAVAILABLE, TECHNICAL_FAILURE }

        public AuthenticationResolution {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.ACTIVE) != (operationsPrincipalId != null && !operationsPrincipalId.isBlank())) {
                throw new IllegalArgumentException("principal id only belongs to active credential");
            }
        }
    }

    record AuthorizationResolution(Status status) {
        public enum Status { AUTHORIZED, DENIED_OR_HIDDEN, UNAVAILABLE, TECHNICAL_FAILURE }

        public AuthorizationResolution {
            if (status == null) throw new IllegalArgumentException("status required");
        }
    }

    record ProvisioningResolution(Status status) {
        public enum Status {
            APPLIED, REPLAYED, CONFLICT, INVALID, UNKNOWN_VISIT, PRINCIPAL_NOT_FOUND,
            PRINCIPAL_REVOKED, GRANT_NOT_FOUND, ALREADY_REVOKED, UNAVAILABLE, TECHNICAL_FAILURE
        }

        public ProvisioningResolution {
            if (status == null) throw new IllegalArgumentException("status required");
        }
    }
}
