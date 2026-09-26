package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;

import java.util.Set;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record ElderRecordResolutionResultV1(
        String contractVersion,
        String kind,
        String authResolution,
        String availability,
        String elderId
) {
    public static final String CONTRACT_VERSION = "elder-record-identity-api-v1";
    public static final String KIND = "elder_record_resolution_result_v1";
    private static final Set<String> AUTH = Set.of("authenticated", "missing", "expired", "invalid", "unavailable",
            "technical_failure");
    private static final Set<String> AVAILABILITY = Set.of("bound", "not_found", "unavailable", "technical_failure");

    public ElderRecordResolutionResultV1 {
        if (!CONTRACT_VERSION.equals(contractVersion) || !KIND.equals(kind) || !AUTH.contains(authResolution)) {
            throw new IllegalArgumentException("invalid ElderRecord resolution envelope");
        }
        if ("authenticated".equals(authResolution)) {
            if (!AVAILABILITY.contains(availability) || ("bound".equals(availability) != !blank(elderId))) {
                throw new IllegalArgumentException("ElderRecord availability and id must agree");
            }
        } else if (availability != null || elderId != null) {
            throw new IllegalArgumentException("unauthenticated result cannot contain ElderRecord data");
        }
    }

    public static ElderRecordResolutionResultV1 from(ElderRecordService.Resolution result) {
        if (result == null) return technicalFailure();
        String auth = result.authStatus().name().toLowerCase();
        if (!"authenticated".equals(auth)) return new ElderRecordResolutionResultV1(
                CONTRACT_VERSION, KIND, auth, null, null);
        return new ElderRecordResolutionResultV1(CONTRACT_VERSION, KIND, auth,
                result.availability().name().toLowerCase(), result.record() == null ? null : result.record().elderId());
    }

    public static ElderRecordResolutionResultV1 technicalFailure() {
        return new ElderRecordResolutionResultV1(CONTRACT_VERSION, KIND, "technical_failure", null, null);
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
