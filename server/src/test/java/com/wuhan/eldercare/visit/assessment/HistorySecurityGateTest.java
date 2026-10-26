package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

@ExtendWith(OutputCaptureExtension.class)
class HistorySecurityGateTest {
    @Test void boundBeforeJsonAndDisabledWriteDoesNotParseSensitiveBody(CapturedOutput output) throws Exception {
        var service=mock(HistoryService.class);var mapper=new ObjectMapper();
        var mvc=standaloneSetup(new HistoryController(service,mapper)).build();
        String marker="TEST_ONLY_SENSITIVE_SENTINEL_DO_NOT_LOG";
        String large="{\"answers\":\""+marker+"x".repeat(70000)+"\"}";
        assertEquals(503,mvc.perform(post("/api/v1/completed-assessments?testOnly=true")
                .header("X-Test-Only","true").contentType("application/json").content(large)).andReturn().getResponse().getStatus());
        when(service.available()).thenReturn(true);
        assertEquals(400,mvc.perform(post("/api/v1/completed-assessments").contentType("application/json").content(large)).andReturn().getResponse().getStatus());
        assertEquals(400,mvc.perform(post("/api/v1/completed-assessments").contentType("application/json").content("{"+marker)).andReturn().getResponse().getStatus());
        verify(service,never()).create(any(),any());
        assertFalse(output.getAll().contains(marker));
    }
}
