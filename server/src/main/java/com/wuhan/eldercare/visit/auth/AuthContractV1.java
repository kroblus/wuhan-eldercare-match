package com.wuhan.eldercare.visit.auth;

/** Versioned, private Backend authentication boundary for C5. */
public final class AuthContractV1 {
    public static final String CONTRACT_VERSION = "wechat-authenticated-principal-contract-v1";
    public static final String REQUEST_KIND = "wechat_authentication_request_v1";
    public static final String RESULT_KIND = "wechat_authentication_result_v1";

    private AuthContractV1() {
    }
}
