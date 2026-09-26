package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.AppointmentOwnerReadRepository;
import com.wuhan.eldercare.visit.application.AppointmentOwnerReadService;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishResult;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.application.InstitutionHistoricalPublicNameResolver;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class AppointmentOwnerReadServiceTest {
    private static final TrustedPrincipal OWNER = new TrustedPrincipal("synthetic-owner");

    @Test
    void readyCollectionPreservesAllFiveStatusesAndUsesOnlyTrustedOwner() {
        List<TrustedPrincipal> requestedPrincipals = new ArrayList<>();
        FakeInstitutionRepository institutions = new FakeInstitutionRepository();
        institutions.names.put("synthetic-institution:1", InstitutionRevisionRepository.ExactPublicNameResult
                .ready("synthetic-institution", 1, "Synthetic Historical Name"));
        List<AppointmentOwnerReadRepository.OwnedVisit> visits = List.of(
                visit("requested"), visit("contacting"), visit("scheduled"), visit("completed"), visit("cancelled"));
        var service = service(authenticated(), principal -> {
            requestedPrincipals.add(principal);
            return AppointmentOwnerReadRepository.Result.ready(visits);
        }, institutions);

        var result = service.load("opaque-session");

        assertEquals("ready", result.availability().wireValue());
        assertEquals(List.of("requested", "contacting", "scheduled", "completed", "cancelled"),
                result.items().stream().map(AppointmentOwnerReadService.AppointmentListItem::visitStatus).toList());
        assertEquals(List.of(OWNER), requestedPrincipals);
        assertEquals(List.of("synthetic-institution:1", "synthetic-institution:1", "synthetic-institution:1",
                "synthetic-institution:1", "synthetic-institution:1"), institutions.lookups);
        assertEquals("Synthetic Historical Name", result.items().getFirst().institutionDisplay().name());
    }

    @Test
    void validOwnerWithNoVisitsIsReadyEmpty() {
        var service = service(authenticated(), principal -> AppointmentOwnerReadRepository.Result.ready(List.of()),
                new FakeInstitutionRepository());

        var result = service.load("opaque-session");

        assertEquals("authenticated", result.authResolution().wireValue());
        assertEquals("ready", result.availability().wireValue());
        assertEquals(List.of(), result.items());
    }

    @Test
    void unauthenticatedAndExpiredSessionsReturnNoItemsAndSkipOwnerRepository() {
        for (AuthEvidenceResolver.Resolution.Status status : List.of(
                AuthEvidenceResolver.Resolution.Status.MISSING,
                AuthEvidenceResolver.Resolution.Status.EXPIRED,
                AuthEvidenceResolver.Resolution.Status.INVALID)) {
            int[] reads = {0};
            var service = service(evidence -> AuthEvidenceResolver.Resolution.failure(status), principal -> {
                reads[0]++;
                return AppointmentOwnerReadRepository.Result.ready(List.of(visit("completed")));
            }, new FakeInstitutionRepository());

            var result = service.load("opaque-session");

            assertEquals(status.name().toLowerCase(), result.authResolution().wireValue());
            assertNull(result.availability());
            assertNull(result.items());
            assertEquals(0, reads[0]);
        }
    }

    @Test
    void exactRevisionUnavailableKeepsVisitAndDoesNotAskForLatestRevision() {
        FakeInstitutionRepository institutions = new FakeInstitutionRepository();
        institutions.names.put("synthetic-institution:8", InstitutionRevisionRepository.ExactPublicNameResult.unavailable());
        var service = service(authenticated(), principal -> AppointmentOwnerReadRepository.Result.ready(
                List.of(new AppointmentOwnerReadRepository.OwnedVisit("visit-1", "synthetic-institution", "8",
                        "completed", "2026-10-01", "morning", 1, null))), institutions);

        var result = service.load("opaque-session");

        assertEquals("ready", result.availability().wireValue());
        assertEquals(1, result.items().size());
        assertEquals("unavailable", result.items().getFirst().institutionDisplay().availability().wireValue());
        assertNull(result.items().getFirst().institutionDisplay().name());
        assertEquals(List.of("synthetic-institution:8"), institutions.lookups);
    }

    @Test
    void unknownStatusOrTechnicalHistoricalReadFailsWholeCollectionClosed() {
        var corruptStatus = service(authenticated(), principal -> AppointmentOwnerReadRepository.Result.ready(
                List.of(new AppointmentOwnerReadRepository.OwnedVisit("visit-1", "synthetic-institution", "1",
                        "auto_completed", "2026-10-01", "morning", 1, null))), new FakeInstitutionRepository())
                .load("opaque-session");
        assertEquals("technical_failure", corruptStatus.availability().wireValue());
        assertNull(corruptStatus.items());

        FakeInstitutionRepository institutions = new FakeInstitutionRepository();
        institutions.failure = true;
        var resolverFailure = service(authenticated(), principal -> AppointmentOwnerReadRepository.Result.ready(
                List.of(visit("completed"))), institutions).load("opaque-session");
        assertEquals("technical_failure", resolverFailure.availability().wireValue());
        assertNull(resolverFailure.items());
    }

    private static AppointmentOwnerReadRepository.OwnedVisit visit(String status) {
        return new AppointmentOwnerReadRepository.OwnedVisit("visit-" + status, "synthetic-institution", "1",
                status, "2026-10-01", "morning", 2, false);
    }

    private static AuthEvidenceResolver authenticated() {
        return evidence -> AuthEvidenceResolver.Resolution.authenticated(OWNER);
    }

    private static AppointmentOwnerReadService service(
            AuthEvidenceResolver auth,
            AppointmentOwnerReadRepository repository,
            FakeInstitutionRepository institutions
    ) {
        return new AppointmentOwnerReadService(auth, repository, new InstitutionHistoricalPublicNameResolver(institutions));
    }

    private static final class FakeInstitutionRepository implements InstitutionRevisionRepository {
        private final Map<String, ExactPublicNameResult> names = new java.util.HashMap<>();
        private final List<String> lookups = new ArrayList<>();
        private boolean failure;

        @Override public InstitutionPublishResult publish(
                com.wuhan.eldercare.visit.institution.application.InstitutionPublishPackageV1 publishPackage,
                Instant publishedAt) { return null; }
        @Override public CurrentHeadResult currentHead(String institutionId) { return null; }

        @Override
        public ExactPublicNameResult resolveExactPublicName(String institutionId, long recordRevision) {
            lookups.add(institutionId + ":" + recordRevision);
            if (failure) return ExactPublicNameResult.technicalFailure();
            return names.getOrDefault(institutionId + ":" + recordRevision, ExactPublicNameResult.unavailable());
        }
    }
}
