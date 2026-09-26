package com.wuhan.eldercare.visit.institution.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Set;
import java.util.regex.Pattern;

/** Strict internal import envelope. It contains no revision or head authority. */
public record InstitutionPublishPackageV1(
        String operationId,
        String sourceReference,
        String operatorReference,
        ObjectNode record
) {
    private static final Set<String> EXACT_KEYS = Set.of(
            "packageVersion", "operationId", "sourceReference", "operatorReference", "record");
    private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z][A-Za-z0-9._:-]{0,119}");
    private static final Pattern OPERATOR_REFERENCE = Pattern.compile("ops:[A-Za-z][A-Za-z0-9._:-]{0,110}");
    private static final Pattern PHONE_LIKE = Pattern.compile(".*(?:\\+?\\d[\\d ()-]{7,}\\d).*", Pattern.DOTALL);

    public InstitutionPublishPackageV1 {
        record = record == null ? null : record.deepCopy();
    }

    public static ParseResult parse(JsonNode input) {
        if (input == null || !input.isObject() || !hasExactKeys(input, EXACT_KEYS)) {
            return ParseResult.invalid("INVALID_PACKAGE_SHAPE");
        }
        if (!"institution-publish-package-v1".equals(input.path("packageVersion").asText(null))) {
            return ParseResult.invalid("UNSUPPORTED_PACKAGE_VERSION");
        }
        String operationId = text(input, "operationId");
        String sourceReference = text(input, "sourceReference");
        String operatorReference = text(input, "operatorReference");
        JsonNode record = input.get("record");
        if (operationId == null || !IDENTIFIER.matcher(operationId).matches()) {
            return ParseResult.invalid("INVALID_OPERATION_ID");
        }
        if (sourceReference == null || sourceReference.length() > 1000 || hasControlCharacters(sourceReference)) {
            return ParseResult.invalid("INVALID_SOURCE_REFERENCE");
        }
        if (operatorReference == null || !OPERATOR_REFERENCE.matcher(operatorReference).matches()
                || PHONE_LIKE.matcher(operatorReference).matches()) {
            return ParseResult.invalid("INVALID_OPERATOR_REFERENCE");
        }
        if (record == null || !record.isObject()) {
            return ParseResult.invalid("INVALID_RECORD_CANDIDATE");
        }
        return ParseResult.valid(new InstitutionPublishPackageV1(
                operationId, sourceReference, operatorReference, (ObjectNode) record));
    }

    private static String text(JsonNode input, String field) {
        JsonNode value = input.get(field);
        if (value == null || !value.isTextual()) return null;
        String text = value.asText().trim();
        return text.isEmpty() ? null : text;
    }

    private static boolean hasControlCharacters(String value) {
        return value.chars().anyMatch(Character::isISOControl);
    }

    private static boolean hasExactKeys(JsonNode object, Set<String> keys) {
        if (object.size() != keys.size()) return false;
        for (String field : keys) if (!object.has(field)) return false;
        return true;
    }

    public record ParseResult(Status status, InstitutionPublishPackageV1 value, String code) {
        public static ParseResult valid(InstitutionPublishPackageV1 value) {
            return new ParseResult(Status.VALID, value, null);
        }

        public static ParseResult invalid(String code) {
            return new ParseResult(Status.INVALID, null, code);
        }

        public enum Status { VALID, INVALID }
    }
}
