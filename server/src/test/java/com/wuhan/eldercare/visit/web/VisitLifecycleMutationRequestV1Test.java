package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class VisitLifecycleMutationRequestV1Test {
    @Test
    void ignoresClientAuthorityFieldsAndKeepsOnlyLifecycleIntentAndTypedEvidence() throws Exception {
        String json = """
                {
                  "operationId":"op-1",
                  "expectedStatus":"scheduled",
                  "targetStatus":"completed",
                  "userId":"attacker-user",
                  "operationsPrincipalId":"attacker-ops",
                  "currentStatus":"completed",
                  "completed":true,
                  "evidence":{"kind":"in_person_visit_occurred","reference":"ops-record:123","factAt":"2026-09-26T09:00:00Z","verifiedBy":"client"}
                }
                """;
        VisitLifecycleMutationRequestV1 request = new ObjectMapper().readValue(json,
                VisitLifecycleMutationRequestV1.class);
        var applicationRequest = request.toApplicationRequest();

        assertEquals("op-1", applicationRequest.operationId());
        assertEquals("scheduled", applicationRequest.expectedStatus());
        assertEquals("completed", applicationRequest.targetStatus());
        assertEquals("in_person_visit_occurred", applicationRequest.evidenceKind());
        assertEquals("ops-record:123", applicationRequest.evidenceReference());
        assertEquals("2026-09-26T09:00:00Z", applicationRequest.factAt());
    }

    @Test
    void credentialBearingTrustedPrincipalUsesExplicitRedactedStringAndCannotSerializeDigest() throws Exception {
        var hasher = new com.wuhan.eldercare.visit.operations.Sha256OperationsCredentialHasher();
        String credential = "ops1_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
        String digest = hasher.digest(credential).orElseThrow();
        var authorizationRepository = new com.wuhan.eldercare.visit.operations.OperationsAuthorizationRepository() {
            @Override public AuthenticationResolution resolveCredential(String requestedDigest) {
                return new AuthenticationResolution(AuthenticationResolution.Status.ACTIVE, "ops_synthetic");
            }
            @Override public AuthorizationResolution authorizeVisit(String principalId, String visitId) {
                return new AuthorizationResolution(AuthorizationResolution.Status.AUTHORIZED);
            }
            @Override public ProvisioningResolution applyProvisioning(
                    com.wuhan.eldercare.visit.operations.ProvisioningCommand command, java.time.Instant acceptedAt) {
                return new ProvisioningResolution(ProvisioningResolution.Status.TECHNICAL_FAILURE);
            }
        };
        var trusted = new com.wuhan.eldercare.visit.operations.OperationsPrincipalResolver(authorizationRepository, hasher)
                .resolve(credential).principal();
        String serialized = new ObjectMapper().disable(SerializationFeature.FAIL_ON_EMPTY_BEANS)
                .writeValueAsString(trusted);

        assertEquals("TrustedOperationsPrincipal[resolved]", trusted.toString());
        assertEquals("{}", serialized);
        org.junit.jupiter.api.Assertions.assertFalse(serialized.contains(digest));
        org.junit.jupiter.api.Assertions.assertFalse(serialized.contains(credential));
    }
}
