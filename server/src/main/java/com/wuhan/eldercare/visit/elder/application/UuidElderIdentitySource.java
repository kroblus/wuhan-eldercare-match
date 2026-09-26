package com.wuhan.eldercare.visit.elder.application;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

public final class UuidElderIdentitySource implements ElderIdentitySource {
    private final Clock clock;

    public UuidElderIdentitySource(Clock clock) {
        if (clock == null) throw new IllegalArgumentException("Elder identity clock required");
        this.clock = clock;
    }

    @Override
    public String newElderId() {
        return "elder_" + UUID.randomUUID();
    }

    @Override
    public Instant createdAt() {
        return clock.instant();
    }
}
