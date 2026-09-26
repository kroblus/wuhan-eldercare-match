package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

/** Read-only appointment reference precondition; it does not create or authorize a C3 Visit submission. */
public interface AppointmentReferenceReader {
    Result resolve(TrustedPrincipal principal, String elderId, String institutionId, String institutionRecordRevision);

    enum Status { AUTHORIZED, UNAUTHORIZED, INVALID, UNAVAILABLE, TECHNICAL_FAILURE }

    record Result(Status status) {
        public Result {
            if (status == null) throw new IllegalArgumentException("appointment reference status required");
        }

        public static Result of(Status status) { return new Result(status); }
    }
}
