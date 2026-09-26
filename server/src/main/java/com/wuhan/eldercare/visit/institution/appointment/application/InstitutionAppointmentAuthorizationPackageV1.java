package com.wuhan.eldercare.visit.institution.appointment.application;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Set;

/** Controlled, backend-only provisioning intent. This has no public HTTP binding. */
public record InstitutionAppointmentAuthorizationPackageV1(
        String operationId,
        Action action,
        String institutionId,
        long recordRevision,
        String provenanceReference,
        String operatorReference
) {
    public static final String PACKAGE_VERSION = "institution-appointment-authorization-package-v1";
    private static final long MAX_SAFE_REVISION = 9_007_199_254_740_991L;
    private static final Set<String> FIELDS = Set.of("packageVersion", "operationId", "action", "institutionId",
            "recordRevision", "provenanceReference", "operatorReference");

    public InstitutionAppointmentAuthorizationPackageV1 {
        if (blank(operationId) || operationId.length() > 120 || action == null || blank(institutionId)
                || institutionId.length() > 200 || recordRevision < 1 || recordRevision > MAX_SAFE_REVISION
                || blank(provenanceReference) || provenanceReference.length() > 1000
                || blank(operatorReference) || operatorReference.length() > 120) {
            throw new IllegalArgumentException("invalid Institution appointment authorization package");
        }
    }

    public static ParseResult parse(JsonNode value) {
        if (value == null || !value.isObject() || !PACKAGE_VERSION.equals(value.path("packageVersion").asText(null))) {
            return ParseResult.invalid();
        }
        var fields = value.fieldNames();
        while (fields.hasNext()) if (!FIELDS.contains(fields.next())) return ParseResult.invalid();
        if (value.size() != FIELDS.size() || !value.path("recordRevision").isIntegralNumber()
                || !value.path("recordRevision").canConvertToLong()) return ParseResult.invalid();
        Action action = switch (value.path("action").asText("")) {
            case "authorize" -> Action.AUTHORIZE;
            case "revoke" -> Action.REVOKE;
            default -> null;
        };
        try {
            return ParseResult.valid(new InstitutionAppointmentAuthorizationPackageV1(
                    value.path("operationId").asText(null), action,
                    value.path("institutionId").asText(null), value.path("recordRevision").asLong(),
                    value.path("provenanceReference").asText(null), value.path("operatorReference").asText(null)));
        } catch (RuntimeException ignored) {
            return ParseResult.invalid();
        }
    }

    public enum Action { AUTHORIZE, REVOKE }

    public record ParseResult(Status status, InstitutionAppointmentAuthorizationPackageV1 value) {
        public enum Status { VALID, INVALID }
        public ParseResult {
            if (status == null || ((status == Status.VALID) != (value != null))) {
                throw new IllegalArgumentException("package parse result invalid");
            }
        }
        static ParseResult valid(InstitutionAppointmentAuthorizationPackageV1 value) {
            return new ParseResult(Status.VALID, value);
        }
        static ParseResult invalid() { return new ParseResult(Status.INVALID, null); }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
