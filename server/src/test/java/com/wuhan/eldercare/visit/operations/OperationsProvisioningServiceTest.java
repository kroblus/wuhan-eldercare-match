package com.wuhan.eldercare.visit.operations;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.FileSystems;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OperationsProvisioningServiceTest {
    private static final String CREDENTIAL = "ops1_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
    private static final String PRINCIPAL_ID = "ops_0123456789abcdef";
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void provisioningPassesOnlyCredentialDigestAndDeterministicApprovedPairIntent() {
        OperationsAuthorizationRepository repository = mock(OperationsAuthorizationRepository.class);
        when(repository.applyProvisioning(any(), any())).thenReturn(new OperationsAuthorizationRepository.ProvisioningResolution(
                OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED));
        var service = new OperationsProvisioningService(repository, new Sha256OperationsCredentialHasher(), clock());

        service.execute(principalPackage("operation-1", "visit_beta", "visit_alpha"), CREDENTIAL);
        service.execute(principalPackage("operation-1", "visit_alpha", "visit_beta"), CREDENTIAL);

        var captor = org.mockito.ArgumentCaptor.forClass(ProvisioningCommand.class);
        org.mockito.Mockito.verify(repository, org.mockito.Mockito.times(2)).applyProvisioning(captor.capture(), any());
        ProvisioningCommand firstCommand = captor.getAllValues().getFirst();
        ProvisioningCommand replayCommand = captor.getAllValues().get(1);
        assertEquals(firstCommand.intentFingerprint(), replayCommand.intentFingerprint());
        assertEquals(List.of("visit_beta", "visit_alpha"), firstCommand.visitIds());
        assertNotEquals(CREDENTIAL, firstCommand.credentialDigest());
        assertTrue(!firstCommand.toString().contains(CREDENTIAL));
    }

    @Test
    void sameOperationIdWithChangedCredentialProducesConflictFingerprint() {
        OperationsAuthorizationRepository repository = mock(OperationsAuthorizationRepository.class);
        when(repository.applyProvisioning(any(), any())).thenReturn(new OperationsAuthorizationRepository.ProvisioningResolution(
                OperationsAuthorizationRepository.ProvisioningResolution.Status.APPLIED));
        var service = new OperationsProvisioningService(repository, new Sha256OperationsCredentialHasher(), clock());

        service.execute(principalPackage("operation-1", "visit_alpha"), CREDENTIAL);
        service.execute(principalPackage("operation-1", "visit_alpha"),
                "ops1_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopr");

        var capture = org.mockito.ArgumentCaptor.forClass(ProvisioningCommand.class);
        org.mockito.Mockito.verify(repository, org.mockito.Mockito.times(2)).applyProvisioning(capture.capture(), any());
        assertNotEquals(capture.getAllValues().get(0).intentFingerprint(), capture.getAllValues().get(1).intentFingerprint());
    }

    @Test
    void parserRejectsWildcardDuplicatePairAndUnexpectedIdentityClaims() {
        OperationsProvisioningPackageV1.ParseResult wildcard = OperationsProvisioningPackageV1.parse(
                principalPackage("operation-1", "*"), null);
        OperationsProvisioningPackageV1.ParseResult duplicate = OperationsProvisioningPackageV1.parse(
                principalPackage("operation-1", "visit_alpha", "visit_alpha"), null);
        ObjectNode spoofed = principalPackage("operation-1", "visit_alpha");
        spoofed.put("userId", "ordinary-c5-user");
        OperationsProvisioningPackageV1.ParseResult extraIdentity = OperationsProvisioningPackageV1.parse(spoofed, null);

        assertEquals(OperationsProvisioningPackageV1.ParseResult.Status.INVALID, wildcard.status());
        assertEquals(OperationsProvisioningPackageV1.ParseResult.Status.INVALID, duplicate.status());
        assertEquals(OperationsProvisioningPackageV1.ParseResult.Status.INVALID, extraIdentity.status());
    }

    @Test
    void provisioningPackageDoesNotAcceptCallerChosenCredential() {
        ObjectNode packageInput = principalPackage("operation-1", "visit_alpha");
        packageInput.put("credential", CREDENTIAL);
        var rawCredentialRejected = OperationsProvisioningPackageV1.parse(packageInput, null);
        assertEquals(OperationsProvisioningPackageV1.ParseResult.Status.INVALID, rawCredentialRejected.status());

        var parsed = OperationsProvisioningPackageV1.parse(principalPackage("operation-1", "visit_alpha"), CREDENTIAL);
        assertEquals(OperationsProvisioningPackageV1.ParseResult.Status.VALID, parsed.status());
        assertTrue(!parsed.value().toString().contains(CREDENTIAL));
    }

    @Test
    void generatedCredentialContainsThirtyTwoRandomBytesAndCanBeReusedFromOutputFile() throws Exception {
        var generator = new SecureRandomOperationsCredentialGenerator();
        Path directory = createExternalTempDirectory("ops-credential-test-");
        Path output = directory.resolve("operations-credential.txt");
        try {
            String credential = OperationsProvisioningCommandRunner.readOrCreateCredential(
                    output, generator, new Sha256OperationsCredentialHasher());
            assertTrue(new Sha256OperationsCredentialHasher().digest(credential).isPresent());
            assertEquals(32, Base64.getUrlDecoder().decode(credential.substring("ops1_".length())).length);
            assertEquals(credential, OperationsProvisioningCommandRunner.readOrCreateCredential(
                    output, generator, new Sha256OperationsCredentialHasher()));
            assertEquals(credential, OperationsProvisioningCommandRunner.readOrCreateCredential(
                    output, generator, new Sha256OperationsCredentialHasher()));
            assertEquals(credential, Files.readString(output));
        } finally {
            Files.deleteIfExists(output);
            Files.deleteIfExists(directory);
        }
    }

    @Test
    void gitCheckoutGuardChecksCandidateAncestorsNotCurrentWorkingDirectory(@TempDir Path directory) throws Exception {
        Path repository = Files.createDirectory(directory.resolve("repository"));
        Files.createDirectory(repository.resolve(".git"));
        Path nested = Files.createDirectories(repository.resolve("secrets"));
        Path inside = Files.createFile(nested.resolve("input.json"));
        Path outsideDirectory = createExternalTempDirectory("ops-outside-test-");
        Path outside = Files.createFile(outsideDirectory.resolve("outside.json"));

        assertTrue(OperationsProvisioningCommandRunner.isInsideGitCheckout(inside));
        assertTrue(!OperationsProvisioningCommandRunner.isInsideGitCheckout(outside));
        Files.deleteIfExists(outside);
        Files.deleteIfExists(outsideDirectory);
    }

    private ObjectNode principalPackage(String operationId, String... visitIds) {
        ObjectNode input = mapper.createObjectNode();
        input.put("packageVersion", "operations-provisioning-command-v1");
        input.put("operationId", operationId);
        input.put("operationType", "PROVISION_PRINCIPAL");
        input.put("approvalReference", "approval:access-list-2026-09");
        input.put("provisioningActorReference", "deployment:release-job-42");
        input.put("operationsPrincipalId", PRINCIPAL_ID);
        input.put("verifiedActorReference", "verified-ops-actor:directory-record-8");
        var visits = input.putArray("visitIds");
        for (String visitId : visitIds) visits.add(visitId);
        return input;
    }

    private static Path createExternalTempDirectory(String prefix) throws Exception {
        for (Path root : FileSystems.getDefault().getRootDirectories()) {
            Path directory = null;
            try {
                directory = Files.createTempDirectory(root, prefix);
                if (!OperationsProvisioningCommandRunner.isInsideGitCheckout(directory.resolve("candidate"))
                        && OperationsProvisioningCommandRunner.makeDirectoryPrivate(directory)) {
                    return directory;
                }
                Files.deleteIfExists(directory);
            } catch (Exception ignored) {
                if (directory != null) Files.deleteIfExists(directory);
            }
        }
        org.junit.jupiter.api.Assumptions.assumeTrue(false,
                "no writable temp root outside a Git checkout is available for the secret-file test");
        throw new IllegalStateException("assumption aborted");
    }

    private static Clock clock() {
        return Clock.fixed(Instant.parse("2026-09-26T00:00:00Z"), ZoneOffset.UTC);
    }
}
