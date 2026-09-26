package com.wuhan.eldercare.visit.institution.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.C4Application;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.nio.file.Files;
import java.nio.file.Path;

/** Explicit deployment-controlled CLI. Normal Spring startup never invokes this command. */
public final class InstitutionPublishCommand {
    private static final long MAX_PACKAGE_BYTES = 12L * 1024L * 1024L;

    private InstitutionPublishCommand() { }

    public static boolean isRequested(String[] args) {
        ApplicationArguments parsed = new DefaultApplicationArguments(args);
        return parsed.containsOption("institution.publisher.command")
                && parsed.getOptionValues("institution.publisher.command").contains("publish");
    }

    public static int run(String[] args) {
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(C4Application.class)
                .web(WebApplicationType.NONE)
                .run(args)) {
            ApplicationArguments parsed = new DefaultApplicationArguments(args);
            String inputValue = firstOption(parsed, "institution.publisher.input");
            if (inputValue == null) {
                System.err.println("institution publish failed: INVALID_PACKAGE (input path required)");
                return 2;
            }
            Path input = Path.of(inputValue);
            if (!Files.isRegularFile(input) || Files.size(input) > MAX_PACKAGE_BYTES) {
                System.err.println("institution publish failed: INVALID_PACKAGE (input unreadable or too large)");
                return 2;
            }
            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            JsonNode packageInput = objectMapper.readTree(Files.readAllBytes(input));
            InstitutionRevisionPublisher publisher = context.getBean(InstitutionRevisionPublisher.class);
            InstitutionPublishResult result = publisher.publish(packageInput);
            if (result.status() == InstitutionPublishResult.Status.PUBLISHED
                    || result.status() == InstitutionPublishResult.Status.REPLAYED) {
                System.out.println("institution publish status=" + result.status()
                        + " institutionId=" + result.institutionId()
                        + " recordRevision=" + result.recordRevision()
                        + " publishedAt=" + result.publishedAt());
                return 0;
            }
            System.err.println("institution publish status=" + result.status());
            result.validationIssues().forEach(issue ->
                    System.err.println("validation issue code=" + issue.code() + " path=" + issue.path()));
            return result.status() == InstitutionPublishResult.Status.INVALID_PACKAGE
                    || result.status() == InstitutionPublishResult.Status.INVALID_RECORD
                    || result.status() == InstitutionPublishResult.Status.OPERATION_ID_CONFLICT ? 2 : 1;
        } catch (Exception ignored) {
            System.err.println("institution publish status=TECHNICAL_FAILURE");
            return 1;
        }
    }

    private static String firstOption(ApplicationArguments arguments, String name) {
        if (!arguments.containsOption(name)) return null;
        var values = arguments.getOptionValues(name);
        return values == null || values.size() != 1 || values.get(0).isBlank() ? null : values.get(0);
    }
}
