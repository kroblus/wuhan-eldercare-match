package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.domain.SubmissionValidation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.wuhan.eldercare.visit.web.SubmissionRequestV1;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SubmissionValidationTest {
    @Test
    void manualJsonPhoneNeverCoercesNonStringsAndPreservesForbiddenWhitespace() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        String p = "13" + "0".repeat(9);
        for (String rawJson : List.of(p, "true", "{}", "[]")) {
            assertThrows(JsonMappingException.class, () -> mapper.readValue("{\"phone\":" + rawJson + "}", SubmissionRequestV1.class), "non-string TEST_ONLY candidate must not coerce");
        }
        var parsed = mapper.readValue("{\"phone\":\"\\t" + p + "\\n\"}", SubmissionRequestV1.class);
        assertTrue(parsed.toCommand().phone().equals("\t" + p + "\n"));
        assertTrue(SubmissionValidation.issues(parsed.toCommand()).contains("phone"));
    }

    @Test
    void ownerApprovedPhonePolicyRejectsEveryInvalidCandidateBeforeAuthOrWrite() {
        String p = "13" + "0".repeat(9);
        List<String> invalid = new ArrayList<>(List.of("", "   ", p.substring(0, 10), p + "0", "0".repeat(6),
                "2" + p.substring(1), "10" + p.substring(2), "11" + p.substring(2), "12" + p.substring(2),
                p.substring(0, 3) + " " + p.substring(3), p + "\n", "\t" + p + "\t",
                "\u00a0" + p + "\u00a0", "\u2003" + p, "\ufeff" + p,
                p.substring(0, 10) + "A", "１" + "３" + "０".repeat(9), "١" + "٣" + "٠".repeat(9), "+86" + p));
        for (String delimiter : List.of("\r", "\n", "\r\n", "\0", "\u001f", "\u007f", "\t", "\u00a0", "-", "(", ")", "+", ".")) {
            invalid.add(p.substring(0, 3) + delimiter + p.substring(3));
        }
        invalid.add(null);
        for (String phone : invalid) {
            var request = command("test-only-phone-key", "institution-test", "2026-10-01", phone, null);
            assertTrue(SubmissionValidation.issues(request).contains("phone"), "invalid TEST_ONLY candidate must be rejected");
            java.util.concurrent.atomic.AtomicInteger downstream = new java.util.concurrent.atomic.AtomicInteger();
            var service = new com.wuhan.eldercare.visit.application.VisitSubmissionService(
                    evidence -> { downstream.incrementAndGet(); throw new AssertionError("auth must not run"); },
                    (evidence, purpose, name, number) -> { downstream.incrementAndGet(); throw new AssertionError("provider must not run"); },
                    (principal, elder, institution, revision) -> { downstream.incrementAndGet(); throw new AssertionError("references must not run"); },
                    (principal, cmd, contact) -> { downstream.incrementAndGet(); throw new AssertionError("repository must not run"); });
            assertEquals("VALIDATION_FAILED", service.submit(request, "TEST_ONLY", "TEST_ONLY").code());
            assertEquals(0, downstream.get());
        }
    }

    @Test
    void onlyEdgeAsciiSpacesAreNormalizedAndEveryApprovedSecondDigitPasses() {
        for (int second = 3; second <= 9; second++) {
            String p = "1" + second + "0".repeat(9);
            var request = command("test-only-phone-key", "institution-test", "2026-10-01", "   " + p + "  ", null);
            assertTrue(request.phone().equals(p), "canonical value must contain only the candidate digits");
            assertFalse(SubmissionValidation.issues(request).contains("phone"));
        }
        String raw = "\t13" + "0".repeat(9) + "\n";
        assertTrue(SubmissionValidation.normalizeManualPhone("  " + raw + "  ").equals(raw), "non-ASCII-space edges must remain visible to validation");
    }

    @Test
    void validC2CommandHasNoIssues() {
        assertTrue(SubmissionValidation.issues(TestFixtures.command("key-0001")).isEmpty());
    }

    @Test
    void elderIdMayBeOmittedAsAnAssertionAndWillBeResolvedByTheBackend() {
        var command = TestFixtures.command("key-elder-optional").withElderId(null);
        assertFalse(SubmissionValidation.issues(command).contains("elderId"));
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
