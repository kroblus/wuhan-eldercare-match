package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class CanonicalPayloadHasher {
    public String hash(SubmissionCommandV1 command) {
        if (command == null || command.elderId() == null || command.elderId().isBlank()) {
            throw new IllegalArgumentException("canonical server-resolved Elder ID required");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(command.canonicalMaterial().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    /** Hashes the frozen canonical command after replacing an optional client Elder assertion with server truth. */
    public String hash(SubmissionCommandV1 command, String canonicalElderId) {
        if (canonicalElderId == null || canonicalElderId.isBlank()) {
            throw new IllegalArgumentException("canonical server-resolved Elder ID required");
        }
        return hash(command.withElderId(canonicalElderId));
    }
}
