package com.wuhan.eldercare.visit.operations;

/** Resolves only backend-provisioned Operations credentials; it never accepts a client principal id. */
public final class OperationsPrincipalResolver {
    private final OperationsAuthorizationRepository repository;
    private final OperationsCredentialHasher hasher;

    public OperationsPrincipalResolver(OperationsAuthorizationRepository repository,
                                       OperationsCredentialHasher hasher) {
        this.repository = repository;
        this.hasher = hasher;
    }

    public Resolution resolve(String credentialEvidence) {
        if (credentialEvidence == null || credentialEvidence.isBlank()) {
            return Resolution.failure(Resolution.Status.AUTH_REQUIRED_OR_INVALID);
        }
        try {
            var digest = hasher.digest(credentialEvidence);
            if (digest == null || digest.isEmpty()) {
                return Resolution.failure(Resolution.Status.AUTH_REQUIRED_OR_INVALID);
            }
            OperationsAuthorizationRepository.AuthenticationResolution result =
                    repository.resolveCredential(digest.get());
            if (result == null) return Resolution.failure(Resolution.Status.TECHNICAL_FAILURE);
            return switch (result.status()) {
                case ACTIVE -> {
                    try {
                        yield Resolution.authenticated(new TrustedOperationsPrincipal(result.operationsPrincipalId(), digest.get()));
                    } catch (RuntimeException ignored) {
                        yield Resolution.failure(Resolution.Status.TECHNICAL_FAILURE);
                    }
                }
                case REVOKED -> Resolution.failure(Resolution.Status.REVOKED_OR_DISABLED);
                case UNKNOWN -> Resolution.failure(Resolution.Status.AUTH_REQUIRED_OR_INVALID);
                case UNAVAILABLE -> Resolution.failure(Resolution.Status.UNAVAILABLE);
                case TECHNICAL_FAILURE -> Resolution.failure(Resolution.Status.TECHNICAL_FAILURE);
            };
        } catch (RuntimeException ignored) {
            return Resolution.failure(Resolution.Status.TECHNICAL_FAILURE);
        }
    }

    public record Resolution(Status status, TrustedOperationsPrincipal principal) {
        public enum Status { READY, AUTH_REQUIRED_OR_INVALID, REVOKED_OR_DISABLED, UNAVAILABLE, TECHNICAL_FAILURE }

        public Resolution {
            if (status == null) throw new IllegalArgumentException("status required");
            if ((status == Status.READY) != (principal != null)) {
                throw new IllegalArgumentException("trusted principal only belongs to READY result");
            }
        }

        static Resolution authenticated(TrustedOperationsPrincipal principal) {
            return new Resolution(Status.READY, principal);
        }

        static Resolution failure(Status status) {
            return new Resolution(status, null);
        }
    }
}
