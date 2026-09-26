package com.wuhan.eldercare.visit.institution.appointment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.C4Application;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationPackageV1;
import com.wuhan.eldercare.visit.institution.appointment.application.InstitutionAppointmentAuthorizationProvisioner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;

/** Explicit deployment-only grant/revocation command; no runtime HTTP provisioning route exists. */
public final class InstitutionAppointmentAuthorizationCommand {
    private static final long MAX_PACKAGE_BYTES = 64L * 1024L;
    private static final String COMMAND = "institution.appointment.authorization.command";
    private static final String INPUT = "institution.appointment.authorization.input";

    private InstitutionAppointmentAuthorizationCommand() { }

    public static boolean isRequested(String[] args) {
        return new DefaultApplicationArguments(args).containsOption(COMMAND);
    }

    public static int run(String[] args) {
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(C4Application.class)
                .web(WebApplicationType.NONE).run(args)) {
            ApplicationArguments parsed = new DefaultApplicationArguments(args);
            var commands = parsed.getOptionValues(COMMAND);
            Path input = optionPath(parsed, INPUT);
            if (commands == null || commands.size() != 1 || !"apply".equals(commands.getFirst())
                    || input == null || parsed.getOptionNames().stream().anyMatch(name ->
                    !name.equals(COMMAND) && !name.equals(INPUT) && !name.startsWith("spring.")
                            && !name.startsWith("c4.") && !name.startsWith("institution.publisher."))) {
                System.err.println("institution appointment authorization status=INVALID");
                return 2;
            }
            if (!isSafeExternalPackage(input)) {
                System.err.println("institution appointment authorization status=INVALID");
                return 2;
            }
            byte[] bytes = Files.readAllBytes(input);
            try {
                ObjectMapper mapper = context.getBean(ObjectMapper.class);
                InstitutionAppointmentAuthorizationPackageV1.ParseResult parsedPackage =
                        InstitutionAppointmentAuthorizationPackageV1.parse(mapper.readTree(bytes));
                if (parsedPackage.status() != InstitutionAppointmentAuthorizationPackageV1.ParseResult.Status.VALID) {
                    System.err.println("institution appointment authorization status=INVALID");
                    return 2;
                }
                InstitutionAppointmentAuthorizationProvisioner.Result result = context
                        .getBean(InstitutionAppointmentAuthorizationProvisioner.class).apply(parsedPackage.value());
                System.out.println("institution appointment authorization status=" + result.status());
                return switch (result.status()) {
                    case APPLIED, REPLAYED -> 0;
                    case INVALID, CONFLICT -> 2;
                    case UNAVAILABLE, TECHNICAL_FAILURE -> 1;
                };
            } finally {
                java.util.Arrays.fill(bytes, (byte) 0);
            }
        } catch (Exception ignored) {
            System.err.println("institution appointment authorization status=TECHNICAL_FAILURE");
            return 1;
        }
    }

    private static Path optionPath(ApplicationArguments parsed, String name) {
        if (!parsed.containsOption(name)) return null;
        var values = parsed.getOptionValues(name);
        if (values == null || values.size() != 1 || values.getFirst().isBlank()) return null;
        return Path.of(values.getFirst()).toAbsolutePath().normalize();
    }

    private static boolean isSafeExternalPackage(Path path) throws Exception {
        if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(path)
                || Files.size(path) > MAX_PACKAGE_BYTES) return false;
        Path current = path.getParent();
        while (current != null) {
            if (Files.exists(current.resolve(".git"), LinkOption.NOFOLLOW_LINKS)) return false;
            current = current.getParent();
        }
        return true;
    }
}
