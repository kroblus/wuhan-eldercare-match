package com.wuhan.eldercare.visit.domain;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;

public final class SubmissionValidation {
    public static final String CONTRACT_VERSION = "appointment-institution-visit-contract-v1";
    public static final String KIND = "appointment_submission_v1";
    public static final String PHONE_PURPOSE = "appointment_or_consultant_contact";
    public static final String PHONE_AUTHORIZATION = "explicit";
    private static final int ID_MIN_LENGTH = 1;
    private static final int ID_MAX_LENGTH = 200;
    private static final int IDEMPOTENCY_MIN_LENGTH = 8;
    private static final int IDEMPOTENCY_MAX_LENGTH = 128;
    private static final int DATE_MAX_LENGTH = 32;
    private static final int TIME_PREFERENCE_MAX_LENGTH = 80;
    private static final int CONTACT_NAME_MAX_LENGTH = 200;
    private static final int NOTES_MAX_LENGTH = 2000;
    private static final DateTimeFormatter STRICT_DATE =
            DateTimeFormatter.ofPattern("uuuu-MM-dd").withResolverStyle(ResolverStyle.STRICT);

    private SubmissionValidation() {
    }

    public static List<String> issues(SubmissionCommandV1 command) {
        List<String> issues = new ArrayList<>();
        if (command == null) {
            issues.add("command");
            return issues;
        }
        required(issues, "contractVersion", command.contractVersion());
        required(issues, "kind", command.kind());
        required(issues, "idempotencyKey", command.idempotencyKey());
        required(issues, "institutionId", command.institutionId());
        required(issues, "institutionRecordRevision", command.institutionRecordRevision());
        required(issues, "visitDate", command.visitDate());
        required(issues, "visitTimePreference", command.visitTimePreference());
        required(issues, "contactName", command.contactName());
        required(issues, "phone", command.phone());
        if (!CONTRACT_VERSION.equals(command.contractVersion())) issues.add("contractVersion");
        if (!KIND.equals(command.kind())) issues.add("kind");
        validateIdempotencyKey(issues, command.idempotencyKey());
        validateOpaqueId(issues, "institutionId", command.institutionId());
        validateOpaqueId(issues, "institutionRecordRevision", command.institutionRecordRevision());
        if (command.elderId() != null) validateOpaqueId(issues, "elderId", command.elderId());
        validateDate(issues, command.visitDate());
        validateLength(issues, "visitTimePreference", command.visitTimePreference(), 1, TIME_PREFERENCE_MAX_LENGTH);
        validateLength(issues, "contactName", command.contactName(), 1, CONTACT_NAME_MAX_LENGTH);
        validatePhone(issues, command.phone());
        if (command.participantCount() < 1 || command.participantCount() > 1000) issues.add("participantCount");
        if (!PHONE_PURPOSE.equals(command.phonePurpose())) issues.add("phonePurpose");
        if (!PHONE_AUTHORIZATION.equals(command.phoneAuthorization())) issues.add("phoneAuthorization");
        if (command.notes() != null) validateLength(issues, "notes", command.notes(), 1, NOTES_MAX_LENGTH);
        return List.copyOf(issues);
    }

    private static void required(List<String> issues, String path, String value) {
        if (value == null || value.isBlank()) issues.add(path);
    }

    private static void validateLength(List<String> issues, String path, String value, int min, int max) {
        if (value == null || value.length() < min || value.length() > max) issues.add(path);
    }

    private static void validateOpaqueId(List<String> issues, String path, String value) {
        if (value == null) return;
        validateLength(issues, path, value, ID_MIN_LENGTH, ID_MAX_LENGTH);
        if (hasControlCharacter(value)) issues.add(path);
    }

    private static void validateIdempotencyKey(List<String> issues, String value) {
        if (value == null) return;
        validateLength(issues, "idempotencyKey", value, IDEMPOTENCY_MIN_LENGTH, IDEMPOTENCY_MAX_LENGTH);
        if (containsWhitespace(value) || value.matches("\\d+") || value.matches(".*[@()+].*")) {
            issues.add("idempotencyKey");
        }
    }

    private static void validateDate(List<String> issues, String value) {
        if (value == null || value.length() < 1 || value.length() > DATE_MAX_LENGTH
                || !value.matches("\\d{4}-\\d{2}-\\d{2}")) {
            issues.add("visitDate");
            return;
        }
        try {
            LocalDate parsed = LocalDate.parse(value, STRICT_DATE);
            if (parsed.getYear() < 1) issues.add("visitDate");
        } catch (DateTimeParseException ignored) {
            issues.add("visitDate");
        }
    }

    private static void validatePhone(List<String> issues, String value) {
        if (value == null || value.length() != 11 || !value.matches("1[3-9][0-9]{9}")) issues.add("phone");
    }

    /** APPOINTMENT_PHONE_FORMAT_V1: only edge U+0020 is removed, before independent validation. */
    public static String normalizeManualPhone(String value) {
        if (value == null) return null;
        int start = 0;
        int end = value.length();
        while (start < end && value.charAt(start) == ' ') start++;
        while (end > start && value.charAt(end - 1) == ' ') end--;
        return value.substring(start, end);
    }

    private static boolean hasControlCharacter(String value) {
        return value.chars().anyMatch(character -> character <= 0x1F || character == 0x7F);
    }

    private static boolean containsWhitespace(String value) {
        return value.codePoints().anyMatch(Character::isWhitespace);
    }
}
