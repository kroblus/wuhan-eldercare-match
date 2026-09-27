package com.wuhan.eldercare.visit.elder.application;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;

import java.sql.Connection;
/** Resolves C5 identity before every owner-scoped read or explicit establish operation. */
public final class ElderRecordService {
    private final AuthEvidenceResolver authentication;
    private final ElderRecordRepository repository;
    private final ElderIdentitySource identitySource;

    public ElderRecordService(AuthEvidenceResolver authentication, ElderRecordRepository repository,
                              ElderIdentitySource identitySource) {
        if (authentication == null || repository == null || identitySource == null) {
            throw new IllegalArgumentException("Elder identity dependencies required");
        }
        this.authentication = authentication;
        this.repository = repository;
        this.identitySource = identitySource;
    }

    public Resolution resolveCurrent(String authEvidence) {
        AuthEvidenceResolver.Resolution auth = resolveAuthentication(authEvidence);
        if (auth.status() != AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
            return Resolution.unauthenticated(auth.status());
        }
        return resolve(auth.principal());
    }

    /** Establish is an explicit use case. Ordinary reads and login never call it. */
    public Establishment establishCurrent(String authEvidence) {
        AuthEvidenceResolver.Resolution auth = resolveAuthentication(authEvidence);
        if (auth.status() != AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
            return Establishment.unauthenticated(auth.status());
        }
        TrustedPrincipal principal = auth.principal();
        ElderRecordRepository.Lookup existing = safeLookup(principal.userId());
        if (existing.status() == ElderRecordRepository.Lookup.Status.FOUND) {
            return Establishment.bound(auth.status(), Establishment.Status.ALREADY_BOUND, existing.record());
        }
        if (existing.status() != ElderRecordRepository.Lookup.Status.NOT_FOUND) {
            return Establishment.bound(auth.status(), fromLookup(existing.status()), null);
        }

        ElderRecord candidate;
        try {
            candidate = new ElderRecord(identitySource.newElderId(), principal.userId(), identitySource.createdAt());
        } catch (RuntimeException ignored) {
            return Establishment.bound(auth.status(), Establishment.Status.TECHNICAL_FAILURE, null);
        }

        ElderRecordRepository.Establish persisted;
        try {
            persisted = repository.establish(candidate);
        } catch (RuntimeException ignored) {
            return Establishment.bound(auth.status(), Establishment.Status.TECHNICAL_FAILURE, null);
        }
        if (persisted == null || persisted.status() == null) {
            return Establishment.bound(auth.status(), Establishment.Status.TECHNICAL_FAILURE, null);
        }
        return switch (persisted.status()) {
            case CREATED -> Establishment.bound(auth.status(), Establishment.Status.CREATED, persisted.record());
            case ALREADY_BOUND -> Establishment.bound(auth.status(), Establishment.Status.ALREADY_BOUND, persisted.record());
            case UNAVAILABLE -> Establishment.bound(auth.status(), Establishment.Status.UNAVAILABLE, null);
            case TECHNICAL_FAILURE -> Establishment.bound(auth.status(), Establishment.Status.TECHNICAL_FAILURE, null);
        };
    }

    /** Internal principal-scoped resolver; never looks up a caller-supplied elderId. */
    public Resolution resolve(TrustedPrincipal principal) {
        if (principal == null) return Resolution.unauthenticated(AuthEvidenceResolver.Resolution.Status.TECHNICAL_FAILURE);
        ElderRecordRepository.Lookup result = safeLookup(principal.userId());
        if (result == null || result.status() == null) {
            return Resolution.authenticated(Availability.TECHNICAL_FAILURE, null);
        }
        return switch (result.status()) {
            case FOUND -> validOwner(result.record(), principal)
                    ? Resolution.authenticated(Availability.BOUND, result.record())
                    : Resolution.authenticated(Availability.TECHNICAL_FAILURE, null);
            case NOT_FOUND -> Resolution.authenticated(Availability.NOT_FOUND, null);
            case UNAVAILABLE -> Resolution.authenticated(Availability.UNAVAILABLE, null);
            case TECHNICAL_FAILURE -> Resolution.authenticated(Availability.TECHNICAL_FAILURE, null);
        };
    }

    /** Assertion comparison is performed only after resolution by trusted C5 userId. */
    public ReferenceAuthorizer.Authorization authorizeAssertion(TrustedPrincipal principal, String assertedElderId) {
        if (principal == null || assertedElderId == null || assertedElderId.isBlank()) {
            return ReferenceAuthorizer.Authorization.INVALID;
        }
        Resolution current = resolve(principal);
        if (current.authStatus() != AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
            return ReferenceAuthorizer.Authorization.TECHNICAL_FAILURE;
        }
        return switch (current.availability()) {
            case BOUND -> current.record().elderId().equals(assertedElderId)
                    ? ReferenceAuthorizer.Authorization.AUTHORIZED
                    : ReferenceAuthorizer.Authorization.UNAUTHORIZED;
            case NOT_FOUND -> ReferenceAuthorizer.Authorization.UNAUTHORIZED;
            case UNAVAILABLE -> ReferenceAuthorizer.Authorization.UNAVAILABLE;
            case TECHNICAL_FAILURE -> ReferenceAuthorizer.Authorization.TECHNICAL_FAILURE;
        };
    }

    /** Resolves the canonical Elder identity from trusted C5 ownership in the caller's transaction. */
    public ReferenceAuthorizer.Resolution authorizeAssertion(Connection connection, TrustedPrincipal principal,
                                                               String assertedElderId) {
        if (connection == null || principal == null || !repository.supportsTransactionScopedLookup()) {
            return ReferenceAuthorizer.Resolution.of(ReferenceAuthorizer.Authorization.TECHNICAL_FAILURE);
        }
        ElderRecordRepository.Lookup lookup;
        try {
            lookup = repository.findByResponsibleUserId(connection, principal.userId());
        } catch (RuntimeException ignored) {
            return ReferenceAuthorizer.Resolution.of(ReferenceAuthorizer.Authorization.TECHNICAL_FAILURE);
        }
        if (lookup == null || lookup.status() == null) {
            return ReferenceAuthorizer.Resolution.of(ReferenceAuthorizer.Authorization.TECHNICAL_FAILURE);
        }
        return switch (lookup.status()) {
            case FOUND -> {
                ElderRecord record = lookup.record();
                if (!principal.userId().equals(record.responsibleUserId())) {
                    yield ReferenceAuthorizer.Resolution.of(ReferenceAuthorizer.Authorization.TECHNICAL_FAILURE);
                }
                if (assertedElderId != null && !assertedElderId.isBlank()
                        && !record.elderId().equals(assertedElderId)) {
                    yield ReferenceAuthorizer.Resolution.of(ReferenceAuthorizer.Authorization.UNAUTHORIZED);
                }
                yield ReferenceAuthorizer.Resolution.authorized(record.elderId());
            }
            case NOT_FOUND -> ReferenceAuthorizer.Resolution.of(ReferenceAuthorizer.Authorization.UNAUTHORIZED);
            case UNAVAILABLE -> ReferenceAuthorizer.Resolution.of(ReferenceAuthorizer.Authorization.UNAVAILABLE);
            case TECHNICAL_FAILURE -> ReferenceAuthorizer.Resolution.of(ReferenceAuthorizer.Authorization.TECHNICAL_FAILURE);
        };
    }

    private AuthEvidenceResolver.Resolution resolveAuthentication(String evidence) {
        try {
            AuthEvidenceResolver.Resolution result = authentication.resolve(evidence);
            return result == null ? AuthEvidenceResolver.Resolution.failure(
                    AuthEvidenceResolver.Resolution.Status.TECHNICAL_FAILURE) : result;
        } catch (RuntimeException ignored) {
            return AuthEvidenceResolver.Resolution.failure(AuthEvidenceResolver.Resolution.Status.TECHNICAL_FAILURE);
        }
    }

    private ElderRecordRepository.Lookup safeLookup(String userId) {
        try {
            ElderRecordRepository.Lookup result = repository.findByResponsibleUserId(userId);
            return result == null ? ElderRecordRepository.Lookup.of(
                    ElderRecordRepository.Lookup.Status.TECHNICAL_FAILURE) : result;
        } catch (RuntimeException ignored) {
            return ElderRecordRepository.Lookup.of(ElderRecordRepository.Lookup.Status.TECHNICAL_FAILURE);
        }
    }

    private static boolean validOwner(ElderRecord record, TrustedPrincipal principal) {
        return record != null && record.responsibleUserId().equals(principal.userId());
    }

    private static Establishment.Status fromLookup(ElderRecordRepository.Lookup.Status status) {
        return status == ElderRecordRepository.Lookup.Status.UNAVAILABLE
                ? Establishment.Status.UNAVAILABLE : Establishment.Status.TECHNICAL_FAILURE;
    }

    public enum Availability { BOUND, NOT_FOUND, UNAVAILABLE, TECHNICAL_FAILURE }

    public record Resolution(AuthEvidenceResolver.Resolution.Status authStatus,
                             Availability availability, ElderRecord record) {
        public Resolution {
            if (authStatus == null) throw new IllegalArgumentException("auth status required");
            if (authStatus == AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
                if (availability == null || ((availability == Availability.BOUND) != (record != null))) {
                    throw new IllegalArgumentException("record must match bound availability");
                }
            } else if (availability != null || record != null) {
                throw new IllegalArgumentException("unauthenticated result cannot contain Elder data");
            }
        }

        static Resolution authenticated(Availability availability, ElderRecord record) {
            return new Resolution(AuthEvidenceResolver.Resolution.Status.AUTHENTICATED, availability, record);
        }

        static Resolution unauthenticated(AuthEvidenceResolver.Resolution.Status authStatus) {
            return new Resolution(authStatus, null, null);
        }
    }

    public static final class Establishment {
        public enum Status { CREATED, ALREADY_BOUND, UNAVAILABLE, TECHNICAL_FAILURE }

        private final AuthEvidenceResolver.Resolution.Status authStatus;
        private final Status status;
        private final ElderRecord record;

        private Establishment(AuthEvidenceResolver.Resolution.Status authStatus, Status status, ElderRecord record) {
            if (authStatus == null) throw new IllegalArgumentException("auth status required");
            boolean authenticated = authStatus == AuthEvidenceResolver.Resolution.Status.AUTHENTICATED;
            if (authenticated != (status != null) || ((status == Status.CREATED || status == Status.ALREADY_BOUND) != (record != null))) {
                throw new IllegalArgumentException("establishment state and record must agree");
            }
            this.authStatus = authStatus;
            this.status = status;
            this.record = record;
        }

        static Establishment unauthenticated(AuthEvidenceResolver.Resolution.Status status) {
            return new Establishment(status, null, null);
        }

        static Establishment bound(AuthEvidenceResolver.Resolution.Status authStatus, Status status, ElderRecord record) {
            return new Establishment(authStatus, status, record);
        }

        public AuthEvidenceResolver.Resolution.Status authStatus() { return authStatus; }
        public Status status() { return status; }
        public ElderRecord record() { return record; }
    }
}
