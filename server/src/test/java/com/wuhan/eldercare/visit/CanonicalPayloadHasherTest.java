package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.CanonicalPayloadHasher;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class CanonicalPayloadHasherTest {
    @Test
    void sameNormalizedPayloadHasSameHash() {
        CanonicalPayloadHasher hasher = new CanonicalPayloadHasher();
        assertEquals(hasher.hash(TestFixtures.command("key-0001")), hasher.hash(TestFixtures.command("key-0001")));
    }

    @Test
    void materialPayloadChangeHasDifferentHash() {
        CanonicalPayloadHasher hasher = new CanonicalPayloadHasher();
        var changed = new com.wuhan.eldercare.visit.domain.SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", "key-0001",
                "institution-1", "revision-7", "elder-1", "2026-10-01", "afternoon", 2, false,
                "张三", "13800000000", "appointment_or_consultant_contact", "explicit", "需要无障碍接待");
        assertNotEquals(hasher.hash(TestFixtures.command("key-0001")), hasher.hash(changed));
    }

    @Test
    void canonicalJsonCannotCollideThroughEmbeddedDelimiters() {
        CanonicalPayloadHasher hasher = new CanonicalPayloadHasher();
        var left = command("left\u001fright", "tail");
        var right = command("left", "right\u001ftail");
        assertNotEquals(left.canonicalMaterial(), right.canonicalMaterial());
        assertNotEquals(hasher.hash(left), hasher.hash(right));
    }

    @Test
    void canonicalJsonUsesC2FieldOrderAndOmitsAbsentOptionals() {
        var command = new com.wuhan.eldercare.visit.domain.SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", "canonical-key",
                "institution-1", "revision-7", "elder-1", "2026-10-01", "morning", 2, null,
                "张三", "13800000000", "appointment_or_consultant_contact", "explicit", null);
        assertEquals("{\"contractVersion\":\"appointment-institution-visit-contract-v1\","
                        + "\"kind\":\"appointment_submission_v1\",\"idempotencyKey\":\"canonical-key\","
                        + "\"institutionId\":\"institution-1\",\"institutionRecordRevision\":\"revision-7\","
                        + "\"elderId\":\"elder-1\",\"visitDate\":\"2026-10-01\","
                        + "\"visitTimePreference\":\"morning\",\"participantCount\":2,"
                        + "\"contactName\":\"张三\",\"phone\":\"13800000000\","
                        + "\"phonePurpose\":\"appointment_or_consultant_contact\","
                        + "\"phoneAuthorization\":\"explicit\"}", command.canonicalMaterial());
    }

    private static com.wuhan.eldercare.visit.domain.SubmissionCommandV1 command(String institutionId, String revision) {
        return new com.wuhan.eldercare.visit.domain.SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", "collision-key",
                institutionId, revision, "elder-1", "2026-10-01", "morning", 2, false,
                "张三", "13800000000", "appointment_or_consultant_contact", "explicit", "notes");
    }
}
