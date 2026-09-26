package com.wuhan.eldercare.visit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishCommand;
import com.wuhan.eldercare.visit.operations.OperationsProvisioningCommandRunner;

@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class, FlywayAutoConfiguration.class})
public class C4Application {
    public static void main(String[] args) {
        if (OperationsProvisioningCommandRunner.isRequested(args)) {
            int exitCode = OperationsProvisioningCommandRunner.run(args);
            if (exitCode != 0) System.exit(exitCode);
            return;
        }
        if (InstitutionPublishCommand.isRequested(args)) {
            int exitCode = InstitutionPublishCommand.run(args);
            if (exitCode != 0) System.exit(exitCode);
            return;
        }
        SpringApplication.run(C4Application.class, args);
    }
}
