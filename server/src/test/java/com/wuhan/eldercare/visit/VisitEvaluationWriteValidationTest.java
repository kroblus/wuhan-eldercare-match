package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.VisitEvaluationContentNormalizer;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteContentV1;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteValidation;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VisitEvaluationWriteValidationTest {
    private static VisitEvaluationWriteContentV1 minimal() {
        return new VisitEvaluationWriteContentV1(5, "willing", null, null, null, null, null, null, null);
    }

    @Test
    void onlyOverallRatingAndConsiderationAreRequired() {
        assertTrue(VisitEvaluationWriteValidation.validate(minimal()).isEmpty());
        assertTrue(VisitEvaluationWriteValidation.validate(
                new VisitEvaluationWriteContentV1(null, "willing", null, null, null, null, null, null, null))
                .contains(new VisitEvaluationWriteValidation.FieldError("overallRating", "REQUIRED")));
        assertTrue(VisitEvaluationWriteValidation.validate(
                new VisitEvaluationWriteContentV1(5, null, null, null, null, null, null, null, null))
                .contains(new VisitEvaluationWriteValidation.FieldError("consideration", "REQUIRED")));
    }

    @Test
    void providedRatingMustBeIntegerFromOneThroughFiveAndUnknownKeysAreRejected() {
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                1, "compare", Map.of("hygiene", 5), null, null, null, null, null, null)).isEmpty());
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                6, "willing", Map.of("hygiene", 0), null, null, null, null, null, null)).stream()
                .anyMatch(error -> "INVALID_RATING".equals(error.code())));
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                4, "willing", Map.of("unknown", 3), null, null, null, null, null, null)).stream()
                .anyMatch(error -> "UNKNOWN_FIELD".equals(error.code())));
    }

    @Test
    void feeTopicsAndAggregateClarityUseOnlyFrozenCodesAndRemainOptional() {
        assertTrue(VisitEvaluationWriteValidation.validate(minimal()).isEmpty());
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, "clear", Map.of("bed_fee", "explained", "deposit", "not_explained",
                "other_one_time_fee", "unconfirmed"), null, null, null, null)).isEmpty());
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, Map.of("unknown_fee", "unconfirmed"), null, null, null, null))
                .stream().anyMatch(error -> "UNKNOWN_FIELD".equals(error.code())));
    }

    @Test
    void tagGroupsHaveIndependentLimitsAndPermitCrossGroupReuse() {
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, null, List.of("care"), List.of("care"), null)).isEmpty());
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, null, List.of("care", "medical", "room", "other"), null, null))
                .stream().anyMatch(error -> "TAG_LIMIT_EXCEEDED".equals(error.code())));
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, null, List.of("care", "care"), null, null))
                .stream().anyMatch(error -> "DUPLICATE_TAG".equals(error.code())));
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, null, List.of("fake"), null, null))
                .stream().anyMatch(error -> "UNKNOWN_TAG".equals(error.code())));
    }

    @Test
    void noAndUnconfirmedStayDistinctAndHandoverUnconfirmedIsExclusive() {
        var no = new VisitEvaluationWriteContentV1.CareProcessObservations("no", "unconfirmed", List.of());
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, no, null, null, null)).isEmpty());

        var invalid = new VisitEvaluationWriteContentV1.CareProcessObservations(
                "unconfirmed", "no", List.of("unconfirmed", "vital_signs"));
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, invalid, null, null, null)).stream()
                .anyMatch(error -> "HANDOVER_UNCONFIRMED_EXCLUSIVE".equals(error.code())));

        var specific = new VisitEvaluationWriteContentV1.CareProcessObservations(
                null, null, List.of("follow_up", "vital_signs"));
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, specific, null, null, null)).isEmpty());
    }

    @Test
    void commentLimitIsEnforcedWithoutTrimmingOrMakingItRequired() {
        assertTrue(VisitEvaluationWriteValidation.validate(minimal()).isEmpty());
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, null, null, null, "x".repeat(200))).isEmpty());
        assertTrue(VisitEvaluationWriteValidation.validate(new VisitEvaluationWriteContentV1(
                5, "willing", null, null, null, null, null, null, "x".repeat(201))).stream()
                .anyMatch(error -> "COMMENT_TOO_LONG".equals(error.code())));
    }

    @Test
    void normalizationMakesObjectOrderAndSetOrderIrrelevantButPreservesSemanticValues() {
        VisitEvaluationContentNormalizer normalizer = new VisitEvaluationContentNormalizer(new ObjectMapper());
        Map<String, Integer> firstRatings = new LinkedHashMap<>();
        firstRatings.put("room_comfort", 4);
        firstRatings.put("hygiene", 5);
        Map<String, Integer> secondRatings = new LinkedHashMap<>();
        secondRatings.put("hygiene", 5);
        secondRatings.put("room_comfort", 4);
        var first = new VisitEvaluationWriteContentV1(5, "willing", firstRatings, null, null,
                new VisitEvaluationWriteContentV1.CareProcessObservations("no", null,
                        List.of("follow_up", "vital_signs")), List.of("care", "medical"), List.of(), "");
        var second = new VisitEvaluationWriteContentV1(5, "willing", secondRatings, null, Map.of(),
                new VisitEvaluationWriteContentV1.CareProcessObservations("no", null,
                        List.of("vital_signs", "follow_up")), List.of("medical", "care"), List.of(), null);

        var normalizedFirst = normalizer.normalize(first);
        var normalizedSecond = normalizer.normalize(second);
        assertEquals(normalizedFirst.fingerprint(), normalizedSecond.fingerprint());
        assertEquals(null, normalizedFirst.content().feeTopicExplanations());
        assertEquals(null, normalizedFirst.content().comment());

        var unconfirmed = new VisitEvaluationWriteContentV1(5, "willing", null, null,
                Map.of("bed_fee", "unconfirmed"), null, null, null, null);
        var notExplained = new VisitEvaluationWriteContentV1(5, "willing", null, null,
                Map.of("bed_fee", "not_explained"), null, null, null, null);
        assertFalse(normalizer.normalize(unconfirmed).fingerprint()
                .equals(normalizer.normalize(notExplained).fingerprint()));
    }
}
