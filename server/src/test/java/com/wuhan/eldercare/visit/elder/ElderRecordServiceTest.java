package com.wuhan.eldercare.visit.elder;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.elder.application.ElderIdentitySource;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ElderRecordServiceTest {
    private static final TrustedPrincipal OWNER = new TrustedPrincipal("synthetic-c5-user-a");

    @Test
    void resolveIsReadOnlyAndOnlyExplicitEstablishCreatesAnOpaqueStableIdentity() {
        InMemoryRepository repository = new InMemoryRepository();
        AtomicInteger idCalls = new AtomicInteger();
        ElderIdentitySource ids = new ElderIdentitySource() {
            @Override public String newElderId() { return "elder_server_" + idCalls.incrementAndGet(); }
            @Override public Instant createdAt() { return Instant.parse("2026-09-27T00:00:00Z"); }
        };
        ElderRecordService service = service(evidence -> AuthEvidenceResolver.Resolution.authenticated(OWNER), repository, ids);

        var empty = service.resolveCurrent("synthetic-session");
        assertEquals(ElderRecordService.Availability.NOT_FOUND, empty.availability());
        assertEquals(0, repository.records.size(), "ordinary resolution must not establish a binding");

        var first = service.establishCurrent("synthetic-session");
        var repeated = service.establishCurrent("synthetic-session");

        assertEquals(ElderRecordService.Establishment.Status.CREATED, first.status());
        assertEquals(ElderRecordService.Establishment.Status.ALREADY_BOUND, repeated.status());
        assertEquals("elder_server_1", first.record().elderId());
        assertEquals(first.record().elderId(), repeated.record().elderId());
        assertEquals(1, repository.records.size());
        assertEquals(1, idCalls.get());
    }

    @Test
    void missingExpiredAndInvalidC5EvidenceNeverReadsOrWritesElderRecords() {
        for (AuthEvidenceResolver.Resolution.Status status : new AuthEvidenceResolver.Resolution.Status[] {
                AuthEvidenceResolver.Resolution.Status.MISSING,
                AuthEvidenceResolver.Resolution.Status.EXPIRED,
                AuthEvidenceResolver.Resolution.Status.INVALID,
                AuthEvidenceResolver.Resolution.Status.UNAVAILABLE }) {
            InMemoryRepository repository = new InMemoryRepository();
            AtomicInteger idCalls = new AtomicInteger();
            ElderRecordService service = service(
                    evidence -> AuthEvidenceResolver.Resolution.failure(status), repository,
                    fixedIds(idCalls));

            var resolved = service.resolveCurrent("synthetic-session");
            var established = service.establishCurrent("synthetic-session");

            assertEquals(status, resolved.authStatus());
            assertEquals(status, established.authStatus());
            assertNull(resolved.availability());
            assertNull(established.status());
            assertEquals(0, repository.reads);
            assertEquals(0, repository.writes);
            assertEquals(0, idCalls.get());
        }
    }

    @Test
    void foreignAndUnknownElderAssertionsHaveTheSamePrivacySafeOutcome() {
        InMemoryRepository repository = new InMemoryRepository();
        ElderRecordService service = service(evidence -> AuthEvidenceResolver.Resolution.authenticated(OWNER),
                repository, fixedIds(new AtomicInteger()));
        var created = service.establishCurrent("synthetic-session");
        repository.records.put("synthetic-c5-user-b", new ElderRecord(
                "elder_foreign_synthetic", "synthetic-c5-user-b", Instant.parse("2026-09-27T00:00:00Z")));

        assertEquals(ReferenceAuthorizer.Authorization.UNAUTHORIZED,
                service.authorizeAssertion(OWNER, "elder_unknown_synthetic"));
        assertEquals(ReferenceAuthorizer.Authorization.UNAUTHORIZED,
                service.authorizeAssertion(OWNER, "elder_foreign_synthetic"));
        assertEquals(ReferenceAuthorizer.Authorization.AUTHORIZED,
                service.authorizeAssertion(OWNER, created.record().elderId()));
    }

    @Test
    void invalidOrMissingAssertionCannotSelectAnotherRecord() {
        InMemoryRepository repository = new InMemoryRepository();
        ElderRecordService service = service(evidence -> AuthEvidenceResolver.Resolution.authenticated(OWNER),
                repository, fixedIds(new AtomicInteger()));
        service.establishCurrent("synthetic-session");

        assertEquals(ReferenceAuthorizer.Authorization.INVALID, service.authorizeAssertion(OWNER, null));
        assertEquals(ReferenceAuthorizer.Authorization.INVALID, service.authorizeAssertion(OWNER, " "));
        assertEquals(ReferenceAuthorizer.Authorization.UNAUTHORIZED, service.authorizeAssertion(
                new TrustedPrincipal("synthetic-c5-user-b"), "elder_server_1"));
    }

    private static ElderRecordService service(AuthEvidenceResolver auth, InMemoryRepository repository,
                                              ElderIdentitySource ids) {
        return new ElderRecordService(auth, repository, ids);
    }

    private static ElderIdentitySource fixedIds(AtomicInteger calls) {
        return new ElderIdentitySource() {
            @Override public String newElderId() { calls.incrementAndGet(); return "elder_server_1"; }
            @Override public Instant createdAt() { return Instant.parse("2026-09-27T00:00:00Z"); }
        };
    }

    private static final class InMemoryRepository implements ElderRecordRepository {
        private final Map<String, ElderRecord> records = new HashMap<>();
        private int reads;
        private int writes;

        @Override
        public Lookup findByResponsibleUserId(String responsibleUserId) {
            reads++;
            ElderRecord record = records.get(responsibleUserId);
            return record == null ? Lookup.of(Lookup.Status.NOT_FOUND) : Lookup.found(record);
        }

        @Override
        public Establish establish(ElderRecord candidate) {
            writes++;
            ElderRecord existing = records.get(candidate.responsibleUserId());
            if (existing != null) return Establish.alreadyBound(existing);
            if (records.values().stream().anyMatch(item -> item.elderId().equals(candidate.elderId()))) {
                return Establish.of(Establish.Status.TECHNICAL_FAILURE);
            }
            records.put(candidate.responsibleUserId(), candidate);
            return Establish.created(candidate);
        }
    }
}
