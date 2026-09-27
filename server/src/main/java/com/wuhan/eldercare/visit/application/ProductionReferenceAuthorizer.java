package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentEligibilityResolver;

import java.sql.Connection;

/** Canonical C3 reference checks, with transaction-scoped locking for formal Visit creation. */
public final class ProductionReferenceAuthorizer implements ReferenceAuthorizer {
    private final ElderRecordService elders;
    private final InstitutionAppointmentEligibilityResolver institutions;

    public ProductionReferenceAuthorizer(ElderRecordService elders,
                                         InstitutionAppointmentEligibilityResolver institutions) {
        if (elders == null || institutions == null) {
            throw new IllegalArgumentException("canonical reference dependencies required");
        }
        this.elders = elders;
        this.institutions = institutions;
    }

    @Override
    public Authorization authorize(TrustedPrincipal principal, String elderId,
                                  String institutionId, String institutionRecordRevision) {
        if (principal == null || elderId == null || elderId.isBlank()) return Authorization.INVALID;
        Authorization elder = elders.authorizeAssertion(principal, elderId);
        if (elder != Authorization.AUTHORIZED) return elder;
        return map(institutions.resolve(institutionId, institutionRecordRevision).status());
    }

    @Override
    public Resolution authorize(Connection connection, TrustedPrincipal principal, String elderId,
                                String institutionId, String institutionRecordRevision) {
        if (connection == null || principal == null) return Resolution.of(Authorization.TECHNICAL_FAILURE);
        Resolution elder = elders.authorizeAssertion(connection, principal, elderId);
        if (elder.status() != Authorization.AUTHORIZED) return elder;
        InstitutionAppointmentEligibilityResolver.Result institution =
                institutions.resolve(connection, institutionId, institutionRecordRevision);
        if (institution == null || institution.status() == null) {
            return Resolution.of(Authorization.TECHNICAL_FAILURE);
        }
        Authorization status = map(institution.status());
        return status == Authorization.AUTHORIZED
                ? Resolution.authorized(elder.elderId())
                : Resolution.of(status);
    }

    @Override
    public boolean supportsTransactionalAuthorization() { return true; }

    private static Authorization map(InstitutionAppointmentEligibilityResolver.Status status) {
        if (status == null) return Authorization.TECHNICAL_FAILURE;
        return switch (status) {
            case ELIGIBLE -> Authorization.AUTHORIZED;
            case NOT_FOUND, NOT_CURRENT, NOT_PUBLISHED, NOT_AUTHORIZED -> Authorization.UNAUTHORIZED;
            case INVALID -> Authorization.INVALID;
            case UNAVAILABLE -> Authorization.UNAVAILABLE;
            case TECHNICAL_FAILURE -> Authorization.TECHNICAL_FAILURE;
        };
    }
}
