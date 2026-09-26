package com.wuhan.eldercare.visit.institution.persistence;

import com.wuhan.eldercare.visit.institution.application.InstitutionPublishPackageV1;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishResult;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;

import java.time.Instant;

public final class UnavailableInstitutionRevisionRepository implements InstitutionRevisionRepository {
    @Override
    public InstitutionPublishResult publish(InstitutionPublishPackageV1 publishPackage, Instant publishedAt) {
        return InstitutionPublishResult.of(InstitutionPublishResult.Status.UNAVAILABLE);
    }

    @Override
    public CurrentHeadResult currentHead(String institutionId) {
        return CurrentHeadResult.unavailable();
    }

    @Override
    public ExactPublicNameResult resolveExactPublicName(String institutionId, long recordRevision) {
        return ExactPublicNameResult.unavailable();
    }

    @Override
    public CurrentAppointmentRevisionResult resolveCurrentAppointmentRevision(String institutionId, long requestedRevision) {
        return CurrentAppointmentRevisionResult.unavailable();
    }
}
