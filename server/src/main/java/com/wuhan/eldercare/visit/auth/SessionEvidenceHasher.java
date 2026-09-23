package com.wuhan.eldercare.visit.auth;

import java.util.Optional;

/** One-way representation for self-owned session evidence. */
public interface SessionEvidenceHasher {
    Optional<String> digest(String sessionEvidence);
}
