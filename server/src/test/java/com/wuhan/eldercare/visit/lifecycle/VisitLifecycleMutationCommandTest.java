package com.wuhan.eldercare.visit.lifecycle;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VisitLifecycleMutationCommandTest {
    @Test
    void absentFactTimeStaysAbsentAndScheduledAppointmentTimeIsCanonicalized() {
        var absent = VisitLifecycleMutationCommandV1.create(
                "op-1", "contacting", "scheduled", "confirmed_visit_plan", null, null);
        var withOffset = VisitLifecycleMutationCommandV1.create(
                "op-1", "contacting", "scheduled", "confirmed_visit_plan", null, "2026-10-02T10:00:00+08:00");
        var withUtc = VisitLifecycleMutationCommandV1.create(
                "op-1", "contacting", "scheduled", "confirmed_visit_plan", null, "2026-10-02T02:00:00Z");

        assertTrue(absent.evidenceMatchesTarget());
        assertNull(absent.evidence().factAt());
        assertEquals(withOffset.requestFingerprint(), withUtc.requestFingerprint());
    }

    @Test
    void completionEvidenceMustBeTypedAndUnknownOrClientOnlyClaimsAreNotContent() {
        var complete = VisitLifecycleMutationCommandV1.create(
                "op-2", "scheduled", "completed", "in_person_visit_occurred", null,
                "2026-09-26T10:00:00Z");
        var noEvidence = VisitLifecycleMutationCommandV1.create("op-3", "scheduled", "completed", null, null, null);
        var wrongEvidence = VisitLifecycleMutationCommandV1.create(
                "op-4", "scheduled", "completed", "confirmed_visit_plan", null, null);
        var unknownEvidence = VisitLifecycleMutationCommandV1.create(
                "op-5", "scheduled", "completed", "user_says_visited", null, null);
        var evaluationEvidence = VisitLifecycleMutationCommandV1.create(
                "op-6", "scheduled", "completed", "evaluation_submitted", null, null);

        assertTrue(complete.evidenceMatchesTarget());
        assertFalse(noEvidence.evidenceMatchesTarget());
        assertFalse(wrongEvidence.evidenceMatchesTarget());
        assertNull(unknownEvidence);
        assertNull(evaluationEvidence, "Evaluation is not a Visit completion evidence source");
        assertNotEquals(complete.requestFingerprint(), wrongEvidence.requestFingerprint());
    }

    @Test
    void malformedOperationIdentityStatusReferenceOrFactTimeIsRejected() {
        assertNull(VisitLifecycleMutationCommandV1.create("", "requested", "contacting", "follow_up_underway", null, null));
        assertNull(VisitLifecycleMutationCommandV1.create("op", "pending", "contacting", "follow_up_underway", null, null));
        assertNull(VisitLifecycleMutationCommandV1.create("op", "requested", "contacting", "follow_up_underway", "bad ref", null));
        assertNull(VisitLifecycleMutationCommandV1.create("op", "requested", "contacting", "follow_up_underway", null, "tomorrow"));
    }
}
