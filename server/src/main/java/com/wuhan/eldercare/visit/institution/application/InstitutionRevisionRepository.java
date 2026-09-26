package com.wuhan.eldercare.visit.institution.application;

import java.time.Instant;

public interface InstitutionRevisionRepository {
    InstitutionPublishResult publish(
            InstitutionPublishPackageV1 publishPackage,
            Instant publishedAt);

    CurrentHeadResult currentHead(String institutionId);

    ExactPublicNameResult resolveExactPublicName(String institutionId, long recordRevision);

    CurrentAppointmentRevisionResult resolveCurrentAppointmentRevision(String institutionId, long requestedRevision);

    record CurrentHeadResult(Status status, String institutionId, Long recordRevision) {
        public static CurrentHeadResult ready(String institutionId, long revision) {
            return new CurrentHeadResult(Status.READY, institutionId, revision);
        }

        public static CurrentHeadResult unavailable() {
            return new CurrentHeadResult(Status.UNAVAILABLE, null, null);
        }

        public static CurrentHeadResult technicalFailure() {
            return new CurrentHeadResult(Status.TECHNICAL_FAILURE, null, null);
        }

        public enum Status { READY, UNAVAILABLE, TECHNICAL_FAILURE }
    }

    record ExactPublicNameResult(Status status, String institutionId, Long recordRevision, String publicName) {
        public static ExactPublicNameResult ready(String institutionId, long recordRevision, String publicName) {
            return new ExactPublicNameResult(Status.READY, institutionId, recordRevision, publicName);
        }

        public static ExactPublicNameResult unavailable() {
            return new ExactPublicNameResult(Status.UNAVAILABLE, null, null, null);
        }

        public static ExactPublicNameResult technicalFailure() {
            return new ExactPublicNameResult(Status.TECHNICAL_FAILURE, null, null, null);
        }

        public enum Status { READY, UNAVAILABLE, TECHNICAL_FAILURE }
    }

    /** Current head and its requested exact revision are read in one authoritative SQL statement. */
    record CurrentAppointmentRevisionResult(Status status, String institutionId, Long currentRevision,
                                             boolean exactRevisionFound, String recordStatus) {
        public static CurrentAppointmentRevisionResult ready(String institutionId, long currentRevision,
                                                              boolean exactRevisionFound, String recordStatus) {
            return new CurrentAppointmentRevisionResult(Status.READY, institutionId, currentRevision,
                    exactRevisionFound, recordStatus);
        }

        public static CurrentAppointmentRevisionResult unavailable() {
            return new CurrentAppointmentRevisionResult(Status.UNAVAILABLE, null, null, false, null);
        }

        public static CurrentAppointmentRevisionResult notFound() {
            return new CurrentAppointmentRevisionResult(Status.NOT_FOUND, null, null, false, null);
        }

        public static CurrentAppointmentRevisionResult technicalFailure() {
            return new CurrentAppointmentRevisionResult(Status.TECHNICAL_FAILURE, null, null, false, null);
        }

        public enum Status { READY, NOT_FOUND, UNAVAILABLE, TECHNICAL_FAILURE }
    }
}
