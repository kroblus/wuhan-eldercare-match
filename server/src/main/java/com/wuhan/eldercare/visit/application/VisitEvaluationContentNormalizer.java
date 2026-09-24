package com.wuhan.eldercare.visit.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteContentV1;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Implements only the set/absent equivalences frozen for V1 logical replay. */
public final class VisitEvaluationContentNormalizer {
    private final ObjectMapper canonicalMapper;

    public VisitEvaluationContentNormalizer(ObjectMapper objectMapper) {
        if (objectMapper == null) throw new IllegalArgumentException("objectMapper required");
        this.canonicalMapper = objectMapper.copy()
                .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    }

    public Normalized normalize(VisitEvaluationWriteContentV1 content) {
        if (!com.wuhan.eldercare.visit.domain.VisitEvaluationWriteValidation.validate(content).isEmpty()) {
            throw new IllegalArgumentException("invalid evaluation content cannot be normalized");
        }
        VisitEvaluationWriteContentV1 normalized = new VisitEvaluationWriteContentV1(
                content.overallRating(),
                content.consideration(),
                emptyToNull(sortedMap(content.ratings())),
                content.feeExplanationClear(),
                emptyToNull(sortedMap(content.feeTopicExplanations())),
                normalizeObservations(content.careProcessObservations()),
                emptyToNull(sortedSet(content.likedTags())),
                emptyToNull(sortedSet(content.concernTags())),
                content.comment() == null || content.comment().isEmpty() ? null : content.comment());
        try {
            byte[] canonicalJson = canonicalMapper.writeValueAsBytes(normalized);
            String fingerprint = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonicalJson));
            return new Normalized(normalized, fingerprint);
        } catch (Exception ignored) {
            throw new IllegalStateException("cannot fingerprint evaluation content");
        }
    }

    public String digestIdempotencyKey(String idempotencyKey) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(idempotencyKey.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ignored) {
            throw new IllegalStateException("cannot digest idempotency key");
        }
    }

    public byte[] toJson(VisitEvaluationWriteContentV1 content) {
        try {
            return canonicalMapper.writeValueAsBytes(content);
        } catch (Exception ignored) {
            throw new IllegalStateException("cannot encode evaluation content");
        }
    }

    private static VisitEvaluationWriteContentV1.CareProcessObservations normalizeObservations(
            VisitEvaluationWriteContentV1.CareProcessObservations value) {
        if (value == null) return null;
        List<String> topics = emptyToNull(sortedSet(value.handoverTopics()));
        if (value.careRecordLearned() == null && value.handoverLearned() == null && topics == null) return null;
        return new VisitEvaluationWriteContentV1.CareProcessObservations(
                value.careRecordLearned(), value.handoverLearned(), topics);
    }

    private static <V> Map<String, V> sortedMap(Map<String, V> value) {
        return value == null || value.isEmpty() ? null : java.util.Collections.unmodifiableMap(new TreeMap<>(value));
    }

    private static List<String> sortedSet(List<String> values) {
        return values == null || values.isEmpty() ? null : values.stream().sorted().toList();
    }

    private static <T> T emptyToNull(T value) {
        if (value instanceof Map<?, ?> map && map.isEmpty()) return null;
        if (value instanceof List<?> list && list.isEmpty()) return null;
        return value;
    }

    public record Normalized(VisitEvaluationWriteContentV1 content, String fingerprint) {
        public Normalized {
            if (content == null || fingerprint == null || fingerprint.length() != 64) {
                throw new IllegalArgumentException("normalized content required");
            }
        }
    }
}
