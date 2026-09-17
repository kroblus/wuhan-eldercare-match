package com.wuhan.eldercare.visit.domain;

import java.time.Instant;

public record VisitReceiptV1(
        String contractVersion,
        String kind,
        String visitId,
        String institutionId,
        String institutionRecordRevision,
        String status,
        Instant acceptedAt,
        String publicMessage
) {
    public static final String CONTRACT_VERSION = "appointment-institution-visit-contract-v1";
    public static final String KIND = "appointment_submission_receipt_v1";

    public VisitReceiptV1(
            String visitId,
            String institutionId,
            String institutionRecordRevision,
            String status,
            Instant acceptedAt,
            String publicMessage
    ) {
        this(CONTRACT_VERSION, KIND, visitId, institutionId, institutionRecordRevision,
                status, acceptedAt, publicMessage);
    }

    public VisitReceiptV1 {
        if (!CONTRACT_VERSION.equals(contractVersion) || !KIND.equals(kind)) {
            throw new IllegalArgumentException("invalid receipt version or kind");
        }
        if (visitId == null || visitId.isBlank()) throw new IllegalArgumentException("visitId required");
        if (!"requested".equals(status)) throw new IllegalArgumentException("C4 only persists requested");
        if (acceptedAt == null) throw new IllegalArgumentException("acceptedAt required");
        publicMessage = "预约申请已提交";
    }
}
