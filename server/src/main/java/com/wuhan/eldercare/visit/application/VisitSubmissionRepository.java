package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.PersistedVisitCandidateV1;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

public interface VisitSubmissionRepository {
    Result createOrReplay(TrustedPrincipal principal, SubmissionCommandV1 command, PrivateContact contact);

    record Result(Status status, PersistedVisitCandidateV1 candidate) {
        public enum Status {
            ACCEPTED,
            REPLAYED,
            CONFLICT,
            UNAVAILABLE,
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
