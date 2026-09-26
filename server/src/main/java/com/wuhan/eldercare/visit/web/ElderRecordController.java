package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.elder.application.ElderRecordService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/elder-record")
public final class ElderRecordController {
    private final ElderRecordService service;

    public ElderRecordController(ElderRecordService service) {
        if (service == null) throw new IllegalArgumentException("ElderRecordService required");
        this.service = service;
    }

    /** Read is principal-scoped and never creates an ElderRecord. */
    @GetMapping
    public ResponseEntity<ElderRecordResolutionResultV1> resolve(
            @RequestHeader(value = "X-Auth-Evidence", required = false) String authEvidence) {
        try {
            return ResponseEntity.ok(ElderRecordResolutionResultV1.from(service.resolveCurrent(authEvidence)));
        } catch (RuntimeException ignored) {
            return ResponseEntity.ok(ElderRecordResolutionResultV1.technicalFailure());
        }
    }

    /** Explicit create-or-resolve action. The client supplies neither owner nor elderId. */
    @PostMapping
    public ResponseEntity<ElderRecordEstablishmentResultV1> establish(
            @RequestHeader(value = "X-Auth-Evidence", required = false) String authEvidence) {
        try {
            return ResponseEntity.ok(ElderRecordEstablishmentResultV1.from(service.establishCurrent(authEvidence)));
        } catch (RuntimeException ignored) {
            return ResponseEntity.ok(ElderRecordEstablishmentResultV1.technicalFailure());
        }
    }
}
