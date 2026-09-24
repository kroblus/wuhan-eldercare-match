package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wuhan.eldercare.visit.application.VisitEvaluationSubmissionService;
import com.wuhan.eldercare.visit.domain.VisitEvaluationWriteContentV1;

import java.util.List;
import java.util.Map;

/** Exact client-controlled envelope and content; authority fields are not part of this DTO. */
@JsonIgnoreProperties(ignoreUnknown = false)
public record VisitEvaluationSubmissionRequestV1(
        String contractVersion,
        String kind,
        String idempotencyKey,
        @JsonDeserialize(using = StrictIntegerJsonDeserializer.class)
        Integer overallRating,
        String consideration,
        @JsonDeserialize(contentUsing = StrictIntegerJsonDeserializer.class)
        Map<String, Integer> ratings,
        String feeExplanationClear,
        Map<String, String> feeTopicExplanations,
        CareProcessObservations careProcessObservations,
        List<String> likedTags,
        List<String> concernTags,
        String comment
) {
    public VisitEvaluationSubmissionService.Request toServiceRequest() {
        return new VisitEvaluationSubmissionService.Request(contractVersion, kind, idempotencyKey,
                new VisitEvaluationWriteContentV1(overallRating, consideration, ratings, feeExplanationClear,
                        feeTopicExplanations, careProcessObservations == null ? null : careProcessObservations.toDomain(),
                        likedTags, concernTags, comment));
    }

    @JsonIgnoreProperties(ignoreUnknown = false)
    public record CareProcessObservations(
            String careRecordLearned,
            String handoverLearned,
            List<String> handoverTopics
    ) {
        VisitEvaluationWriteContentV1.CareProcessObservations toDomain() {
            return new VisitEvaluationWriteContentV1.CareProcessObservations(
                    careRecordLearned, handoverLearned, handoverTopics);
        }
    }
}
