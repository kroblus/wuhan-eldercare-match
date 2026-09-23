package com.wuhan.eldercare.visit.auth;

/** Wire identity and purpose for the C6 phone-verification boundary. */
public final class PhoneAuthorizationContractV1 {
    public static final String CONTRACT_VERSION = "authenticated-visit-submission-persistence-contract-v1";
    public static final String REQUEST_KIND = "purpose_bound_phone_verification_request_v1";
    public static final String RESULT_KIND = "purpose_bound_phone_verification_result_v1";
    public static final String PURPOSE = "appointment_or_consultant_contact";

    private PhoneAuthorizationContractV1() { }
}
