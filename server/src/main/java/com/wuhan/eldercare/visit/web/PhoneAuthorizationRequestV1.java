package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wuhan.eldercare.visit.application.PhoneAuthorizationService;

@JsonIgnoreProperties(ignoreUnknown = false)
public record PhoneAuthorizationRequestV1(
        String contractVersion,
        String kind,
        String purpose,
        String code
) {
    public PhoneAuthorizationService.PhoneAuthorizationRequest toServiceRequest() {
        return new PhoneAuthorizationService.PhoneAuthorizationRequest(contractVersion, kind, purpose, code);
    }

    @Override public String toString() { return "PhoneAuthorizationRequestV1[code=redacted]"; }
}
