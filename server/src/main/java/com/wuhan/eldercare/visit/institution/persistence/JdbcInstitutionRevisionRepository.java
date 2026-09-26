package com.wuhan.eldercare.visit.institution.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishPackageV1;
import com.wuhan.eldercare.visit.institution.application.InstitutionPublishResult;
import com.wuhan.eldercare.visit.institution.application.InstitutionRevisionRepository;
import com.wuhan.eldercare.visit.institution.application.InstitutionSnapshotValidator;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Calendar;
import java.util.Optional;
import java.util.TimeZone;

/** MySQL-backed immutable revision store and explicit current-head repository. */
public final class JdbcInstitutionRevisionRepository implements InstitutionRevisionRepository {
    private static final long MAX_SAFE_REVISION = 9_007_199_254_740_991L;
    private static final String INSERT_REVISION_SEQUENCE_SQL = "INSERT IGNORE INTO institution_revision_sequence_v1 "
            + "(institution_id, next_revision) VALUES (?, 1)";
    private static final String LOCK_REVISION_SEQUENCE_SQL = "SELECT next_revision FROM institution_revision_sequence_v1 "
            + "WHERE institution_id = ? FOR UPDATE";
    private static final String UPDATE_REVISION_SEQUENCE_SQL = "UPDATE institution_revision_sequence_v1 "
            + "SET next_revision = ? WHERE institution_id = ?";
    private static final String LOCK_CURRENT_HEAD_SQL = "SELECT record_revision FROM institution_current_head_v1 "
            + "WHERE institution_id = ? FOR UPDATE";
    private static final String FIND_OPERATION_SQL = "SELECT institution_id, record_revision, snapshot_json, "
            + "contract_version, source_reference, operator_reference, published_at "
            + "FROM institution_record_revision_v1 WHERE operation_id = ?";
    private static final String INSERT_REVISION_SQL = "INSERT INTO institution_record_revision_v1 "
            + "(institution_id, record_revision, contract_version, snapshot_json, operation_id, source_reference, "
            + "operator_reference, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    private static final String UPSERT_CURRENT_HEAD_SQL = "INSERT INTO institution_current_head_v1 "
            + "(institution_id, record_revision, promoted_at) VALUES (?, ?, ?) "
            + "ON DUPLICATE KEY UPDATE record_revision = VALUES(record_revision), promoted_at = VALUES(promoted_at)";
    private static final String FIND_CURRENT_HEAD_SQL = "SELECT record_revision FROM institution_current_head_v1 "
            + "WHERE institution_id = ?";
    private static final String FIND_EXACT_REVISION_SQL = "SELECT snapshot_json FROM institution_record_revision_v1 "
            + "WHERE institution_id = ? AND record_revision = ?";
    private static final String FIND_CURRENT_APPOINTMENT_REVISION_SQL = "SELECT head.record_revision AS current_revision, "
            + "revision.snapshot_json FROM institution_current_head_v1 head LEFT JOIN institution_record_revision_v1 revision "
            + "ON revision.institution_id = head.institution_id AND revision.record_revision = ? "
            + "WHERE head.institution_id = ?";

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;
    private final InstitutionSnapshotValidator validator;

    public JdbcInstitutionRevisionRepository(DataSource dataSource, ObjectMapper objectMapper,
                                             InstitutionSnapshotValidator validator) {
        if (dataSource == null || objectMapper == null || validator == null) {
            throw new IllegalArgumentException("institution persistence dependencies required");
        }
        this.dataSource = dataSource;
        this.objectMapper = objectMapper;
        this.validator = validator;
    }

    @Override
    public InstitutionPublishResult publish(InstitutionPublishPackageV1 publishPackage, java.time.Instant publishedAt) {
        if (!isPublishable(publishPackage) || publishedAt == null) {
            return InstitutionPublishResult.of(InstitutionPublishResult.Status.INVALID_PACKAGE);
        }
        ObjectNode candidate = publishPackage.record();
        String institutionId = candidate.path("institutionId").asText();
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                Optional<StoredRevision> existingOperation = findByOperationId(
                        connection, publishPackage.operationId());
                if (existingOperation.isPresent()) {
                    InstitutionPublishResult replay = resolveReplay(existingOperation.get(), publishPackage);
                    connection.commit();
                    return replay;
                }

                long revision = allocateRevision(connection, institutionId);
                if (revision < 1 || revision > MAX_SAFE_REVISION) {
                    rollbackQuietly(connection);
                    return InstitutionPublishResult.of(InstitutionPublishResult.Status.TECHNICAL_FAILURE);
                }
                ObjectNode serverBound = bindServerIdentity(candidate, revision);
                InstitutionSnapshotValidator.ValidationResult validation = validator.validate(serverBound);
                if (validation == null || validation.status() == InstitutionSnapshotValidator.Status.TECHNICAL_FAILURE) {
                    rollbackQuietly(connection);
                    return InstitutionPublishResult.of(InstitutionPublishResult.Status.TECHNICAL_FAILURE);
                }
                if (validation.status() == InstitutionSnapshotValidator.Status.UNAVAILABLE) {
                    rollbackQuietly(connection);
                    return InstitutionPublishResult.of(InstitutionPublishResult.Status.VALIDATOR_UNAVAILABLE);
                }
                if (validation.status() != InstitutionSnapshotValidator.Status.VALID) {
                    rollbackQuietly(connection);
                    return InstitutionPublishResult.invalidRecord(validation.issues());
                }

                String contractVersion = serverBound.path("contractVersion").asText(null);
                String publicName = displayablePublicName(serverBound);
                if (contractVersion == null || publicName == null) {
                    rollbackQuietly(connection);
                    return InstitutionPublishResult.of(InstitutionPublishResult.Status.TECHNICAL_FAILURE);
                }
                String snapshotJson = objectMapper.writeValueAsString(serverBound);
                insertRevision(connection, publishPackage, institutionId, revision, contractVersion,
                        snapshotJson, publishedAt);
                promoteCurrentHead(connection, institutionId, revision, publishedAt);
                connection.commit();
                return InstitutionPublishResult.published(InstitutionPublishResult.Status.PUBLISHED,
                        institutionId, revision, publicName, publishedAt);
            } catch (SQLException failure) {
                rollbackQuietly(connection);
                if (isConstraintViolation(failure)) return resolveOperationAfterConstraint(publishPackage);
                return InstitutionPublishResult.of(isUnavailable(failure)
                        ? InstitutionPublishResult.Status.UNAVAILABLE
                        : InstitutionPublishResult.Status.TECHNICAL_FAILURE);
            } catch (RuntimeException | IOException failure) {
                rollbackQuietly(connection);
                return InstitutionPublishResult.of(InstitutionPublishResult.Status.TECHNICAL_FAILURE);
            }
        } catch (SQLException failure) {
            return InstitutionPublishResult.of(isUnavailable(failure)
                    ? InstitutionPublishResult.Status.UNAVAILABLE
                    : InstitutionPublishResult.Status.TECHNICAL_FAILURE);
        }
    }

    @Override
    public CurrentHeadResult currentHead(String institutionId) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(FIND_CURRENT_HEAD_SQL)) {
            statement.setString(1, institutionId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return CurrentHeadResult.unavailable();
                long revision = result.getLong("record_revision");
                if (revision < 1 || revision > MAX_SAFE_REVISION) return CurrentHeadResult.technicalFailure();
                return CurrentHeadResult.ready(institutionId, revision);
            }
        } catch (SQLException failure) {
            return isUnavailable(failure) ? CurrentHeadResult.unavailable() : CurrentHeadResult.technicalFailure();
        }
    }

    @Override
    public ExactPublicNameResult resolveExactPublicName(String institutionId, long recordRevision) {
        if (recordRevision < 1 || recordRevision > MAX_SAFE_REVISION) return ExactPublicNameResult.unavailable();
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(FIND_EXACT_REVISION_SQL)) {
            statement.setString(1, institutionId);
            statement.setLong(2, recordRevision);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return ExactPublicNameResult.unavailable();
                JsonNode snapshot = objectMapper.readTree(result.getString("snapshot_json"));
                if (snapshot == null
                        || !institutionId.equals(snapshot.path("institutionId").asText(null))
                        || !snapshot.path("recordRevision").canConvertToLong()
                        || snapshot.path("recordRevision").asLong() != recordRevision) {
                    return ExactPublicNameResult.technicalFailure();
                }
                NameProjection projection = projectPublicName(snapshot);
                if (projection.status() == NameProjection.Status.INVALID) return ExactPublicNameResult.technicalFailure();
                return ExactPublicNameResult.ready(institutionId, recordRevision, projection.name());
            }
        } catch (SQLException failure) {
            return isUnavailable(failure) ? ExactPublicNameResult.unavailable() : ExactPublicNameResult.technicalFailure();
        } catch (IOException | RuntimeException failure) {
            return ExactPublicNameResult.technicalFailure();
        }
    }

    @Override
    public CurrentAppointmentRevisionResult resolveCurrentAppointmentRevision(String institutionId, long requestedRevision) {
        if (institutionId == null || institutionId.isBlank() || requestedRevision < 1
                || requestedRevision > MAX_SAFE_REVISION) return CurrentAppointmentRevisionResult.unavailable();
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(FIND_CURRENT_APPOINTMENT_REVISION_SQL)) {
            statement.setLong(1, requestedRevision);
            statement.setString(2, institutionId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return CurrentAppointmentRevisionResult.notFound();
                long currentRevision = result.getLong("current_revision");
                if (result.wasNull() || currentRevision < 1 || currentRevision > MAX_SAFE_REVISION) {
                    return CurrentAppointmentRevisionResult.technicalFailure();
                }
                String snapshotJson = result.getString("snapshot_json");
                if (snapshotJson == null) return CurrentAppointmentRevisionResult.ready(
                        institutionId, currentRevision, false, null);
                JsonNode snapshot = objectMapper.readTree(snapshotJson);
                if (snapshot == null || !institutionId.equals(snapshot.path("institutionId").asText(null))
                        || !snapshot.path("recordRevision").canConvertToLong()
                        || snapshot.path("recordRevision").asLong() != requestedRevision) {
                    return CurrentAppointmentRevisionResult.technicalFailure();
                }
                JsonNode status = snapshot.get("recordStatus");
                return CurrentAppointmentRevisionResult.ready(institutionId, currentRevision, true,
                        status != null && status.isTextual() ? status.asText() : null);
            }
        } catch (SQLException failure) {
            return isUnavailable(failure)
                    ? CurrentAppointmentRevisionResult.unavailable()
                    : CurrentAppointmentRevisionResult.technicalFailure();
        } catch (IOException | RuntimeException failure) {
            return CurrentAppointmentRevisionResult.technicalFailure();
        }
    }

    private long allocateRevision(Connection connection, String institutionId) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(INSERT_REVISION_SEQUENCE_SQL)) {
            insert.setString(1, institutionId);
            insert.executeUpdate();
        }
        long nextRevision;
        try (PreparedStatement lockSequence = connection.prepareStatement(LOCK_REVISION_SEQUENCE_SQL)) {
            lockSequence.setString(1, institutionId);
            try (ResultSet result = lockSequence.executeQuery()) {
                if (!result.next()) throw new SQLException("institution revision sequence row missing");
                nextRevision = result.getLong("next_revision");
            }
        }
        if (nextRevision < 1 || nextRevision > MAX_SAFE_REVISION) return nextRevision;

        Optional<Long> head = findCurrentHeadForUpdate(connection, institutionId);
        if (head.isPresent() && nextRevision <= head.get()) {
            throw new SQLException("institution revision sequence is behind explicit current head");
        }
        try (PreparedStatement update = connection.prepareStatement(UPDATE_REVISION_SEQUENCE_SQL)) {
            update.setLong(1, nextRevision + 1);
            update.setString(2, institutionId);
            if (update.executeUpdate() != 1) throw new SQLException("institution revision sequence update failed");
        }
        return nextRevision;
    }

    private Optional<Long> findCurrentHeadForUpdate(Connection connection, String institutionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOCK_CURRENT_HEAD_SQL)) {
            statement.setString(1, institutionId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                long revision = result.getLong("record_revision");
                return revision < 1 || revision > MAX_SAFE_REVISION ? Optional.of(-1L) : Optional.of(revision);
            }
        }
    }

    private ObjectNode bindServerIdentity(ObjectNode candidate, long revision) {
        ObjectNode bound = candidate.deepCopy();
        bound.put("recordRevision", revision);
        bound.put("recordStatus", "published");
        JsonNode evidence = bound.get("evidence");
        if (evidence instanceof ArrayNode evidenceItems) {
            for (JsonNode item : evidenceItems) {
                if (item instanceof ObjectNode evidenceItem) evidenceItem.put("recordRevision", revision);
            }
        }
        return bound;
    }

    private InstitutionPublishResult resolveReplay(StoredRevision existing, InstitutionPublishPackageV1 request) {
        ObjectNode candidate = request.record();
        if (!existing.institutionId().equals(candidate.path("institutionId").asText(null))
                || !existing.sourceReference().equals(request.sourceReference())
                || !existing.operatorReference().equals(request.operatorReference())) {
            return InstitutionPublishResult.of(InstitutionPublishResult.Status.OPERATION_ID_CONFLICT);
        }
        ObjectNode expected = bindServerIdentity(candidate, existing.recordRevision());
        try {
            JsonNode stored = objectMapper.readTree(existing.snapshotJson());
            if (!stored.equals((left, right) -> {
                if (left.isNumber() && right.isNumber()) {
                    return left.decimalValue().compareTo(right.decimalValue());
                }
                return left.equals(right) ? 0 : 1;
            }, expected)) {
                return InstitutionPublishResult.of(InstitutionPublishResult.Status.OPERATION_ID_CONFLICT);
            }
            NameProjection projection = projectPublicName(stored);
            return projection.status() == NameProjection.Status.INVALID
                    ? InstitutionPublishResult.of(InstitutionPublishResult.Status.TECHNICAL_FAILURE)
                    : InstitutionPublishResult.published(InstitutionPublishResult.Status.REPLAYED,
                            existing.institutionId(), existing.recordRevision(), projection.name(), existing.publishedAt());
        } catch (IOException failure) {
            return InstitutionPublishResult.of(InstitutionPublishResult.Status.TECHNICAL_FAILURE);
        }
    }

    private void insertRevision(Connection connection, InstitutionPublishPackageV1 request, String institutionId,
                                long revision, String contractVersion, String snapshotJson,
                                java.time.Instant publishedAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_REVISION_SQL)) {
            statement.setString(1, institutionId);
            statement.setLong(2, revision);
            statement.setString(3, contractVersion);
            statement.setString(4, snapshotJson);
            statement.setString(5, request.operationId());
            statement.setString(6, request.sourceReference());
            statement.setString(7, request.operatorReference());
            statement.setTimestamp(8, Timestamp.from(publishedAt), utcCalendar());
            statement.executeUpdate();
        }
    }

    private static void promoteCurrentHead(Connection connection, String institutionId, long revision,
                                           java.time.Instant publishedAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(UPSERT_CURRENT_HEAD_SQL)) {
            statement.setString(1, institutionId);
            statement.setLong(2, revision);
            statement.setTimestamp(3, Timestamp.from(publishedAt), utcCalendar());
            statement.executeUpdate();
        }
    }

    private Optional<StoredRevision> findByOperationId(Connection connection, String operationId)
            throws SQLException, IOException {
        try (PreparedStatement statement = connection.prepareStatement(FIND_OPERATION_SQL)) {
            statement.setString(1, operationId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                Timestamp publishedAt = result.getTimestamp("published_at", utcCalendar());
                return Optional.of(new StoredRevision(
                        result.getString("institution_id"),
                        result.getLong("record_revision"),
                        result.getString("snapshot_json"),
                        result.getString("contract_version"),
                        result.getString("source_reference"),
                        result.getString("operator_reference"),
                        publishedAt == null ? null : publishedAt.toInstant()));
            }
        }
    }

    private InstitutionPublishResult resolveOperationAfterConstraint(InstitutionPublishPackageV1 request) {
        try (Connection connection = dataSource.getConnection()) {
            Optional<StoredRevision> existing = findByOperationId(connection, request.operationId());
            if (existing.isEmpty()) return InstitutionPublishResult.of(InstitutionPublishResult.Status.TECHNICAL_FAILURE);
            return resolveReplay(existing.get(), request);
        } catch (SQLException failure) {
            return InstitutionPublishResult.of(isUnavailable(failure)
                    ? InstitutionPublishResult.Status.UNAVAILABLE
                    : InstitutionPublishResult.Status.TECHNICAL_FAILURE);
        } catch (IOException failure) {
            return InstitutionPublishResult.of(InstitutionPublishResult.Status.TECHNICAL_FAILURE);
        }
    }

    private boolean isPublishable(InstitutionPublishPackageV1 request) {
        if (request == null || request.record() == null) return false;
        ObjectNode record = request.record();
        return request.operationId() != null && request.operationId().length() <= 120
                && request.sourceReference() != null && request.sourceReference().length() <= 1000
                && request.operatorReference() != null && request.operatorReference().length() <= 120
                && "institution-contract-v1.2.1".equals(record.path("contractVersion").asText(null))
                && "PRODUCTION_CANDIDATE".equals(record.path("recordProvenance").asText(null))
                && record.path("institutionId").isTextual()
                && !record.path("institutionId").asText().isBlank()
                && record.path("institutionId").asText().length() <= 200;
    }

    private static String displayablePublicName(JsonNode snapshot) {
        NameProjection projection = projectPublicName(snapshot);
        return projection.status() == NameProjection.Status.READY ? projection.name() : null;
    }

    private static NameProjection projectPublicName(JsonNode snapshot) {
        JsonNode nameField = snapshot.path("identity").path("name");
        if (!nameField.isObject() || !nameField.path("availability").isTextual()) {
            return NameProjection.invalid();
        }
        String availability = nameField.path("availability").asText();
        JsonNode value = nameField.get("value");
        if (!"provided".equals(availability) || value == null || !value.isTextual()) {
            return NameProjection.invalid();
        }
        String publicName = value.asText();
        return publicName.isBlank() ? NameProjection.invalid() : NameProjection.ready(publicName);
    }

    private static boolean isConstraintViolation(SQLException failure) {
        for (SQLException current = failure; current != null; current = current.getNextException()) {
            if ("23000".equals(current.getSQLState())) return true;
        }
        return false;
    }

    private static boolean isUnavailable(SQLException failure) {
        for (SQLException current = failure; current != null; current = current.getNextException()) {
            String state = current.getSQLState();
            if (state != null && state.startsWith("08")) return true;
        }
        return false;
    }

    private static Calendar utcCalendar() {
        return Calendar.getInstance(TimeZone.getTimeZone("UTC"));
    }

    private static void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // Preserve the original publish outcome.
        }
    }

    private record StoredRevision(String institutionId, long recordRevision, String snapshotJson,
                                  String contractVersion, String sourceReference, String operatorReference,
                                  java.time.Instant publishedAt) { }

    private record NameProjection(Status status, String name) {
        private static NameProjection ready(String name) { return new NameProjection(Status.READY, name); }
        private static NameProjection invalid() { return new NameProjection(Status.INVALID, null); }

        private enum Status { READY, INVALID }
    }
}
