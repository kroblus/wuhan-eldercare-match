package com.wuhan.eldercare.visit.application;

import com.wuhan.eldercare.visit.domain.TrustedPrincipal;

public interface ReferenceAuthorizer {
    Authorization authorize(TrustedPrincipal principal, String elderId, String institutionId, String institutionRecordRevision);

    enum Authorization {
        AUTHORIZED,
        UNAUTHORIZED,
        INVALID,
        UNAVAILABLE,
        TECHNICAL_FAILURE
    }
}
