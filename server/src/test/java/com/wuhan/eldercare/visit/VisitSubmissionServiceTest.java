package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.BackendSubmissionResultV1;
import com.wuhan.eldercare.visit.application.PurposeBoundContactVerifier;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.PersistedVisitCandidateV1;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.domain.VisitReceiptV1;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class VisitSubmissionServiceTest {
    @Test
    void committedReplayReturnsBeforeContactOrReferenceChecks() {
        AtomicInteger contactCalls = new AtomicInteger();
        AtomicInteger referenceCalls = new AtomicInteger();
        AtomicInteger createCalls = new AtomicInteger();
        var command = TestFixtures.command("replay-before-contact");
        TrustedPrincipal owner = new TrustedPrincipal("user-1");
        PrivateContact persistedContact = new PrivateContact(command.contactName(), command.phone());
        VisitSubmissionRepository repository = new VisitSubmissionRepository() {
            @Override
            public Result createOrReplay(TrustedPrincipal principal,
                                         com.wuhan.eldercare.visit.domain.SubmissionCommandV1 request,
                                         PrivateContact contact) {
                createCalls.incrementAndGet();
                return new Result(Result.Status.TECHNICAL_FAILURE, null);
            }

            @Override
            public Result findCommitted(TrustedPrincipal principal,
                                        com.wuhan.eldercare.visit.domain.SubmissionCommandV1 request,
                                        String authEvidence, AuthEvidenceResolver authEvidenceResolver) {
                return new Result(Result.Status.REPLAYED,
                        candidate(principal, request, persistedContact));
            }
        };
        VisitSubmissionService service = service(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(owner),
                (evidence, purpose, name, phone) -> {
                    contactCalls.incrementAndGet();
                    return PurposeBoundContactVerifier.Verification.failure(
                            PurposeBoundContactVerifier.Verification.Status.EXPIRED);
                },
                (principal, elder, institution, revision) -> {
                    referenceCalls.incrementAndGet();
                    return ReferenceAuthorizer.Authorization.UNAUTHORIZED;
                }, repository);

        SubmissionResultV1 result = service.submit(command, "auth", "expired-or-consumed-proof");

        assertEquals(SubmissionResultV1.Outcome.REPLAYED, result.outcome());
        assertEquals("visit-1", result.receipt().visitId());
        assertEquals(0, contactCalls.get());
        assertEquals(0, referenceCalls.get());
        assertEquals(0, createCalls.get());
    }

    @Test
    void missingAuthCreatesNoPersistenceAttempt() {
        AtomicInteger calls = new AtomicInteger();
        VisitSubmissionService service = service(
                evidence -> AuthEvidenceResolver.Resolution.failure(AuthEvidenceResolver.Resolution.Status.MISSING),
                (evidence, purpose, name, phone) -> PurposeBoundContactVerifier.Verification.failure(PurposeBoundContactVerifier.Verification.Status.AUTHORIZED),
                (principal, elder, institution, revision) -> ReferenceAuthorizer.Authorization.AUTHORIZED,
                (principal, command, contact) -> {
                    calls.incrementAndGet();
                    return new VisitSubmissionRepository.Result(VisitSubmissionRepository.Result.Status.TECHNICAL_FAILURE, null);
                });

        SubmissionResultV1 result = service.submit(TestFixtures.command("auth-missing"), null, null);
        assertEquals(SubmissionResultV1.Outcome.REJECTED, result.outcome());
        assertEquals("AUTH_REQUIRED", result.code());
        assertEquals(0, calls.get());
    }

    @Test
    void nonTransactionalRepositoryFailsClosedBeforeContactOrLegacyWrite() {
        AtomicInteger contactCalls = new AtomicInteger();
        AtomicInteger referenceCalls = new AtomicInteger();
        AtomicInteger legacyWrites = new AtomicInteger();
        VisitSubmissionRepository legacyRepository = (principal, command, contact) -> {
            legacyWrites.incrementAndGet();
            return new VisitSubmissionRepository.Result(VisitSubmissionRepository.Result.Status.ACCEPTED,
                    candidate(principal, command, contact));
        };
        VisitSubmissionService service = new VisitSubmissionService(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("user-1")),
                (evidence, purpose, name, phone) -> {
                    contactCalls.incrementAndGet();
                    return PurposeBoundContactVerifier.Verification.authorized(new PrivateContact(name, phone));
                },
                (principal, elder, institution, revision) -> {
                    referenceCalls.incrementAndGet();
                    return ReferenceAuthorizer.Authorization.AUTHORIZED;
                },
                legacyRepository);

        BackendSubmissionResultV1 result = service.submitBackend(
                TestFixtures.command("legacy-repository-blocked"), "auth", "phone-proof");

        assertEquals(SubmissionResultV1.Outcome.UNAVAILABLE, result.outcome());
        assertEquals("SERVICE_UNAVAILABLE", result.code());
        assertEquals(0, contactCalls.get());
        assertEquals(0, referenceCalls.get());
        assertEquals(0, legacyWrites.get());
    }

    @Test
    void contactEvidenceMustBeAuthorizedBeforePersistence() {
        AtomicInteger calls = new AtomicInteger();
        VisitSubmissionService service = service(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("user-1")),
                (evidence, purpose, name, phone) -> PurposeBoundContactVerifier.Verification.failure(PurposeBoundContactVerifier.Verification.Status.DECLINED),
                (principal, elder, institution, revision) -> ReferenceAuthorizer.Authorization.AUTHORIZED,
                (principal, command, contact) -> {
                    calls.incrementAndGet();
                    return new VisitSubmissionRepository.Result(VisitSubmissionRepository.Result.Status.ACCEPTED, null);
                });

        SubmissionResultV1 result = service.submit(TestFixtures.command("contact-missing"), "auth", "phone-proof");
        assertEquals(SubmissionResultV1.Outcome.REJECTED, result.outcome());
        assertEquals("CONTACT_REQUIRED", result.code());
        assertEquals(0, calls.get());
    }

    @Test
    void acceptedRequiresMatchingPrivateContactAndReferenceAuthorization() {
        VisitSubmissionService service = service(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("user-1")),
                (evidence, purpose, name, phone) -> PurposeBoundContactVerifier.Verification.authorized(new PrivateContact(name, phone)),
                (principal, elder, institution, revision) -> ReferenceAuthorizer.Authorization.AUTHORIZED,
                (principal, command, contact) -> new VisitSubmissionRepository.Result(
                        VisitSubmissionRepository.Result.Status.ACCEPTED,
                        candidate(principal, command, contact)));

        SubmissionResultV1 result = service.submit(TestFixtures.command("accepted"), "auth", "phone-proof");
        assertEquals(SubmissionResultV1.Outcome.ACCEPTED, result.outcome());
        assertEquals("visit-1", result.receipt().visitId());
    }

    @Test
    void backendAcceptedResultCarriesCompletePrivateCandidateBeforePublicProjection() throws Exception {
        VisitSubmissionService service = service(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("user-1")),
                (evidence, purpose, name, phone) -> PurposeBoundContactVerifier.Verification.authorized(new PrivateContact(name, phone)),
                (principal, elder, institution, revision) -> ReferenceAuthorizer.Authorization.AUTHORIZED,
                (principal, command, contact) -> new VisitSubmissionRepository.Result(
                        VisitSubmissionRepository.Result.Status.ACCEPTED, candidate(principal, command, contact)));

        BackendSubmissionResultV1 backend = service.submitBackend(TestFixtures.command("candidate"), "auth", "phone-proof");
        assertEquals(SubmissionResultV1.Outcome.ACCEPTED, backend.outcome());
        assertEquals("user-1", backend.candidate().userId());
        assertEquals("13800000000", backend.candidate().phone());
        assertEquals("requested", backend.candidate().status());
        var publicResult = backend.toPublic();
        assertEquals("visit-1", publicResult.receipt().visitId());
        String json = new ObjectMapper().findAndRegisterModules().writeValueAsString(publicResult);
        assertEquals(false, json.contains("13800000000"));
        assertEquals(false, json.contains("user-1"));
        assertEquals(false, json.contains("contactName"));
    }

    @Test
    void mismatchedVerifierValueFailsClosedAsTechnical() {
        VisitSubmissionService service = service(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("user-1")),
                (evidence, purpose, name, phone) -> PurposeBoundContactVerifier.Verification.authorized(new PrivateContact(name, "13900000000")),
                (principal, elder, institution, revision) -> ReferenceAuthorizer.Authorization.AUTHORIZED,
                (principal, command, contact) -> new VisitSubmissionRepository.Result(VisitSubmissionRepository.Result.Status.TECHNICAL_FAILURE, null));

        SubmissionResultV1 result = service.submit(TestFixtures.command("mismatch"), "auth", "phone-proof");
        assertEquals(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, result.outcome());
        assertNull(result.receipt());
    }

    @Test
    void repositoryOutcomesMapToStableC3Taxonomy() {
        VisitSubmissionService service = service(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("user-1")),
                (evidence, purpose, name, phone) -> PurposeBoundContactVerifier.Verification.authorized(new PrivateContact(name, phone)),
                (principal, elder, institution, revision) -> ReferenceAuthorizer.Authorization.AUTHORIZED,
                (principal, command, contact) -> new VisitSubmissionRepository.Result(VisitSubmissionRepository.Result.Status.CONFLICT, null));
        SubmissionResultV1 result = service.submit(TestFixtures.command("conflict"), "auth", "phone-proof");
        assertEquals(SubmissionResultV1.Outcome.CONFLICT, result.outcome());
        assertEquals("IDEMPOTENCY_CONFLICT", result.code());
    }

    @Test
    void changedPersistedNotesAreRejectedByCandidateFirewall() {
        VisitSubmissionService service = service(
                evidence -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("user-1")),
                (evidence, purpose, name, phone) -> PurposeBoundContactVerifier.Verification.authorized(new PrivateContact(name, phone)),
                (principal, elder, institution, revision) -> ReferenceAuthorizer.Authorization.AUTHORIZED,
                (principal, command, contact) -> {
                    PersistedVisitCandidateV1 candidate = candidate(principal, command, contact);
                    return new VisitSubmissionRepository.Result(VisitSubmissionRepository.Result.Status.ACCEPTED,
                            new PersistedVisitCandidateV1(candidate.visitId(), candidate.userId(), candidate.elderId(),
                                    candidate.institutionId(), candidate.institutionRecordRevision(), candidate.visitDate(),
                                    candidate.visitTimePreference(), candidate.participantCount(), candidate.pickupRequested(),
                                    candidate.contactName(), candidate.phone(), candidate.phonePurpose(), candidate.status(),
                                    candidate.acceptedAt(), "tampered notes"));
                });

        SubmissionResultV1 result = service.submit(TestFixtures.command("notes-firewall"), "auth", "phone-proof");
        assertEquals(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, result.outcome());
        assertNull(result.receipt());
    }

    private static VisitSubmissionService service(
            AuthEvidenceResolver auth,
            PurposeBoundContactVerifier contact,
            ReferenceAuthorizer reference,
            VisitSubmissionRepository repository
    ) {
        return new VisitSubmissionService(auth, contact, reference,
                new TestOnlyLegacyVisitSubmissionRepositoryAdapter(repository));
    }

    private static PersistedVisitCandidateV1 candidate(
            TrustedPrincipal principal,
            com.wuhan.eldercare.visit.domain.SubmissionCommandV1 command,
            PrivateContact contact
    ) {
        return new PersistedVisitCandidateV1("visit-1", principal.userId(), command.elderId(),
                command.institutionId(), command.institutionRecordRevision(), command.visitDate(),
                command.visitTimePreference(), command.participantCount(), command.pickupRequested(),
                contact.contactName(), contact.phone(), command.phonePurpose(), "requested",
                Instant.parse("2026-09-17T00:00:00Z"), command.notes());
    }
}
