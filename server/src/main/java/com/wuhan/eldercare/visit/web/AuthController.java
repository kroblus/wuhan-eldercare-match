package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.auth.AuthResultV1;
import com.wuhan.eldercare.visit.auth.C5AuthService;
import com.wuhan.eldercare.visit.auth.WeChatAuthRequestV1;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final C5AuthService service;

    public AuthController(C5AuthService service) {
        this.service = service;
    }

    @PostMapping("/wechat")
    public ResponseEntity<AuthResultV1> authenticate(@RequestBody(required = false) WeChatAuthRequestV1 request) {
        try {
            return ResponseEntity.ok(service.authenticate(request));
        } catch (RuntimeException ignored) {
            return ResponseEntity.ok(AuthResultV1.technicalFailure());
        }
    }
}
