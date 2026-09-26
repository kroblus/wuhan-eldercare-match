package com.wuhan.eldercare.visit.elder;

import com.zaxxer.hikari.HikariDataSource;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.persistence.JdbcElderRecordRepository;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Run only after the disposable MySQL process has been stopped and restarted on the same datadir. */
@Tag("mysql-integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElderRecordMySqlRestartProbeTest {
    private static final String RESTART_USER = "synthetic-restart-probe-user";
    private static final String RESTART_ELDER_ID = "elder_restart_probe_expected";
    private HikariDataSource dataSource;

    @BeforeAll
    void requireRestartedDisposableMysql() {
        String url = System.getenv("ELDER_FOUNDATION_MYSQL_URL");
        String username = System.getenv("ELDER_FOUNDATION_MYSQL_USERNAME");
        assumeTrue("true".equalsIgnoreCase(System.getenv("ELDER_FOUNDATION_DISPOSABLE_MYSQL")),
                "explicit disposable MySQL marker required");
        assumeTrue(url != null && url.startsWith("jdbc:mysql://127.0.0.1:") && username != null,
                "isolated loopback MySQL URL and test username required");
        URI uri = URI.create("http://" + url.substring("jdbc:mysql://".length()).split("\\?", 2)[0]);
        assumeTrue(uri.getPort() > 0 && uri.getPort() != 3306 && uri.getPath().contains("disposable"),
                "Owner port/schema forbidden");
        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(System.getenv().getOrDefault("ELDER_FOUNDATION_MYSQL_PASSWORD", ""));
        assertEquals("8", Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .load().info().current().getVersion().getVersion());
    }

    @AfterAll
    void closePool() {
        if (dataSource != null) dataSource.close();
    }

    @Test
    void sameC5UserResolvesSamePersistedElderAfterMysqlServerRestart() {
        ElderRecordRepository.Lookup result = new JdbcElderRecordRepository(dataSource)
                .findByResponsibleUserId(RESTART_USER);
        assertEquals(ElderRecordRepository.Lookup.Status.FOUND, result.status());
        assertEquals(RESTART_ELDER_ID, result.record().elderId());
        assertEquals(RESTART_USER, result.record().responsibleUserId());
    }
}
