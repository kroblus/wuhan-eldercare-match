package com.wuhan.eldercare.visit.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Frozen V1 write-contract validation and safe field-error projection. */
public final class VisitEvaluationWriteValidation {
    private static final Set<String> CONSIDERATIONS = Set.of("willing", "compare", "not_considering");
    private static final Set<String> RATINGS = Set.of(
            "hygiene", "room_comfort", "age_friendly_facilities", "common_space", "living_atmosphere",
            "service_attitude", "professional_impression", "communication_with_elder", "on_site_care_order",
            "medical_support", "emergency_explanation", "rehabilitation_facilities", "safety_management",
            "dining_room_environment", "meal_impression", "dietary_arrangement_explanation", "dietary_needs_fit",
            "activity_space", "activity_variety", "daily_life_atmosphere", "common_area_use");
    private static final Set<String> FEE_TOPICS = Set.of(
            "bed_fee", "meal_fee", "care_fee", "management_fee", "special_care_fee", "deposit", "other_one_time_fee");
    private static final Set<String> FEE_ANSWERS = Set.of("explained", "not_explained", "unconfirmed");
    private static final Set<String> OBSERVATION_ANSWERS = Set.of("yes", "no", "unconfirmed");
    private static final Set<String> HANDOVER_TOPICS = Set.of(
            "vital_signs", "abnormal_events", "handling_method", "follow_up", "family_communication", "unconfirmed");
    private static final Set<String> TAGS = Set.of(
            "care", "medical", "room", "environment", "dining", "activities", "transport", "price",
            "staff_attitude", "other");
    private static final Set<String> AGGREGATE_FEE_CLARITY = Set.of("clear", "unclear");

    private VisitEvaluationWriteValidation() {
    }

    public static List<FieldError> validateEnvelope(String contractVersion, String kind, String idempotencyKey) {
        List<FieldError> errors = new ArrayList<>();
        if (!"visit-evaluation-production-write-contract-v1".equals(contractVersion)) {
            add(errors, "contractVersion", "INVALID_CONTRACT_VERSION");
        }
        if (!"visit_evaluation_submission_request_v1".equals(kind)) {
            add(errors, "kind", "INVALID_KIND");
        }
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() < 8
                || idempotencyKey.length() > 128 || hasControlOrWhitespace(idempotencyKey)) {
            add(errors, "idempotencyKey", "INVALID_IDEMPOTENCY_KEY");
        }
        return List.copyOf(errors);
    }

    public static List<FieldError> validate(VisitEvaluationWriteContentV1 content) {
        List<FieldError> errors = new ArrayList<>();
        if (content == null) {
            add(errors, "content", "REQUIRED");
            return List.copyOf(errors);
        }
        if (content.overallRating() == null) add(errors, "overallRating", "REQUIRED");
        else if (!inRatingRange(content.overallRating())) add(errors, "overallRating", "INVALID_RATING");
        if (content.consideration() == null || content.consideration().isBlank()) {
            add(errors, "consideration", "REQUIRED");
        } else if (!CONSIDERATIONS.contains(content.consideration())) {
            add(errors, "consideration", "INVALID_CONSIDERATION");
        }

        validateRatings(errors, content.ratings());
        if (content.feeExplanationClear() != null && !AGGREGATE_FEE_CLARITY.contains(content.feeExplanationClear())) {
            add(errors, "feeExplanationClear", "INVALID_FEE_CLARITY");
        }
        validateFeeTopics(errors, content.feeTopicExplanations());
        validateObservations(errors, content.careProcessObservations());
        validateTags(errors, "likedTags", content.likedTags());
        validateTags(errors, "concernTags", content.concernTags());
        if (content.comment() != null && content.comment().length() > 200) {
            add(errors, "comment", "COMMENT_TOO_LONG");
        }
        return List.copyOf(errors);
    }

    private static void validateRatings(List<FieldError> errors, Map<String, Integer> ratings) {
        if (ratings == null) return;
        ratings.forEach((key, value) -> {
            String path = "ratings." + safePathSegment(key);
            if (key == null || !RATINGS.contains(key)) add(errors, path, "UNKNOWN_FIELD");
            else if (value == null || !inRatingRange(value)) add(errors, path, "INVALID_RATING");
        });
    }

    private static void validateFeeTopics(List<FieldError> errors, Map<String, String> answers) {
        if (answers == null) return;
        answers.forEach((key, value) -> {
            String path = "feeTopicExplanations." + safePathSegment(key);
            if (key == null || !FEE_TOPICS.contains(key)) add(errors, path, "UNKNOWN_FIELD");
            else if (value == null || !FEE_ANSWERS.contains(value)) add(errors, path, "INVALID_FEE_EXPLANATION");
        });
    }

    private static void validateObservations(List<FieldError> errors,
                                             VisitEvaluationWriteContentV1.CareProcessObservations observations) {
        if (observations == null) return;
        validateObservation(errors, "careProcessObservations.careRecordLearned", observations.careRecordLearned());
        validateObservation(errors, "careProcessObservations.handoverLearned", observations.handoverLearned());
        List<String> topics = observations.handoverTopics();
        if (topics == null) return;
        Set<String> found = new java.util.HashSet<>();
        boolean hasUnconfirmed = false;
        boolean hasSpecific = false;
        for (String topic : topics) {
            if (topic == null || !HANDOVER_TOPICS.contains(topic)) {
                add(errors, "careProcessObservations.handoverTopics", "INVALID_HANDOVER_TOPIC");
                continue;
            }
            if (!found.add(topic)) add(errors, "careProcessObservations.handoverTopics", "DUPLICATE_HANDOVER_TOPIC");
            if ("unconfirmed".equals(topic)) hasUnconfirmed = true;
            else hasSpecific = true;
        }
        if (hasUnconfirmed && hasSpecific) {
            add(errors, "careProcessObservations.handoverTopics", "HANDOVER_UNCONFIRMED_EXCLUSIVE");
        }
    }

    private static void validateObservation(List<FieldError> errors, String path, String value) {
        if (value != null && !OBSERVATION_ANSWERS.contains(value)) add(errors, path, "INVALID_OBSERVATION");
    }

    private static void validateTags(List<FieldError> errors, String path, List<String> tags) {
        if (tags == null) return;
        if (tags.size() > 3) add(errors, path, "TAG_LIMIT_EXCEEDED");
        Set<String> found = new java.util.HashSet<>();
        for (String tag : tags) {
            if (tag == null || !TAGS.contains(tag)) add(errors, path, "UNKNOWN_TAG");
            else if (!found.add(tag)) add(errors, path, "DUPLICATE_TAG");
        }
    }

    private static boolean inRatingRange(Integer value) {
        return value >= 1 && value <= 5;
    }

    private static String safePathSegment(String value) {
        if (value == null || value.isBlank() || value.length() > 80
                || value.chars().anyMatch(character -> character <= 0x1f || character == 0x7f || character == '.')) {
            return "unknown";
        }
        return value;
    }

    private static boolean hasControlOrWhitespace(String value) {
        return value.codePoints().anyMatch(character -> Character.isWhitespace(character)
                || Character.isISOControl(character));
    }

    private static void add(List<FieldError> errors, String field, String code) {
        FieldError error = new FieldError(field, code);
        if (!errors.contains(error)) errors.add(error);
    }

    public record FieldError(String field, String code) {
        public FieldError {
            if (field == null || field.isBlank() || code == null || code.isBlank()) {
                throw new IllegalArgumentException("field error values required");
            }
        }
    }
}
