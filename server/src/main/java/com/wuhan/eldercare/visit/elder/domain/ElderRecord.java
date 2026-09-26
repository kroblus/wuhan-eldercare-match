package com.wuhan.eldercare.visit.elder.domain;

import java.time.Instant;

/** Stable subject identity only; Assessment and ElderProfile data remain in their owning domains. */
public record ElderRecord(String elderId, String responsibleUserId, Instant createdAt) {
    public ElderRecord {
        if (elderId == null || elderId.isBlank() || elderId.length() > 200) {
            throw new IllegalArgumentException("elderId required");
        }
        if (responsibleUserId == null || responsibleUserId.isBlank() || responsibleUserId.length() > 200) {
            throw new IllegalArgumentException("responsible user required");
        }
        if (createdAt == null) throw new IllegalArgumentException("createdAt required");
        elderId = elderId.trim();
        responsibleUserId = responsibleUserId.trim();
    }
}
