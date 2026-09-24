package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.application.VisitEvaluationSubmissionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/visits")
public class VisitEvaluationSubmissionController {
    private final VisitEvaluationSubmissionService service;

    public VisitEvaluationSubmissionController(VisitEvaluationSubmissionService service) {
        this.service = service;
    }

    @PostMapping("/{visitId}/evaluation")
    public ResponseEntity<VisitEvaluationSubmissionResultV1> submit(
            @PathVariable String visitId,
            @RequestHeader(value = "X-Auth-Evidence", required = false) String authEvidence,
            @RequestBody VisitEvaluationSubmissionRequestV1 request
    ) {
        try {
            return ResponseEntity.ok(VisitEvaluationSubmissionResultV1.from(
                    service.submit(visitId, request.toServiceRequest(), authEvidence)));
        } catch (RuntimeException ignored) {
            return ResponseEntity.ok(VisitEvaluationSubmissionResultV1.technicalFailure());
        }
    }
}
