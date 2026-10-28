package com.wuhan.eldercare.visit.institution.application;

import java.time.Instant;
import java.sql.Connection;

public interface InstitutionRevisionRepository {
    InstitutionPublishResult publish(
            InstitutionPublishPackageV1 publishPackage,
            Instant publishedAt);

    /** Participates in the caller's transaction; caller commits or rolls back the whole publication. */
    default InstitutionPublishResult publish(Connection connection, InstitutionPublishPackageV1 publishPackage,
            Instant publishedAt, long expectedCurrentRevision) throws Exception {
        return InstitutionPublishResult.of(InstitutionPublishResult.Status.UNAVAILABLE);
    }

    default boolean supportsTransactionalPublication() { return false; }

    /** Explicit bootstrap preserves original revisions/evidence; never overwrites a stored snapshot. */
    default InstitutionPublishResult importBaseline(Connection connection, com.fasterxml.jackson.databind.node.ObjectNode record,
            String operationId, String sourceReference, Instant importedAt) throws Exception {
        return InstitutionPublishResult.of(InstitutionPublishResult.Status.UNAVAILABLE);
    }
    default InstitutionPublishResult importBaseline(Connection connection,com.fasterxml.jackson.databind.node.ObjectNode record,
            String operationId,String sourceReference,Instant importedAt,boolean promoteCurrent)throws Exception {
        return promoteCurrent?importBaseline(connection,record,operationId,sourceReference,importedAt)
                :InstitutionPublishResult.of(InstitutionPublishResult.Status.UNAVAILABLE);
    }

    CurrentHeadResult currentHead(String institutionId);

    ExactPublicNameResult resolveExactPublicName(String institutionId, long recordRevision);

    CurrentAppointmentRevisionResult resolveCurrentAppointmentRevision(String institutionId, long requestedRevision);

    /** Resolves and locks the current head for an appointment write transaction. */
    default CurrentAppointmentRevisionResult resolveCurrentAppointmentRevision(
            Connection connection, String institutionId, long requestedRevision) {
        return resolveCurrentAppointmentRevision(institutionId, requestedRevision);
    }

    default boolean supportsTransactionScopedAppointmentRead() { return false; }

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
