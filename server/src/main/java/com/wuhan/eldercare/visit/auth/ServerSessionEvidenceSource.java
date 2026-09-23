package com.wuhan.eldercare.visit.auth;

import java.security.SecureRandom;
import java.util.Base64;

@FunctionalInterface
public interface ServerSessionEvidenceSource {
    String newSessionEvidence();

    static ServerSessionEvidenceSource production() {
        SecureRandom random = new SecureRandom();
        return () -> {
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        };
    }
}
