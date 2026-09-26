package com.wuhan.eldercare.visit.institution.appointment.application;

import java.time.Clock;

/** Controlled deployment capability; not exposed as a user or operations HTTP endpoint. */
public final class InstitutionAppointmentAuthorizationProvisioner {
    private final InstitutionAppointmentAuthorizationRepository authorizations;
    private final InstitutionAppointmentEligibilityResolver eligibility;
    private final Clock clock;

    public InstitutionAppointmentAuthorizationProvisioner(
            InstitutionAppointmentAuthorizationRepository authorizations,
            InstitutionAppointmentEligibilityResolver eligibility,
            Clock clock) {
        if (authorizations == null || eligibility == null || clock == null) {
            throw new IllegalArgumentException("appointment authorization provisioning dependencies required");
        }
        this.authorizations = authorizations;
        this.eligibility = eligibility;
        this.clock = clock;
    }

    public Result apply(InstitutionAppointmentAuthorizationPackageV1 request) {
        if (request == null) return Result.of(Status.INVALID);
        if (request.action() == InstitutionAppointmentAuthorizationPackageV1.Action.AUTHORIZE) {
            InstitutionAppointmentEligibilityResolver.CurrentPublished current = eligibility.verifyCurrentPublished(
                    request.institutionId(), request.recordRevision());
            if (current == null || current.status() != InstitutionAppointmentEligibilityResolver.CurrentPublished.Status.READY) {
                return Result.of(mapTargetFailure(current == null ? null : current.status()));
            }
        }

        InstitutionAppointmentAuthorizationRepository.Event event;
        try {
            event = new InstitutionAppointmentAuthorizationRepository.Event(
                    request.operationId(), request.institutionId(), request.recordRevision(),
                    request.action() == InstitutionAppointmentAuthorizationPackageV1.Action.AUTHORIZE
                            ? InstitutionAppointmentAuthorizationRepository.Event.State.AUTHORIZED
                            : InstitutionAppointmentAuthorizationRepository.Event.State.REVOKED,
                    request.provenanceReference(), request.operatorReference(), clock.instant());
        } catch (RuntimeException ignored) {
            return Result.of(Status.INVALID);
        }

        InstitutionAppointmentAuthorizationRepository.Apply persisted;
        try {
            persisted = authorizations.append(event);
        } catch (RuntimeException ignored) {
            return Result.of(Status.TECHNICAL_FAILURE);
        }
        if (persisted == null || persisted.status() == null) return Result.of(Status.TECHNICAL_FAILURE);
        return Result.of(switch (persisted.status()) {
            case APPLIED -> Status.APPLIED;
            case REPLAYED -> Status.REPLAYED;
            case CONFLICT -> Status.CONFLICT;
            case INVALID -> Status.INVALID;
            case UNAVAILABLE -> Status.UNAVAILABLE;
            case TECHNICAL_FAILURE -> Status.TECHNICAL_FAILURE;
        });
    }

    private static Status mapTargetFailure(InstitutionAppointmentEligibilityResolver.CurrentPublished.Status status) {
        if (status == null) return Status.TECHNICAL_FAILURE;
        return switch (status) {
            case READY -> Status.APPLIED;
            case INVALID, NOT_FOUND, NOT_CURRENT, NOT_PUBLISHED -> Status.INVALID;
            case UNAVAILABLE -> Status.UNAVAILABLE;
            case TECHNICAL_FAILURE -> Status.TECHNICAL_FAILURE;
        };
    }

    public enum Status { APPLIED, REPLAYED, CONFLICT, INVALID, UNAVAILABLE, TECHNICAL_FAILURE }

    public record Result(Status status) {
        public Result {
            if (status == null) throw new IllegalArgumentException("provisioning result status required");
        }
        public static Result of(Status status) { return new Result(status); }
    }
}
