package com.wuhan.eldercare.visit.domain;

/**
 * Backend-local projection of the C2 AppointmentSubmissionV1 command.
 * It intentionally has no userId, visitId, status, acceptedAt or provider data.
 */
public record SubmissionCommandV1(
        String contractVersion,
        String kind,
        String idempotencyKey,
        String institutionId,
        String institutionRecordRevision,
        String elderId,
        String visitDate,
        String visitTimePreference,
        int participantCount,
        Boolean pickupRequested,
        String contactName,
        String phone,
        String phonePurpose,
        String phoneAuthorization,
        String notes
) {
    public SubmissionCommandV1 {
        contractVersion = trim(contractVersion);
        kind = trim(kind);
        idempotencyKey = trim(idempotencyKey);
        institutionId = trim(institutionId);
        institutionRecordRevision = trim(institutionRecordRevision);
        elderId = trim(elderId);
        visitDate = trim(visitDate);
        visitTimePreference = trim(visitTimePreference);
        contactName = trim(contactName);
        phone = trim(phone);
        phonePurpose = trim(phonePurpose);
        phoneAuthorization = trim(phoneAuthorization);
        notes = notes == null ? null : trim(notes);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    public boolean hasOptionalPickup() {
        return pickupRequested != null;
    }

    public String canonicalMaterial() {
        // Keep the exact C2 canonical submission order. Optional fields are
        // omitted, just as JSON.stringify omits undefined properties. JSON
        // escaping makes the representation collision-free without inventing
        // a second idempotency grammar on the Backend.
        StringBuilder material = new StringBuilder("{");
        appendString(material, "contractVersion", contractVersion, false);
        appendString(material, "kind", kind, true);
        appendString(material, "idempotencyKey", idempotencyKey, true);
        appendString(material, "institutionId", institutionId, true);
        appendString(material, "institutionRecordRevision", institutionRecordRevision, true);
        appendString(material, "elderId", elderId, true);
        appendString(material, "visitDate", visitDate, true);
        appendString(material, "visitTimePreference", visitTimePreference, true);
        appendNumber(material, "participantCount", participantCount);
        appendString(material, "contactName", contactName, true);
        appendString(material, "phone", phone, true);
        appendString(material, "phonePurpose", phonePurpose, true);
        appendString(material, "phoneAuthorization", phoneAuthorization, true);
        if (pickupRequested != null) appendBoolean(material, "pickupRequested", pickupRequested);
        if (notes != null) appendString(material, "notes", notes, true);
        material.append('}');
        return material.toString();
    }

    private static void appendString(StringBuilder target, String field, String value, boolean comma) {
        if (comma) target.append(',');
        quote(target, field);
        target.append(':');
        quote(target, value);
    }

    private static void appendNumber(StringBuilder target, String field, int value) {
        target.append(',');
        quote(target, field);
        target.append(':').append(value);
    }

    private static void appendBoolean(StringBuilder target, String field, boolean value) {
        target.append(',');
        quote(target, field);
        target.append(':').append(value);
    }

    private static void quote(StringBuilder target, String value) {
        target.append('"');
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> target.append("\\\"");
                case '\\' -> target.append("\\\\");
                case '\b' -> target.append("\\b");
                case '\f' -> target.append("\\f");
                case '\n' -> target.append("\\n");
                case '\r' -> target.append("\\r");
                case '\t' -> target.append("\\t");
                default -> {
                    if (character <= 0x1f) {
                        target.append("\\u");
                        String hex = Integer.toHexString(character);
                        target.append("0".repeat(4 - hex.length())).append(hex);
                    } else {
                        target.append(character);
                    }
                }
            }
        }
        target.append('"');
    }
}
