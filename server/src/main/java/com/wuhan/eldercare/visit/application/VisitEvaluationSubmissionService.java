package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteContentV1;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteValidation;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** Resolves C5 authority and applies the frozen production write semantics. */
public final class VisitEvaluationSubmissionService {
    private final AuthEvidenceResolver authEvidenceResolver;
    private final VisitEvaluationWriteRepository repository;
    private final VisitEvaluationContentNormalizer normalizer;
    private final VisitEvaluationIdentitySource identitySource;

    public VisitEvaluationSubmissionService(
            AuthEvidenceResolver authEvidenceResolver,
            VisitEvaluationWriteRepository repository,
            VisitEvaluationContentNormalizer normalizer,
            VisitEvaluationIdentitySource identitySource
    ) {
        if (authEvidenceResolver == null || repository == null || normalizer == null || identitySource == null) {
            throw new IllegalArgumentException("Evaluation submission dependencies required");
        }
        this.authEvidenceResolver = authEvidenceResolver;
        this.repository = repository;
        this.normalizer = normalizer;
        this.identitySource = identitySource;
    }

    public Result submit(String visitId, Request request, String authEvidence) {
        AuthEvidenceResolver.Resolution auth;
        try {
            auth = authEvidenceResolver.resolve(authEvidence);
        } catch (RuntimeException ignored) {
            return Result.failure("technical_failure", Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);
        }
        if (auth == null || auth.status() == null) {
            return Result.failure("technical_failure", Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);
        }
        String authResolution = authResolution(auth.status());
        if (auth.status() != AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
            return switch (auth.status()) {
                case MISSING, EXPIRED, INVALID -> Result.failure(authResolution, Outcome.REJECTED, "AUTH_REQUIRED", null);
                case UNAVAILABLE -> Result.failure(authResolution, Outcome.UNAVAILABLE, "SERVICE_UNAVAILABLE", null);
                case TECHNICAL_FAILURE -> Result.failure(authResolution, Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);
                case AUTHENTICATED -> throw new IllegalStateException("authenticated is not failure");
            };
        }
        TrustedPrincipal principal = auth.principal();
        if (principal == null) return Result.failure("technical_failure", Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);

        if (!safeVisitId(visitId)) {
            return Result.failure(authResolution, Outcome.REJECTED, "NOT_FOUND", null);
        }
        List<VisitEvaluationWriteValidation.FieldError> errors = request == null
                ? List.of(new VisitEvaluationWriteValidation.FieldError("request", "REQUIRED"))
                : request.validateEnvelope();
        VisitEvaluationWriteContentV1 content = request == null ? null : request.content();
        errors = append(errors, VisitEvaluationWriteValidation.validate(content));
        if (!errors.isEmpty()) {
            return Result.failure(authResolution, Outcome.REJECTED, "VALIDATION_FAILED", errors);
        }

        VisitEvaluationContentNormalizer.Normalized normalized;
        String keyDigest;
        String evaluationId;
        Instant submittedAt;
        try {
            normalized = normalizer.normalize(content);
            keyDigest = normalizer.digestIdempotencyKey(request.idempotencyKey());
            evaluationId = identitySource.newEvaluationId();
            Instant clockValue = identitySource.submittedAt();
            submittedAt = clockValue == null ? null : clockValue.truncatedTo(ChronoUnit.MICROS);
            if (evaluationId == null || evaluationId.isBlank() || submittedAt == null) {
                throw new IllegalStateException("server identity source returned incomplete result");
            }
        } catch (RuntimeException ignored) {
            return Result.failure(authResolution, Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);
        }

        VisitEvaluationWriteRepository.Result persisted;
        try {
            persisted = repository.createOrResolve(principal, visitId, keyDigest, normalized.fingerprint(),
                    normalized.content(), evaluationId, submittedAt);
        } catch (RuntimeException ignored) {
            persisted = VisitEvaluationWriteRepository.Result.of(
                    VisitEvaluationWriteRepository.Result.Status.TECHNICAL_FAILURE);
        }
        if (persisted == null || persisted.status() == null) {
            return Result.failure(authResolution, Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);
        }
        return switch (persisted.status()) {
            case ACCEPTED -> accepted(authResolution, Outcome.ACCEPTED, "ACCEPTED", persisted.receipt());
            case REPLAYED -> accepted(authResolution, Outcome.REPLAYED, "REPLAYED", persisted.receipt());
            case NOT_FOUND -> Result.failure(authResolution, Outcome.REJECTED, "NOT_FOUND", null);
            case NOT_COMPLETED -> Result.failure(authResolution, Outcome.REJECTED, "NOT_COMPLETED", null);
            case VALIDATION_FAILED -> Result.failure(authResolution, Outcome.REJECTED, "VALIDATION_FAILED",
                    List.of(new VisitEvaluationWriteValidation.FieldError("content", "VALIDATION_FAILED")));
            case ALREADY_SUBMITTED -> Result.failure(authResolution, Outcome.REJECTED, "ALREADY_SUBMITTED", null);
            case IDEMPOTENCY_CONFLICT -> Result.failure(authResolution, Outcome.CONFLICT, "IDEMPOTENCY_CONFLICT", null);
            case UNAVAILABLE -> Result.failure(authResolution, Outcome.UNAVAILABLE, "SERVICE_UNAVAILABLE", null);
            case TECHNICAL_FAILURE -> Result.failure(authResolution, Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);
        };
    }

    private static Result accepted(String authResolution, Outcome outcome, String code,
                                   VisitEvaluationWriteRepository.Receipt receipt) {
        if (receipt == null) return Result.failure(authResolution, Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE", null);
        return new Result(authResolution, outcome, code, receipt, null);
    }

    private static List<VisitEvaluationWriteValidation.FieldError> append(
            List<VisitEvaluationWriteValidation.FieldError> left,
            List<VisitEvaluationWriteValidation.FieldError> right) {
        if (left.isEmpty()) return right;
        if (right.isEmpty()) return left;
        java.util.ArrayList<VisitEvaluationWriteValidation.FieldError> combined = new java.util.ArrayList<>(left);
        for (VisitEvaluationWriteValidation.FieldError error : right) if (!combined.contains(error)) combined.add(error);
        return List.copyOf(combined);
    }

    private static String authResolution(AuthEvidenceResolver.Resolution.Status status) {
        return switch (status) {
            case AUTHENTICATED -> "authenticated";
            case MISSING -> "missing";
            case EXPIRED -> "expired";
            case INVALID -> "invalid";
            case UNAVAILABLE -> "unavailable";
            case TECHNICAL_FAILURE -> "technical_failure";
        };
    }

    private static boolean safeVisitId(String value) {
        return value != null && !value.isBlank() && value.length() <= 200
                && value.chars().noneMatch(character -> character <= 0x1f || character == 0x7f);
    }

    public enum Outcome { ACCEPTED, REPLAYED, REJECTED, CONFLICT, UNAVAILABLE, TECHNICAL_FAILURE }

    public record Request(String contractVersion, String kind, String idempotencyKey,
                          VisitEvaluationWriteContentV1 content) {
        public List<VisitEvaluationWriteValidation.FieldError> validateEnvelope() {
            return VisitEvaluationWriteValidation.validateEnvelope(contractVersion, kind, idempotencyKey);
        }
    }

    public record Result(String authResolution, Outcome outcome, String code,
                         VisitEvaluationWriteRepository.Receipt receipt,
                         List<VisitEvaluationWriteValidation.FieldError> fieldErrors) {
        public Result {
            if (authResolution == null || outcome == null || code == null || code.isBlank()) {
                throw new IllegalArgumentException("submission result fields required");
            }
            boolean receiptRequired = outcome == Outcome.ACCEPTED || outcome == Outcome.REPLAYED;
            if (receiptRequired != (receipt != null)) throw new IllegalArgumentException("receipt/outcome mismatch");
            boolean errorsRequired = "VALIDATION_FAILED".equals(code);
            if (errorsRequired != (fieldErrors != null && !fieldErrors.isEmpty())) {
                throw new IllegalArgumentException("field errors only belong to validation failure");
            }
            if (fieldErrors != null) fieldErrors = List.copyOf(fieldErrors);
        }

        static Result failure(String auth, Outcome outcome, String code,
                              List<VisitEvaluationWriteValidation.FieldError> errors) {
            return new Result(auth, outcome, code, null, errors);
        }
    }
}
