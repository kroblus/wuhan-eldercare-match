package com.wuhan.eldercare.visit.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/** Client-authored VisitEvaluation content only; it carries no owner or Visit authority. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record VisitEvaluationWriteContentV1(
        Integer overallRating,
        String consideration,
        Map<String, Integer> ratings,
        String feeExplanationClear,
        Map<String, String> feeTopicExplanations,
        CareProcessObservations careProcessObservations,
        List<String> likedTags,
        List<String> concernTags,
        String comment
) {
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CareProcessObservations(
            String careRecordLearned,
            String handoverLearned,
            List<String> handoverTopics
    ) {
    }
}
