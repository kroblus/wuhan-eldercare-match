package com.wuhan.eldercare.visit.application;

import java.time.Instant;

public interface ServerIdentitySource {
    String newVisitId();

    Instant now();
}
