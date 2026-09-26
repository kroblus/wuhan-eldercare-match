package com.wuhan.eldercare.visit.institution.appointment.application;

import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;

/** Resolves current exact publication state and separately checks explicit Operations authorization. */
public final class InstitutionAppointmentEligibilityResolver {
    private static final long MAX_SAFE_REVISION = 9_007_199_254_740_991L;

    private final InstitutionRevisionRepository revisions;
    private final InstitutionAppointmentAuthorizationRepository authorizations;

    public InstitutionAppointmentEligibilityResolver(InstitutionRevisionRepository revisions,
                                                     InstitutionAppointmentAuthorizationRepository authorizations) {
        if (revisions == null || authorizations == null) {
            throw new IllegalArgumentException("Institution appointment eligibility dependencies required");
        }
        this.revisions = revisions;
        this.authorizations = authorizations;
    }

    public Result resolve(String institutionId, String recordRevision) {
        Long revision = parseRevision(recordRevision);
        if (blank(institutionId) || institutionId.length() > 200 || revision == null) {
            return Result.of(Status.INVALID);
        }
        CurrentPublished current = currentPublished(institutionId, revision);
        if (current.status() != CurrentPublished.Status.READY) {
            return Result.of(switch (current.status()) {
                case INVALID -> Status.INVALID;
                case NOT_FOUND -> Status.NOT_FOUND;
                case NOT_CURRENT -> Status.NOT_CURRENT;
                case NOT_PUBLISHED -> Status.NOT_PUBLISHED;
                case UNAVAILABLE -> Status.UNAVAILABLE;
                case TECHNICAL_FAILURE -> Status.TECHNICAL_FAILURE;
                case READY -> throw new IllegalStateException("unreachable");
            });
        }

        InstitutionAppointmentAuthorizationRepository.Lookup authorization;
        try {
            authorization = authorizations.latest(institutionId, revision);
        } catch (RuntimeException ignored) {
            return Result.of(Status.TECHNICAL_FAILURE);
        }
        if (authorization == null || authorization.status() == null) return Result.of(Status.TECHNICAL_FAILURE);
        return Result.of(switch (authorization.status()) {
            case AUTHORIZED -> Status.ELIGIBLE;
            case REVOKED, NOT_CONFIGURED -> Status.NOT_AUTHORIZED;
            case UNAVAILABLE -> Status.UNAVAILABLE;
            case TECHNICAL_FAILURE -> Status.TECHNICAL_FAILURE;
        });
    }

    /** Used only before a controlled provisioner records a positive authorization. */
    public CurrentPublished verifyCurrentPublished(String institutionId, long recordRevision) {
        if (blank(institutionId) || institutionId.length() > 200 || recordRevision < 1
                || recordRevision > MAX_SAFE_REVISION) {
            return CurrentPublished.of(CurrentPublished.Status.INVALID);
        }
        return currentPublished(institutionId, recordRevision);
    }

    private CurrentPublished currentPublished(String institutionId, long requestedRevision) {
        InstitutionRevisionRepository.CurrentAppointmentRevisionResult resolved;
        try {
            resolved = revisions.resolveCurrentAppointmentRevision(institutionId, requestedRevision);
        } catch (RuntimeException ignored) {
            return CurrentPublished.of(CurrentPublished.Status.TECHNICAL_FAILURE);
        }
        if (resolved == null || resolved.status() == null) return CurrentPublished.of(CurrentPublished.Status.TECHNICAL_FAILURE);
        return switch (resolved.status()) {
            case NOT_FOUND -> CurrentPublished.of(CurrentPublished.Status.NOT_FOUND);
            case UNAVAILABLE -> CurrentPublished.of(CurrentPublished.Status.UNAVAILABLE);
            case TECHNICAL_FAILURE -> CurrentPublished.of(CurrentPublished.Status.TECHNICAL_FAILURE);
            case READY -> {
                if (!institutionId.equals(resolved.institutionId()) || resolved.currentRevision() == null
                        || resolved.currentRevision() < 1 || resolved.currentRevision() > MAX_SAFE_REVISION) {
                    yield CurrentPublished.of(CurrentPublished.Status.TECHNICAL_FAILURE);
                }
                if (resolved.currentRevision() != requestedRevision) {
                    yield CurrentPublished.of(CurrentPublished.Status.NOT_CURRENT);
                }
                if (!resolved.exactRevisionFound()) yield CurrentPublished.of(CurrentPublished.Status.NOT_FOUND);
                yield "published".equals(resolved.recordStatus())
                        ? CurrentPublished.ready()
                        : CurrentPublished.of(CurrentPublished.Status.NOT_PUBLISHED);
            }
        };
    }

    private static Long parseRevision(String value) {
        if (blank(value) || !value.equals(value.trim())) return null;
        try {
            long parsed = Long.parseLong(value);
            return parsed >= 1 && parsed <= MAX_SAFE_REVISION ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }

    public enum Status {
        ELIGIBLE, NOT_FOUND, NOT_CURRENT, NOT_PUBLISHED, NOT_AUTHORIZED, INVALID, UNAVAILABLE, TECHNICAL_FAILURE
    }

    public record Result(Status status) {
        public Result {
            if (status == null) throw new IllegalArgumentException("eligibility status required");
        }
        public static Result of(Status status) { return new Result(status); }
    }

    public record CurrentPublished(Status status) {
        public enum Status { READY, NOT_FOUND, NOT_CURRENT, NOT_PUBLISHED, INVALID, UNAVAILABLE, TECHNICAL_FAILURE }
        public CurrentPublished {
            if (status == null) throw new IllegalArgumentException("revision status required");
        }
        public static CurrentPublished ready() { return new CurrentPublished(Status.READY); }
        public static CurrentPublished of(Status status) { return new CurrentPublished(status); }
    }
}
