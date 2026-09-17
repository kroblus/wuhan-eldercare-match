package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class CanonicalPayloadHasher {
    public String hash(SubmissionCommandV1 command) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(command.canonicalMaterial().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }
}
