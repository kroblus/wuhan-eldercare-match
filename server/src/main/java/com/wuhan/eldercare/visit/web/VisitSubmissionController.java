package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.application.BackendSubmissionResultV1;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/appointment-submissions")
public class VisitSubmissionController {
    private final VisitSubmissionService service;

    public VisitSubmissionController(VisitSubmissionService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<BackendSubmissionResultV1> submit(
            @RequestHeader(value = "X-Auth-Evidence", required = false) String authEvidence,
            @RequestHeader(value = "X-Phone-Auth-Evidence", required = false) String phoneEvidence,
            @RequestBody SubmissionRequestV1 request
    ) {
        // This is the private Backend -> Application transport boundary. The
        // Application adapter must validate an accepted/replayed candidate
        // through the C2 firewall before producing a Page-safe receipt.
        return ResponseEntity.ok(service.submitBackend(request.toCommand(), authEvidence, phoneEvidence));
    }
}
