package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.PersistedVisitCandidateV1;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;

/**
 * Versioned private Backend -> Application result. The candidate is the
 * complete persisted InstitutionVisit shape required by the C2 firewall.
 * The HTTP controller exposes this only as the private Backend-to-Application
 * transport boundary; {@link #toPublic()} projects only the safe receipt
 * after validation so the candidate never becomes Page state.
 */
public record BackendSubmissionResultV1(
        String contractVersion,
        String kind,
        SubmissionResultV1.Outcome outcome,
        String code,
        PersistedVisitCandidateV1 candidate
) {
    public static final String CONTRACT_VERSION = "authenticated-visit-submission-persistence-contract-v1";
    public static final String KIND = "authenticated_visit_submission_backend_result_v1";

    public BackendSubmissionResultV1 {
        if (!CONTRACT_VERSION.equals(contractVersion)) throw new IllegalArgumentException("invalid C3 result version");
        if (!KIND.equals(kind)) throw new IllegalArgumentException("invalid C3 result kind");
        if (outcome == null || code == null || code.isBlank()) throw new IllegalArgumentException("result fields required");
        if ((outcome == SubmissionResultV1.Outcome.ACCEPTED || outcome == SubmissionResultV1.Outcome.REPLAYED)
                != (candidate != null)) {
            throw new IllegalArgumentException("accepted/replayed must carry a candidate");
        }
    }

    public static BackendSubmissionResultV1 from(SubmissionResultV1.Outcome outcome, String code) {
        return new BackendSubmissionResultV1(CONTRACT_VERSION, KIND, outcome, code, null);
    }

    public static BackendSubmissionResultV1 accepted(PersistedVisitCandidateV1 candidate, boolean replayed) {
        return new BackendSubmissionResultV1(CONTRACT_VERSION, KIND,
                replayed ? SubmissionResultV1.Outcome.REPLAYED : SubmissionResultV1.Outcome.ACCEPTED,
                replayed ? "REPLAYED" : "ACCEPTED", candidate);
    }

    public SubmissionResultV1 toPublic() {
        return switch (outcome) {
            case ACCEPTED -> SubmissionResultV1.accepted(candidate.toPublicReceipt());
            case REPLAYED -> SubmissionResultV1.replayed(candidate.toPublicReceipt());
            case REJECTED -> SubmissionResultV1.rejected(code);
            case CONFLICT -> SubmissionResultV1.conflict();
            case UNAVAILABLE -> SubmissionResultV1.unavailable();
            case TECHNICAL_FAILURE -> SubmissionResultV1.technicalFailure();
        };
    }
}
