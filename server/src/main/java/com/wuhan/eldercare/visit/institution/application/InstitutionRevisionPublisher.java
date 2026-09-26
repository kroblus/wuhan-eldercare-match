package com.wuhan.eldercare.visit.institution.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

/** Controlled application entry point; it is never invoked by normal application startup. */
public final class InstitutionRevisionPublisher {
    private static final String ACTIVE_CONTRACT_VERSION = "institution-contract-v1.2.1";
    private final InstitutionRevisionRepository repository;
    private final Clock clock;

    public InstitutionRevisionPublisher(InstitutionRevisionRepository repository,
                                        Clock clock) {
        this.repository = Objects.requireNonNull(repository);
        this.clock = Objects.requireNonNull(clock);
    }

    public InstitutionPublishResult publish(JsonNode packageInput) {
        InstitutionPublishPackageV1.ParseResult parsed = InstitutionPublishPackageV1.parse(packageInput);
        if (parsed.status() != InstitutionPublishPackageV1.ParseResult.Status.VALID) {
            return InstitutionPublishResult.of(InstitutionPublishResult.Status.INVALID_PACKAGE);
        }
        InstitutionPublishPackageV1 publishPackage = parsed.value();
        ObjectNode record = publishPackage.record();
        if (!ACTIVE_CONTRACT_VERSION.equals(record.path("contractVersion").asText(null))) {
            return InstitutionPublishResult.of(InstitutionPublishResult.Status.INVALID_RECORD);
        }
        if (!"PRODUCTION_CANDIDATE".equals(record.path("recordProvenance").asText(null))) {
            return InstitutionPublishResult.of(InstitutionPublishResult.Status.INVALID_RECORD);
        }
        JsonNode institutionId = record.get("institutionId");
        if (institutionId == null || !institutionId.isTextual() || institutionId.asText().isBlank()
                || institutionId.asText().length() > 200) {
            return InstitutionPublishResult.of(InstitutionPublishResult.Status.INVALID_RECORD);
        }
        return repository.publish(publishPackage, clock.instant().truncatedTo(ChronoUnit.MICROS));
    }

}
