package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.PersistedVisitCandidateV1;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

public interface VisitSubmissionRepository {
    Result createOrReplay(TrustedPrincipal principal, SubmissionCommandV1 command, PrivateContact contact);

    /** Transactionally checks the current C5 session and an existing owner/key before contacting C6. */
    default Result findCommitted(TrustedPrincipal principal, SubmissionCommandV1 command,
                                 String authEvidence, AuthEvidenceResolver authEvidenceResolver) {
        return new Result(Result.Status.NO_COMMITTED_RECORD, null);
    }

    /** Production path: repeats C5 and owner/key checks, then authorizes references and writes atomically. */
    default Result createOrReplay(TrustedPrincipal principal, SubmissionCommandV1 command, PrivateContact contact,
                                  String authEvidence, AuthEvidenceResolver authEvidenceResolver,
                                  ReferenceAuthorizer referenceAuthorizer) {
        // Never silently degrade the production transaction boundary to the legacy
        // unguarded persistence method. Test doubles that intentionally emulate
        // the old seam must opt in through an explicit test-only adapter.
        return new Result(Result.Status.TECHNICAL_FAILURE, null);
    }

    default boolean hasTransactionalAuthorization() { return false; }

    record Result(Status status, PersistedVisitCandidateV1 candidate) {
        public enum Status {
            ACCEPTED,
            REPLAYED,
            CONFLICT,
            UNAVAILABLE,
            NO_COMMITTED_RECORD,
            AUTH_REQUIRED,
            AUTH_UNAVAILABLE,
            REFERENCE_REJECTED,
            REFERENCE_INVALID,
            TECHNICAL_FAILURE
        }

        public Result {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.ACCEPTED || status == Status.REPLAYED) != (candidate != null)) {
                throw new IllegalArgumentException("candidate only belongs to accepted/replayed");
            }
        }
    }
}
