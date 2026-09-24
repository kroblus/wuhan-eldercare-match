package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import java.util.Set;

/** Resolves a C5 session and returns only an owner's authoritative Evaluation context. */
public final class VisitEvaluationContextService {
    private static final Set<String> C1_VISIT_STATUSES = Set.of(
            "requested", "contacting", "scheduled", "completed", "cancelled");

    private final AuthEvidenceResolver authEvidenceResolver;
    private final VisitEvaluationContextRepository repository;

    public VisitEvaluationContextService(
            AuthEvidenceResolver authEvidenceResolver,
            VisitEvaluationContextRepository repository
    ) {
        if (authEvidenceResolver == null || repository == null) {
            throw new IllegalArgumentException("Evaluation context dependencies required");
        }
        this.authEvidenceResolver = authEvidenceResolver;
        this.repository = repository;
    }

    public Result load(String visitId, String authEvidence) {
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
        if (principal == null || !isSafeVisitId(visitId)) {
            return principal == null
                    ? Result.authenticationFailure(AuthResolution.TECHNICAL_FAILURE)
                    : Result.authenticated(Availability.NOT_FOUND, null);
        }

        VisitEvaluationContextRepository.Result read;
        try {
            read = repository.findOwned(principal, visitId);
        } catch (RuntimeException ignored) {
            read = VisitEvaluationContextRepository.Result.technicalFailure();
        }
        if (read == null || read.status() == null) {
            return Result.authenticated(Availability.TECHNICAL_FAILURE, null);
        }

        return switch (read.status()) {
            case NOT_FOUND -> Result.authenticated(Availability.NOT_FOUND, null);
            case UNAVAILABLE -> Result.authenticated(Availability.UNAVAILABLE, null);
            case TECHNICAL_FAILURE -> Result.authenticated(Availability.TECHNICAL_FAILURE, null);
            case FOUND -> mapFoundVisit(visitId, read.visit());
        };
    }

    private static Result mapFoundVisit(String requestedVisitId, VisitEvaluationContextRepository.OwnedVisit visit) {
        if (visit == null || !requestedVisitId.equals(visit.visitId())
                || !C1_VISIT_STATUSES.contains(visit.visitStatus())) {
            return Result.authenticated(Availability.TECHNICAL_FAILURE, null);
        }
        Context context = new Context(visit.visitId(), visit.institutionId(),
                visit.institutionRecordRevision(), visit.visitStatus());
        return Result.authenticated("completed".equals(visit.visitStatus())
                ? Availability.ELIGIBLE
                : Availability.NOT_COMPLETED, context);
    }

    private static boolean isSafeVisitId(String value) {
        return value != null && !value.isBlank() && value.length() <= 200
                && value.chars().noneMatch(character -> character <= 0x1F || character == 0x7F);
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
        ELIGIBLE("eligible"), NOT_COMPLETED("not_completed"), NOT_FOUND("not_found"),
        UNAVAILABLE("unavailable"), TECHNICAL_FAILURE("technical_failure");

        private final String wireValue;

        Availability(String wireValue) { this.wireValue = wireValue; }

        public String wireValue() { return wireValue; }
    }

    public record Context(String visitId, String institutionId, String institutionRecordRevision, String visitStatus) {
    }

    public record Result(AuthResolution authResolution, Availability availability, Context context) {
        public Result {
            if (authResolution == null) throw new IllegalArgumentException("authResolution required");
            if (authResolution == AuthResolution.AUTHENTICATED) {
                if (availability == null) throw new IllegalArgumentException("authenticated result requires availability");
                boolean contextRequired = availability == Availability.ELIGIBLE
                        || availability == Availability.NOT_COMPLETED;
                if (contextRequired != (context != null)) {
                    throw new IllegalArgumentException("context must match owned Visit availability");
                }
                if (context != null) {
                    boolean completed = "completed".equals(context.visitStatus());
                    if ((availability == Availability.ELIGIBLE) != completed) {
                        throw new IllegalArgumentException("eligibility must match authoritative Visit status");
                    }
                }
            } else if (availability != null || context != null) {
                throw new IllegalArgumentException("unauthenticated result cannot carry Visit data");
            }
        }

        static Result authenticationFailure(AuthResolution resolution) {
            if (resolution == AuthResolution.AUTHENTICATED) {
                throw new IllegalArgumentException("authenticated resolution requires availability");
            }
            return new Result(resolution, null, null);
        }

        static Result authenticated(Availability availability, Context context) {
            return new Result(AuthResolution.AUTHENTICATED, availability, context);
        }
    }
}
