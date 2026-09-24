package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

/** Owner-scoped, read-only projection of a persisted Visit for Evaluation eligibility. */
public interface VisitEvaluationContextRepository {
    Result findOwned(TrustedPrincipal principal, String visitId);

    record OwnedVisit(String visitId, String institutionId, String institutionRecordRevision, String visitStatus) {
        public OwnedVisit {
            if (blank(visitId) || blank(institutionId) || blank(institutionRecordRevision) || blank(visitStatus)) {
                throw new IllegalArgumentException("incomplete owned Visit projection");
            }
        }
    }

    record Result(Status status, OwnedVisit visit) {
        public enum Status { FOUND, NOT_FOUND, UNAVAILABLE, TECHNICAL_FAILURE }

        public Result {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.FOUND) != (visit != null)) {
                throw new IllegalArgumentException("Visit projection only belongs to found result");
            }
        }

        public static Result found(OwnedVisit visit) {
            return new Result(Status.FOUND, visit);
        }

        public static Result notFound() {
            return new Result(Status.NOT_FOUND, null);
        }

        public static Result unavailable() {
            return new Result(Status.UNAVAILABLE, null);
        }

        public static Result technicalFailure() {
            return new Result(Status.TECHNICAL_FAILURE, null);
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
