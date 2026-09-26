package com.wuhan.eldercare.visit.lifecycle;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

final class VisitLifecycleRequestFingerprintV1 {
    private VisitLifecycleRequestFingerprintV1() { }

    static String digest(String expectedStatus, String targetStatus, VisitLifecycleEvidenceV1 evidence) {
        String kind = evidence == null ? "" : evidence.kind().wireValue();
        String reference = evidence == null || evidence.reference() == null ? "" : evidence.reference();
        String factAt = evidence == null || evidence.factAt() == null ? "" : evidence.factAt().toString();
        // Length-prefix fields so separators inside a field cannot create the same logical fingerprint.
        String canonical = encode(expectedStatus) + encode(targetStatus) + encode(kind) + encode(reference) + encode(factAt);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    private static String encode(String value) {
        return value.length() + ":" + value;
    }
}
