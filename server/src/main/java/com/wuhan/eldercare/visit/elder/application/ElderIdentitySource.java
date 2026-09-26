package com.wuhan.eldercare.visit.elder.application;

import java.time.Instant;

/** Server-owned identity and clock source for persistent ElderRecord creation. */
public interface ElderIdentitySource {
    String newElderId();

    Instant createdAt();
}
