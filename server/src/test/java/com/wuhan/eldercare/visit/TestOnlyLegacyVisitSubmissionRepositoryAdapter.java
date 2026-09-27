package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.ReferenceAuthorizer;
import com.wuhan.eldercare.visit.application.VisitSubmissionRepository;
import com.wuhan.eldercare.visit.domain.PrivateContact;
import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

/**
 * Explicit test-only adapter for legacy service unit fixtures. It emulates the
 * former authorize-then-write seam and must never be used by production wiring.
 */
final class TestOnlyLegacyVisitSubmissionRepositoryAdapter implements VisitSubmissionRepository {
    private final VisitSubmissionRepository delegate;

    TestOnlyLegacyVisitSubmissionRepositoryAdapter(VisitSubmissionRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public Result createOrReplay(TrustedPrincipal principal, SubmissionCommandV1 command, PrivateContact contact) {
        return delegate.createOrReplay(principal, command, contact);
    }

    @Override
    public Result findCommitted(TrustedPrincipal principal, SubmissionCommandV1 command,
                               String authEvidence, AuthEvidenceResolver authEvidenceResolver) {
        return delegate.findCommitted(principal, command, authEvidence, authEvidenceResolver);
    }

    @Override
    public Result createOrReplay(TrustedPrincipal principal, SubmissionCommandV1 command, PrivateContact contact,
                                 String authEvidence, AuthEvidenceResolver authEvidenceResolver,
                                 ReferenceAuthorizer referenceAuthorizer) {
        ReferenceAuthorizer.Authorization authorization;
        try {
            authorization = referenceAuthorizer.authorize(principal, command.elderId(), command.institutionId(),
                    command.institutionRecordRevision());
        } catch (RuntimeException ignored) {
            return new Result(Result.Status.TECHNICAL_FAILURE, null);
        }
        if (authorization == null) return new Result(Result.Status.TECHNICAL_FAILURE, null);
        return switch (authorization) {
            case AUTHORIZED -> delegate.createOrReplay(principal, command, contact);
            case UNAUTHORIZED -> new Result(Result.Status.REFERENCE_REJECTED, null);
            case INVALID -> new Result(Result.Status.REFERENCE_INVALID, null);
            case UNAVAILABLE -> new Result(Result.Status.UNAVAILABLE, null);
            case TECHNICAL_FAILURE -> new Result(Result.Status.TECHNICAL_FAILURE, null);
        };
    }

    @Override
    public boolean hasTransactionalAuthorization() {
        return true;
    }
}
