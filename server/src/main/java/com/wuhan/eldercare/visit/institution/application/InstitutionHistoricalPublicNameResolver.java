package com.wuhan.eldercare.visit.institution.application;

import java.util.Objects;

/** Exact historical display seam for future consumers; it never consults the current head. */
public final class InstitutionHistoricalPublicNameResolver {
    private final InstitutionRevisionRepository repository;

    public InstitutionHistoricalPublicNameResolver(InstitutionRevisionRepository repository) {
        this.repository = Objects.requireNonNull(repository);
    }

    public InstitutionRevisionRepository.ExactPublicNameResult resolve(String institutionId, long recordRevision) {
        if (institutionId == null || institutionId.isBlank() || institutionId.length() > 200 || recordRevision <= 0) {
            return InstitutionRevisionRepository.ExactPublicNameResult.unavailable();
        }
        return repository.resolveExactPublicName(institutionId, recordRevision);
    }
}
