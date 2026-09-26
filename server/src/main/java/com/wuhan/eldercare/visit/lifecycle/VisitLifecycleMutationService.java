package com.wuhan.eldercare.visit.lifecycle;

import com.wuhan.eldercare.visit.operations.OperationsPrincipalResolver;
import com.wuhan.eldercare.visit.operations.OperationsVisitAuthorizationResolver;
import com.wuhan.eldercare.visit.operations.TrustedOperationsPrincipal;

import java.time.Clock;
import java.time.Instant;
import java.util.regex.Pattern;

/** Orchestrates Operations authentication, exact Visit scope, and the atomic lifecycle persistence boundary. */
public final class VisitLifecycleMutationService {
    private static final Pattern VISIT_ID = Pattern.compile("[A-Za-z0-9._:-]{1,200}");

    private final OperationsPrincipalResolver principalResolver;
    private final OperationsVisitAuthorizationResolver authorizationResolver;
    private final VisitLifecycleMutationRepository repository;
    private final Clock clock;

    public VisitLifecycleMutationService(OperationsPrincipalResolver principalResolver,
                                         OperationsVisitAuthorizationResolver authorizationResolver,
                                         VisitLifecycleMutationRepository repository,
                                         Clock clock) {
        if (principalResolver == null || authorizationResolver == null || repository == null || clock == null) {
            throw new IllegalArgumentException("lifecycle mutation dependencies required");
        }
        this.principalResolver = principalResolver;
        this.authorizationResolver = authorizationResolver;
        this.repository = repository;
        this.clock = clock;
    }

    public Result mutate(String visitId, String credentialEvidence, Request request) {
        if (blank(visitId) || !VISIT_ID.matcher(visitId).matches() || "*".equals(visitId)) {
            return Result.of(Result.Status.NOT_FOUND);
        }
        if (request == null) return Result.of(Result.Status.VALIDATION_FAILED);
        VisitLifecycleMutationCommandV1 command = VisitLifecycleMutationCommandV1.create(
                request.operationId(), request.expectedStatus(), request.targetStatus(),
                request.evidenceKind(), request.evidenceReference(), request.factAt());
        if (command == null) return Result.of(Result.Status.VALIDATION_FAILED);

        OperationsPrincipalResolver.Resolution principalResult = principalResolver.resolve(credentialEvidence);
        if (principalResult == null) return Result.of(Result.Status.TECHNICAL_FAILURE);
        switch (principalResult.status()) {
            case AUTH_REQUIRED_OR_INVALID, REVOKED_OR_DISABLED -> { return Result.of(Result.Status.AUTH_REQUIRED); }
            case UNAVAILABLE -> { return Result.of(Result.Status.UNAVAILABLE); }
            case TECHNICAL_FAILURE -> { return Result.of(Result.Status.TECHNICAL_FAILURE); }
            case READY -> { }
        }
        TrustedOperationsPrincipal principal = principalResult.principal();

        OperationsVisitAuthorizationResolver.Resolution scope = authorizationResolver.authorize(principal, visitId);
        if (scope == null) return Result.of(Result.Status.TECHNICAL_FAILURE);
        switch (scope.status()) {
            case DENIED_OR_HIDDEN -> { return Result.of(Result.Status.NOT_FOUND); }
            case UNAVAILABLE -> { return Result.of(Result.Status.UNAVAILABLE); }
            case TECHNICAL_FAILURE -> { return Result.of(Result.Status.TECHNICAL_FAILURE); }
            case AUTHORIZED -> { }
        }

        try {
            VisitLifecycleMutationRepository.Result persisted = repository.mutate(principal, visitId, command, clock.instant());
            if (persisted == null) return Result.of(Result.Status.TECHNICAL_FAILURE);
            return Result.from(persisted);
        } catch (RuntimeException ignored) {
            return Result.of(Result.Status.TECHNICAL_FAILURE);
        }
    }

    public record Request(String operationId, String expectedStatus, String targetStatus,
                          String evidenceKind, String evidenceReference, String factAt) { }

    public record Result(Status status, VisitLifecycleMutationRepository.Receipt receipt) {
        public enum Status {
            ACCEPTED("accepted"), REPLAYED("replayed"), NO_OP("no_op"), AUTH_REQUIRED("auth_required"),
            NOT_FOUND("not_found"), VALIDATION_FAILED("validation_failed"), ILLEGAL_TRANSITION("illegal_transition"),
            EVIDENCE_INSUFFICIENT("evidence_insufficient"), CONFLICT("conflict"),
            IDEMPOTENCY_CONFLICT("idempotency_conflict"), UNAVAILABLE("unavailable"),
            TECHNICAL_FAILURE("technical_failure");

            private final String wireValue;
            Status(String wireValue) { this.wireValue = wireValue; }
            public String wireValue() { return wireValue; }
        }

        public Result {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.ACCEPTED || status == Status.REPLAYED || status == Status.NO_OP) != (receipt != null)) {
                throw new IllegalArgumentException("receipt only belongs to accepted/no-op results");
            }
        }

        static Result of(Status status) { return new Result(status, null); }

        private static Result from(VisitLifecycleMutationRepository.Result result) {
            Status status = switch (result.status()) {
            case ACCEPTED -> Status.ACCEPTED;
            case REPLAYED -> Status.REPLAYED;
            case NO_OP -> Status.NO_OP;
            case AUTH_REQUIRED -> Status.AUTH_REQUIRED;
            case NOT_FOUND -> Status.NOT_FOUND;
                case ILLEGAL_TRANSITION -> Status.ILLEGAL_TRANSITION;
                case EVIDENCE_INSUFFICIENT -> Status.EVIDENCE_INSUFFICIENT;
                case CONFLICT -> Status.CONFLICT;
                case IDEMPOTENCY_CONFLICT -> Status.IDEMPOTENCY_CONFLICT;
                case UNAVAILABLE -> Status.UNAVAILABLE;
                case TECHNICAL_FAILURE -> Status.TECHNICAL_FAILURE;
            };
            return new Result(status, result.receipt());
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
