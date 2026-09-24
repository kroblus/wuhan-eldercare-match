package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.VisitEvaluationContextRepository;
import com.wuhan.eldercare.visit.application.VisitEvaluationContextService;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class VisitEvaluationContextServiceTest {
    private static final TrustedPrincipal OWNER = new TrustedPrincipal("user-owner");

    @Test
    void ownedCompletedVisitIsEligibleAndUsesOnlyTrustedPrincipalAndRouteVisitId() {
        List<String> requested = new ArrayList<>();
        List<TrustedPrincipal> principals = new ArrayList<>();
        VisitEvaluationContextService service = service(authenticated(), (principal, visitId) -> {
            principals.add(principal);
            requested.add(visitId);
            return found("completed");
        });

        var result = service.load("visit-owned", "opaque-session");

        assertEquals("eligible", result.availability().wireValue());
        assertEquals("visit-owned", result.context().visitId());
        assertEquals("institution-1", result.context().institutionId());
        assertEquals("revision-4", result.context().institutionRecordRevision());
        assertEquals("completed", result.context().visitStatus());
        assertEquals(List.of("visit-owned"), requested);
        assertEquals(List.of(OWNER), principals);
    }

    @Test
    void allOtherC1StatusesReturnOwnedNonEditableContext() {
        for (String status : List.of("requested", "contacting", "scheduled", "cancelled")) {
            VisitEvaluationContextService service = service(authenticated(), (principal, visitId) -> found(status));
            var result = service.load("visit-owned", "opaque-session");
            assertEquals("not_completed", result.availability().wireValue(), status);
            assertEquals(status, result.context().visitStatus(), status);
        }
    }

    @Test
    void unknownAndForeignOwnedIdsHaveIdenticalHiddenResult() {
        VisitEvaluationContextService service = service(authenticated(), (principal, visitId) ->
                VisitEvaluationContextRepository.Result.notFound());

        var unknown = service.load("visit-unknown", "opaque-session");
        var foreign = service.load("visit-foreign", "opaque-session");

        assertEquals(unknown, foreign);
        assertEquals("not_found", unknown.availability().wireValue());
        assertNull(unknown.context());
    }

    @Test
    void missingExpiredInvalidAndUnavailableSessionsReturnNoVisitDataAndSkipRepository() {
        for (AuthEvidenceResolver.Resolution.Status status : List.of(
                AuthEvidenceResolver.Resolution.Status.MISSING,
                AuthEvidenceResolver.Resolution.Status.EXPIRED,
                AuthEvidenceResolver.Resolution.Status.INVALID,
                AuthEvidenceResolver.Resolution.Status.UNAVAILABLE)) {
            AtomicInteger reads = new AtomicInteger();
            AuthEvidenceResolver resolver = evidence -> AuthEvidenceResolver.Resolution.failure(status);
            VisitEvaluationContextService service = service(resolver, (principal, visitId) -> {
                reads.incrementAndGet();
                return found("completed");
            });

            var result = service.load("visit-owned", "opaque-session");

            assertEquals(status.name().toLowerCase(Locale.ROOT), result.authResolution().wireValue());
            assertNull(result.availability());
            assertNull(result.context());
            assertEquals(0, reads.get());
        }
    }

    @Test
    void unavailableAndTechnicalRepositoryFailuresStayDistinctAndCarryNoContext() {
        var unavailable = service(authenticated(), (principal, visitId) ->
                VisitEvaluationContextRepository.Result.unavailable()).load("visit-owned", "opaque-session");
        var failure = service(authenticated(), (principal, visitId) ->
                VisitEvaluationContextRepository.Result.technicalFailure()).load("visit-owned", "opaque-session");

        assertEquals("unavailable", unavailable.availability().wireValue());
        assertNull(unavailable.context());
        assertEquals("technical_failure", failure.availability().wireValue());
        assertNull(failure.context());
    }

    @Test
    void corruptPersistedStatusFailsClosedWithoutInventingDomainState() {
        VisitEvaluationContextService service = service(authenticated(), (principal, visitId) ->
                VisitEvaluationContextRepository.Result.found(new VisitEvaluationContextRepository.OwnedVisit(
                        visitId, "institution-1", "revision-4", "auto_completed")));

        var result = service.load("visit-owned", "opaque-session");

        assertEquals("technical_failure", result.availability().wireValue());
        assertNull(result.context());
    }

    @Test
    void unsafeVisitIdDoesNotReachRepository() {
        AtomicInteger reads = new AtomicInteger();
        VisitEvaluationContextService service = service(authenticated(), (principal, visitId) -> {
            reads.incrementAndGet();
            return found("completed");
        });

        var result = service.load("bad\nvisit", "opaque-session");

        assertEquals("not_found", result.availability().wireValue());
        assertNull(result.context());
        assertEquals(0, reads.get());
    }

    private static AuthEvidenceResolver authenticated() {
        return evidence -> AuthEvidenceResolver.Resolution.authenticated(OWNER);
    }

    private static VisitEvaluationContextRepository.Result found(String status) {
        return VisitEvaluationContextRepository.Result.found(new VisitEvaluationContextRepository.OwnedVisit(
                "visit-owned", "institution-1", "revision-4", status));
    }

    private static VisitEvaluationContextService service(
            AuthEvidenceResolver resolver,
            VisitEvaluationContextRepository repository
    ) {
        return new VisitEvaluationContextService(resolver, repository);
    }
}
