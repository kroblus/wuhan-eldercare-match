package com.wuhan.eldercare.visit.auth;

/** Default production-safe provider: no configured provider means no authentication. */
public final class UnavailableWeChatAuthProvider implements WeChatAuthProvider {
    @Override
    public ExchangeResult exchange(String loginCode) {
        if (loginCode == null || loginCode.isBlank()) return ExchangeResult.failure(ExchangeResult.Status.INVALID);
        return ExchangeResult.failure(ExchangeResult.Status.UNAVAILABLE);
    }
}
