package com.wuhan.eldercare.visit.institution.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.institution.application.InstitutionSnapshotValidator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/** Executes the exact frozen Institution TypeScript validator through the packaged Node 24 bridge. */
public final class NodeInstitutionSnapshotValidator implements InstitutionSnapshotValidator {
    private static final String SOURCE_RESOURCE_PREFIX = "institution-validator/miniprogram/";
    private static final String SOURCE_PATTERN = "classpath*:institution-validator/miniprogram/**/*.ts";
    private static final String BRIDGE_RESOURCE = "institution-validator/tools/validate-institution-record.mjs";
    private static final Duration PROCESS_TIMEOUT = Duration.ofSeconds(30);
    private static final int MAX_RECORD_BYTES = 10 * 1024 * 1024;

    private final String nodeExecutable;
    private final ObjectMapper objectMapper;
    private volatile ValidatorAssets validatorAssets;

    public NodeInstitutionSnapshotValidator(String nodeExecutable, ObjectMapper objectMapper) {
        if (nodeExecutable == null || nodeExecutable.isBlank() || objectMapper == null) {
            throw new IllegalArgumentException("Node executable and JSON mapper are required");
        }
        this.nodeExecutable = nodeExecutable;
        this.objectMapper = objectMapper;
    }

    @Override
    public ValidationResult validate(JsonNode serverBoundRecord) {
        if (serverBoundRecord == null || !serverBoundRecord.isObject()) {
            return ValidationResult.invalid(List.of(new Issue("INVALID_INSTITUTION_RECORD", "$")));
        }
        try {
            var envelope = objectMapper.createObjectNode();
            envelope.set("record", serverBoundRecord);
            byte[] request = objectMapper.writeValueAsBytes(envelope);
            if (request.length > MAX_RECORD_BYTES) return ValidationResult.invalid(
                    List.of(new Issue("INSTITUTION_RECORD_TOO_LARGE", "$")));
            ValidatorAssets assets = assets();
            Process process;
            try {
                process = new ProcessBuilder(nodeExecutable, "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
                        assets.bridge().toString(),
                        "--source-root", assets.sourceRoot().toString()).start();
            } catch (IOException missingRuntime) {
                return ValidationResult.unavailable();
            }

            CompletableFuture<byte[]> stdout = readAsync(process.getInputStream());
            CompletableFuture<byte[]> stderr = readAsync(process.getErrorStream());
            try (OutputStream stdin = process.getOutputStream()) {
                stdin.write(request);
            }
            if (!process.waitFor(PROCESS_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                return ValidationResult.technicalFailure();
            }
            byte[] output = stdout.get(PROCESS_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            stderr.get(PROCESS_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS); // Drain benign Node module warnings.
            JsonNode response = objectMapper.readTree(output);
            if (response == null) return ValidationResult.technicalFailure();
            if (response.path("technicalFailure").asBoolean() || process.exitValue() != 0) {
                String code = firstIssueCode(response.path("issues"));
                return "NODE_24_REQUIRED".equals(code)
                        ? ValidationResult.unavailable()
                        : ValidationResult.technicalFailure();
            }
            if (response.path("valid").asBoolean(false)) return ValidationResult.valid();
            return ValidationResult.invalid(readIssues(response.path("issues")));
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return ValidationResult.technicalFailure();
        } catch (Exception ignored) {
            return ValidationResult.technicalFailure();
        }
    }

    /** Schema-complete unknown facts only; the template is not a published or verified institution. */
    public JsonNode draftTemplate(String institutionId) {
        try {
            ValidatorAssets assets = assets();
            Process process = new ProcessBuilder(nodeExecutable, "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
                    assets.bridge().toString(), "--source-root", assets.sourceRoot().toString()).start();
            CompletableFuture<byte[]> stdout = readAsync(process.getInputStream());
            CompletableFuture<byte[]> stderr = readAsync(process.getErrorStream());
            try(OutputStream stdin = process.getOutputStream()) {
                stdin.write(objectMapper.writeValueAsBytes(objectMapper.createObjectNode().put("templateInstitutionId", institutionId)));
            }
            if(!process.waitFor(PROCESS_TIMEOUT.toMillis(),TimeUnit.MILLISECONDS)) {
                process.destroyForcibly(); return null;
            }
            byte[] output=stdout.get(PROCESS_TIMEOUT.toMillis(),TimeUnit.MILLISECONDS);
            stderr.get(PROCESS_TIMEOUT.toMillis(),TimeUnit.MILLISECONDS);
            JsonNode result=objectMapper.readTree(output);
            return process.exitValue()==0&&result!=null&&result.path("record").isObject()?result.path("record"):null;
        } catch(InterruptedException interrupted) { Thread.currentThread().interrupt(); return null; }
        catch(Exception failure) { return null; }
    }

    private ValidatorAssets assets() throws IOException {
        ValidatorAssets existing = validatorAssets;
        if (existing != null) return existing;
        synchronized (this) {
            if (validatorAssets != null) return validatorAssets;
            Path root = Files.createTempDirectory("institution-validator-");
            Path sourceRoot = root.resolve("miniprogram");
            Files.createDirectories(sourceRoot);
            ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver(
                    NodeInstitutionSnapshotValidator.class.getClassLoader());
            Resource[] sourceFiles = resolver.getResources(SOURCE_PATTERN);
            if (sourceFiles.length == 0) throw new IOException("Institution validator source is not packaged");
            for (Resource sourceFile : sourceFiles) copySourceFile(sourceFile, sourceRoot);

            Path packageJson = sourceRoot.resolve("package.json");
            Files.writeString(packageJson, "{\"type\":\"module\"}\n", StandardCharsets.UTF_8);
            Path bridge = root.resolve("validate-institution-record.mjs");
            try (InputStream input = new ClassPathResource(BRIDGE_RESOURCE).getInputStream()) {
                Files.copy(input, bridge, StandardCopyOption.REPLACE_EXISTING);
            }
            registerTempCleanup(root);
            validatorAssets = new ValidatorAssets(sourceRoot, bridge);
            return validatorAssets;
        }
    }

    private static void copySourceFile(Resource resource, Path sourceRoot) throws IOException {
        URL url = resource.getURL();
        String externalForm = url.toExternalForm();
        int markerIndex = externalForm.indexOf(SOURCE_RESOURCE_PREFIX);
        if (markerIndex < 0) throw new IOException("Unexpected packaged Institution validator resource path");
        String relativeName = externalForm.substring(markerIndex + SOURCE_RESOURCE_PREFIX.length());
        Path relative = Path.of(relativeName.replace('/', java.io.File.separatorChar)).normalize();
        if (relative.isAbsolute() || relative.startsWith("..")) {
            throw new IOException("Invalid packaged Institution validator resource path");
        }
        Path destination = sourceRoot.resolve(relative);
        Files.createDirectories(destination.getParent());
        try (InputStream input = resource.getInputStream()) {
            Files.copy(input, destination, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void registerTempCleanup(Path root) {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try (var files = Files.walk(root)) {
                files.sorted(Comparator.reverseOrder()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                        // Temporary validator source contains no user or production data.
                    }
                });
            } catch (IOException ignored) {
                // Best effort cleanup after the controlled publisher or server exits.
            }
        }, "institution-validator-cleanup"));
    }

    private static CompletableFuture<byte[]> readAsync(InputStream stream) {
        return CompletableFuture.supplyAsync(() -> {
            try (stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                stream.transferTo(output);
                return output.toByteArray();
            } catch (IOException failure) {
                throw new IllegalStateException("Cannot drain validator process output", failure);
            }
        });
    }

    private static String firstIssueCode(JsonNode issues) {
        return issues.isArray() && !issues.isEmpty() ? issues.get(0).path("code").asText("") : "";
    }

    private static List<Issue> readIssues(JsonNode issues) {
        if (!issues.isArray()) return List.of(new Issue("INVALID_INSTITUTION_RECORD", "$"));
        List<Issue> result = new ArrayList<>();
        for (JsonNode issue : issues) {
            String code = issue.path("code").asText(null);
            String path = issue.path("path").asText(null);
            if (code != null && path != null) result.add(new Issue(code, path));
        }
        return result.isEmpty() ? List.of(new Issue("INVALID_INSTITUTION_RECORD", "$")) : List.copyOf(result);
    }

    private record ValidatorAssets(Path sourceRoot, Path bridge) { }
}
