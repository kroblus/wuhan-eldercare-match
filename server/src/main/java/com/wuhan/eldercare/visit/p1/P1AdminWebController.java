package com.wuhan.eldercare.visit.p1;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import java.net.URI;

/** Same-origin static workbench; its data API always performs independent admin authentication. */
@Controller
public final class P1AdminWebController {
    @GetMapping("/p1-admin")
    public ResponseEntity<Void> canonicalRoot() {
        return ResponseEntity.status(308).header("Cache-Control", "no-store").location(URI.create("/p1-admin/")).build();
    }

    @GetMapping({"/p1-admin/",
            "/p1-admin/dashboard", "/p1-admin/dashboard/",
            "/p1-admin/requests", "/p1-admin/requests/",
            "/p1-admin/visits", "/p1-admin/visits/",
            "/p1-admin/institutions", "/p1-admin/institutions/",
            "/p1-admin/reports", "/p1-admin/reports/"})
    public String index(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return "forward:/p1-admin/index.html";
    }
}
