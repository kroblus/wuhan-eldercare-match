package com.wuhan.eldercare.visit.operations;

import java.util.Optional;

/** One-way digest boundary for high-entropy Operations bearer evidence. */
public interface OperationsCredentialHasher {
    Optional<String> digest(String credentialEvidence);
}
