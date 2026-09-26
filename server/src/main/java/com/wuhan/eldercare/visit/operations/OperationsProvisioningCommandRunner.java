package com.wuhan.eldercare.visit.operations;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.C4Application;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.SeekableByteChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.OpenOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.nio.file.attribute.AclEntry;
import java.nio.file.attribute.AclEntryPermission;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclFileAttributeView;
import java.nio.file.attribute.UserPrincipal;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Explicit deployment-only command. Normal Backend startup never reads provisioning packages. */
public final class OperationsProvisioningCommandRunner {
    private static final long MAX_PACKAGE_BYTES = 64L * 1024L;
    private static final long MAX_CREDENTIAL_BYTES = 128L;
    private static final String COMMAND = "operations.authorization.provisioning.command";
    private static final String INPUT = "operations.authorization.provisioning.input";
    private static final String CREDENTIAL_OUTPUT = "operations.authorization.provisioning.credential-output";

    private OperationsProvisioningCommandRunner() { }

    public static boolean isRequested(String[] args) {
        ApplicationArguments parsed = new DefaultApplicationArguments(args);
        return parsed.containsOption(COMMAND);
    }

    public static int run(String[] args) {
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(C4Application.class)
                .web(WebApplicationType.NONE)
                .run(args)) {
            ApplicationArguments parsed = new DefaultApplicationArguments(args);
            var commands = parsed.getOptionValues(COMMAND);
            if (commands == null || commands.size() != 1 || !"apply".equals(commands.getFirst())) {
                System.err.println("operations provisioning status=INVALID");
                return 2;
            }
            Path input = optionPath(parsed, INPUT);
            if (input == null || !isSafeExternalRegularFile(input, MAX_PACKAGE_BYTES)) {
                System.err.println("operations provisioning status=INVALID");
                return 2;
            }
            byte[] packageBytes = Files.readAllBytes(input);
            String enrollmentCredential = null;
            try {
                ObjectMapper mapper = context.getBean(ObjectMapper.class);
                JsonNode inputJson = mapper.readTree(packageBytes);
                OperationsProvisioningPackageV1.ParseResult intent =
                        OperationsProvisioningPackageV1.parse(inputJson, null);
                if (intent.status() != OperationsProvisioningPackageV1.ParseResult.Status.VALID) {
                    System.err.println("operations provisioning status=INVALID");
                    return 2;
                }
                if (intent.value().action() == ProvisioningCommand.Action.PROVISION_PRINCIPAL) {
                    Path credentialOutput = optionPath(parsed, CREDENTIAL_OUTPUT);
                    if (credentialOutput == null || credentialOutput.equals(input)
                            || !isSafeExternalOutputPath(credentialOutput)) {
                        System.err.println("operations provisioning status=INVALID");
                        return 2;
                    }
                    OperationsCredentialGenerator generator = context.getBean(OperationsCredentialGenerator.class);
                    OperationsCredentialHasher hasher = context.getBean(OperationsCredentialHasher.class);
                    enrollmentCredential = readOrCreateCredential(credentialOutput, generator, hasher);
                    if (enrollmentCredential == null) {
                        System.err.println("operations provisioning status=INVALID");
                        return 2;
                    }
                } else if (parsed.containsOption(CREDENTIAL_OUTPUT)) {
                    System.err.println("operations provisioning status=INVALID");
                    return 2;
                }
                OperationsProvisioningService service = context.getBean(OperationsProvisioningService.class);
                OperationsAuthorizationRepository.ProvisioningResolution result =
                        service.execute(inputJson, enrollmentCredential);
                System.out.println("operations provisioning status=" + result.status());
                return result.status() == OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED
                        || result.status() == OperationsAuthorizationRepository.ProvisioningResolution.Status.REPLAYED
                        ? 0 : result.status() == OperationsAuthorizationRepository.ProvisioningResolution.Status.INVALID
                        || result.status() == OperationsAuthorizationRepository.ProvisioningResolution.Status.CONFLICT
                        || result.status() == OperationsAuthorizationRepository.ProvisioningResolution.Status.UNKNOWN_VISIT
                        ? 2 : 1;
            } finally {
                Arrays.fill(packageBytes, (byte) 0);
                enrollmentCredential = null;
            }
        } catch (Exception ignored) {
            System.err.println("operations provisioning status=TECHNICAL_FAILURE");
            return 1;
        }
    }

    static String readOrCreateCredential(Path output, OperationsCredentialGenerator generator,
            OperationsCredentialHasher hasher) throws IOException {
        if (!isSafeExternalOutputPath(output)) return null;
        if (Files.exists(output, LinkOption.NOFOLLOW_LINKS)) {
            if (!Files.isRegularFile(output, LinkOption.NOFOLLOW_LINKS)
                    || Files.size(output) > MAX_CREDENTIAL_BYTES || !isPrivateCredentialFile(output)) return null;
            byte[] bytes = readNoFollow(output, MAX_CREDENTIAL_BYTES);
            if (bytes == null) return null;
            try {
                String credential = new String(bytes, StandardCharsets.US_ASCII);
                return hasher.digest(credential).isPresent() ? credential : null;
            } finally {
                Arrays.fill(bytes, (byte) 0);
            }
        }

        String credential = generator.generate();
        if (credential == null || hasher.digest(credential).isEmpty()) return null;
        byte[] bytes = credential.getBytes(StandardCharsets.US_ASCII);
        boolean created = false;
        try {
            try {
                Files.createFile(output, PosixFilePermissions.asFileAttribute(
                        PosixFilePermissions.fromString("rw-------")));
            } catch (UnsupportedOperationException ignored) {
                Files.createFile(output);
            }
            created = true;
            if (!makeCredentialFilePrivate(output)) throw new IOException("credential output permissions unavailable");
            Set<OpenOption> options = new HashSet<>();
            options.add(StandardOpenOption.WRITE);
            options.add(LinkOption.NOFOLLOW_LINKS);
            try (SeekableByteChannel channel = Files.newByteChannel(output, options)) {
                ByteBuffer buffer = ByteBuffer.wrap(bytes);
                while (buffer.hasRemaining()) channel.write(buffer);
            }
            return credential;
        } catch (IOException | RuntimeException failure) {
            if (created) Files.deleteIfExists(output);
            throw failure;
        } finally {
            Arrays.fill(bytes, (byte) 0);
        }
    }

    static boolean isInsideGitCheckout(Path candidate) throws IOException {
        Path parent = candidate.toAbsolutePath().normalize().getParent();
        if (parent == null) return false;
        Path realParent = parent.toRealPath();
        Path current = realParent;
        while (current != null) {
            if (Files.exists(current.resolve(".git"), LinkOption.NOFOLLOW_LINKS)) return true;
            current = current.getParent();
        }
        return false;
    }

    private static Path optionPath(ApplicationArguments parsed, String name) {
        if (!parsed.containsOption(name)) return null;
        var values = parsed.getOptionValues(name);
        if (values == null || values.size() != 1 || values.getFirst().isBlank()) return null;
        return Path.of(values.getFirst()).toAbsolutePath().normalize();
    }

    private static boolean isSafeExternalRegularFile(Path path, long maxBytes) throws IOException {
        return Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
                && !Files.isSymbolicLink(path) && Files.size(path) <= maxBytes
                && !isInsideGitCheckout(path);
    }

    private static boolean isSafeExternalOutputPath(Path path) throws IOException {
        return path != null && path.isAbsolute() && path.getParent() != null
                && isPrivateDirectory(path.getParent())
                && !Files.isSymbolicLink(path)
                && !isInsideGitCheckout(path);
    }

    static boolean makeDirectoryPrivate(Path directory) throws IOException {
        if (directory == null || !Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(directory)) return false;
        var posix = Files.getFileAttributeView(directory, java.nio.file.attribute.PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
        if (posix != null) {
            var privatePermissions = PosixFilePermissions.fromString("rwx------");
            posix.setPermissions(privatePermissions);
            return privatePermissions.equals(posix.readAttributes().permissions());
        }
        AclFileAttributeView acl = Files.getFileAttributeView(directory, AclFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
        if (acl == null) return false;
        UserPrincipal owner = acl.getOwner();
        AclEntry ownerOnly = AclEntry.newBuilder().setType(AclEntryType.ALLOW).setPrincipal(owner)
                .setPermissions(Set.of(AclEntryPermission.values())).build();
        acl.setAcl(java.util.List.of(ownerOnly));
        var actual = acl.getAcl();
        return actual.size() == 1 && actual.getFirst().type() == AclEntryType.ALLOW
                && owner.equals(actual.getFirst().principal())
                && actual.getFirst().permissions().containsAll(Set.of(AclEntryPermission.values()));
    }

    private static boolean isPrivateDirectory(Path directory) throws IOException {
        if (!Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(directory)) return false;
        var posix = Files.getFileAttributeView(directory, java.nio.file.attribute.PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
        if (posix != null) return PosixFilePermissions.fromString("rwx------")
                .equals(posix.readAttributes().permissions());
        AclFileAttributeView acl = Files.getFileAttributeView(directory, AclFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
        if (acl == null) return false;
        UserPrincipal owner = acl.getOwner();
        var entries = acl.getAcl();
        return entries.size() == 1 && entries.getFirst().type() == AclEntryType.ALLOW
                && owner.equals(entries.getFirst().principal())
                && entries.getFirst().permissions().containsAll(Set.of(AclEntryPermission.values()));
    }

    private static boolean makeCredentialFilePrivate(Path path) throws IOException {
        var posix = Files.getFileAttributeView(path, java.nio.file.attribute.PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
        if (posix != null) {
            var privatePermissions = PosixFilePermissions.fromString("rw-------");
            posix.setPermissions(privatePermissions);
            return privatePermissions.equals(posix.readAttributes().permissions());
        }
        AclFileAttributeView acl = Files.getFileAttributeView(path, AclFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
        if (acl == null) return false;
        UserPrincipal owner = acl.getOwner();
        AclEntry ownerOnly = AclEntry.newBuilder().setType(AclEntryType.ALLOW).setPrincipal(owner)
                .setPermissions(Set.of(AclEntryPermission.values())).build();
        acl.setAcl(java.util.List.of(ownerOnly));
        var actual = acl.getAcl();
        return actual.size() == 1 && actual.getFirst().type() == AclEntryType.ALLOW
                && owner.equals(actual.getFirst().principal())
                && actual.getFirst().permissions().containsAll(Set.of(AclEntryPermission.values()));
    }

    private static boolean isPrivateCredentialFile(Path path) throws IOException {
        var posix = Files.getFileAttributeView(path, java.nio.file.attribute.PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
        if (posix != null) return PosixFilePermissions.fromString("rw-------")
                .equals(posix.readAttributes().permissions());
        AclFileAttributeView acl = Files.getFileAttributeView(path, AclFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
        if (acl == null) return false;
        UserPrincipal owner = acl.getOwner();
        var entries = acl.getAcl();
        return entries.size() == 1 && entries.getFirst().type() == AclEntryType.ALLOW
                && owner.equals(entries.getFirst().principal())
                && entries.getFirst().permissions().containsAll(Set.of(AclEntryPermission.values()));
    }

    private static byte[] readNoFollow(Path path, long maxBytes) throws IOException {
        Set<OpenOption> options = Set.of(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS);
        try (SeekableByteChannel channel = Files.newByteChannel(path, options)) {
            long size = channel.size();
            if (size < 1 || size > maxBytes) return null;
            ByteBuffer buffer = ByteBuffer.allocate((int) size);
            while (buffer.hasRemaining() && channel.read(buffer) >= 0) { }
            if (buffer.hasRemaining()) return null;
            return buffer.array();
        }
    }

}
