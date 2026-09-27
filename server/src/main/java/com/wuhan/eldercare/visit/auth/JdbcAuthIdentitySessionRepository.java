package com.wuhan.eldercare.visit.auth;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;

/** JDBC implementation of C5 identity/session truth. */
public final class JdbcAuthIdentitySessionRepository implements AuthIdentitySessionRepository {
    private final DataSource dataSource;
    private final ServerOpaquePrincipalSource principalSource;

    public JdbcAuthIdentitySessionRepository(DataSource dataSource, ServerOpaquePrincipalSource principalSource) {
        this.dataSource = dataSource;
        this.principalSource = principalSource;
    }

    @Override
    public LoginResult createOrLogin(String providerNamespace, String providerSubjectDigest,
                                     String sessionDigest, Instant issuedAt, Instant expiresAt) {
        if (blank(providerNamespace) || blank(providerSubjectDigest) || blank(sessionDigest)
                || issuedAt == null || expiresAt == null || !expiresAt.isAfter(issuedAt)) {
            return new LoginResult(LoginResult.Status.TECHNICAL_FAILURE);
        }
        // A concurrent first login can win the identity unique key. Retry in a fresh
        // transaction after the winner commits; never commit an identity without a session.
        for (int attempt = 0; attempt < 4; attempt++) {
            try (Connection connection = dataSource.getConnection()) {
                connection.setAutoCommit(false);
                try {
                    String userId = selectUserId(connection, providerNamespace, providerSubjectDigest);
                    if (userId == null) {
                        userId = principalSource.newUserId();
                        if (blank(userId)) throw new IllegalStateException("principal source returned blank id");
                        try {
                            insertIdentity(connection, providerNamespace, providerSubjectDigest, userId, issuedAt);
                        } catch (SQLException duplicateIdentity) {
                            rollbackQuietly(connection);
                            if (isDuplicateKey(duplicateIdentity)) continue;
                            return new LoginResult(isUnavailable(duplicateIdentity)
                                    ? LoginResult.Status.UNAVAILABLE : LoginResult.Status.TECHNICAL_FAILURE);
                        }
                    }
                    try {
                        insertSession(connection, userId, sessionDigest, issuedAt, expiresAt);
                    } catch (SQLException sessionFailure) {
                        rollbackQuietly(connection);
                        return new LoginResult(isDuplicateKey(sessionFailure)
                                ? LoginResult.Status.SESSION_COLLISION
                                : isUnavailable(sessionFailure)
                                ? LoginResult.Status.UNAVAILABLE : LoginResult.Status.TECHNICAL_FAILURE);
                    }
                    connection.commit();
                    return new LoginResult(LoginResult.Status.ISSUED);
                } catch (SQLException | RuntimeException failure) {
                    rollbackQuietly(connection);
                    return new LoginResult(isUnavailable(failure)
                            ? LoginResult.Status.UNAVAILABLE : LoginResult.Status.TECHNICAL_FAILURE);
                }
            } catch (SQLException failure) {
                return new LoginResult(isUnavailable(failure)
                        ? LoginResult.Status.UNAVAILABLE : LoginResult.Status.TECHNICAL_FAILURE);
            }
        }
        return new LoginResult(LoginResult.Status.TECHNICAL_FAILURE);
    }

    @Override
    public SessionResolution resolveSession(String sessionDigest, Instant now) {
        if (blank(sessionDigest) || now == null) {
            return new SessionResolution(SessionResolution.Status.UNKNOWN, null);
        }
        String sql = "SELECT user_id, expires_at, revoked_at FROM auth_session_v1 WHERE session_digest = ?";
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, sessionDigest);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return new SessionResolution(SessionResolution.Status.UNKNOWN, null);
                String userId = result.getString("user_id");
                Instant expiresAt = result.getTimestamp("expires_at").toInstant();
                Timestamp revokedAtValue = result.getTimestamp("revoked_at");
                if (revokedAtValue != null) return new SessionResolution(SessionResolution.Status.REVOKED, null);
                if (!expiresAt.isAfter(now)) return new SessionResolution(SessionResolution.Status.EXPIRED, null);
                return new SessionResolution(SessionResolution.Status.ACTIVE, userId);
            }
        } catch (SQLException exception) {
            return new SessionResolution(isUnavailable(exception)
                    ? SessionResolution.Status.UNAVAILABLE
                    : SessionResolution.Status.TECHNICAL_FAILURE, null);
        }
    }

    @Override
    public SessionResolution resolveSession(Connection connection, String sessionDigest, Instant now) {
        if (connection == null || blank(sessionDigest) || now == null) {
            return new SessionResolution(SessionResolution.Status.UNKNOWN, null);
        }
        String sql = "SELECT user_id, expires_at, revoked_at FROM auth_session_v1 WHERE session_digest = ? FOR UPDATE";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, sessionDigest);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return new SessionResolution(SessionResolution.Status.UNKNOWN, null);
                String userId = result.getString("user_id");
                Timestamp expiresAtValue = result.getTimestamp("expires_at");
                Timestamp revokedAtValue = result.getTimestamp("revoked_at");
                if (userId == null || userId.isBlank() || expiresAtValue == null) {
                    return new SessionResolution(SessionResolution.Status.TECHNICAL_FAILURE, null);
                }
                if (revokedAtValue != null) return new SessionResolution(SessionResolution.Status.REVOKED, null);
                if (!expiresAtValue.toInstant().isAfter(now)) {
                    return new SessionResolution(SessionResolution.Status.EXPIRED, null);
                }
                return new SessionResolution(SessionResolution.Status.ACTIVE, userId);
            }
        } catch (SQLException exception) {
            return new SessionResolution(isUnavailable(exception)
                    ? SessionResolution.Status.UNAVAILABLE
                    : SessionResolution.Status.TECHNICAL_FAILURE, null);
        }
    }

    @Override
    public boolean supportsTransactionalSessionResolution() { return true; }

    @Override
    public RevokeResult revokeSession(String sessionDigest, Instant revokedAt) {
        if (blank(sessionDigest) || revokedAt == null) return new RevokeResult(RevokeResult.Status.UNKNOWN);
        String sql = "UPDATE auth_session_v1 SET revoked_at = ? WHERE session_digest = ? AND revoked_at IS NULL";
        try (Connection connection = dataSource.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setTimestamp(1, Timestamp.from(revokedAt));
            statement.setString(2, sessionDigest);
            int updated = statement.executeUpdate();
            return new RevokeResult(updated == 1 ? RevokeResult.Status.REVOKED : RevokeResult.Status.UNKNOWN);
        } catch (SQLException exception) {
            return new RevokeResult(isUnavailable(exception)
                    ? RevokeResult.Status.UNAVAILABLE
                    : RevokeResult.Status.TECHNICAL_FAILURE);
        }
    }

    private static String selectUserId(Connection connection, String namespace, String digest) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT user_id FROM auth_provider_identity_v1 WHERE provider_namespace = ? AND provider_subject_digest = ?")) {
            statement.setString(1, namespace);
            statement.setString(2, digest);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : null;
            }
        }
    }

    private static void insertIdentity(Connection connection, String namespace, String digest, String userId, Instant createdAt)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO auth_provider_identity_v1 "
                        + "(provider_namespace, provider_subject_digest, user_id, created_at) VALUES (?, ?, ?, ?)")) {
            statement.setString(1, namespace);
            statement.setString(2, digest);
            statement.setString(3, userId);
            statement.setTimestamp(4, Timestamp.from(createdAt));
            statement.executeUpdate();
        }
    }

    private static void insertSession(Connection connection, String userId, String digest,
                                      Instant issuedAt, Instant expiresAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO auth_session_v1 "
                        + "(session_digest, user_id, issued_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, NULL)")) {
            statement.setString(1, digest);
            statement.setString(2, userId);
            statement.setTimestamp(3, Timestamp.from(issuedAt));
            statement.setTimestamp(4, Timestamp.from(expiresAt));
            statement.executeUpdate();
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean isDuplicateKey(SQLException exception) {
        SQLException current = exception;
        while (current != null) {
            if ("23000".equals(current.getSQLState()) || current.getErrorCode() == 1062) return true;
            current = current.getNextException();
        }
        return false;
    }

    private static boolean isUnavailable(Throwable exception) {
        if (!(exception instanceof SQLException sql)) return false;
        String state = sql.getSQLState();
        return state != null && (state.startsWith("08") || "40001".equals(state));
    }

    private static void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // Stable failure mapping is the only observable result.
        }
    }
}
