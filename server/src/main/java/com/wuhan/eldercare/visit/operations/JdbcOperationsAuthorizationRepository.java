package com.wuhan.eldercare.visit.operations;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/** MySQL persistence for separately trusted Operations identities and exact Visit grants. */
public final class JdbcOperationsAuthorizationRepository implements OperationsAuthorizationRepository {
    private static final String RESOLVE_CREDENTIAL_SQL = "SELECT p.principal_state, c.credential_state, "
            + "p.operations_principal_id FROM operations_credential_v1 c "
            + "JOIN operations_principal_v1 p ON p.operations_principal_id = c.operations_principal_id "
            + "WHERE c.credential_digest = ?";
    private static final String AUTHORIZE_VISIT_SQL = "SELECT 1 FROM institution_visit_v1 v "
            + "JOIN operations_visit_grant_v1 g ON g.visit_id = v.visit_id "
            + "JOIN operations_principal_v1 p ON p.operations_principal_id = g.operations_principal_id "
            + "JOIN operations_credential_v1 c ON c.operations_principal_id = p.operations_principal_id "
            + "WHERE v.visit_id = ? AND g.operations_principal_id = ? AND p.principal_state = 'ACTIVE' "
            + "AND g.grant_state = 'ACTIVE' AND c.credential_state = 'ACTIVE'";

    private final DataSource dataSource;

    public JdbcOperationsAuthorizationRepository(DataSource dataSource) {
        if (dataSource == null) throw new IllegalArgumentException("dataSource required");
        this.dataSource = dataSource;
    }

    @Override
    public AuthenticationResolution resolveCredential(String credentialDigest) {
        if (!isDigest(credentialDigest)) return auth(AuthenticationResolution.Status.UNKNOWN, null);
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(RESOLVE_CREDENTIAL_SQL)) {
            statement.setString(1, credentialDigest);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return auth(AuthenticationResolution.Status.UNKNOWN, null);
                boolean active = "ACTIVE".equals(result.getString("principal_state"))
                        && "ACTIVE".equals(result.getString("credential_state"));
                return active
                        ? auth(AuthenticationResolution.Status.ACTIVE, result.getString("operations_principal_id"))
                        : auth(AuthenticationResolution.Status.REVOKED, null);
            }
        } catch (SQLException exception) {
            return auth(isUnavailable(exception) ? AuthenticationResolution.Status.UNAVAILABLE
                    : AuthenticationResolution.Status.TECHNICAL_FAILURE, null);
        } catch (RuntimeException ignored) {
            return auth(AuthenticationResolution.Status.TECHNICAL_FAILURE, null);
        }
    }

    @Override
    public AuthorizationResolution authorizeVisit(String operationsPrincipalId, String visitId) {
        if (blank(operationsPrincipalId) || blank(visitId) || "*".equals(visitId)) {
            return authorization(AuthorizationResolution.Status.DENIED_OR_HIDDEN);
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(AUTHORIZE_VISIT_SQL)) {
            statement.setString(1, visitId);
            statement.setString(2, operationsPrincipalId);
            try (ResultSet result = statement.executeQuery()) {
                return authorization(result.next() ? AuthorizationResolution.Status.AUTHORIZED
                        : AuthorizationResolution.Status.DENIED_OR_HIDDEN);
            }
        } catch (SQLException exception) {
            return authorization(isUnavailable(exception) ? AuthorizationResolution.Status.UNAVAILABLE
                    : AuthorizationResolution.Status.TECHNICAL_FAILURE);
        } catch (RuntimeException ignored) {
            return authorization(AuthorizationResolution.Status.TECHNICAL_FAILURE);
        }
    }

    @Override
    public ProvisioningResolution applyProvisioning(ProvisioningCommand command, Instant acceptedAt) {
        if (command == null || acceptedAt == null || !validCommand(command)) {
            return provisioning(ProvisioningResolution.Status.INVALID);
        }
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                ProvisioningResolution prior = existingOperation(connection, command, false);
                if (prior != null) {
                    connection.rollback();
                    return prior;
                }
                ProvisioningResolution.Status applied = applyIntent(connection, command, acceptedAt);
                if (applied != ProvisioningResolution.Status.APPLIED) {
                    connection.rollback();
                    return provisioning(applied);
                }
                insertOperation(connection, command, acceptedAt);
                connection.commit();
                return provisioning(ProvisioningResolution.Status.APPLIED);
            } catch (SQLException exception) {
                rollbackQuietly(connection);
                if (isUniqueConflict(exception)) {
                    ProvisioningResolution concurrent = resolveOperationAfterConflict(command);
                    return concurrent == null ? provisioning(ProvisioningResolution.Status.CONFLICT) : concurrent;
                }
                return provisioning(isUnavailable(exception) ? ProvisioningResolution.Status.UNAVAILABLE
                        : ProvisioningResolution.Status.TECHNICAL_FAILURE);
            } catch (RuntimeException ignored) {
                rollbackQuietly(connection);
                return provisioning(ProvisioningResolution.Status.TECHNICAL_FAILURE);
            }
        } catch (SQLException exception) {
            return provisioning(isUnavailable(exception) ? ProvisioningResolution.Status.UNAVAILABLE
                    : ProvisioningResolution.Status.TECHNICAL_FAILURE);
        }
    }

    private ProvisioningResolution.Status applyIntent(Connection connection, ProvisioningCommand command,
                                                       Instant acceptedAt) throws SQLException {
        return switch (command.action()) {
            case PROVISION_PRINCIPAL -> provisionPrincipal(connection, command, acceptedAt);
            case GRANT_VISIT -> grantVisit(connection, command, acceptedAt);
            case REVOKE_GRANT -> revokeGrant(connection, command, acceptedAt);
            case REVOKE_PRINCIPAL -> revokePrincipal(connection, command, acceptedAt);
        };
    }

    private ProvisioningResolution.Status provisionPrincipal(Connection connection, ProvisioningCommand command,
                                                               Instant acceptedAt) throws SQLException {
        List<String> visits = command.visitIds().stream().sorted().toList();
        for (String visitId : visits) {
            if (!lockVisit(connection, visitId)) return ProvisioningResolution.Status.UNKNOWN_VISIT;
        }

        PrincipalRow principal = findPrincipal(connection, command.operationsPrincipalId(), true);
        ProvisioningResolution prior = existingOperation(connection, command, true);
        if (prior != null) return prior.status();
        if (principal != null && "REVOKED".equals(principal.state())) {
            return ProvisioningResolution.Status.PRINCIPAL_REVOKED;
        }
        if (principal != null && !principal.verifiedActorReference().equals(command.verifiedActorReference())) {
            return ProvisioningResolution.Status.CONFLICT;
        }
        CredentialRow credential = findCredentialByDigest(connection, command.credentialDigest(), true);
        if (credential != null && !credential.operationsPrincipalId().equals(command.operationsPrincipalId())) {
            return ProvisioningResolution.Status.CONFLICT;
        }
        CredentialRow principalCredential = findCredentialByPrincipal(connection, command.operationsPrincipalId(), true);
        if (principalCredential != null && (!principalCredential.credentialDigest().equals(command.credentialDigest())
                || "REVOKED".equals(principalCredential.state()))) {
            return ProvisioningResolution.Status.CONFLICT;
        }
        if (credential != null && "REVOKED".equals(credential.state())) {
            return ProvisioningResolution.Status.CONFLICT;
        }

        if (principal == null) {
            insertPrincipal(connection, command, acceptedAt);
            insertCredential(connection, command, acceptedAt);
        } else if (principalCredential == null) {
            insertCredential(connection, command, acceptedAt);
        }
        for (String visitId : visits) {
            grantOne(connection, command.operationsPrincipalId(), visitId, command, acceptedAt);
        }
        return ProvisioningResolution.Status.APPLIED;
    }

    private ProvisioningResolution.Status grantVisit(Connection connection, ProvisioningCommand command,
                                                       Instant acceptedAt) throws SQLException {
        PrincipalRow principal = findPrincipal(connection, command.operationsPrincipalId(), true);
        if (principal == null) return ProvisioningResolution.Status.PRINCIPAL_NOT_FOUND;
        ProvisioningResolution prior = existingOperation(connection, command, true);
        if (prior != null) return prior.status();
        if ("REVOKED".equals(principal.state())) return ProvisioningResolution.Status.PRINCIPAL_REVOKED;
        String visitId = command.singleVisitId();
        if (visitId == null || !lockVisit(connection, visitId)) return ProvisioningResolution.Status.UNKNOWN_VISIT;
        prior = existingOperation(connection, command, true);
        if (prior != null) return prior.status();
        grantOne(connection, command.operationsPrincipalId(), visitId, command, acceptedAt);
        return ProvisioningResolution.Status.APPLIED;
    }

    private void grantOne(Connection connection, String principalId, String visitId,
                          ProvisioningCommand command, Instant acceptedAt) throws SQLException {
        GrantRow existing = findGrant(connection, principalId, visitId, true);
        if (existing == null) {
            try (PreparedStatement statement = connection.prepareStatement("INSERT INTO operations_visit_grant_v1 "
                    + "(operations_principal_id, visit_id, grant_state, approval_reference, "
                    + "created_by_operation_id, created_at, last_granted_by_operation_id, last_granted_at) "
                    + "VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, ?)")) {
                statement.setString(1, principalId);
                statement.setString(2, visitId);
                statement.setString(3, command.approvalReference());
                statement.setString(4, command.operationId());
                statement.setTimestamp(5, Timestamp.from(acceptedAt));
                statement.setString(6, command.operationId());
                statement.setTimestamp(7, Timestamp.from(acceptedAt));
                statement.executeUpdate();
            }
            return;
        }
        if ("ACTIVE".equals(existing.state())) {
            try (PreparedStatement statement = connection.prepareStatement("UPDATE operations_visit_grant_v1 SET "
                    + "approval_reference = ?, last_granted_by_operation_id = ?, last_granted_at = ? "
                    + "WHERE operations_principal_id = ? AND visit_id = ?")) {
                statement.setString(1, command.approvalReference());
                statement.setString(2, command.operationId());
                statement.setTimestamp(3, Timestamp.from(acceptedAt));
                statement.setString(4, principalId);
                statement.setString(5, visitId);
                statement.executeUpdate();
            }
            return;
        }
        try (PreparedStatement statement = connection.prepareStatement("UPDATE operations_visit_grant_v1 SET "
                + "grant_state = 'ACTIVE', approval_reference = ?, last_granted_by_operation_id = ?, "
                + "last_granted_at = ?, revoked_by_operation_id = NULL, revoked_at = NULL "
                + "WHERE operations_principal_id = ? AND visit_id = ?")) {
            statement.setString(1, command.approvalReference());
            statement.setString(2, command.operationId());
            statement.setTimestamp(3, Timestamp.from(acceptedAt));
            statement.setString(4, principalId);
            statement.setString(5, visitId);
            statement.executeUpdate();
        }
    }

    private ProvisioningResolution.Status revokeGrant(Connection connection, ProvisioningCommand command,
                                                        Instant acceptedAt) throws SQLException {
        PrincipalRow principal = findPrincipal(connection, command.operationsPrincipalId(), true);
        if (principal == null) return ProvisioningResolution.Status.PRINCIPAL_NOT_FOUND;
        ProvisioningResolution prior = existingOperation(connection, command, true);
        if (prior != null) return prior.status();
        String visitId = command.singleVisitId();
        GrantRow grant = visitId == null ? null : findGrant(connection, command.operationsPrincipalId(), visitId, true);
        if (grant == null) return ProvisioningResolution.Status.GRANT_NOT_FOUND;
        prior = existingOperation(connection, command, true);
        if (prior != null) return prior.status();
        if ("REVOKED".equals(grant.state())) return ProvisioningResolution.Status.ALREADY_REVOKED;
        try (PreparedStatement statement = connection.prepareStatement("UPDATE operations_visit_grant_v1 SET "
                + "grant_state = 'REVOKED', revoked_by_operation_id = ?, revoked_at = ? "
                + "WHERE operations_principal_id = ? AND visit_id = ? AND grant_state = 'ACTIVE'")) {
            statement.setString(1, command.operationId());
            statement.setTimestamp(2, Timestamp.from(acceptedAt));
            statement.setString(3, command.operationsPrincipalId());
            statement.setString(4, visitId);
            statement.executeUpdate();
        }
        return ProvisioningResolution.Status.APPLIED;
    }

    private ProvisioningResolution.Status revokePrincipal(Connection connection, ProvisioningCommand command,
                                                             Instant acceptedAt) throws SQLException {
        PrincipalRow principal = findPrincipal(connection, command.operationsPrincipalId(), true);
        if (principal == null) return ProvisioningResolution.Status.PRINCIPAL_NOT_FOUND;
        ProvisioningResolution prior = existingOperation(connection, command, true);
        if (prior != null) return prior.status();
        if ("REVOKED".equals(principal.state())) return ProvisioningResolution.Status.ALREADY_REVOKED;
        try (PreparedStatement statement = connection.prepareStatement("UPDATE operations_principal_v1 SET "
                + "principal_state = 'REVOKED', revoked_by_operation_id = ?, revoked_at = ? "
                + "WHERE operations_principal_id = ? AND principal_state = 'ACTIVE'")) {
            statement.setString(1, command.operationId());
            statement.setTimestamp(2, Timestamp.from(acceptedAt));
            statement.setString(3, command.operationsPrincipalId());
            statement.executeUpdate();
        }
        try (PreparedStatement statement = connection.prepareStatement("UPDATE operations_credential_v1 SET "
                + "credential_state = 'REVOKED', revoked_by_operation_id = ?, revoked_at = ? "
                + "WHERE operations_principal_id = ? AND credential_state = 'ACTIVE'")) {
            statement.setString(1, command.operationId());
            statement.setTimestamp(2, Timestamp.from(acceptedAt));
            statement.setString(3, command.operationsPrincipalId());
            statement.executeUpdate();
        }
        try (PreparedStatement statement = connection.prepareStatement("UPDATE operations_visit_grant_v1 SET "
                + "grant_state = 'REVOKED', revoked_by_operation_id = ?, revoked_at = ? "
                + "WHERE operations_principal_id = ? AND grant_state = 'ACTIVE'")) {
            statement.setString(1, command.operationId());
            statement.setTimestamp(2, Timestamp.from(acceptedAt));
            statement.setString(3, command.operationsPrincipalId());
            statement.executeUpdate();
        }
        return ProvisioningResolution.Status.APPLIED;
    }

    private void insertPrincipal(Connection connection, ProvisioningCommand command, Instant acceptedAt)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("INSERT INTO operations_principal_v1 "
                + "(operations_principal_id, principal_state, verified_actor_reference, approval_reference, "
                + "created_by_operation_id, created_at) VALUES (?, 'ACTIVE', ?, ?, ?, ?)")) {
            statement.setString(1, command.operationsPrincipalId());
            statement.setString(2, command.verifiedActorReference());
            statement.setString(3, command.approvalReference());
            statement.setString(4, command.operationId());
            statement.setTimestamp(5, Timestamp.from(acceptedAt));
            statement.executeUpdate();
        }
    }

    private void insertCredential(Connection connection, ProvisioningCommand command, Instant acceptedAt)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("INSERT INTO operations_credential_v1 "
                + "(operations_principal_id, credential_digest, credential_state, created_by_operation_id, created_at) "
                + "VALUES (?, ?, 'ACTIVE', ?, ?)")) {
            statement.setString(1, command.operationsPrincipalId());
            statement.setString(2, command.credentialDigest());
            statement.setString(3, command.operationId());
            statement.setTimestamp(4, Timestamp.from(acceptedAt));
            statement.executeUpdate();
        }
    }

    private void insertOperation(Connection connection, ProvisioningCommand command, Instant acceptedAt)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("INSERT INTO operations_provisioning_operation_v1 "
                + "(operation_id, operation_type, intent_fingerprint, operations_principal_id, visit_id, "
                + "approval_reference, provisioning_actor_reference, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            statement.setString(1, command.operationId());
            statement.setString(2, command.action().name());
            statement.setString(3, command.intentFingerprint());
            statement.setString(4, command.operationsPrincipalId());
            statement.setString(5, command.singleVisitId());
            statement.setString(6, command.approvalReference());
            statement.setString(7, command.provisioningActorReference());
            statement.setTimestamp(8, Timestamp.from(acceptedAt));
            statement.executeUpdate();
        }
    }

    private boolean lockVisit(Connection connection, String visitId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT visit_id FROM institution_visit_v1 WHERE visit_id = ? FOR UPDATE")) {
            statement.setString(1, visitId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private PrincipalRow findPrincipal(Connection connection, String principalId, boolean lock) throws SQLException {
        String sql = "SELECT principal_state, verified_actor_reference FROM operations_principal_v1 "
                + "WHERE operations_principal_id = ?" + (lock ? " FOR UPDATE" : "");
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, principalId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? new PrincipalRow(result.getString("principal_state"),
                        result.getString("verified_actor_reference")) : null;
            }
        }
    }

    private CredentialRow findCredentialByDigest(Connection connection, String digest, boolean lock)
            throws SQLException {
        String sql = "SELECT operations_principal_id, credential_digest, credential_state "
                + "FROM operations_credential_v1 WHERE credential_digest = ?" + (lock ? " FOR UPDATE" : "");
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, digest);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? new CredentialRow(result.getString("operations_principal_id"),
                        result.getString("credential_digest"), result.getString("credential_state")) : null;
            }
        }
    }

    private CredentialRow findCredentialByPrincipal(Connection connection, String principalId, boolean lock)
            throws SQLException {
        String sql = "SELECT operations_principal_id, credential_digest, credential_state "
                + "FROM operations_credential_v1 WHERE operations_principal_id = ?" + (lock ? " FOR UPDATE" : "");
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, principalId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? new CredentialRow(result.getString("operations_principal_id"),
                        result.getString("credential_digest"), result.getString("credential_state")) : null;
            }
        }
    }

    private GrantRow findGrant(Connection connection, String principalId, String visitId, boolean lock)
            throws SQLException {
        String sql = "SELECT grant_state FROM operations_visit_grant_v1 "
                + "WHERE operations_principal_id = ? AND visit_id = ?" + (lock ? " FOR UPDATE" : "");
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, principalId);
            statement.setString(2, visitId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? new GrantRow(result.getString("grant_state")) : null;
            }
        }
    }

    private ProvisioningResolution existingOperation(Connection connection, ProvisioningCommand command,
                                                        boolean lock) throws SQLException {
        String sql = "SELECT intent_fingerprint FROM operations_provisioning_operation_v1 WHERE operation_id = ?"
                + (lock ? " FOR UPDATE" : "");
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, command.operationId());
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return null;
                return provisioning(command.intentFingerprint().equals(result.getString("intent_fingerprint"))
                        ? ProvisioningResolution.Status.REPLAYED : ProvisioningResolution.Status.CONFLICT);
            }
        }
    }

    private ProvisioningResolution resolveOperationAfterConflict(ProvisioningCommand command) {
        try (Connection connection = dataSource.getConnection()) {
            ProvisioningResolution result = existingOperation(connection, command, false);
            return result;
        } catch (SQLException ignored) {
            return null;
        }
    }

    private static boolean validCommand(ProvisioningCommand command) {
        if (blank(command.operationId()) || !isDigest(command.intentFingerprint())
                || blank(command.operationsPrincipalId()) || blank(command.approvalReference())
                || blank(command.provisioningActorReference()) || command.visitIds().size() > 100) return false;
        if (command.action() == ProvisioningCommand.Action.PROVISION_PRINCIPAL) {
            return isDigest(command.credentialDigest()) && !blank(command.verifiedActorReference())
                    && !command.visitIds().isEmpty() && command.visitIds().stream().allMatch(JdbcOperationsAuthorizationRepository::validVisitId);
        }
        if (command.action() == ProvisioningCommand.Action.GRANT_VISIT
                || command.action() == ProvisioningCommand.Action.REVOKE_GRANT) {
            return command.visitIds().size() == 1 && validVisitId(command.singleVisitId())
                    && command.credentialDigest() == null && command.verifiedActorReference() == null;
        }
        return command.visitIds().isEmpty() && command.credentialDigest() == null
                && command.verifiedActorReference() == null;
    }

    private static boolean validVisitId(String value) {
        return !blank(value) && value.equals(value.trim()) && value.length() <= 200
                && !"*".equals(value) && !"ALL_VISITS".equalsIgnoreCase(value)
                && value.chars().noneMatch(Character::isISOControl);
    }

    private static boolean isDigest(String value) {
        return value != null && value.matches("[a-f0-9]{64}");
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean isUniqueConflict(SQLException exception) {
        for (SQLException current = exception; current != null; current = current.getNextException()) {
            if (current.getErrorCode() == 1062) return true;
        }
        return false;
    }

    private static boolean isUnavailable(SQLException exception) {
        for (SQLException current = exception; current != null; current = current.getNextException()) {
            String state = current.getSQLState();
            if (state != null && (state.startsWith("08") || "40001".equals(state)
                    || current.getErrorCode() == 1205 || current.getErrorCode() == 1213)) return true;
        }
        return false;
    }

    private static void rollbackQuietly(Connection connection) {
        try { connection.rollback(); } catch (SQLException ignored) { }
    }

    private static AuthenticationResolution auth(AuthenticationResolution.Status status, String principalId) {
        return new AuthenticationResolution(status, principalId);
    }

    private static AuthorizationResolution authorization(AuthorizationResolution.Status status) {
        return new AuthorizationResolution(status);
    }

    private static ProvisioningResolution provisioning(ProvisioningResolution.Status status) {
        return new ProvisioningResolution(status);
    }

    private record PrincipalRow(String state, String verifiedActorReference) { }
    private record CredentialRow(String operationsPrincipalId, String credentialDigest, String state) { }
    private record GrantRow(String state) { }
}
