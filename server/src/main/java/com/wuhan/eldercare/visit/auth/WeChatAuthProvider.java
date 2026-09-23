package com.wuhan.eldercare.visit.auth;

/** Backend-only provider exchange port. Implementations must not leak raw fields. */
public interface WeChatAuthProvider {
    ExchangeResult exchange(String loginCode);

    record ExchangeResult(Status status, String providerNamespace, String providerSubject) {
        public enum Status {
            AUTHENTICATED,
            INVALID,
            UNAVAILABLE,
            TECHNICAL_FAILURE
        }

        public ExchangeResult {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.AUTHENTICATED)
                    != (providerNamespace != null && !providerNamespace.isBlank()
                    && providerSubject != null && !providerSubject.isBlank())) {
                throw new IllegalArgumentException("provider identity only belongs to authenticated result");
            }
        }

        public static ExchangeResult authenticated(String namespace, String subject) {
            return new ExchangeResult(Status.AUTHENTICATED, namespace, subject);
        }

        public static ExchangeResult failure(Status status) {
            return new ExchangeResult(status, null, null);
        }
    }
}
