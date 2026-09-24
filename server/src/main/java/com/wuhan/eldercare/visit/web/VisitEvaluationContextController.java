package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.application.VisitEvaluationContextService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/visits")
public class VisitEvaluationContextController {
    private final VisitEvaluationContextService service;

    public VisitEvaluationContextController(VisitEvaluationContextService service) {
        this.service = service;
    }

    @GetMapping("/{visitId}/evaluation-context")
    public ResponseEntity<VisitEvaluationContextResultV1> load(
            @PathVariable String visitId,
            @RequestHeader(value = "X-Auth-Evidence", required = false) String authEvidence
    ) {
        try {
            return ResponseEntity.ok(VisitEvaluationContextResultV1.from(service.load(visitId, authEvidence)));
        } catch (RuntimeException ignored) {
            return ResponseEntity.ok(VisitEvaluationContextResultV1.technicalFailure());
        }
    }
}
