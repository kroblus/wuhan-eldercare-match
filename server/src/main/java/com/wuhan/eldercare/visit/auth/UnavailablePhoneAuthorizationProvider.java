package com.wuhan.eldercare.visit.auth;

/** Fail-closed provider used when production phone authorization is not configured. */
public final class UnavailablePhoneAuthorizationProvider implements PhoneAuthorizationProvider {
    @Override
    public ExchangeResult exchange(String oneTimeCode) {
        return oneTimeCode == null || oneTimeCode.isBlank()
                ? ExchangeResult.failure(ExchangeResult.Status.MISSING)
                : ExchangeResult.failure(ExchangeResult.Status.UNAVAILABLE);
    }
}
