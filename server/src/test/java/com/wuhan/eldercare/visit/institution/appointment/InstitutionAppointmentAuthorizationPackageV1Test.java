package com.wuhan.eldercare.visit.institution.appointment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationPackageV1;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class InstitutionAppointmentAuthorizationPackageV1Test {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsOnlyExactControlledProvisioningShape() throws Exception {
        var valid = mapper.readTree("""
                {
                  "packageVersion":"institution-appointment-authorization-package-v1",
                  "operationId":"synthetic-operation-1",
                  "action":"authorize",
                  "institutionId":"synthetic-institution",
                  "recordRevision":4,
                  "provenanceReference":"approval:synthetic-review",
                  "operatorReference":"operator:synthetic"
                }
                """);
        var parsed = InstitutionAppointmentAuthorizationPackageV1.parse(valid);
        assertEquals(InstitutionAppointmentAuthorizationPackageV1.ParseResult.Status.VALID, parsed.status());
        assertEquals(InstitutionAppointmentAuthorizationPackageV1.Action.AUTHORIZE, parsed.value().action());

        ((com.fasterxml.jackson.databind.node.ObjectNode) valid).put("userId", "synthetic-client-user");
        var extraIdentity = InstitutionAppointmentAuthorizationPackageV1.parse(valid);
        assertEquals(InstitutionAppointmentAuthorizationPackageV1.ParseResult.Status.INVALID, extraIdentity.status());
        assertNull(extraIdentity.value());
    }

    @Test
    void rejectsUnknownStateAndNonIntegralRevision() throws Exception {
        String base = """
                {
                  "packageVersion":"institution-appointment-authorization-package-v1",
                  "operationId":"synthetic-operation-2",
                  "action":"%s",
                  "institutionId":"synthetic-institution",
                  "recordRevision":%s,
                  "provenanceReference":"approval:synthetic-review",
                  "operatorReference":"operator:synthetic"
                }
                """;
        assertEquals(InstitutionAppointmentAuthorizationPackageV1.ParseResult.Status.INVALID,
                InstitutionAppointmentAuthorizationPackageV1.parse(mapper.readTree(
                        base.formatted("allow-all", "4"))).status());
        assertEquals(InstitutionAppointmentAuthorizationPackageV1.ParseResult.Status.INVALID,
                InstitutionAppointmentAuthorizationPackageV1.parse(mapper.readTree(
                        base.formatted("authorize", "4.5"))).status());
    }
}
