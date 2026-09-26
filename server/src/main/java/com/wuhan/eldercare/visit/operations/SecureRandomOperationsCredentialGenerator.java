package com.wuhan.eldercare.visit.operations;

import java.security.SecureRandom;
import java.util.Base64;

/** Issues an opaque credential from 256 bits of SecureRandom entropy. */
public final class SecureRandomOperationsCredentialGenerator implements OperationsCredentialGenerator {
    private static final String PREFIX = "ops1_";
    private final SecureRandom secureRandom;

    public SecureRandomOperationsCredentialGenerator() {
        this(new SecureRandom());
    }

    SecureRandomOperationsCredentialGenerator(SecureRandom secureRandom) {
        if (secureRandom == null) throw new IllegalArgumentException("secure random required");
        this.secureRandom = secureRandom;
    }

    @Override
    public String generate() {
        byte[] entropy = new byte[32];
        secureRandom.nextBytes(entropy);
        try {
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(entropy);
        } finally {
            java.util.Arrays.fill(entropy, (byte) 0);
        }
    }
}
