package com.wuhan.eldercare.visit.application;

import java.time.Instant;

/** Server authority for evaluation identity and submission time. */
public interface VisitEvaluationIdentitySource {
    String newEvaluationId();

    Instant submittedAt();
}
