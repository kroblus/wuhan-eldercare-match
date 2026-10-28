package com.wuhan.eldercare.visit.p1;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class P1AdminWebRoutingTest {
    @Test void onlyKnownPageEntrypointsForwardToTheReactIndex() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new P1AdminWebController()).build();
        mvc.perform(get("/p1-admin")).andExpect(status().is3xxRedirection()).andExpect(redirectedUrl("/p1-admin/"))
                .andExpect(header().string("Cache-Control", "no-store"));
        for (String page : new String[]{"", "dashboard", "requests", "visits", "institutions", "reports"}) {
            for (String suffix : new String[]{"", "/"}) {
                if (page.isEmpty() && suffix.isEmpty()) continue;
                String path = "/p1-admin" + (page.isEmpty() ? suffix : "/" + page + suffix);
                mvc.perform(get(path)).andExpect(status().isOk()).andExpect(forwardedUrl("/p1-admin/index.html"))
                        .andExpect(header().string("Cache-Control", "no-store"));
            }
        }
    }

    @Test void missingAssetsUnknownPagesAndApiPathsAreNeverSpaFallbacks() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new P1AdminWebController()).build();
        for (String path : new String[]{"/p1-admin/assets/missing.js", "/p1-admin/missing.css", "/p1-admin/unknown",
                "/p1-admin/institutions/unknown", "/p1-admin/api/v1/p1-service/admin/session",
                "/api/v1/p1-service/admin/session", "/p1-admin/login", "/error"}) {
            mvc.perform(get(path)).andExpect(status().isNotFound()).andExpect(forwardedUrl(null));
        }
    }
}
