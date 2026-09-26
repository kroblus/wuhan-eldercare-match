package com.wuhan.eldercare.visit.lifecycle;

import com.wuhan.eldercare.visit.operations.TrustedOperationsPrincipal;

import java.time.Instant;

/** No synthetic status mutation is available when production persistence is disabled. */
public final class UnavailableVisitLifecycleMutationRepository implements VisitLifecycleMutationRepository {
    @Override
    public Result mutate(TrustedOperationsPrincipal principal, String visitId,
                         VisitLifecycleMutationCommandV1 command, Instant recordedAt) {
        return Result.of(Result.Status.UNAVAILABLE);
    }
}
