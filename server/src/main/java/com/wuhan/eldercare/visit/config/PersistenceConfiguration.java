package com.wuhan.eldercare.visit.config;

import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;

@Configuration
public class PersistenceConfiguration {
    @Bean(destroyMethod = "close")
    @ConditionalOnProperty(name = "c4.persistence.enabled", havingValue = "true")
    DataSource c4DataSource(Environment environment) {
        String url = required(environment, "C4_MYSQL_URL");
        String username = required(environment, "C4_MYSQL_USERNAME");
        String password = environment.getProperty("C4_MYSQL_PASSWORD", "");
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        dataSource.setMaximumPoolSize(8);
        dataSource.setMinimumIdle(1);
        dataSource.setPoolName("c4-visit-pool");
        return dataSource;
    }

    @Bean
    @ConditionalOnBean(DataSource.class)
    Flyway c4Flyway(DataSource dataSource) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(false)
                .load();
        flyway.migrate();
        return flyway;
    }

    private static String required(Environment environment, String name) {
        String value = environment.getProperty(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required when C4 persistence is enabled");
        }
        return value;
    }
}
