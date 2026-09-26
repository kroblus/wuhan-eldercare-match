package com.wuhan.eldercare.visit.institution.appointment.application;

import java.time.Instant;

/** Operations authorization is stored separately from Institution verified facts. */
public interface InstitutionAppointmentAuthorizationRepository {
    Lookup latest(String institutionId, long recordRevision);

    Apply append(Event event);

    record Event(String operationId, String institutionId, long recordRevision, State state,
                 String provenanceReference, String operatorReference, Instant recordedAt) {
        public enum State { AUTHORIZED, REVOKED }

        public Event {
            if (blank(operationId) || operationId.length() > 120 || blank(institutionId)
                    || institutionId.length() > 200 || recordRevision < 1
                    || state == null || blank(provenanceReference) || provenanceReference.length() > 1000
                    || blank(operatorReference) || operatorReference.length() > 120 || recordedAt == null) {
                throw new IllegalArgumentException("invalid appointment authorization event");
            }
        }

        private static boolean blank(String value) { return value == null || value.isBlank(); }
    }

    record Lookup(Status status) {
        public enum Status { AUTHORIZED, REVOKED, NOT_CONFIGURED, UNAVAILABLE, TECHNICAL_FAILURE }
        public Lookup {
            if (status == null) throw new IllegalArgumentException("authorization lookup status required");
        }
        public static Lookup of(Status status) { return new Lookup(status); }
    }

    record Apply(Status status) {
        public enum Status { APPLIED, REPLAYED, CONFLICT, INVALID, UNAVAILABLE, TECHNICAL_FAILURE }
        public Apply {
            if (status == null) throw new IllegalArgumentException("authorization write status required");
        }
        public static Apply of(Status status) { return new Apply(status); }
    }
}
