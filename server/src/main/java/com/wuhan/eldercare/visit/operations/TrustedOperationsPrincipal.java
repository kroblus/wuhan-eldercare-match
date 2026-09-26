package com.wuhan.eldercare.visit.operations;

/** Opaque, server-resolved Operations identity. Only the credential resolver can construct it. */
public final class TrustedOperationsPrincipal {
    private final String operationsPrincipalId;

    TrustedOperationsPrincipal(String operationsPrincipalId) {
        if (operationsPrincipalId == null || operationsPrincipalId.isBlank()) {
            throw new IllegalArgumentException("operations principal id required");
        }
        this.operationsPrincipalId = operationsPrincipalId;
    }

    public String operationsPrincipalId() {
        return operationsPrincipalId;
    }

    @Override
    public String toString() {
        return "TrustedOperationsPrincipal[resolved]";
    }
}
