package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.auth.PhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationContractV1;

/** Authenticates the caller before consuming a one-time phone authorization code. */
public final class PhoneAuthorizationService {
    private final AuthEvidenceResolver authEvidenceResolver;
    private final PhoneAuthorizationProvider provider;

    public PhoneAuthorizationService(AuthEvidenceResolver authEvidenceResolver, PhoneAuthorizationProvider provider) {
        if (authEvidenceResolver == null || provider == null) {
            throw new IllegalArgumentException("phone authorization dependencies required");
        }
        this.authEvidenceResolver = authEvidenceResolver;
        this.provider = provider;
    }

    public VerificationResult verify(String authEvidence, PhoneAuthorizationRequest request) {
        AuthEvidenceResolver.Resolution auth;
        try {
            auth = authEvidenceResolver.resolve(authEvidence);
        } catch (RuntimeException ignored) {
            return VerificationResult.authFailure(AuthResolution.TECHNICAL_FAILURE);
        }
        if (auth == null) return VerificationResult.authFailure(AuthResolution.TECHNICAL_FAILURE);
        AuthResolution authResolution = AuthResolution.from(auth.status());
        if (authResolution != AuthResolution.AUTHENTICATED) {
            return VerificationResult.authFailure(authResolution);
        }

        PhoneEvidenceOutcome phoneOutcome;
        if (request == null || request.code() == null || request.code().isBlank()) {
            phoneOutcome = PhoneEvidenceOutcome.MISSING;
        } else if (!request.isValidEnvelope()
                || !PhoneAuthorizationContractV1.PURPOSE.equals(request.purpose())) {
            phoneOutcome = PhoneEvidenceOutcome.INVALID;
        } else {
            PhoneAuthorizationProvider.ExchangeResult exchange;
            try {
                exchange = provider.exchange(request.code());
            } catch (RuntimeException ignored) {
                exchange = null;
            }
            phoneOutcome = PhoneEvidenceOutcome.from(exchange == null
                    ? PhoneAuthorizationProvider.ExchangeResult.Status.TECHNICAL_FAILURE
                    : exchange.status());
        }
        return VerificationResult.authenticated(phoneOutcome);
    }

    public record PhoneAuthorizationRequest(String contractVersion, String kind, String purpose, String code) {
        public boolean isValidEnvelope() {
            return PhoneAuthorizationContractV1.CONTRACT_VERSION.equals(contractVersion)
                    && PhoneAuthorizationContractV1.REQUEST_KIND.equals(kind)
                    && code != null && !code.isBlank() && code.length() <= 512
                    && code.chars().noneMatch(character -> character <= 0x1F || character == 0x7F);
        }

        @Override public String toString() { return "PhoneAuthorizationRequest[code=redacted]"; }
    }

    public enum AuthResolution {
        AUTHENTICATED("authenticated"), MISSING("missing"), EXPIRED("expired"), INVALID("invalid"),
        UNAVAILABLE("unavailable"), TECHNICAL_FAILURE("technical_failure");

        private final String wireValue;
        AuthResolution(String wireValue) { this.wireValue = wireValue; }
        public String wireValue() { return wireValue; }

        public static AuthResolution from(AuthEvidenceResolver.Resolution.Status status) {
            return switch (status) {
                case AUTHENTICATED -> AUTHENTICATED;
                case MISSING -> MISSING;
                case EXPIRED -> EXPIRED;
                case INVALID -> INVALID;
                case UNAVAILABLE -> UNAVAILABLE;
                case TECHNICAL_FAILURE -> TECHNICAL_FAILURE;
            };
        }
    }

    public enum PhoneEvidenceOutcome {
        AUTHORIZED("authorized"), MISSING("missing"), DECLINED("declined"), EXPIRED("expired"),
        INVALID("invalid"), UNAVAILABLE("unavailable"), TECHNICAL_FAILURE("technical_failure");

        private final String wireValue;
        PhoneEvidenceOutcome(String wireValue) { this.wireValue = wireValue; }
        public String wireValue() { return wireValue; }

        public static PhoneEvidenceOutcome from(PhoneAuthorizationProvider.ExchangeResult.Status status) {
            return switch (status) {
                case AUTHORIZED -> AUTHORIZED;
                case MISSING -> MISSING;
                case DECLINED -> DECLINED;
                case EXPIRED -> EXPIRED;
                case INVALID -> INVALID;
                case UNAVAILABLE -> UNAVAILABLE;
                case TECHNICAL_FAILURE -> TECHNICAL_FAILURE;
            };
        }
    }

    public record VerificationResult(AuthResolution authResolution, PhoneEvidenceOutcome phoneEvidenceOutcome) {
        public VerificationResult {
            if (authResolution == null) throw new IllegalArgumentException("authResolution required");
            if ((authResolution == AuthResolution.AUTHENTICATED) != (phoneEvidenceOutcome != null)) {
                throw new IllegalArgumentException("phone outcome only follows authenticated resolution");
            }
        }

        public static VerificationResult authFailure(AuthResolution resolution) {
            if (resolution == AuthResolution.AUTHENTICATED) {
                throw new IllegalArgumentException("authenticated resolution requires phone outcome");
            }
            return new VerificationResult(resolution, null);
        }

        public static VerificationResult authenticated(PhoneEvidenceOutcome outcome) {
            return new VerificationResult(AuthResolution.AUTHENTICATED, outcome);
        }
    }
}
