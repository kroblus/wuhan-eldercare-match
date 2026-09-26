package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentEligibilityResolver;

/** Resolves read-only Elder and Institution reference authority for a future phase-specific consumer. */
public final class ProductionAppointmentReferenceReader implements AppointmentReferenceReader {
    private final ElderRecordService elders;
    private final InstitutionAppointmentEligibilityResolver institutions;

    public ProductionAppointmentReferenceReader(ElderRecordService elders,
                                                InstitutionAppointmentEligibilityResolver institutions) {
        if (elders == null || institutions == null) throw new IllegalArgumentException("reference dependencies required");
        this.elders = elders;
        this.institutions = institutions;
    }

    @Override
    public Result resolve(TrustedPrincipal principal, String elderId, String institutionId,
                          String institutionRecordRevision) {
        ReferenceAuthorizer.Authorization elder = elders.authorizeAssertion(principal, elderId);
        if (elder != ReferenceAuthorizer.Authorization.AUTHORIZED) return Result.of(map(elder));
        InstitutionAppointmentEligibilityResolver.Result institution =
                institutions.resolve(institutionId, institutionRecordRevision);
        if (institution == null || institution.status() == null) {
            return Result.of(Status.TECHNICAL_FAILURE);
        }
        return Result.of(switch (institution.status()) {
            case ELIGIBLE -> Status.AUTHORIZED;
            case INVALID -> Status.INVALID;
            case UNAVAILABLE -> Status.UNAVAILABLE;
            case TECHNICAL_FAILURE -> Status.TECHNICAL_FAILURE;
            case NOT_FOUND, NOT_CURRENT, NOT_PUBLISHED, NOT_AUTHORIZED -> Status.UNAUTHORIZED;
        });
    }

    private static Status map(ReferenceAuthorizer.Authorization authorization) {
        if (authorization == null) return Status.TECHNICAL_FAILURE;
        return switch (authorization) {
            case AUTHORIZED -> Status.AUTHORIZED;
            case UNAUTHORIZED -> Status.UNAUTHORIZED;
            case INVALID -> Status.INVALID;
            case UNAVAILABLE -> Status.UNAVAILABLE;
            case TECHNICAL_FAILURE -> Status.TECHNICAL_FAILURE;
        };
    }
}
