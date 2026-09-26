package com.wuhan.eldercare.visit.institution.application;

import java.util.Objects;

/** Reads the explicitly persisted current-head fact. */
public final class InstitutionCurrentHeadReader {
    private final InstitutionRevisionRepository repository;

    public InstitutionCurrentHeadReader(InstitutionRevisionRepository repository) {
        this.repository = Objects.requireNonNull(repository);
    }

    public InstitutionRevisionRepository.CurrentHeadResult read(String institutionId) {
        if (institutionId == null || institutionId.isBlank() || institutionId.length() > 200) {
            return InstitutionRevisionRepository.CurrentHeadResult.unavailable();
        }
        return repository.currentHead(institutionId);
    }
}
