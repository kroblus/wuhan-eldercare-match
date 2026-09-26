package com.wuhan.eldercare.visit.elder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.elder.application.ElderIdentitySource;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.application.ElderRecordService;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;
import com.wuhan.eldercare.visit.web.ElderRecordController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ElderRecordControllerTest {
    private final InMemoryRepository repository = new InMemoryRepository();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        AuthEvidenceResolver auth = evidence -> "valid-session".equals(evidence)
                ? AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal("synthetic-c5-user"))
                : AuthEvidenceResolver.Resolution.failure(evidence == null
                ? AuthEvidenceResolver.Resolution.Status.MISSING : AuthEvidenceResolver.Resolution.Status.INVALID);
        ElderIdentitySource ids = new ElderIdentitySource() {
            @Override public String newElderId() { return "elder_server_generated"; }
            @Override public Instant createdAt() { return Instant.parse("2026-09-27T00:00:00Z"); }
        };
        mvc = MockMvcBuilders.standaloneSetup(new ElderRecordController(
                new ElderRecordService(auth, repository, ids))).build();
    }

    @Test
    void readWithoutSessionDoesNotCreateAndExplicitPostIgnoresClientIdentityFields() throws Exception {
        mvc.perform(get("/api/v1/elder-record"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authResolution").value("missing"));
        org.junit.jupiter.api.Assertions.assertEquals(0, repository.records.size());

        mvc.perform(post("/api/v1/elder-record")
                        .header("X-Auth-Evidence", "valid-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsBytes(Map.of(
                                "elderId", "elder_client_chosen", "userId", "synthetic-spoofed-user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.establishment").value("created"))
                .andExpect(jsonPath("$.elderId", startsWith("elder_server_")))
                .andExpect(jsonPath("$.responsibleUserId").doesNotExist());

        mvc.perform(get("/api/v1/elder-record").header("X-Auth-Evidence", "valid-session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability").value("bound"))
                .andExpect(jsonPath("$.elderId").value("elder_server_generated"));
    }

    private static final class InMemoryRepository implements ElderRecordRepository {
        private final Map<String, ElderRecord> records = new HashMap<>();

        @Override public Lookup findByResponsibleUserId(String userId) {
            ElderRecord record = records.get(userId);
            return record == null ? Lookup.of(Lookup.Status.NOT_FOUND) : Lookup.found(record);
        }

        @Override public Establish establish(ElderRecord candidate) {
            ElderRecord existing = records.get(candidate.responsibleUserId());
            if (existing != null) return Establish.alreadyBound(existing);
            records.put(candidate.responsibleUserId(), candidate);
            return Establish.created(candidate);
        }
    }
}
