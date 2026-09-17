package com.wuhan.eldercare.visit.domain;

import java.time.Instant;

/**
 * Private Backend-to-Application candidate. The authenticated submission
 * transport may serialize it only to the Application adapter; it must never
 * become Page state. The Application validates every field before projecting
 * a public receipt, mirroring the C2 accepted-persistence firewall.
 */
public record PersistedVisitCandidateV1(
        String contractVersion,
        String kind,
        String visitId,
        String userId,
        String elderId,
        String institutionId,
        String institutionRecordRevision,
        String visitDate,
        String visitTimePreference,
        int participantCount,
        Boolean pickupRequested,
        String contactName,
        String phone,
        String phonePurpose,
        String status,
        Instant acceptedAt,
        String notes
) {
    public static final String CONTRACT_VERSION = "appointment-institution-visit-contract-v1";
    public static final String KIND = "institution_visit_v1";

    public PersistedVisitCandidateV1(
            String visitId,
            String userId,
            String elderId,
            String institutionId,
            String institutionRecordRevision,
            String visitDate,
            String visitTimePreference,
            int participantCount,
            Boolean pickupRequested,
            String contactName,
            String phone,
            String phonePurpose,
            String status,
            Instant acceptedAt,
            String notes
    ) {
        this(CONTRACT_VERSION, KIND, visitId, userId, elderId, institutionId, institutionRecordRevision,
                visitDate, visitTimePreference, participantCount, pickupRequested, contactName, phone,
                phonePurpose, status, acceptedAt, notes);
    }

    public PersistedVisitCandidateV1 {
        if (!CONTRACT_VERSION.equals(contractVersion) || !KIND.equals(kind)) {
            throw new IllegalArgumentException("invalid InstitutionVisit candidate version or kind");
        }
        if (visitId == null || visitId.isBlank() || userId == null || userId.isBlank()
                || elderId == null || elderId.isBlank() || institutionId == null || institutionId.isBlank()
                || institutionRecordRevision == null || institutionRecordRevision.isBlank()
                || contactName == null || contactName.isBlank() || phone == null || phone.isBlank()
                || !"appointment_or_consultant_contact".equals(phonePurpose)
                || !"requested".equals(status) || acceptedAt == null) {
            throw new IllegalArgumentException("incomplete persisted InstitutionVisit candidate");
        }
    }

    public VisitReceiptV1 toPublicReceipt() {
        return new VisitReceiptV1(visitId, institutionId, institutionRecordRevision,
                status, acceptedAt, "预约申请已提交");
    }
}
