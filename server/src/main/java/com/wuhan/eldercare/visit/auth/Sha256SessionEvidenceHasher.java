package com.wuhan.eldercare.visit.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;

public final class Sha256SessionEvidenceHasher implements SessionEvidenceHasher {
    @Override
    public Optional<String> digest(String sessionEvidence) {
        if (sessionEvidence == null || sessionEvidence.isBlank() || sessionEvidence.length() > 4096) {
            return Optional.empty();
        }
        try {
            return Optional.of(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(sessionEvidence.trim().getBytes(StandardCharsets.UTF_8))));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }
}
