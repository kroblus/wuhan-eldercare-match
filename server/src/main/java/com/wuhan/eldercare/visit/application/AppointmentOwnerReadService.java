package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.institution.application.InstitutionHistoricalPublicNameResolver;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Resolves a C5 session before reading and projecting only that owner's Visits. */
public final class AppointmentOwnerReadService {
    private static final Set<String> C1_VISIT_STATUSES = Set.of(
            "requested", "contacting", "scheduled", "completed", "cancelled");
    private static final long MAX_SAFE_REVISION = 9_007_199_254_740_991L;

    private final AuthEvidenceResolver authEvidenceResolver;
    private final AppointmentOwnerReadRepository repository;
    private final InstitutionHistoricalPublicNameResolver institutionNameResolver;

    public AppointmentOwnerReadService(
            AuthEvidenceResolver authEvidenceResolver,
            AppointmentOwnerReadRepository repository,
            InstitutionHistoricalPublicNameResolver institutionNameResolver
    ) {
        if (authEvidenceResolver == null || repository == null || institutionNameResolver == null) {
            throw new IllegalArgumentException("Appointment owner-read dependencies required");
        }
        this.authEvidenceResolver = authEvidenceResolver;
        this.repository = repository;
        this.institutionNameResolver = institutionNameResolver;
    }

    public Result load(String authEvidence) {
        AuthEvidenceResolver.Resolution auth;
        try {
            auth = authEvidenceResolver.resolve(authEvidence);
        } catch (RuntimeException ignored) {
            return Result.authenticationFailure(AuthResolution.TECHNICAL_FAILURE);
        }
        if (auth == null || auth.status() == null) {
            return Result.authenticationFailure(AuthResolution.TECHNICAL_FAILURE);
        }

        AuthResolution authResolution = AuthResolution.from(auth.status());
        if (authResolution != AuthResolution.AUTHENTICATED) {
            return Result.authenticationFailure(authResolution);
        }
        TrustedPrincipal principal = auth.principal();
        if (principal == null) return Result.authenticationFailure(AuthResolution.TECHNICAL_FAILURE);

        AppointmentOwnerReadRepository.Result read;
        try {
            read = repository.findAllOwned(principal);
        } catch (RuntimeException ignored) {
            read = AppointmentOwnerReadRepository.Result.technicalFailure();
        }
        if (read == null || read.status() == null) {
            return Result.authenticated(Availability.TECHNICAL_FAILURE, null);
        }
        return switch (read.status()) {
            case UNAVAILABLE -> Result.authenticated(Availability.UNAVAILABLE, null);
            case TECHNICAL_FAILURE -> Result.authenticated(Availability.TECHNICAL_FAILURE, null);
            case READY -> mapReadyCollection(read.visits());
        };
    }

    private Result mapReadyCollection(List<AppointmentOwnerReadRepository.OwnedVisit> visits) {
        if (visits == null) return Result.authenticated(Availability.TECHNICAL_FAILURE, null);
        List<AppointmentListItem> items = new ArrayList<>(visits.size());
        for (AppointmentOwnerReadRepository.OwnedVisit visit : visits) {
            Mapping mapping = mapVisit(visit);
            if (mapping.technicalFailure()) {
                // A partial result could look like a complete owner collection, so fail closed.
                return Result.authenticated(Availability.TECHNICAL_FAILURE, null);
            }
            items.add(mapping.item());
        }
        return Result.authenticated(Availability.READY, List.copyOf(items));
    }

    private Mapping mapVisit(AppointmentOwnerReadRepository.OwnedVisit visit) {
        if (visit == null || blank(visit.visitId()) || visit.visitId().length() > 200
                || blank(visit.institutionId()) || visit.institutionId().length() > 200
                || blank(visit.institutionRecordRevision()) || visit.institutionRecordRevision().length() > 200
                || !C1_VISIT_STATUSES.contains(visit.visitStatus())
                || blank(visit.visitDate()) || visit.visitDate().length() > 32
                || blank(visit.visitTimePreference()) || visit.visitTimePreference().length() > 128
                || visit.participantCount() <= 0) {
            return Mapping.failure();
        }

        InstitutionDisplay display = resolveExactInstitutionDisplay(visit);
        if (display == null) return Mapping.failure();
        return Mapping.ready(new AppointmentListItem(
                visit.visitId(), visit.institutionId(), visit.institutionRecordRevision(), visit.visitStatus(),
                visit.visitDate(), visit.visitTimePreference(), visit.participantCount(),
                visit.pickupRequested(), display));
    }

    /** A null result denotes a resolver technical failure; malformed/missing exact revisions stay unavailable. */
    private InstitutionDisplay resolveExactInstitutionDisplay(AppointmentOwnerReadRepository.OwnedVisit visit) {
        long revision;
        try {
            revision = Long.parseLong(visit.institutionRecordRevision());
        } catch (NumberFormatException ignored) {
            return InstitutionDisplay.unavailable();
        }
        if (revision < 1 || revision > MAX_SAFE_REVISION) return InstitutionDisplay.unavailable();

        InstitutionRevisionRepository.ExactPublicNameResult result;
        try {
            result = institutionNameResolver.resolve(visit.institutionId(), revision);
        } catch (RuntimeException ignored) {
            return null;
        }
        if (result == null || result.status() == null) return null;
        return switch (result.status()) {
            case UNAVAILABLE -> InstitutionDisplay.unavailable();
            case TECHNICAL_FAILURE -> null;
            case READY -> visit.institutionId().equals(result.institutionId())
                    && result.recordRevision() != null && result.recordRevision() == revision
                    && !blank(result.publicName()) && result.publicName().length() <= 200
                    ? InstitutionDisplay.ready(result.publicName())
                    : null;
        };
    }

    public enum AuthResolution {
        AUTHENTICATED("authenticated"), MISSING("missing"), EXPIRED("expired"), INVALID("invalid"),
        UNAVAILABLE("unavailable"), TECHNICAL_FAILURE("technical_failure");

        private final String wireValue;

        AuthResolution(String wireValue) { this.wireValue = wireValue; }

        public String wireValue() { return wireValue; }

        static AuthResolution from(AuthEvidenceResolver.Resolution.Status status) {
            return switch (status) {
                case AUTHENTICATED -> AUTHENTICATED;
                case MISSING -> MISSING;
                case EXPIRED -> EXPIRED;
                case INVALID -> INVALID;
                case UNAVAILABLE -> UNAVAILABLE;
                case TECHNICAL_FAILURE -> TECHNICAL_FAILURE;
            };
        }
    }

    public enum Availability {
        READY("ready"), UNAVAILABLE("unavailable"), TECHNICAL_FAILURE("technical_failure");

        private final String wireValue;

        Availability(String wireValue) { this.wireValue = wireValue; }

        public String wireValue() { return wireValue; }
    }

    public enum DisplayAvailability {
        READY("ready"), UNAVAILABLE("unavailable");

        private final String wireValue;

        DisplayAvailability(String wireValue) { this.wireValue = wireValue; }

        public String wireValue() { return wireValue; }
    }

    public record InstitutionDisplay(DisplayAvailability availability, String name) {
        public InstitutionDisplay {
            if (availability == null) throw new IllegalArgumentException("institution display availability required");
            if ((availability == DisplayAvailability.READY) != !blank(name)) {
                throw new IllegalArgumentException("institution name must match display availability");
            }
        }

        static InstitutionDisplay ready(String name) {
            return new InstitutionDisplay(DisplayAvailability.READY, name);
        }

        static InstitutionDisplay unavailable() {
            return new InstitutionDisplay(DisplayAvailability.UNAVAILABLE, null);
        }
    }

    public record AppointmentListItem(
            String visitId,
            String institutionId,
            String institutionRecordRevision,
            String visitStatus,
            String visitDate,
            String visitTimePreference,
            int participantCount,
            Boolean pickupRequested,
            InstitutionDisplay institutionDisplay
    ) { }

    public record Result(AuthResolution authResolution, Availability availability, List<AppointmentListItem> items) {
        public Result {
            if (authResolution == null) throw new IllegalArgumentException("authResolution required");
            if (authResolution == AuthResolution.AUTHENTICATED) {
                if (availability == null) throw new IllegalArgumentException("authenticated result requires availability");
                if ((availability == Availability.READY) != (items != null)) {
                    throw new IllegalArgumentException("items only belong to ready result");
                }
                if (items != null) items = List.copyOf(items);
            } else if (availability != null || items != null) {
                throw new IllegalArgumentException("unauthenticated result cannot contain Visit data");
            }
        }

        static Result authenticationFailure(AuthResolution resolution) {
            if (resolution == AuthResolution.AUTHENTICATED) {
                throw new IllegalArgumentException("authenticated resolution requires availability");
            }
            return new Result(resolution, null, null);
        }

        static Result authenticated(Availability availability, List<AppointmentListItem> items) {
            return new Result(AuthResolution.AUTHENTICATED, availability, items);
        }
    }

    private record Mapping(AppointmentListItem item, boolean technicalFailure) {
        private static Mapping ready(AppointmentListItem item) { return new Mapping(item, false); }
        private static Mapping failure() { return new Mapping(null, true); }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
