package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import java.util.List;

/** Owner-scoped read port for the retained Appointment/Visit collection. */
public interface AppointmentOwnerReadRepository {
    Result findAllOwned(TrustedPrincipal principal);

    record OwnedVisit(
            String visitId,
            String institutionId,
            String institutionRecordRevision,
            String visitStatus,
            String visitDate,
            String visitTimePreference,
            int participantCount,
            Boolean pickupRequested
    ) { }

    record Result(Status status, List<OwnedVisit> visits) {
        public enum Status { READY, UNAVAILABLE, TECHNICAL_FAILURE }

        public Result {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.READY) != (visits != null)) {
                throw new IllegalArgumentException("Visit collection only belongs to ready result");
            }
            if (visits != null) visits = List.copyOf(visits);
        }

        public static Result ready(List<OwnedVisit> visits) {
            return new Result(Status.READY, visits);
        }

        public static Result unavailable() {
            return new Result(Status.UNAVAILABLE, null);
        }

        public static Result technicalFailure() {
            return new Result(Status.TECHNICAL_FAILURE, null);
        }
    }
}
