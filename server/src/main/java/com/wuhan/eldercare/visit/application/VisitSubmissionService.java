package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.PersistedVisitCandidateV1;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import com.wuhan.eldercare.visit.domain.SubmissionValidation;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

import java.util.List;

public final class VisitSubmissionService {
    private final AuthEvidenceResolver authEvidenceResolver;
    private final PurposeBoundContactVerifier contactVerifier;
    private final ReferenceAuthorizer referenceAuthorizer;
    private final VisitSubmissionRepository repository;

    public VisitSubmissionService(
            AuthEvidenceResolver authEvidenceResolver,
            PurposeBoundContactVerifier contactVerifier,
            ReferenceAuthorizer referenceAuthorizer,
            VisitSubmissionRepository repository
    ) {
        this.authEvidenceResolver = authEvidenceResolver;
        this.contactVerifier = contactVerifier;
        this.referenceAuthorizer = referenceAuthorizer;
        this.repository = repository;
    }

    public SubmissionResultV1 submit(SubmissionCommandV1 command, String authEvidence, String phoneEvidence) {
        return submitBackend(command, authEvidence, phoneEvidence).toPublic();
    }

    public BackendSubmissionResultV1 submitBackend(SubmissionCommandV1 command, String authEvidence, String phoneEvidence) {
        List<String> issues = SubmissionValidation.issues(command);
        if (!issues.isEmpty()) return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.REJECTED, "VALIDATION_FAILED");

        AuthEvidenceResolver.Resolution auth;
        try {
            auth = authEvidenceResolver.resolve(authEvidence);
        } catch (RuntimeException ignored) {
            return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        }
        if (auth == null) return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        if (auth.status() != AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
            return mapAuthFailure(auth.status());
        }
        TrustedPrincipal principal = auth.principal();

        PurposeBoundContactVerifier.Verification contact;
        try {
            contact = contactVerifier.verify(phoneEvidence, SubmissionValidation.PHONE_PURPOSE,
                    command.contactName(), command.phone());
        } catch (RuntimeException ignored) {
            return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        }
        if (contact == null) return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        if (contact.status() != PurposeBoundContactVerifier.Verification.Status.AUTHORIZED) {
            return mapContactFailure(contact.status());
        }
        PrivateContact privateContact = contact.contact();
        if (!command.contactName().equals(privateContact.contactName())
                || !command.phone().equals(privateContact.phone())) {
            return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        }

        ReferenceAuthorizer.Authorization reference;
        try {
            reference = referenceAuthorizer.authorize(principal, command.elderId(), command.institutionId(),
                    command.institutionRecordRevision());
        } catch (RuntimeException ignored) {
            return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        }
        if (reference == null) return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        if (reference != ReferenceAuthorizer.Authorization.AUTHORIZED) {
            return mapReferenceFailure(reference);
        }

        VisitSubmissionRepository.Result persisted;
        try {
            persisted = repository.createOrReplay(principal, command, privateContact);
        } catch (RuntimeException ignored) {
            return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        }
        if (persisted == null) return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        return switch (persisted.status()) {
            case ACCEPTED -> projectAcceptedCandidate(persisted.candidate(), principal, command, privateContact, false);
            case REPLAYED -> projectAcceptedCandidate(persisted.candidate(), principal, command, privateContact, true);
            case CONFLICT -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.CONFLICT, "IDEMPOTENCY_CONFLICT");
            case UNAVAILABLE -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.UNAVAILABLE, "SERVICE_UNAVAILABLE");
            case TECHNICAL_FAILURE -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        };
    }

    private static BackendSubmissionResultV1 projectAcceptedCandidate(
            PersistedVisitCandidateV1 candidate,
            TrustedPrincipal principal,
            SubmissionCommandV1 command,
            PrivateContact contact,
            boolean replayed
    ) {
        if (candidate == null
                || !principal.userId().equals(candidate.userId())
                || !command.elderId().equals(candidate.elderId())
                || !command.institutionId().equals(candidate.institutionId())
                || !command.institutionRecordRevision().equals(candidate.institutionRecordRevision())
                || !command.visitDate().equals(candidate.visitDate())
                || !command.visitTimePreference().equals(candidate.visitTimePreference())
                || command.participantCount() != candidate.participantCount()
                || !java.util.Objects.equals(command.pickupRequested(), candidate.pickupRequested())
                || !contact.contactName().equals(candidate.contactName())
                || !contact.phone().equals(candidate.phone())
                || !command.phonePurpose().equals(candidate.phonePurpose())
                || !java.util.Objects.equals(command.notes(), candidate.notes())
                || !"requested".equals(candidate.status())
                || candidate.visitId() == null || candidate.visitId().isBlank()
                || candidate.acceptedAt() == null) {
            return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        }
        try {
            return BackendSubmissionResultV1.accepted(candidate, replayed);
        } catch (RuntimeException ignored) {
            return BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
        }
    }

    private static BackendSubmissionResultV1 mapAuthFailure(AuthEvidenceResolver.Resolution.Status status) {
        return switch (status) {
            case MISSING, EXPIRED, INVALID -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.REJECTED, "AUTH_REQUIRED");
            case UNAVAILABLE -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.UNAVAILABLE, "SERVICE_UNAVAILABLE");
            case TECHNICAL_FAILURE -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
            case AUTHENTICATED -> throw new IllegalStateException("authenticated is not a failure");
        };
    }

    private static BackendSubmissionResultV1 mapContactFailure(PurposeBoundContactVerifier.Verification.Status status) {
        return switch (status) {
            case MISSING, DECLINED, EXPIRED, INVALID -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.REJECTED, "CONTACT_REQUIRED");
            case UNAVAILABLE -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.UNAVAILABLE, "SERVICE_UNAVAILABLE");
            case TECHNICAL_FAILURE -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
            case AUTHORIZED -> throw new IllegalStateException("authorized is not a failure");
        };
    }

    private static BackendSubmissionResultV1 mapReferenceFailure(ReferenceAuthorizer.Authorization status) {
        return switch (status) {
            case UNAUTHORIZED, INVALID -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.REJECTED, "REFERENCE_UNAVAILABLE");
            case UNAVAILABLE -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.UNAVAILABLE, "SERVICE_UNAVAILABLE");
            case TECHNICAL_FAILURE -> BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE");
            case AUTHORIZED -> throw new IllegalStateException("authorized is not a failure");
        };
    }
}
