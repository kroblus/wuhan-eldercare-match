package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.application.VisitEvaluationContextRepository;
import com.wuhan.eldercare.visit.application.VisitEvaluationContextService;
import com.wuhan.eldercare.visit.application.VisitEvaluationIdentitySource;
import com.wuhan.eldercare.visit.application.VisitEvaluationSubmissionService;
import com.wuhan.eldercare.visit.application.VisitEvaluationWriteRepository;
import com.wuhan.eldercare.visit.domain.TrustedPrincipal;
import com.wuhan.eldercare.visit.web.VisitEvaluationContextController;
import com.wuhan.eldercare.visit.web.VisitEvaluationContextResultV1;
import com.wuhan.eldercare.visit.web.VisitEvaluationSubmissionRequestV1;
import com.wuhan.eldercare.visit.web.VisitEvaluationSubmissionResultV1;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.FileSystemResource;

import java.io.IOException;
import java.nio.file.Path;
import java.security.Permission;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Offline synthetic JSON boundary driver. It invokes the production DTOs, services,
 * validators, result mappers, and Spring Boot configured Jackson mapper directly;
 * it never starts the application, opens a socket, or constructs a database client.
 *
 * stdin manifest:
 * {"scenario":{"visitId":"...","institutionId":"...","revision":"...",
 * "evaluationId":"...","submittedAt":"..."},
 * "requests":[{"caseId":"...","jsonText":"...","expectedResult":"...",
 * "contractBasis":"...","expectedReplayed":false}],
 * "contexts":[{"caseId":"...","authResolution":"authenticated",
 * "repositoryStatus":"found","visitStatus":"completed"}]}
 *
 * argv[0] is the repository root; its actual server/src/main/resources/application.yml is loaded.
 */
public final class VisitEvaluationJsonOfflineDriver {
    private static final String SYNTHETIC_PRINCIPAL = "synthetic-gate-owner";
    private static final AtomicInteger NETWORK_ATTEMPTS = new AtomicInteger();
    private static final AtomicInteger GUARD_CANARY_BLOCKS = new AtomicInteger();
    private static volatile boolean GUARD_CANARY_ACTIVE;
    private static final List<String> SOURCE_PATHS = List.of(
            "server/src/main/java/com/wuhan/eldercare/visit/web/VisitEvaluationSubmissionRequestV1.java",
            "server/src/main/java/com/wuhan/eldercare/visit/web/VisitEvaluationSubmissionResultV1.java",
            "server/src/main/java/com/wuhan/eldercare/visit/web/StrictIntegerJsonDeserializer.java",
            "server/src/main/java/com/wuhan/eldercare/visit/application/VisitEvaluationSubmissionService.java",
            "server/src/main/java/com/wuhan/eldercare/visit/application/VisitEvaluationContentNormalizer.java",
            "server/src/main/java/com/wuhan/eldercare/visit/application/VisitEvaluationWriteRepository.java",
            "server/src/main/java/com/wuhan/eldercare/visit/application/VisitEvaluationIdentitySource.java",
            "server/src/main/java/com/wuhan/eldercare/visit/application/AuthEvidenceResolver.java",
            "server/src/main/java/com/wuhan/eldercare/visit/domain/TrustedPrincipal.java",
            "server/src/main/java/com/wuhan/eldercare/visit/domain/VisitEvaluationWriteContentV1.java",
            "server/src/main/java/com/wuhan/eldercare/visit/domain/VisitEvaluationWriteValidation.java",
            "server/src/main/java/com/wuhan/eldercare/visit/web/VisitEvaluationContextController.java",
            "server/src/main/java/com/wuhan/eldercare/visit/web/VisitEvaluationContextResultV1.java",
            "server/src/main/java/com/wuhan/eldercare/visit/application/VisitEvaluationContextService.java",
            "server/src/main/java/com/wuhan/eldercare/visit/application/VisitEvaluationContextRepository.java",
            "server/src/test/java/com/wuhan/eldercare/visit/VisitEvaluationJsonOfflineDriver.java");

    private VisitEvaluationJsonOfflineDriver() {
    }

    public static void main(String[] args) {
        try {
            if (args.length != 1) throw new IllegalArgumentException("expected repository root path");
            installNetworkDenyGuard();
            Path repositoryRoot = Path.of(args[0]).toAbsolutePath().normalize();
            Path applicationYaml = repositoryRoot.resolve("server/src/main/resources/application.yml");
            ObjectMapper mapper = productionObjectMapper(applicationYaml);
            JsonNode manifest = mapper.readTree(System.in);
            if (manifest == null || !manifest.isObject()) throw new IllegalArgumentException("manifest must be an object");

            JsonNode scenario = manifest.path("scenario");
            String visitId = requiredText(scenario, "visitId");
            String institutionId = requiredText(scenario, "institutionId");
            String revision = requiredText(scenario, "revision");
            String evaluationId = requiredText(scenario, "evaluationId");
            Instant submittedAt = Instant.parse(requiredText(scenario, "submittedAt"));

            ObjectNode output = mapper.createObjectNode();
            ArrayNode requestResults = output.putArray("requestResults");
            ArrayNode responses = output.putArray("responses");
            JsonNode requests = manifest.path("requests");
            if (!requests.isArray()) throw new IllegalArgumentException("requests must be an array");
            for (JsonNode request : requests) {
                RequestExecution execution = runRequest(mapper, request, visitId, evaluationId, submittedAt);
                requestResults.add(execution.result());
                if (execution.responseJson() != null) {
                    ObjectNode response = responses.addObject();
                    response.put("caseId", execution.caseId());
                    response.put("responseType", "submission");
                    response.put("expectedKind", execution.result().path("expectedKind").asText("submitted"));
                    response.put("expectedReplayed", execution.result().path("expectedReplayed").asBoolean(false));
                    response.put("jsonText", execution.responseJson());
                }
            }

            JsonNode contexts = manifest.path("contexts");
            if (contexts.isArray()) {
                for (JsonNode context : contexts) {
                    ContextExecution execution = runContext(mapper, context, visitId, institutionId, revision);
                    ObjectNode result = output.withArray("contextResults").addObject();
                    result.put("caseId", execution.caseId());
                    result.put("repositoryCalls", execution.repositoryCalls());
                    result.put("responseJson", execution.responseJson());

                    ObjectNode response = responses.addObject();
                    response.put("caseId", execution.caseId());
                    response.put("responseType", "context");
                    response.put("expectedKind", optionalText(context, "expectedKind", "eligible"));
                    response.put("jsonText", execution.responseJson());
                }
            } else if (!contexts.isMissingNode() && !contexts.isNull()) {
                throw new IllegalArgumentException("contexts must be an array when supplied");
            }

            ObjectNode evidence = output.putObject("codecEvidence");
            evidence.put("mapperClass", mapper.getClass().getName());
            evidence.put("bootAutoConfiguration", JacksonAutoConfiguration.class.getName());
            evidence.put("yamlLoader", YamlPropertySourceLoader.class.getName());
            evidence.put("repositoryRootArgument", repositoryRoot.toString());
            evidence.put("yamlPath", applicationYaml.toString());
            evidence.put("configurationPath", "server/src/main/resources/application.yml");
            evidence.put("failOnUnknownProperties",
                    mapper.isEnabled(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES));
            evidence.put("yamlJacksonBindingVerified",
                    mapper.isEnabled(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES));
            evidence.put("authConfigurationResolved", false);
            evidence.put("applicationContext", "JacksonAutoConfiguration only; no application component scan");
            evidence.put("httpServerStarted", false);
            evidence.put("databaseConnectionCreated", false);
            evidence.put("realAuthEvidenceSupplied", false);
            evidence.put("networkSocketChecksInstalled", true);
            evidence.put("networkAttemptsBlocked", NETWORK_ATTEMPTS.get());
            evidence.put("networkAttempts", NETWORK_ATTEMPTS.get());
            ObjectNode guardCanary = evidence.putObject("guardCanary");
            guardCanary.put("checkConnectBlocked", true);
            guardCanary.put("checkListenBlocked", true);
            guardCanary.put("blockedChecks", GUARD_CANARY_BLOCKS.get());
            evidence.put("syntheticPrincipal", SYNTHETIC_PRINCIPAL);
            evidence.set("sourcePaths", mapper.valueToTree(SOURCE_PATHS));
            evidence.set("sources", mapper.valueToTree(SOURCE_PATHS));

            mapper.writeValue(System.out, output);
            System.out.write('\n');
        } catch (Exception failure) {
            // The offline harness must not emit input values or exception detail to logs.
            System.err.println("VisitEvaluationJsonOfflineDriver failed: " + failure.getClass().getSimpleName());
            System.exit(2);
        }
    }

    @SuppressWarnings("removal")
    private static void installNetworkDenyGuard() {
        SecurityManager guard = new SecurityManager() {
            @Override
            public void checkPermission(Permission permission) {
                // The harness needs normal local file and classloader access; network is denied below.
            }

            @Override
            public void checkPermission(Permission permission, Object context) {
                // Keep permission policy permissive except for socket operations.
            }

            @Override
            public void checkConnect(String host, int port) {
                blockNetwork();
            }

            @Override
            public void checkConnect(String host, int port, Object context) {
                blockNetwork();
            }

            @Override
            public void checkListen(int port) {
                blockNetwork();
            }

            @Override
            public void checkAccept(String host, int port) {
                blockNetwork();
            }
        };
        System.setSecurityManager(guard);
        if (System.getSecurityManager() != guard) {
            throw new IllegalStateException("network deny guard was not installed");
        }
        assertNetworkCheckBlocked(() -> guard.checkConnect("synthetic.invalid", 443));
        assertNetworkCheckBlocked(() -> guard.checkListen(0));
    }

    private static void blockNetwork() {
        if (GUARD_CANARY_ACTIVE) GUARD_CANARY_BLOCKS.incrementAndGet();
        else NETWORK_ATTEMPTS.incrementAndGet();
        throw new SecurityException("offline gate blocks network access");
    }

    private static void assertNetworkCheckBlocked(Runnable check) {
        GUARD_CANARY_ACTIVE = true;
        try {
            check.run();
            throw new IllegalStateException("network deny guard canary was not blocked");
        } catch (SecurityException expected) {
            // Direct SecurityManager checks only; no socket is created or connected.
        } finally {
            GUARD_CANARY_ACTIVE = false;
        }
    }

    private static ObjectMapper productionObjectMapper(Path applicationYaml) throws IOException {
        if (!applicationYaml.toFile().isFile()) throw new IllegalArgumentException("application.yml path is not a file");
        AtomicReference<ObjectMapper> mapper = new AtomicReference<>();
        List<PropertySource<?>> propertySources = new YamlPropertySourceLoader().load(
                "production-application-yaml", new FileSystemResource(applicationYaml.toFile()));
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class))
                .withInitializer(context -> {
                    Map<String, Object> jacksonProperties = new LinkedHashMap<>();
                    for (PropertySource<?> source : propertySources) {
                        if (source instanceof EnumerablePropertySource<?> enumerable) {
                            for (String propertyName : enumerable.getPropertyNames()) {
                                if (propertyName.startsWith("spring.jackson.")) {
                                    jacksonProperties.put(propertyName, source.getProperty(propertyName));
                                }
                            }
                        }
                    }
                    context.getEnvironment().getPropertySources().addFirst(
                            new MapPropertySource("production-spring-jackson-properties", jacksonProperties));
                })
                .run(context -> mapper.set(context.getBean(ObjectMapper.class)));
        ObjectMapper configured = mapper.get();
        if (configured == null || !configured.isEnabled(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)) {
            throw new IllegalStateException("production Jackson configuration was not applied");
        }
        return configured;
    }

    private static RequestExecution runRequest(
            ObjectMapper mapper,
            JsonNode input,
            String visitId,
            String evaluationId,
            Instant submittedAt
    ) throws Exception {
        String caseId = requiredText(input, "caseId");
        String jsonText = requiredText(input, "jsonText");
        if (jsonText.length() > 64 * 1024) throw new IllegalArgumentException("request fixture exceeds 64 KiB");

        ObjectNode result = mapper.createObjectNode();
        result.put("caseId", caseId);
        result.put("actualJsonPayload", jsonText);
        result.put("direction", "client_to_server");
        result.put("accepted", false);
        result.put("repositoryCalls", 0);
        if (input.has("expectedResult")) result.set("expectedResult", input.get("expectedResult").deepCopy());
        if (input.has("contractBasis")) result.set("contractBasis", input.get("contractBasis").deepCopy());
        if (input.has("expectedReplayed")) result.set("expectedReplayed", input.get("expectedReplayed").deepCopy());
        result.put("expectedKind", optionalText(input, "expectedKind", "submitted"));

        VisitEvaluationSubmissionRequestV1 body;
        try {
            body = mapper.readValue(jsonText, VisitEvaluationSubmissionRequestV1.class);
        } catch (IOException bindingFailure) {
            result.put("rejectionPoint", "Jackson.readValue");
            result.put("actualResult", "REJECTED_BEFORE_APPLICATION_BOUNDARY");
            result.put("deserializationFailureType", bindingFailure.getClass().getSimpleName());
            result.putNull("boundBody");
            result.putNull("serviceResult");
            return new RequestExecution(caseId, result, null);
        }

        result.set("boundBody", mapper.valueToTree(body));
        AtomicInteger repositoryCalls = new AtomicInteger();
        boolean expectedReplayed = input.path("expectedReplayed").asBoolean(false);
        String repositoryStatus = optionalText(input, "repositoryStatus", expectedReplayed ? "replayed" : "accepted");
        VisitEvaluationWriteRepository repository = (principal, submittedVisitId, keyDigest, fingerprint, content,
                                                       newEvaluationId, serverSubmittedAt) -> {
            repositoryCalls.incrementAndGet();
            VisitEvaluationWriteRepository.Receipt receipt = new VisitEvaluationWriteRepository.Receipt(
                    newEvaluationId, submittedVisitId, "submitted", serverSubmittedAt);
            return repositoryResult(repositoryStatus, receipt);
        };
        VisitEvaluationSubmissionService service = new VisitEvaluationSubmissionService(
                authResolver(authStatus(optionalText(input, "authResolution", "authenticated"))), repository,
                new com.wuhan.eldercare.visit.application.VisitEvaluationContentNormalizer(mapper),
                new VisitEvaluationIdentitySource() {
                    @Override public String newEvaluationId() { return evaluationId; }
                    @Override public Instant submittedAt() { return submittedAt; }
                });
        VisitEvaluationSubmissionService.Result applicationResult = service.submit(
                visitId, body == null ? null : body.toServiceRequest(), null);
        VisitEvaluationSubmissionResultV1 response = VisitEvaluationSubmissionResultV1.from(applicationResult);
        String responseJson = mapper.writeValueAsString(response);

        result.put("repositoryCalls", repositoryCalls.get());
        result.set("applicationResult", mapper.valueToTree(applicationResult));
        result.set("serviceResult", mapper.valueToTree(response));
        result.put("responseJson", responseJson);
        if (response != null && ("accepted".equals(response.outcome()) || "replayed".equals(response.outcome()))) {
            result.put("accepted", true);
            result.put("actualResult", response.outcome().toUpperCase(Locale.ROOT)
                    + "_BY_SYNTHETIC_REPOSITORY_AFTER_PRODUCTION_VALIDATION");
            result.put("rejectionPoint", "none");
        } else if (response != null && "VALIDATION_FAILED".equals(response.code())) {
            result.put("rejectionPoint", "VisitEvaluationSubmissionService.submit/VisitEvaluationWriteValidation");
            result.put("actualResult", "REJECTED_BY_PRODUCTION_VALIDATOR");
        } else {
            result.put("rejectionPoint", "production_service_or_result_mapping");
            result.put("actualResult", response == null ? "NO_RESPONSE_BODY" : response.code());
        }
        return new RequestExecution(caseId, result, responseJson);
    }

    private static ContextExecution runContext(
            ObjectMapper mapper,
            JsonNode input,
            String requestedVisitId,
            String institutionId,
            String revision
    ) throws Exception {
        String caseId = requiredText(input, "caseId");
        AuthEvidenceResolver.Resolution.Status authStatus = authStatus(requiredText(input, "authResolution"));
        String repositoryStatus = optionalText(input, "repositoryStatus", "found");
        String visitStatus = optionalText(input, "visitStatus", "completed");
        AtomicInteger repositoryCalls = new AtomicInteger();

        AuthEvidenceResolver resolver = authResolver(authStatus);
        VisitEvaluationContextRepository repository = (principal, visitId) -> {
            repositoryCalls.incrementAndGet();
            return switch (repositoryStatus) {
                case "found" -> VisitEvaluationContextRepository.Result.found(
                        new VisitEvaluationContextRepository.OwnedVisit(
                                requestedVisitId, institutionId, revision, visitStatus));
                case "not_found" -> VisitEvaluationContextRepository.Result.notFound();
                case "unavailable" -> VisitEvaluationContextRepository.Result.unavailable();
                case "technical_failure" -> VisitEvaluationContextRepository.Result.technicalFailure();
                default -> throw new IllegalArgumentException("unsupported synthetic repository status");
            };
        };
        VisitEvaluationContextController controller = new VisitEvaluationContextController(
                new VisitEvaluationContextService(resolver, repository));
        VisitEvaluationContextResultV1 response = controller.load(requestedVisitId, null).getBody();
        String responseJson = mapper.writeValueAsString(response);
        return new ContextExecution(caseId, repositoryCalls.get(), responseJson);
    }

    private static AuthEvidenceResolver authResolver(AuthEvidenceResolver.Resolution.Status status) {
        if (status == AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
            return ignored -> AuthEvidenceResolver.Resolution.authenticated(new TrustedPrincipal(SYNTHETIC_PRINCIPAL));
        }
        return ignored -> AuthEvidenceResolver.Resolution.failure(status);
    }

    private static VisitEvaluationWriteRepository.Result repositoryResult(
            String status,
            VisitEvaluationWriteRepository.Receipt receipt
    ) {
        return switch (status) {
            case "accepted" -> VisitEvaluationWriteRepository.Result.accepted(receipt);
            case "replayed" -> VisitEvaluationWriteRepository.Result.replayed(receipt);
            case "not_found" -> VisitEvaluationWriteRepository.Result.of(
                    VisitEvaluationWriteRepository.Result.Status.NOT_FOUND);
            case "not_completed" -> VisitEvaluationWriteRepository.Result.of(
                    VisitEvaluationWriteRepository.Result.Status.NOT_COMPLETED);
            case "already_submitted" -> VisitEvaluationWriteRepository.Result.of(
                    VisitEvaluationWriteRepository.Result.Status.ALREADY_SUBMITTED);
            case "idempotency_conflict" -> VisitEvaluationWriteRepository.Result.of(
                    VisitEvaluationWriteRepository.Result.Status.IDEMPOTENCY_CONFLICT);
            case "unavailable" -> VisitEvaluationWriteRepository.Result.of(
                    VisitEvaluationWriteRepository.Result.Status.UNAVAILABLE);
            case "technical_failure" -> VisitEvaluationWriteRepository.Result.of(
                    VisitEvaluationWriteRepository.Result.Status.TECHNICAL_FAILURE);
            default -> throw new IllegalArgumentException("unsupported synthetic repository status");
        };
    }

    private static AuthEvidenceResolver.Resolution.Status authStatus(String value) {
        return switch (value.toLowerCase(Locale.ROOT)) {
            case "authenticated" -> AuthEvidenceResolver.Resolution.Status.AUTHENTICATED;
            case "missing" -> AuthEvidenceResolver.Resolution.Status.MISSING;
            case "expired" -> AuthEvidenceResolver.Resolution.Status.EXPIRED;
            case "invalid" -> AuthEvidenceResolver.Resolution.Status.INVALID;
            case "unavailable" -> AuthEvidenceResolver.Resolution.Status.UNAVAILABLE;
            case "technical_failure" -> AuthEvidenceResolver.Resolution.Status.TECHNICAL_FAILURE;
            default -> throw new IllegalArgumentException("unsupported synthetic auth resolution");
        };
    }

    private static String requiredText(JsonNode node, String name) {
        JsonNode value = node.path(name);
        if (!value.isTextual() || value.textValue().isBlank()) {
            throw new IllegalArgumentException("manifest field must be non-blank text: " + name);
        }
        return value.textValue();
    }

    private static String optionalText(JsonNode node, String name, String fallback) {
        JsonNode value = node.path(name);
        if (value.isMissingNode() || value.isNull()) return fallback;
        if (!value.isTextual() || value.textValue().isBlank()) {
            throw new IllegalArgumentException("manifest field must be non-blank text: " + name);
        }
        return value.textValue();
    }

    private record RequestExecution(String caseId, ObjectNode result, String responseJson) {
    }

    private record ContextExecution(String caseId, int repositoryCalls, String responseJson) {
    }
}
