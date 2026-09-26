package com.wuhan.eldercare.visit.institution.application;

import java.time.Instant;
import java.util.List;

public record InstitutionPublishResult(
        Status status,
        String institutionId,
        Long recordRevision,
        String publicName,
        Instant publishedAt,
        List<InstitutionSnapshotValidator.Issue> validationIssues
) {
    public InstitutionPublishResult {
        validationIssues = validationIssues == null ? List.of() : List.copyOf(validationIssues);
    }

    public static InstitutionPublishResult of(Status status) {
        return new InstitutionPublishResult(status, null, null, null, null, List.of());
    }

    public static InstitutionPublishResult invalidRecord(List<InstitutionSnapshotValidator.Issue> issues) {
        return new InstitutionPublishResult(Status.INVALID_RECORD, null, null, null, null, issues);
    }

    public static InstitutionPublishResult published(Status status, String institutionId, long revision,
                                                       String name, Instant publishedAt) {
        return new InstitutionPublishResult(status, institutionId, revision, name, publishedAt, List.of());
    }

    public enum Status {
        PUBLISHED,
        REPLAYED,
        INVALID_PACKAGE,
        INVALID_RECORD,
        OPERATION_ID_CONFLICT,
        VALIDATOR_UNAVAILABLE,
        UNAVAILABLE,
        TECHNICAL_FAILURE
    }
}
