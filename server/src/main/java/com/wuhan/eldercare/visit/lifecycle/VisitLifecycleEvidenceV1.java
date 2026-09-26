package com.wuhan.eldercare.visit.lifecycle;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * A typed Operations attestation. {@code factAt} is asserted business fact time, not server
 * acceptance time: for a confirmed plan it is the appointment time; for an in-person visit
 * it is the attested occurrence time. It stays absent when precise time is not truthfully known.
 */
public record VisitLifecycleEvidenceV1(Kind kind, String reference, Instant factAt) {
    public enum Kind {
        FOLLOW_UP_UNDERWAY("follow_up_underway", "contacting"),
        CONFIRMED_VISIT_PLAN("confirmed_visit_plan", "scheduled"),
        IN_PERSON_VISIT_OCCURRED("in_person_visit_occurred", "completed"),
        CANCELLATION_CONFIRMED("cancellation_confirmed", "cancelled");

        private final String wireValue;
        private final String targetStatus;

        Kind(String wireValue, String targetStatus) {
            this.wireValue = wireValue;
            this.targetStatus = targetStatus;
        }

        public String wireValue() { return wireValue; }
        public String targetStatus() { return targetStatus; }

        public static Kind fromWire(String value) {
            for (Kind kind : values()) if (kind.wireValue.equals(value)) return kind;
            return null;
        }
    }

    public VisitLifecycleEvidenceV1 {
        if (kind == null) throw new IllegalArgumentException("evidence kind required");
        // V7 persists operational facts as MySQL TIMESTAMP(6); align result and replay precision.
        if (factAt != null) factAt = factAt.truncatedTo(ChronoUnit.MICROS);
        if (reference != null && (reference.isBlank() || reference.length() > 200
                || !reference.matches("[A-Za-z0-9._:/-]{1,200}"))) {
            throw new IllegalArgumentException("evidence reference invalid");
        }
    }

}
