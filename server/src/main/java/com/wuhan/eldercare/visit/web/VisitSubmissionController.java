package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.application.VisitSubmissionService;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
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
    public ResponseEntity<SubmissionResultV1> submit(
            @RequestHeader(value = "X-Auth-Evidence", required = false) String authEvidence,
            @RequestHeader(value = "X-Phone-Auth-Evidence", required = false) String phoneEvidence,
            @RequestBody SubmissionRequestV1 request
    ) {
        // Keep the private persistence candidate inside the service boundary;
        // the HTTP API exposes only its validated public receipt projection.
        return ResponseEntity.ok(service.submit(request.toCommand(), authEvidence, phoneEvidence));
    }
}
