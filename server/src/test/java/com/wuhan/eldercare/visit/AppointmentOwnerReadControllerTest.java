package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.application.AppointmentOwnerReadService;
import com.wuhan.eldercare.visit.web.AppointmentOwnerReadController;
import com.wuhan.eldercare.visit.web.AppointmentOwnerReadResultV1;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AppointmentOwnerReadController.class)
class AppointmentOwnerReadControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockBean private AppointmentOwnerReadService service;

    @Test
    void collectionRouteUsesOnlySessionHeaderAndReturnsMinimalListResult() throws Exception {
        var item = new AppointmentOwnerReadService.AppointmentListItem(
                "visit-1", "institution-1", "8", "completed", "2026-10-01", "morning", 2, null,
                new AppointmentOwnerReadService.InstitutionDisplay(
                        AppointmentOwnerReadService.DisplayAvailability.READY, "Synthetic Historical Name"));
        when(service.load(eq("synthetic-session"))).thenReturn(new AppointmentOwnerReadService.Result(
                AppointmentOwnerReadService.AuthResolution.AUTHENTICATED,
                AppointmentOwnerReadService.Availability.READY, List.of(item)));

        mockMvc.perform(get("/api/v1/visits")
                        .header("X-Auth-Evidence", "synthetic-session")
                        .queryParam("userId", "forged-user")
                        .queryParam("ownerId", "forged-owner")
                        .queryParam("status", "cancelled")
                        .queryParam("page", "99"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contractVersion", equalTo(AppointmentOwnerReadResultV1.CONTRACT_VERSION)))
                .andExpect(jsonPath("$.kind", equalTo(AppointmentOwnerReadResultV1.KIND)))
                .andExpect(jsonPath("$.authResolution", equalTo("authenticated")))
                .andExpect(jsonPath("$.availability", equalTo("ready")))
                .andExpect(jsonPath("$.items.length()", equalTo(1)))
                .andExpect(jsonPath("$.items[0].visitStatus", equalTo("completed")))
                .andExpect(jsonPath("$.items[0].institutionRecordRevision", equalTo("8")))
                .andExpect(jsonPath("$.items[0].institutionDisplay.name", equalTo("Synthetic Historical Name")))
                .andExpect(jsonPath("$.items[0].pickupRequested").doesNotExist())
                .andExpect(jsonPath("$.items[0].userId").doesNotExist())
                .andExpect(jsonPath("$.items[0].elderId").doesNotExist())
                .andExpect(jsonPath("$.items[0].phone").doesNotExist())
                .andExpect(jsonPath("$.items[0].assessment").doesNotExist())
                .andExpect(jsonPath("$.items[0].notes").doesNotExist());

        verify(service).load("synthetic-session");
    }

    @Test
    void legitimateEmptyAndMissingSessionHaveDistinctEnvelopes() throws Exception {
        when(service.load(eq("session-empty"))).thenReturn(new AppointmentOwnerReadService.Result(
                AppointmentOwnerReadService.AuthResolution.AUTHENTICATED,
                AppointmentOwnerReadService.Availability.READY, List.of()));
        when(service.load(eq(null))).thenReturn(new AppointmentOwnerReadService.Result(
                AppointmentOwnerReadService.AuthResolution.MISSING, null, null));

        mockMvc.perform(get("/api/v1/visits").header("X-Auth-Evidence", "session-empty"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability", equalTo("ready")))
                .andExpect(jsonPath("$.items.length()", equalTo(0)));
        mockMvc.perform(get("/api/v1/visits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authResolution", equalTo("missing")))
                .andExpect(jsonPath("$.availability").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.items").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void unexpectedControllerFailureDoesNotReturnAnEmptyCollection() throws Exception {
        doThrow(new IllegalStateException("synthetic-private-detail"))
                .when(service).load(eq("synthetic-session"));

        mockMvc.perform(get("/api/v1/visits").header("X-Auth-Evidence", "synthetic-session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authResolution", equalTo("technical_failure")))
                .andExpect(jsonPath("$.availability").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.items").value(org.hamcrest.Matchers.nullValue()));
    }
}
