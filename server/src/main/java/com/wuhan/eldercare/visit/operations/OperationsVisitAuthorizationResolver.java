package com.wuhan.eldercare.visit.operations;

/** Resolves explicit authorization for one exact server Visit identity. */
public final class OperationsVisitAuthorizationResolver {
    private final OperationsAuthorizationRepository repository;

    public OperationsVisitAuthorizationResolver(OperationsAuthorizationRepository repository) {
        this.repository = repository;
    }

    public Resolution authorize(TrustedOperationsPrincipal principal, String visitId) {
        if (principal == null || visitId == null || visitId.isBlank() || "*".equals(visitId)) {
            return new Resolution(Resolution.Status.DENIED_OR_HIDDEN);
        }
        try {
            OperationsAuthorizationRepository.AuthorizationResolution result =
                    repository.authorizeVisit(principal.operationsPrincipalId(), visitId);
            if (result == null) return new Resolution(Resolution.Status.TECHNICAL_FAILURE);
            return switch (result.status()) {
                case AUTHORIZED -> new Resolution(Resolution.Status.AUTHORIZED);
                case DENIED_OR_HIDDEN -> new Resolution(Resolution.Status.DENIED_OR_HIDDEN);
                case UNAVAILABLE -> new Resolution(Resolution.Status.UNAVAILABLE);
                case TECHNICAL_FAILURE -> new Resolution(Resolution.Status.TECHNICAL_FAILURE);
            };
        } catch (RuntimeException ignored) {
            return new Resolution(Resolution.Status.TECHNICAL_FAILURE);
        }
    }

    public record Resolution(Status status) {
        public enum Status { AUTHORIZED, DENIED_OR_HIDDEN, UNAVAILABLE, TECHNICAL_FAILURE }

        public Resolution {
            if (status == null) throw new IllegalArgumentException("status required");
        }
    }
}
