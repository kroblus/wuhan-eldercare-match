package com.wuhan.eldercare.visit.auth;

/** Backend-only boundary for exchanging a one-time WeChat User.phone code. */
public interface PhoneAuthorizationProvider {
    ExchangeResult exchange(String oneTimeCode);

    final class ExchangeResult {
        public enum Status {
            AUTHORIZED,
            MISSING,
            DECLINED,
            EXPIRED,
            INVALID,
            UNAVAILABLE,
            TECHNICAL_FAILURE
        }

        private final Status status;
        private final String phoneNumber;
        private final String purePhoneNumber;

        private ExchangeResult(Status status, String phoneNumber, String purePhoneNumber) {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.AUTHORIZED) != (phoneNumber != null && purePhoneNumber != null)) {
                throw new IllegalArgumentException("phone values only belong to authorized result");
            }
            this.status = status;
            this.phoneNumber = phoneNumber;
            this.purePhoneNumber = purePhoneNumber;
        }

        public static ExchangeResult authorized(String phoneNumber, String purePhoneNumber) {
            if (phoneNumber == null || phoneNumber.isBlank()
                    || purePhoneNumber == null || purePhoneNumber.isBlank()) {
                throw new IllegalArgumentException("provider phone values required");
            }
            return new ExchangeResult(Status.AUTHORIZED, phoneNumber, purePhoneNumber);
        }

        public static ExchangeResult failure(Status status) {
            if (status == Status.AUTHORIZED) throw new IllegalArgumentException("authorized result needs phone values");
            return new ExchangeResult(status, null, null);
        }

        public Status status() { return status; }
        public String phoneNumber() { return phoneNumber; }
        public String purePhoneNumber() { return purePhoneNumber; }

        @Override
        public String toString() {
            return "ExchangeResult[status=" + status + ", phoneValues=redacted]";
        }
    }
}
