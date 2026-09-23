package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wuhan.eldercare.visit.application.PhoneAuthorizationService;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationContractV1;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record PhoneAuthorizationResultV1(
        String contractVersion,
        String kind,
        String authResolution,
        String phoneEvidenceOutcome
) {
    public PhoneAuthorizationResultV1 {
        if (!PhoneAuthorizationContractV1.CONTRACT_VERSION.equals(contractVersion)
                || !PhoneAuthorizationContractV1.RESULT_KIND.equals(kind)
                || authResolution == null || authResolution.isBlank()) {
            throw new IllegalArgumentException("invalid phone verification result");
        }
        if ("authenticated".equals(authResolution) != (phoneEvidenceOutcome != null)) {
            throw new IllegalArgumentException("phone outcome only belongs to authenticated result");
        }
    }

    public static PhoneAuthorizationResultV1 from(PhoneAuthorizationService.VerificationResult result) {
        return new PhoneAuthorizationResultV1(
                PhoneAuthorizationContractV1.CONTRACT_VERSION,
                PhoneAuthorizationContractV1.RESULT_KIND,
                result.authResolution().wireValue(),
                result.phoneEvidenceOutcome() == null ? null : result.phoneEvidenceOutcome().wireValue());
    }

    public static PhoneAuthorizationResultV1 technicalFailure() {
        return new PhoneAuthorizationResultV1(PhoneAuthorizationContractV1.CONTRACT_VERSION,
                PhoneAuthorizationContractV1.RESULT_KIND, "technical_failure", null);
    }
}
