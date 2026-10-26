package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;

@JsonIgnoreProperties(ignoreUnknown = false)
public record SubmissionRequestV1(
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
        @JsonDeserialize(using = AppointmentPhoneCandidateDeserializer.class) String phone,
        String phonePurpose,
        String phoneAuthorization,
        String notes
) {
    public SubmissionCommandV1 toCommand() {
        return new SubmissionCommandV1(contractVersion, kind, idempotencyKey, institutionId,
                institutionRecordRevision, elderId, visitDate, visitTimePreference, participantCount,
                pickupRequested, contactName, phone, phonePurpose, phoneAuthorization, notes);
    }
}
