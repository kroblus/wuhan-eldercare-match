package com.wuhan.eldercare.visit.institution.appointment;

import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationPackageV1;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationProvisioner;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationRepository;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentEligibilityResolver;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishPackageV1;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishResult;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InstitutionAppointmentEligibilityResolverTest {
    private static final String INSTITUTION = "synthetic-institution-a";

    @Test
    void onlyExactCurrentPublishedAndExplicitlyAuthorizedRevisionIsEligible() {
        FakeRevisions revisions = new FakeRevisions();
        FakeAuthorizations authorizations = new FakeAuthorizations();
        var resolver = new InstitutionAppointmentEligibilityResolver(revisions, authorizations);
        authorizations.states.put(key(INSTITUTION, 4), InstitutionAppointmentAuthorizationRepository.Lookup.Status.AUTHORIZED);

        assertEquals(InstitutionAppointmentEligibilityResolver.Status.ELIGIBLE,
                resolver.resolve(INSTITUTION, "4").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_CURRENT,
                resolver.resolve(INSTITUTION, "3").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_PUBLISHED,
                resolver.resolve("synthetic-unpublished-institution", "1").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_AUTHORIZED,
                resolver.resolve("synthetic-no-authorization-institution", "1").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_FOUND,
                resolver.resolve("synthetic-unknown-institution", "1").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.UNAVAILABLE,
                resolver.resolve("synthetic-institution-source-unavailable", "1").status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.INVALID,
                resolver.resolve(INSTITUTION, "latest").status());
    }

    @Test
    void controlledProvisioningRequiresCurrentPublishedRevisionAndRevocationFailsClosed() {
        FakeRevisions revisions = new FakeRevisions();
        FakeAuthorizations authorizations = new FakeAuthorizations();
        var resolver = new InstitutionAppointmentEligibilityResolver(revisions, authorizations);
        var provisioner = new InstitutionAppointmentAuthorizationProvisioner(authorizations, resolver,
                Clock.fixed(Instant.parse("2026-09-27T12:30:00Z"), ZoneOffset.UTC));

        var oldGrant = request("synthetic-old-grant", InstitutionAppointmentAuthorizationPackageV1.Action.AUTHORIZE,
                INSTITUTION, 3);
        assertEquals(InstitutionAppointmentAuthorizationProvisioner.Status.INVALID, provisioner.apply(oldGrant).status());
        assertEquals(0, authorizations.events.size());

        var unavailableTarget = request("synthetic-unavailable-grant",
                InstitutionAppointmentAuthorizationPackageV1.Action.AUTHORIZE,
                "synthetic-institution-source-unavailable", 1);
        assertEquals(InstitutionAppointmentAuthorizationProvisioner.Status.UNAVAILABLE,
                provisioner.apply(unavailableTarget).status());
        assertEquals(0, authorizations.events.size());

        var grant = request("synthetic-grant", InstitutionAppointmentAuthorizationPackageV1.Action.AUTHORIZE,
                INSTITUTION, 4);
        assertEquals(InstitutionAppointmentAuthorizationProvisioner.Status.APPLIED, provisioner.apply(grant).status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.ELIGIBLE,
                resolver.resolve(INSTITUTION, "4").status());

        var revoke = request("synthetic-revoke", InstitutionAppointmentAuthorizationPackageV1.Action.REVOKE,
                INSTITUTION, 4);
        assertEquals(InstitutionAppointmentAuthorizationProvisioner.Status.APPLIED, provisioner.apply(revoke).status());
        assertEquals(InstitutionAppointmentEligibilityResolver.Status.NOT_AUTHORIZED,
                resolver.resolve(INSTITUTION, "4").status());
        assertEquals(2, authorizations.events.size());
        assertEquals(Instant.parse("2026-09-27T12:30:00Z"), authorizations.events.getFirst().recordedAt());
    }

    private static InstitutionAppointmentAuthorizationPackageV1 request(String operation,
            InstitutionAppointmentAuthorizationPackageV1.Action action, String institution, long revision) {
        return new InstitutionAppointmentAuthorizationPackageV1(operation, action, institution, revision,
                "approval-or-revocation-reference:" + operation, "operator:synthetic-backend");
    }

    private static String key(String institution, long revision) { return institution + ":" + revision; }

    private static final class FakeRevisions implements InstitutionRevisionRepository {
        private final Map<String, String> statuses = new HashMap<>();

        private FakeRevisions() {
            statuses.put(key(INSTITUTION, 4), "published");
            statuses.put(key(INSTITUTION, 3), "published");
            statuses.put(key("synthetic-unpublished-institution", 1), "draft");
            statuses.put(key("synthetic-no-authorization-institution", 1), "published");
        }

        @Override public InstitutionPublishResult publish(InstitutionPublishPackageV1 pack, Instant at) { return null; }

        @Override
        public CurrentHeadResult currentHead(String institutionId) {
            if (INSTITUTION.equals(institutionId)) return CurrentHeadResult.ready(institutionId, 4);
            if ("synthetic-unpublished-institution".equals(institutionId)) return CurrentHeadResult.ready(institutionId, 1);
            if ("synthetic-no-authorization-institution".equals(institutionId)) return CurrentHeadResult.ready(institutionId, 1);
            return CurrentHeadResult.unavailable();
        }

        @Override public ExactPublicNameResult resolveExactPublicName(String institutionId, long revision) {
            return ExactPublicNameResult.unavailable();
        }

        @Override
        public CurrentAppointmentRevisionResult resolveCurrentAppointmentRevision(String institutionId, long revision) {
            if ("synthetic-institution-source-unavailable".equals(institutionId)) {
                return CurrentAppointmentRevisionResult.unavailable();
            }
            if ("synthetic-unknown-institution".equals(institutionId)) {
                return CurrentAppointmentRevisionResult.notFound();
            }
            String status = statuses.get(key(institutionId, revision));
            long currentRevision = INSTITUTION.equals(institutionId) ? 4 : 1;
            return CurrentAppointmentRevisionResult.ready(institutionId, currentRevision,
                    status != null, status);
        }
    }

    private static final class FakeAuthorizations implements InstitutionAppointmentAuthorizationRepository {
        private final Map<String, Lookup.Status> states = new HashMap<>();
        private final java.util.List<Event> events = new java.util.ArrayList<>();

        @Override
        public Lookup latest(String institutionId, long revision) {
            return Lookup.of(states.getOrDefault(key(institutionId, revision), Lookup.Status.NOT_CONFIGURED));
        }

        @Override
        public Apply append(Event event) {
            events.add(event);
            states.put(key(event.institutionId(), event.recordRevision()), event.state() == Event.State.AUTHORIZED
                    ? Lookup.Status.AUTHORIZED : Lookup.Status.REVOKED);
            return Apply.of(Apply.Status.APPLIED);
        }
    }
}
