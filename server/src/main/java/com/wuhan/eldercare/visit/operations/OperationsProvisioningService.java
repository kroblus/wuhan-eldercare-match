package com.wuhan.eldercare.visit.operations;

import com.fasterxml.jackson.databind.JsonNode;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/** Controlled application boundary used by the deployment-only provisioning command. */
public final class OperationsProvisioningService {
    private final OperationsAuthorizationRepository repository;
    private final OperationsCredentialHasher credentialHasher;
    private final Clock clock;

    public OperationsProvisioningService(OperationsAuthorizationRepository repository,
            OperationsCredentialHasher credentialHasher, Clock clock) {
        this.repository = repository;
        this.credentialHasher = credentialHasher;
        this.clock = clock;
    }

    public OperationsAuthorizationRepository.ProvisioningResolution execute(
            JsonNode input, String enrollmentCredentialEvidence) {
        OperationsProvisioningPackageV1.ParseResult parsed =
                OperationsProvisioningPackageV1.parse(input, enrollmentCredentialEvidence);
        if (parsed.status() != OperationsProvisioningPackageV1.ParseResult.Status.VALID) {
            return result(OperationsAuthorizationRepository.ProvisioningResolution.Status.INVALID);
        }
        OperationsProvisioningPackageV1 request = parsed.value();
        String credentialDigest = null;
        if (request.action() == ProvisioningCommand.Action.PROVISION_PRINCIPAL) {
            try {
                var digest = credentialHasher.digest(request.credentialEvidence());
                if (digest == null || digest.isEmpty()) {
                    return result(OperationsAuthorizationRepository.ProvisioningResolution.Status.INVALID);
                }
                credentialDigest = digest.get();
            } catch (RuntimeException ignored) {
                return result(OperationsAuthorizationRepository.ProvisioningResolution.Status.INVALID);
            }
        }
        try {
            ProvisioningCommand command = new ProvisioningCommand(
                    request.operationId(), request.action(), fingerprint(request, credentialDigest),
                    request.operationsPrincipalId(), credentialDigest, request.verifiedActorReference(),
                    request.approvalReference(), request.provisioningActorReference(), request.visitIds());
            OperationsAuthorizationRepository.ProvisioningResolution resolved =
                    repository.applyProvisioning(command, clock.instant());
            return resolved == null ? result(OperationsAuthorizationRepository.ProvisioningResolution.Status.TECHNICAL_FAILURE)
                    : resolved;
        } catch (RuntimeException ignored) {
            return result(OperationsAuthorizationRepository.ProvisioningResolution.Status.TECHNICAL_FAILURE);
        }
    }

    private static String fingerprint(OperationsProvisioningPackageV1 request, String credentialDigest) {
        List<String> fields = new ArrayList<>();
        fields.add(request.action().name());
        fields.add(request.operationsPrincipalId());
        fields.add(credentialDigest == null ? "" : credentialDigest);
        fields.add(request.verifiedActorReference() == null ? "" : request.verifiedActorReference());
        fields.add(request.approvalReference());
        fields.add(request.provisioningActorReference());
        List<String> visitIds = request.visitIds().stream().sorted().toList();
        fields.add(Integer.toString(visitIds.size()));
        fields.addAll(visitIds);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String field : fields) {
                byte[] bytes = field.getBytes(StandardCharsets.UTF_8);
                digest.update(ByteBuffer.allocate(Integer.BYTES).putInt(bytes.length).array());
                digest.update(bytes);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception ignored) {
            throw new IllegalStateException("fingerprint unavailable");
        }
    }

    private static OperationsAuthorizationRepository.ProvisioningResolution result(
            OperationsAuthorizationRepository.ProvisioningResolution.Status status) {
        return new OperationsAuthorizationRepository.ProvisioningResolution(status);
    }
}
