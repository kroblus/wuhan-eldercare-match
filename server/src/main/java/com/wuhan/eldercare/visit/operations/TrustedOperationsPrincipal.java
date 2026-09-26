package com.wuhan.eldercare.visit.operations;

import com.fasterxml.jackson.annotation.JsonIgnore;

/** Opaque, server-resolved Operations identity. Only the credential resolver can construct it. */
public final class TrustedOperationsPrincipal {
    private final String operationsPrincipalId;
    private final String credentialDigest;

    TrustedOperationsPrincipal(String operationsPrincipalId) {
        this(operationsPrincipalId, null);
    }

    TrustedOperationsPrincipal(String operationsPrincipalId, String credentialDigest) {
        if (operationsPrincipalId == null || operationsPrincipalId.isBlank()) {
            throw new IllegalArgumentException("operations principal id required");
        }
        this.operationsPrincipalId = operationsPrincipalId;
        this.credentialDigest = credentialDigest;
    }

    public String operationsPrincipalId() {
        return operationsPrincipalId;
    }

    /** Internal transaction recheck only. Never return, serialize, or log this verifier. */
    @JsonIgnore
    public String credentialDigestForTransaction() {
        return credentialDigest;
    }

    @Override
    public String toString() {
        return "TrustedOperationsPrincipal[resolved]";
    }
}
