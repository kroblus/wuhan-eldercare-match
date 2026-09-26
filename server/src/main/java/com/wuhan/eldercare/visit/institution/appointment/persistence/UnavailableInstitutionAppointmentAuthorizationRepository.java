package com.wuhan.eldercare.visit.institution.appointment.persistence;

import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationRepository;

public final class UnavailableInstitutionAppointmentAuthorizationRepository
        implements InstitutionAppointmentAuthorizationRepository {
    @Override
    public Lookup latest(String institutionId, long recordRevision) {
        return Lookup.of(Lookup.Status.UNAVAILABLE);
    }

    @Override
    public Apply append(Event event) {
        return Apply.of(Apply.Status.UNAVAILABLE);
    }
}
