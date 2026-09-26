package com.wuhan.eldercare.visit.institution.application;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/** Calls the active frozen Institution Contract validator before publication. */
public interface InstitutionSnapshotValidator {
    ValidationResult validate(JsonNode serverBoundRecord);

    record ValidationResult(Status status, List<Issue> issues) {
        public ValidationResult {
            issues = issues == null ? List.of() : List.copyOf(issues);
        }

        public static ValidationResult valid() {
            return new ValidationResult(Status.VALID, List.of());
        }

        public static ValidationResult invalid(List<Issue> issues) {
            return new ValidationResult(Status.INVALID, issues);
        }

        public static ValidationResult unavailable() {
            return new ValidationResult(Status.UNAVAILABLE, List.of());
        }

        public static ValidationResult technicalFailure() {
            return new ValidationResult(Status.TECHNICAL_FAILURE, List.of());
        }
    }

    record Issue(String code, String path) { }

    enum Status {
        VALID,
        INVALID,
        UNAVAILABLE,
        TECHNICAL_FAILURE
    }
}
