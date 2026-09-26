package com.wuhan.eldercare.visit.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wuhan.eldercare.visit.application.AppointmentOwnerReadService;

import java.util.List;
import java.util.Set;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record AppointmentOwnerReadResultV1(
        String contractVersion,
        String kind,
        String authResolution,
        String availability,
        List<AppointmentListItemV1> items
) {
    public static final String CONTRACT_VERSION = "appointment-production-owner-read-contract-v1";
    public static final String KIND = "appointment_owner_read_result_v1";
    private static final Set<String> AUTH_RESOLUTIONS = Set.of(
            "authenticated", "missing", "expired", "invalid", "unavailable", "technical_failure");
    private static final Set<String> AVAILABILITIES = Set.of("ready", "unavailable", "technical_failure");
    private static final Set<String> VISIT_STATUSES = Set.of(
            "requested", "contacting", "scheduled", "completed", "cancelled");

    public AppointmentOwnerReadResultV1 {
        if (!CONTRACT_VERSION.equals(contractVersion) || !KIND.equals(kind)
                || !AUTH_RESOLUTIONS.contains(authResolution)) {
            throw new IllegalArgumentException("invalid Appointment owner-read result envelope");
        }
        if ("authenticated".equals(authResolution)) {
            if (!AVAILABILITIES.contains(availability)) {
                throw new IllegalArgumentException("authenticated result requires availability");
            }
            if (("ready".equals(availability)) != (items != null)) {
                throw new IllegalArgumentException("items must match ready availability");
            }
        } else if (availability != null || items != null) {
            throw new IllegalArgumentException("unauthenticated result cannot contain Visit data");
        }
        if (items != null) items = List.copyOf(items);
    }

    public static AppointmentOwnerReadResultV1 from(AppointmentOwnerReadService.Result result) {
        if (result == null) return technicalFailure();
        List<AppointmentListItemV1> items = result.items() == null ? null : result.items().stream()
                .map(AppointmentOwnerReadResultV1::mapItem).toList();
        return new AppointmentOwnerReadResultV1(CONTRACT_VERSION, KIND,
                result.authResolution().wireValue(),
                result.availability() == null ? null : result.availability().wireValue(), items);
    }

    public static AppointmentOwnerReadResultV1 technicalFailure() {
        return new AppointmentOwnerReadResultV1(CONTRACT_VERSION, KIND, "technical_failure", null, null);
    }

    private static AppointmentListItemV1 mapItem(AppointmentOwnerReadService.AppointmentListItem item) {
        if (item == null || item.institutionDisplay() == null) {
            throw new IllegalArgumentException("invalid Appointment list projection");
        }
        return new AppointmentListItemV1(item.visitId(), item.institutionId(), item.institutionRecordRevision(),
                item.visitStatus(), item.visitDate(), item.visitTimePreference(), item.participantCount(),
                item.pickupRequested(), new InstitutionDisplayV1(item.institutionDisplay().availability().wireValue(),
                item.institutionDisplay().name()));
    }

    public record AppointmentListItemV1(
            String visitId,
            String institutionId,
            String institutionRecordRevision,
            String visitStatus,
            String visitDate,
            String visitTimePreference,
            int participantCount,
            @JsonInclude(JsonInclude.Include.NON_NULL) Boolean pickupRequested,
            InstitutionDisplayV1 institutionDisplay
    ) {
        public AppointmentListItemV1 {
            if (blank(visitId) || blank(institutionId) || blank(institutionRecordRevision)
                    || !VISIT_STATUSES.contains(visitStatus) || blank(visitDate) || blank(visitTimePreference)
                    || participantCount < 1 || institutionDisplay == null) {
                throw new IllegalArgumentException("invalid Appointment list item");
            }
        }
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record InstitutionDisplayV1(String availability, String name) {
        public InstitutionDisplayV1 {
            if ("ready".equals(availability) ? blank(name)
                    : !"unavailable".equals(availability) || name != null) {
                throw new IllegalArgumentException("invalid Institution display state");
            }
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
