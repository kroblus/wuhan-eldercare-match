package com.wuhan.eldercare.visit.p1;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Same-origin static workbench; its data API always performs independent admin authentication. */
@Controller
public final class P1AdminWebController {
    @GetMapping({"/p1-admin", "/p1-admin/"})
    public String index() { return "forward:/p1-admin/index.html"; }
}
