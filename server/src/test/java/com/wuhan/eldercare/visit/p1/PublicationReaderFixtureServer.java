package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.institution.persistence.JdbcInstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.persistence.NodeInstitutionSnapshotValidator;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** Test-classpath-only real HTTP/MySQL reader fixture; never packaged or used for real institution data. */
public final class PublicationReaderFixtureServer {
    static P1TestSupport support;
    static P1Service service;

    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("private runtime output path required");
        Path output = Path.of(args[0]).toAbsolutePath().normalize();
        if (!output.getFileName().toString().endsWith(".private.json")) throw new IllegalArgumentException("private output marker required");
        String databaseUrl = System.getenv("P1_MYSQL_URL");
        if (databaseUrl == null || !databaseUrl.matches("jdbc:mysql://127\\.0\\.0\\.1:(?!3306/)[0-9]+/p1_intake_disposable_reader[a-f0-9]{32}\\?.*"))
            throw new IllegalArgumentException("dedicated disposable reader fixture schema required");
        support = new P1TestSupport(System.getenv());
        // PRODUCTION is the protocol branch under test, not the provenance or deployment of these fixtures.
        var settings = new P1Service.Settings(false, false, support.settings.noticeVersion(), support.settings.noticeText(),
                support.settings.noticeApprovalRef(), "", support.settings.adminUsername(), support.settings.adminPasswordHash());
        service = new P1Service(support.database, support.auth, support.mapper, support.clock, settings,
                new JdbcInstitutionRevisionRepository(support.database, support.mapper,
                        new NodeInstitutionSnapshotValidator("node", support.mapper)), true, "node");
        var login = service.login(settings.adminUsername(), support.adminPassword);
        String id = "synthetic-reader-" + UUID.randomUUID();
        ObjectNode record;
        try (var input = PublicationReaderFixtureServer.class.getResourceAsStream("/institution-synthetic-v121.json")) {
            record = (ObjectNode) support.mapper.readTree(input);
        }
        record.put("institutionId", id);
        ((ObjectNode) record.path("identity").path("name")).put("value", "合成历史读取机构第一版");
        ((ObjectNode) record.path("identity").path("regionCode")).put("value", "420106");
        for (var evidence : record.path("evidence")) {
            ((ObjectNode) evidence).put("institutionId", id);
            if (evidence.path("fieldPath").asText().equals("identity.name"))
                ((ObjectNode) evidence.path("valueSnapshot")).put("value", "合成历史读取机构第一版");
        }
        var profile = support.mapper.createObjectNode().put("schemaVersion", "institution-public-profile-v1")
                .put("id", id).put("name", "合成历史读取机构第一版").put("source", "隔离测试合成资料，不是真实机构")
                .put("room", "合成房型").put("address", "合成地址，不据此前往").put("nature", "性质未知")
                .put("tagNote", "合成标签不代表核验能力").put("otherFees", "其他费用未知")
                .put("priceNote", "合成月费，仅测试").put("historyNote", "独立MySQL内的协议分支测试");
        profile.putArray("tags").add("合成测试");
        profile.putArray("prices").addObject().put("level", "合成档位").put("bed", 1000).put("care", 1000).put("food", 500).put("total", 2500);
        var create = support.mapper.createObjectNode().put("institutionId", id);
        create.set("record", record); create.set("publicProfile", profile);
        service.publications().save(login.token(), login.csrfToken(), id, create, true);
        service.publications().confirm(login.token(), login.csrfToken(), id, support.mapper.createObjectNode()
                .put("expectedDraftRevision", 1).put("sourceReference", "SYNTHETIC_READER_FIXTURE_ONLY")
                .put("confirmedBy", "合成测试人").put("confirmedOn", LocalDate.now(java.time.ZoneOffset.UTC).toString()));
        service.publications().publish(login.token(), login.csrfToken(), id, support.mapper.createObjectNode()
                .put("expectedDraftRevision", 2).put("operationId", UUID.randomUUID().toString()));
        support.mapper.writerWithDefaultPrettyPrinter().writeValue(output.toFile(), Map.of(
                "baseUrl", "http://127.0.0.1:18342", "adminUsername", settings.adminUsername(), "adminPassword", support.adminPassword,
                "institutionId", id, "fixtureOnly", true, "protocolDataEnvironment", "PRODUCTION", "initialRecordRevision", 1));
        var application = new SpringApplication(FixtureConfiguration.class);
        application.setDefaultProperties(Map.of("server.port", "18342", "server.address", "127.0.0.1",
                "spring.flyway.enabled", "false", "spring.main.banner-mode", "off", "logging.level.root", "WARN"));
        application.run();
    }

    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration(exclude = {DataSourceAutoConfiguration.class, DataSourceTransactionManagerAutoConfiguration.class})
    @Import({P1Controller.class, InstitutionPublicationController.class})
    public static class FixtureConfiguration {
        @Bean P1Service p1Service() { return service; }
        @Bean ObjectMapper objectMapper() { return support.mapper; }
    }
}
