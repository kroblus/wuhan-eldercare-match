package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.application.AppointmentOwnerReadService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/visits")
public class AppointmentOwnerReadController {
    private final AppointmentOwnerReadService service;

    public AppointmentOwnerReadController(AppointmentOwnerReadService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<AppointmentOwnerReadResultV1> load(
            @RequestHeader(value = "X-Auth-Evidence", required = false) String authEvidence
    ) {
        try {
            return ResponseEntity.ok(AppointmentOwnerReadResultV1.from(service.load(authEvidence)));
        } catch (RuntimeException ignored) {
            return ResponseEntity.ok(AppointmentOwnerReadResultV1.technicalFailure());
        }
    }
}
