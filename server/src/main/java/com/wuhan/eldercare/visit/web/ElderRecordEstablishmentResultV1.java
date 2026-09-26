package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;

import java.util.Set;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record ElderRecordEstablishmentResultV1(
        String contractVersion,
        String kind,
        String authResolution,
        String establishment,
        String elderId
) {
    public static final String CONTRACT_VERSION = "elder-record-identity-api-v1";
    public static final String KIND = "elder_record_establishment_result_v1";
    private static final Set<String> AUTH = Set.of("authenticated", "missing", "expired", "invalid", "unavailable",
            "technical_failure");
    private static final Set<String> ESTABLISHMENT = Set.of("created", "already_bound", "unavailable", "technical_failure");

    public ElderRecordEstablishmentResultV1 {
        if (!CONTRACT_VERSION.equals(contractVersion) || !KIND.equals(kind) || !AUTH.contains(authResolution)) {
            throw new IllegalArgumentException("invalid ElderRecord establishment envelope");
        }
        if ("authenticated".equals(authResolution)) {
            if (!ESTABLISHMENT.contains(establishment)
                    || (("created".equals(establishment) || "already_bound".equals(establishment)) != !blank(elderId))) {
                throw new IllegalArgumentException("ElderRecord establishment and id must agree");
            }
        } else if (establishment != null || elderId != null) {
            throw new IllegalArgumentException("unauthenticated result cannot contain ElderRecord data");
        }
    }

    public static ElderRecordEstablishmentResultV1 from(ElderRecordService.Establishment result) {
        if (result == null) return technicalFailure();
        String auth = result.authStatus().name().toLowerCase();
        if (!"authenticated".equals(auth)) return new ElderRecordEstablishmentResultV1(
                CONTRACT_VERSION, KIND, auth, null, null);
        return new ElderRecordEstablishmentResultV1(CONTRACT_VERSION, KIND, auth,
                result.status().name().toLowerCase(), result.record() == null ? null : result.record().elderId());
    }

    public static ElderRecordEstablishmentResultV1 technicalFailure() {
        return new ElderRecordEstablishmentResultV1(CONTRACT_VERSION, KIND, "technical_failure", null, null);
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
