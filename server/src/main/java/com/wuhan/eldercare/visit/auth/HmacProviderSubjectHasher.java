package com.wuhan.eldercare.visit.auth;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Optional;

public final class HmacProviderSubjectHasher implements ProviderSubjectHasher {
    private final byte[] secret;

    public HmacProviderSubjectHasher(String secret) {
        if (secret == null || secret.isBlank()) throw new IllegalArgumentException("hash secret required");
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public Optional<String> digest(String providerNamespace, String providerSubject) {
        if (providerNamespace == null || providerNamespace.isBlank()
                || providerSubject == null || providerSubject.isBlank()) return Optional.empty();
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            mac.update(providerNamespace.trim().getBytes(StandardCharsets.UTF_8));
            mac.update((byte) 0);
            mac.update(providerSubject.trim().getBytes(StandardCharsets.UTF_8));
            return Optional.of(HexFormat.of().formatHex(mac.doFinal()));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }
}
