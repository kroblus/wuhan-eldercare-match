package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.domain.SubmissionValidation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SubmissionValidationTest {
    @Test
    void validC2CommandHasNoIssues() {
        assertTrue(SubmissionValidation.issues(TestFixtures.command("key-0001")).isEmpty());
    }

    @Test
    void invalidPhonePurposeFailsClosed() {
        var command = new com.wuhan.eldercare.visit.domain.SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", "key-1",
                "institution-1", "revision-7", "elder-1", "2026-10-01", "morning", 1, null,
                "张三", "13800000000", "institution_official_phone", "explicit", null);
        assertTrue(SubmissionValidation.issues(command).contains("phonePurpose"));
    }

    @Test
    void missingContactFailsClosed() {
        var command = new com.wuhan.eldercare.visit.domain.SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", "key-1",
                "institution-1", "revision-7", "elder-1", "2026-10-01", "morning", 1, null,
                "", "", "appointment_or_consultant_contact", "explicit", null);
        assertTrue(SubmissionValidation.issues(command).contains("contactName"));
        assertTrue(SubmissionValidation.issues(command).contains("phone"));
    }

    @Test
    void c2IdempotencyRulesFailClosed() {
        assertTrue(SubmissionValidation.issues(command("short", "institution-1", "2026-10-01", "13800000000", null))
                .contains("idempotencyKey"));
        assertTrue(SubmissionValidation.issues(command("12345678", "institution-1", "2026-10-01", "13800000000", null))
                .contains("idempotencyKey"));
        assertTrue(SubmissionValidation.issues(command("invalid key", "institution-1", "2026-10-01", "13800000000", null))
                .contains("idempotencyKey"));
        assertTrue(SubmissionValidation.issues(command("invalid@key", "institution-1", "2026-10-01", "13800000000", null))
                .contains("idempotencyKey"));
    }

    @Test
    void c2IdentityDateAndPhoneRulesFailClosed() {
        assertTrue(SubmissionValidation.issues(command("valid-key", "bad\u001fid", "2026-10-01", "13800000000", null))
                .contains("institutionId"));
        assertTrue(SubmissionValidation.issues(command("valid-key", "institution-1", "2026-02-30", "13800000000", null))
                .contains("visitDate"));
        assertTrue(SubmissionValidation.issues(command("valid-key", "institution-1", "2026-10-01", "abc123456", null))
                .contains("phone"));
        assertTrue(SubmissionValidation.issues(command("valid-key", "institution-1", "2026-10-01", "12345", null))
                .contains("phone"));
    }

    @Test
    void c2LengthAndNotesRulesMatchFoundation() {
        String contactAtLimit = "联".repeat(200);
        var valid = new com.wuhan.eldercare.visit.domain.SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", "valid-key",
                "institution-1", "revision-7", "elder-1", "2026-10-01", "morning", 1, null,
                contactAtLimit, "13800000000", "appointment_or_consultant_contact", "explicit", "备".repeat(2000));
        assertFalse(SubmissionValidation.issues(valid).contains("contactName"));
        assertFalse(SubmissionValidation.issues(valid).contains("notes"));

        var tooLong = new com.wuhan.eldercare.visit.domain.SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", "valid-key",
                "institution-1", "revision-7", "elder-1", "2026-10-01", "morning", 1, null,
                "联".repeat(201), "13800000000", "appointment_or_consultant_contact", "explicit", "备".repeat(2001));
        assertTrue(SubmissionValidation.issues(tooLong).contains("contactName"));
        assertTrue(SubmissionValidation.issues(tooLong).contains("notes"));
    }

    private static com.wuhan.eldercare.visit.domain.SubmissionCommandV1 command(
            String key, String institutionId, String date, String phone, String notes
    ) {
        return new com.wuhan.eldercare.visit.domain.SubmissionCommandV1(
                "appointment-institution-visit-contract-v1", "appointment_submission_v1", key,
                institutionId, "revision-7", "elder-1", date, "morning", 1, null,
                "张三", phone, "appointment_or_consultant_contact", "explicit", notes);
    }
}
