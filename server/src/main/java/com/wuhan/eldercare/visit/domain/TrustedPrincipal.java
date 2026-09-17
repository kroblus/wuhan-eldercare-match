package com.wuhan.eldercare.visit.domain;

public record TrustedPrincipal(String userId) {
    public TrustedPrincipal {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("userId must be non-blank");
        }
        userId = userId.trim();
    }
}
