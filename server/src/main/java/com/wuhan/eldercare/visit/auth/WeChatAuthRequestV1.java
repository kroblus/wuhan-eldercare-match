package com.wuhan.eldercare.visit.auth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Untrusted client request. The login code is never persisted or echoed. */
@JsonIgnoreProperties(ignoreUnknown = false)
public record WeChatAuthRequestV1(
        String contractVersion,
        String kind,
        String loginCode
) {
    public boolean isValid() {
        return AuthContractV1.CONTRACT_VERSION.equals(contractVersion)
                && AuthContractV1.REQUEST_KIND.equals(kind)
                && loginCode != null
                && !loginCode.isBlank()
                && loginCode.length() <= 512;
    }
}
