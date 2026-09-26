package com.wuhan.eldercare.visit.operations;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Strict, credential-free approved intent for the deployment-only provisioning command. */
public final class OperationsProvisioningPackageV1 {
    private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z][A-Za-z0-9._:-]{0,159}");
    private static final Pattern PRINCIPAL_ID = Pattern.compile("ops_[A-Za-z0-9_-]{16,96}");
    private static final Pattern REFERENCE = Pattern.compile("[A-Za-z][A-Za-z0-9._:/-]{0,199}");
    private static final Pattern DEPLOYMENT_ACTOR = Pattern.compile("deployment:[A-Za-z0-9._/-]{1,180}");
    private static final Pattern VERIFIED_ACTOR = Pattern.compile("verified-ops-actor:[A-Za-z0-9._/-]{1,180}");

    private final String operationId;
    private final ProvisioningCommand.Action action;
    private final String operationsPrincipalId;
    private final String credentialEvidence;
    private final String verifiedActorReference;
    private final String approvalReference;
    private final String provisioningActorReference;
    private final List<String> visitIds;

    private OperationsProvisioningPackageV1(String operationId, ProvisioningCommand.Action action,
            String operationsPrincipalId, String credentialEvidence, String verifiedActorReference,
            String approvalReference, String provisioningActorReference, List<String> visitIds) {
        this.operationId = operationId;
        this.action = action;
        this.operationsPrincipalId = operationsPrincipalId;
        this.credentialEvidence = credentialEvidence;
        this.verifiedActorReference = verifiedActorReference;
        this.approvalReference = approvalReference;
        this.provisioningActorReference = provisioningActorReference;
        this.visitIds = List.copyOf(visitIds);
    }

    public static ParseResult parse(JsonNode input, String credentialEvidence) {
        if (input == null || !input.isObject() || !"operations-provisioning-command-v1".equals(
                text(input, "packageVersion"))) return ParseResult.invalid();
        String actionText = text(input, "operationType");
        ProvisioningCommand.Action action;
        try {
            action = ProvisioningCommand.Action.valueOf(actionText == null ? "" : actionText);
        } catch (IllegalArgumentException ignored) {
            return ParseResult.invalid();
        }
        Set<String> keys = switch (action) {
            case PROVISION_PRINCIPAL -> Set.of("packageVersion", "operationId", "operationType",
                    "approvalReference", "provisioningActorReference", "operationsPrincipalId",
                    "verifiedActorReference", "visitIds");
            case GRANT_VISIT, REVOKE_GRANT -> Set.of("packageVersion", "operationId", "operationType",
                    "approvalReference", "provisioningActorReference", "operationsPrincipalId", "visitId");
            case REVOKE_PRINCIPAL -> Set.of("packageVersion", "operationId", "operationType",
                    "approvalReference", "provisioningActorReference", "operationsPrincipalId");
        };
        if (!hasExactKeys(input, keys)) return ParseResult.invalid();

        String operationId = text(input, "operationId");
        String principalId = text(input, "operationsPrincipalId");
        String approvalReference = text(input, "approvalReference");
        String actorReference = text(input, "provisioningActorReference");
        if (!matches(IDENTIFIER, operationId) || !matches(PRINCIPAL_ID, principalId)
                || !matches(REFERENCE, approvalReference) || !matches(DEPLOYMENT_ACTOR, actorReference)) {
            return ParseResult.invalid();
        }

        String credential = null;
        String verifiedActor = null;
        List<String> visitIds = new ArrayList<>();
        if (action == ProvisioningCommand.Action.PROVISION_PRINCIPAL) {
            credential = credentialEvidence;
            verifiedActor = text(input, "verifiedActorReference");
            JsonNode visits = input.get("visitIds");
            if (!matches(VERIFIED_ACTOR, verifiedActor)
                    || visits == null || !visits.isArray() || visits.isEmpty() || visits.size() > 100) {
                return ParseResult.invalid();
            }
            Set<String> uniqueVisits = new HashSet<>();
            for (JsonNode visit : visits) {
                if (!visit.isTextual()) return ParseResult.invalid();
                String visitId = visit.asText();
                if (!validVisitId(visitId) || !uniqueVisits.add(visitId)) return ParseResult.invalid();
                visitIds.add(visitId);
            }
        } else if (action == ProvisioningCommand.Action.GRANT_VISIT
                || action == ProvisioningCommand.Action.REVOKE_GRANT) {
            String visitId = text(input, "visitId");
            if (!validVisitId(visitId)) return ParseResult.invalid();
            visitIds.add(visitId);
        }
        return ParseResult.valid(new OperationsProvisioningPackageV1(operationId, action, principalId,
                credential, verifiedActor, approvalReference, actorReference, visitIds));
    }

    public String operationId() { return operationId; }
    public ProvisioningCommand.Action action() { return action; }
    public String operationsPrincipalId() { return operationsPrincipalId; }
    public String credentialEvidence() { return credentialEvidence; }
    public String verifiedActorReference() { return verifiedActorReference; }
    public String approvalReference() { return approvalReference; }
    public String provisioningActorReference() { return provisioningActorReference; }
    public List<String> visitIds() { return visitIds; }

    @Override
    public String toString() {
        return "OperationsProvisioningPackageV1[action=" + action + ", principal=" + operationsPrincipalId + "]";
    }

    private static boolean validVisitId(String value) {
        return value != null && !value.isBlank() && value.equals(value.trim()) && value.length() <= 200
                && !"*".equals(value) && !"ALL_VISITS".equalsIgnoreCase(value)
                && value.chars().noneMatch(Character::isISOControl);
    }

    private static boolean matches(Pattern pattern, String value) {
        return value != null && pattern.matcher(value).matches();
    }

    private static String text(JsonNode node, String key) {
        JsonNode value = node.get(key);
        if (value == null || !value.isTextual()) return null;
        String result = value.asText();
        return result.isBlank() || !result.equals(result.trim()) ? null : result;
    }

    private static boolean hasExactKeys(JsonNode object, Set<String> keys) {
        if (object.size() != keys.size()) return false;
        for (String key : keys) if (!object.has(key)) return false;
        return true;
    }

    public record ParseResult(Status status, OperationsProvisioningPackageV1 value) {
        public enum Status { VALID, INVALID }

        public ParseResult {
            if (status == null || (status == Status.VALID) != (value != null)) {
                throw new IllegalArgumentException("valid provisioning package result required");
            }
        }

        static ParseResult valid(OperationsProvisioningPackageV1 value) {
            return new ParseResult(Status.VALID, value);
        }

        static ParseResult invalid() {
            return new ParseResult(Status.INVALID, null);
        }
    }
}
