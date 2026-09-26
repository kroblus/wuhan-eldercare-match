package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.lifecycle.VisitLifecycleMutationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operations/visits")
public class VisitLifecycleMutationController {
    private final VisitLifecycleMutationService service;

    public VisitLifecycleMutationController(VisitLifecycleMutationService service) {
        this.service = service;
    }

    @PostMapping("/{visitId}/lifecycle")
    public ResponseEntity<VisitLifecycleMutationResultV1> mutate(
            @PathVariable String visitId,
            @RequestHeader(value = "X-Operations-Credential", required = false) String credentialEvidence,
            @RequestBody(required = false) VisitLifecycleMutationRequestV1 request
    ) {
        try {
            return ResponseEntity.ok(VisitLifecycleMutationResultV1.from(
                    service.mutate(visitId, credentialEvidence,
                            request == null ? null : request.toApplicationRequest())));
        } catch (RuntimeException ignored) {
            return ResponseEntity.ok(VisitLifecycleMutationResultV1.technicalFailure());
        }
    }
}
