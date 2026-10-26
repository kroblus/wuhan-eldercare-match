package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.C4Application;
import com.wuhan.eldercare.visit.auth.WeChatAuthProvider;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.AclEntry;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclFileAttributeView;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

/** TEST CLASSPATH ONLY local server for an isolated history environment. It does not validate or claim a WeChat AppID. */
public final class HistoryIsolatedEnvironmentServer {
    private static final String FIXTURE_ANSWERS = "/assessment-history/test-only-answers.json";
    private static final String FIXTURE_CATALOG = "/assessment-history/test-only-server-recommendation-catalog-v1.json";
    private static final Set<String> PRIVATE_KEYS = Set.of(
            "environment.id", "environment.appIdGate", "mysql.host", "mysql.port", "mysql.database",
            "mysql.username", "mysql.password",
            "http.port", "c5.hashSecret", "c5.syntheticLoginTicketA", "c5.syntheticLoginTicketB",
            "node.executable");
    private static final Set<String> APPROVED_FIXTURES = Set.of(
            "test-classes/assessment-history/test-only-answers.json",
            "test-classes/assessment-history/test-only-server-recommendation-catalog-v1.json");

    private HistoryIsolatedEnvironmentServer() { }

    public static void main(String[] args) {
        try {
            if (args.length != 1 || !args[0].startsWith("--private-config=")) {
                throw new IllegalArgumentException("protected TEST_ONLY configuration path required");
            }
            rejectConflictingEnvironment();
            Path privateConfig = Path.of(args[0].substring("--private-config=".length())).toAbsolutePath().normalize();
            Path environmentRoot = validatePrivateConfigPath(privateConfig);
            Properties privateValues = loadPrivateConfig(privateConfig);
            validateRuntime(privateValues, environmentRoot);
            Path artifactRoot = environmentRoot.resolve("backend-artifact");
            verifyArtifact(artifactRoot, Path.of(required(privateValues, "node.executable")));

            Map<String, Object> properties = springProperties(privateValues);
            SpringApplication application = new SpringApplication(C4Application.class, TestBeans.class);
            application.setDefaultProperties(properties);
            application.setLogStartupInfo(false);
            application.setRegisterShutdownHook(true);
            application.run();
            System.out.println("HISTORY_ISOLATED_TEST_SERVER_READY");
        } catch (Exception failure) {
            // Configuration may contain secrets. Keep failures generic and never print exception details.
            System.err.println("HISTORY_ISOLATED_TEST_SERVER_REFUSED");
            System.exit(2);
        }
    }

    static Path validatePrivateConfigPath(Path config) throws Exception {
        requireNoSymlink(config);
        if (Files.isSymbolicLink(config) || !Files.isRegularFile(config, LinkOption.NOFOLLOW_LINKS)
                || !"runtime.properties".equals(config.getFileName().toString())
                || config.getParent() == null || !"private".equals(config.getParent().getFileName().toString())) {
            throw new IllegalArgumentException("private configuration path");
        }
        Path rootLexical = config.getParent().getParent().toAbsolutePath().normalize();
        Path root = rootLexical.toRealPath(LinkOption.NOFOLLOW_LINKS);
        if (!root.equals(rootLexical)) throw new IllegalArgumentException("environment path resolves through an alias");
        if (!root.getFileName().toString().matches("history-test-environment-[0-9a-fA-F-]{36}")
                || root.getParent() == null || !"target".equals(root.getParent().getFileName().toString())
                || root.getParent().getParent() == null || !"server".equals(root.getParent().getParent().getFileName().toString())) {
            throw new IllegalArgumentException("environment root boundary");
        }
        Path workingLexical = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        requireNoSymlink(workingLexical);
        Path working = workingLexical.toRealPath(LinkOption.NOFOLLOW_LINKS);
        Path expectedWorking = root.resolve("backend-artifact").toAbsolutePath().normalize();
        if (!working.equals(expectedWorking.toRealPath(LinkOption.NOFOLLOW_LINKS)) || !working.equals(expectedWorking)) {
            throw new IllegalArgumentException("frozen artifact working directory required");
        }
        requireNoSymlink(root);
        requirePrivateAcl(config);
        return root;
    }

    private static void requireNoSymlink(Path path) throws Exception {
        Path current = path.getRoot();
        for (Path part : path) {
            current = current.resolve(part);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS) && Files.isSymbolicLink(current)) {
                throw new IllegalArgumentException("symbolic link in environment path");
            }
        }
    }

    private static void requirePrivateAcl(Path config) throws Exception {
        AclFileAttributeView view = Files.getFileAttributeView(config, AclFileAttributeView.class, LinkOption.NOFOLLOW_LINKS);
        if (view == null) return;
        Set<String> allowed = Set.of("NT AUTHORITY\\SYSTEM", "SYSTEM");
        String owner = Files.getOwner(config, LinkOption.NOFOLLOW_LINKS).getName();
        for (AclEntry entry : view.getAcl()) {
            if (entry.type() != AclEntryType.ALLOW || entry.permissions().isEmpty()) continue;
            String principal = entry.principal().getName();
            if (!principal.equalsIgnoreCase(owner) && allowed.stream().noneMatch(name -> name.equalsIgnoreCase(principal))) {
                throw new IllegalArgumentException("private configuration ACL");
            }
        }
    }

    private static Properties loadPrivateConfig(Path path) throws Exception {
        Properties values = new Properties();
        try (InputStream input = Files.newInputStream(path)) {
            values.load(input);
        }
        if (!values.stringPropertyNames().equals(PRIVATE_KEYS)) {
            throw new IllegalArgumentException("private configuration fields");
        }
        return values;
    }

    private static void validateRuntime(Properties p, Path environmentRoot) {
        String environmentId = required(p, "environment.id");
        if (!environmentId.matches("TEST_ONLY_[A-Za-z0-9_-]{1,72}")
                || !"WAITING_FOR_OWNER".equals(required(p, "environment.appIdGate"))) {
            throw new IllegalArgumentException("AppID gate or environment identity");
        }
        if (!"127.0.0.1".equals(required(p, "mysql.host"))) throw new IllegalArgumentException("database host");
        int mysqlPort = integer(p, "mysql.port");
        if (mysqlPort != 33410) throw new IllegalArgumentException("database port");
        if (!required(p, "mysql.database").matches("history_disposable_[a-f0-9]{16}")) {
            throw new IllegalArgumentException("database name");
        }
        if (!required(p, "mysql.username").matches("history_app_[a-f0-9]{20}")) {
            throw new IllegalArgumentException("database user");
        }
        highEntropy(p, "mysql.password");
        highEntropy(p, "c5.hashSecret");
        highEntropy(p, "c5.syntheticLoginTicketA");
        highEntropy(p, "c5.syntheticLoginTicketB");
        if (p.getProperty("c5.syntheticLoginTicketA").equals(p.getProperty("c5.syntheticLoginTicketB"))) {
            throw new IllegalArgumentException("synthetic account tickets must be distinct");
        }
        int httpPort = integer(p, "http.port");
        if (httpPort != 34579) throw new IllegalArgumentException("HTTP port");
        Path node = Path.of(required(p, "node.executable")).toAbsolutePath().normalize();
        if (!Files.isRegularFile(node, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(node)) {
            throw new IllegalArgumentException("declared Node runtime unavailable");
        }
        if (!environmentRoot.resolve("backend-artifact").toAbsolutePath().normalize()
                .equals(Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize())) {
            throw new IllegalArgumentException("artifact path mismatch");
        }
    }

    private static void highEntropy(Properties p, String key) {
        String value = required(p, key);
        if (!value.matches("[A-Za-z0-9_-]{43,128}")) throw new IllegalArgumentException("invalid secret material");
    }

    private static String required(Properties p, String key) {
        String value = p.getProperty(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("missing private configuration");
        return value;
    }

    private static int integer(Properties p, String key) {
        try { return Integer.parseInt(required(p, key)); }
        catch (RuntimeException ignored) { throw new IllegalArgumentException("invalid numeric configuration"); }
    }

    private static Map<String, Object> springProperties(Properties p) {
        Map<String, Object> values = new java.util.HashMap<>();
        values.put("spring.profiles.active", "assessment-history-test-only");
        values.put("spring.main.banner-mode", "off");
        values.put("server.address", "127.0.0.1");
        values.put("server.port", p.getProperty("http.port"));
        values.put("server.error.include-message", "never");
        values.put("server.error.include-stacktrace", "never");
        values.put("logging.level.root", "WARN");
        values.put("c4.persistence.enabled", "true");
        values.put("C4_PERSISTENCE_ENABLED", "true");
        values.put("C4_MYSQL_URL", "jdbc:mysql://127.0.0.1:33410/" + p.getProperty("mysql.database")
                + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC");
        values.put("C4_MYSQL_USERNAME", p.getProperty("mysql.username"));
        values.put("C4_MYSQL_PASSWORD", p.getProperty("mysql.password"));
        values.put("c5.auth.enabled", "false");
        values.put("C5_AUTH_HASH_SECRET", p.getProperty("c5.hashSecret"));
        values.put("c5.syntheticLoginTicketA", p.getProperty("c5.syntheticLoginTicketA"));
        values.put("c5.syntheticLoginTicketB", p.getProperty("c5.syntheticLoginTicketB"));
        values.put("assessment.history.disposable-mysql", "true");
        values.put("assessment.history.test-only-enabled", "true");
        values.put("assessment.history.user-loop-enabled", "true");
        values.put("assessment.history.recommendation-snapshot-enabled", "true");
        values.put("assessment.history.trusted-preview-enabled", "true");
        values.put("assessment.history.test-only-environment-id", p.getProperty("environment.id"));
        values.put("assessment.history.test-only-intent-max-per-owner", "256");
        values.put("assessment.history.test-only-intent-max-per-window", "16");
        values.put("assessment.history.test-only-intent-window-seconds", "60");
        values.put("assessment.history.node-executable", p.getProperty("node.executable"));
        return values;
    }

    private static void rejectConflictingEnvironment() {
        for (String name : System.getenv().keySet()) {
            String upper = name.toUpperCase(Locale.ROOT);
            if (upper.startsWith("SPRING_") || upper.startsWith("C4_") || upper.startsWith("C5_")
                    || upper.startsWith("ASSESSMENT_HISTORY_") || upper.startsWith("SERVER_")
                    || upper.startsWith("JAVA_TOOL_OPTIONS") || upper.startsWith("JDK_JAVA_OPTIONS")
                    || upper.startsWith("_JAVA_OPTIONS") || upper.equals("CLASSPATH")
                    || upper.equals("NODE_OPTIONS") || upper.equals("NODE_PATH")) {
                throw new IllegalArgumentException("configuration environment override refused");
            }
        }
    }

    static void verifyArtifact(Path artifactRoot, Path nodeExecutable) throws Exception {
        Path rootLexical = artifactRoot.toAbsolutePath().normalize();
        requireNoSymlink(rootLexical);
        Path root = rootLexical.toRealPath(LinkOption.NOFOLLOW_LINKS);
        if (!root.equals(rootLexical)) throw new IllegalArgumentException("artifact path resolves through an alias");
        Path manifestPath = root.resolve("ARTIFACT_MANIFEST.json");
        if (Files.isSymbolicLink(manifestPath) || !Files.isRegularFile(manifestPath, LinkOption.NOFOLLOW_LINKS)) {
            throw new IllegalArgumentException("frozen artifact manifest missing");
        }
        ObjectMapper mapper = new ObjectMapper();
        JsonNode manifest = mapper.readTree(Files.readAllBytes(manifestPath));
        if (!"history_environment_frozen_backend_artifact_v1".equals(manifest.path("kind").asText())
                || !"WAITING_FOR_OWNER".equals(manifest.path("testAppIdGate").asText())
                || !"NOT_VERIFIED".equals(manifest.path("buildProvenance").asText())
                || manifest.path("liveTargetClasspath").asBoolean(true)
                || manifest.path("productionWrite").asBoolean(true)
                || !manifest.path("sourceSnapshotId").isTextual() || manifest.path("sourceSnapshotId").asText().isBlank()
                || !manifest.path("sourceHead").isTextual() || manifest.path("sourceHead").asText().isBlank()
                || !manifest.path("nodeVersion").isTextual() || manifest.path("nodeVersion").asText().isBlank()
                || !manifest.path("nodeExecutableSha256").asText().matches("[a-f0-9]{64}")
                || !manifest.path("artifactId").asText().matches("[a-f0-9]{64}")
                || !manifest.path("files").isArray()) {
            throw new IllegalArgumentException("frozen artifact manifest gate");
        }
        if (!Files.isRegularFile(nodeExecutable, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(nodeExecutable)
                || !manifest.path("nodeExecutableSha256").asText().equals(sha256(nodeExecutable))) {
            throw new IllegalArgumentException("Node runtime does not match frozen artifact");
        }
        Set<String> expected = new HashSet<>();
        List<ArtifactFile> files = new ArrayList<>();
        for (JsonNode file : manifest.path("files")) {
            String relative = file.path("path").asText();
            String digest = file.path("sha256").asText();
            long size = file.path("size").asLong(-1L);
            if (relative.isBlank() || relative.contains("\\") || relative.startsWith("/")
                    || relative.contains("../") || relative.equals("..") || !digest.matches("[a-f0-9]{64}") || size < 0
                    || !expected.add(relative)) throw new IllegalArgumentException("artifact manifest file entry");
            boolean code = relative.startsWith("classes/") || relative.startsWith("lib/");
            boolean harnessClass = relative.matches("test-classes/com/wuhan/eldercare/visit/assessment/HistoryIsolatedEnvironmentServer(\\$[A-Za-z0-9_$]+)?\\.class");
            if (!code && !harnessClass && !APPROVED_FIXTURES.contains(relative)) {
                throw new IllegalArgumentException("unapproved artifact file");
            }
            Path path = root.resolve(relative).normalize();
            if (!path.startsWith(root) || Files.isSymbolicLink(path) || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
                    || Files.size(path) != size || !digest.equals(sha256(path))) {
                throw new IllegalArgumentException("artifact file verification failed");
            }
            files.add(new ArtifactFile(relative, size, digest));
        }
        if (!expected.contains("classes/com/wuhan/eldercare/visit/C4Application.class")
                || !expected.contains("test-classes/com/wuhan/eldercare/visit/assessment/HistoryIsolatedEnvironmentServer.class")
                || !expected.containsAll(APPROVED_FIXTURES)
                || expected.stream().noneMatch(path -> path.startsWith("lib/"))) {
            throw new IllegalArgumentException("artifact required file missing");
        }
        Set<String> actual = new HashSet<>();
        try (var paths = Files.walk(root)) {
            paths.filter(path -> !path.equals(root)).forEach(path -> {
                if (Files.isSymbolicLink(path)) throw new IllegalArgumentException("symbolic link in artifact");
                if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                    String relative = root.relativize(path).toString().replace('\\', '/');
                    if (!"ARTIFACT_MANIFEST.json".equals(relative)) actual.add(relative);
                }
            });
        }
        if (!actual.equals(expected)) throw new IllegalArgumentException("artifact contains unlisted files");
        if (!manifest.path("artifactId").asText().equals(artifactId(files))) {
            throw new IllegalArgumentException("artifact identity mismatch");
        }
    }

    private static String artifactId(List<ArtifactFile> files) throws Exception {
        files.sort((left, right) -> left.path().compareTo(right.path()));
        ObjectMapper mapper = new ObjectMapper();
        var canonical = mapper.createArrayNode();
        for (ArtifactFile file : files) {
            ObjectNode entry = mapper.createObjectNode();
            entry.put("path", file.path());
            entry.put("sha256", file.sha256());
            entry.put("size", file.size());
            canonical.add(entry);
        }
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(canonical)));
    }

    private static String sha256(Path path) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = Files.newInputStream(path)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) >= 0) digest.update(buffer, 0, count);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private record ArtifactFile(String path, long size, String sha256) { }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestBeans {
        @Bean
        HistoryRecommendationSource isolatedRecommendationSource(ObjectMapper mapper) throws Exception {
            JsonNode catalog = mapper.readTree(requiredResource(FIXTURE_CATALOG));
            return () -> new HistoryRecommendationSource.Capture(catalog.deepCopy(), "TEST_ONLY_SERVER_CATALOG_CURRENT_V121");
        }

        @Bean
        HistoryTrustedPreviewInputSource isolatedApprovedSyntheticAnswers(ObjectMapper mapper) throws Exception {
            JsonNode standard = mapper.readTree(requiredResource(FIXTURE_ANSWERS));
            ObjectNode noSafe = standard.deepCopy();
            noSafe.set("cognitive.symptoms", mapper.createArrayNode().add("unknown"));
            List<JsonNode> fixtures = List.of(standard.deepCopy(), noSafe.deepCopy());
            return () -> copy(fixtures);
        }

        @Bean
        @Primary
        WeChatAuthProvider isolatedSyntheticAuthProvider(Environment environment) {
            String ticketA = environment.getProperty("c5.syntheticLoginTicketA");
            String ticketB = environment.getProperty("c5.syntheticLoginTicketB");
            if (ticketA == null || ticketB == null) throw new IllegalStateException("synthetic identity unavailable");
            return code -> {
                if (sameSecret(code, ticketA)) return WeChatAuthProvider.ExchangeResult.authenticated("TEST_ONLY_LOCAL_C5", "synthetic-owner-a");
                if (sameSecret(code, ticketB)) return WeChatAuthProvider.ExchangeResult.authenticated("TEST_ONLY_LOCAL_C5", "synthetic-owner-b");
                return WeChatAuthProvider.ExchangeResult.failure(WeChatAuthProvider.ExchangeResult.Status.INVALID);
            };
        }

        private static byte[] requiredResource(String name) throws Exception {
            try (InputStream input = HistoryIsolatedEnvironmentServer.class.getResourceAsStream(name)) {
                if (input == null) throw new IllegalStateException("approved TEST_ONLY fixture missing");
                return input.readAllBytes();
            }
        }

        private static Collection<JsonNode> copy(List<JsonNode> fixtures) {
            return fixtures.stream().map(fixture -> (JsonNode) fixture.deepCopy()).toList();
        }

        private static boolean sameSecret(String candidate, String expected) {
            return candidate != null && MessageDigest.isEqual(candidate.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8));
        }
    }
}
