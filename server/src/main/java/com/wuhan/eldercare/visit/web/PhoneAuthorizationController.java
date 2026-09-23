package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.application.PhoneAuthorizationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/wechat/phone")
public class PhoneAuthorizationController {
    private final PhoneAuthorizationService service;

    public PhoneAuthorizationController(PhoneAuthorizationService service) {
        this.service = service;
    }

    @PostMapping("/verify")
    public ResponseEntity<PhoneAuthorizationResultV1> verify(
            @RequestHeader(value = "X-Auth-Evidence", required = false) String authEvidence,
            @RequestBody(required = false) PhoneAuthorizationRequestV1 request
    ) {
        try {
            PhoneAuthorizationService.VerificationResult result = service.verify(authEvidence,
                    request == null ? null : request.toServiceRequest());
            return ResponseEntity.ok(PhoneAuthorizationResultV1.from(result));
        } catch (RuntimeException ignored) {
            return ResponseEntity.ok(PhoneAuthorizationResultV1.technicalFailure());
        }
    }
}
