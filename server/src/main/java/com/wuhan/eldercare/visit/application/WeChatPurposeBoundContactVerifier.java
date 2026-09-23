package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.auth.PhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationContractV1;
import com.wuhan.eldercare.visit.domain.PrivateContact;

/** Verifies a fresh WeChat phone code against the private phone submitted to C4. */
public final class WeChatPurposeBoundContactVerifier implements PurposeBoundContactVerifier {
    private final PhoneAuthorizationProvider provider;

    public WeChatPurposeBoundContactVerifier(PhoneAuthorizationProvider provider) {
        if (provider == null) throw new IllegalArgumentException("phone provider required");
        this.provider = provider;
    }

    @Override
    public Verification verify(String opaqueEvidence, String purpose, String contactName, String phone) {
        if (opaqueEvidence == null || opaqueEvidence.isBlank()) {
            return Verification.failure(Verification.Status.MISSING);
        }
        if (!PhoneAuthorizationContractV1.PURPOSE.equals(purpose)) {
            return Verification.failure(Verification.Status.INVALID);
        }
        if (contactName == null || contactName.isBlank() || phone == null || phone.isBlank()) {
            return Verification.failure(Verification.Status.MISSING);
        }

        PhoneAuthorizationProvider.ExchangeResult result;
        try {
            result = provider.exchange(opaqueEvidence);
        } catch (RuntimeException ignored) {
            return Verification.failure(Verification.Status.TECHNICAL_FAILURE);
        }
        if (result == null) return Verification.failure(Verification.Status.TECHNICAL_FAILURE);
        return switch (result.status()) {
            case AUTHORIZED -> matches(phone, result.phoneNumber(), result.purePhoneNumber())
                    ? Verification.authorized(new PrivateContact(contactName, phone))
                    : Verification.failure(Verification.Status.INVALID);
            case MISSING -> Verification.failure(Verification.Status.MISSING);
            case DECLINED -> Verification.failure(Verification.Status.DECLINED);
            case EXPIRED -> Verification.failure(Verification.Status.EXPIRED);
            case INVALID -> Verification.failure(Verification.Status.INVALID);
            case UNAVAILABLE -> Verification.failure(Verification.Status.UNAVAILABLE);
            case TECHNICAL_FAILURE -> Verification.failure(Verification.Status.TECHNICAL_FAILURE);
        };
    }

    private static boolean matches(String submitted, String providerPhone, String providerPurePhone) {
        String submittedDigits = normalizedDigits(submitted);
        if (submittedDigits == null) return false;
        return submittedDigits.equals(normalizedDigits(providerPhone))
                || submittedDigits.equals(normalizedDigits(providerPurePhone));
    }

    private static String normalizedDigits(String value) {
        if (value == null || value.isBlank()) return null;
        StringBuilder digits = new StringBuilder(value.length());
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (current >= '0' && current <= '9') {
                digits.append(current);
            } else if (current != '+' && current != '(' && current != ')' && current != '-'
                    && !Character.isWhitespace(current)) {
                return null;
            }
        }
        return digits.isEmpty() ? null : digits.toString();
    }
}
