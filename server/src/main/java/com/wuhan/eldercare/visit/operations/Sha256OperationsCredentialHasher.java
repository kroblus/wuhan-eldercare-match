package com.wuhan.eldercare.visit.operations;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;
import java.util.regex.Pattern;

/** SHA-256 is appropriate here because the accepted credential contains 256 random bits. */
public final class Sha256OperationsCredentialHasher implements OperationsCredentialHasher {
    private static final Pattern CREDENTIAL = Pattern.compile("ops1_[A-Za-z0-9_-]{43}");

    @Override
    public Optional<String> digest(String credentialEvidence) {
        if (credentialEvidence == null || !CREDENTIAL.matcher(credentialEvidence).matches()) {
            return Optional.empty();
        }
        try {
            return Optional.of(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(credentialEvidence.getBytes(StandardCharsets.UTF_8))));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }
}
