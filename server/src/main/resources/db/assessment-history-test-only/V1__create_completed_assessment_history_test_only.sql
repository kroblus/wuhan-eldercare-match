-- Isolated proposal store. NOT part of the default/production migration chain.
CREATE TABLE completed_assessment_history_test_only_v1 (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owner_user_id VARCHAR(200) NOT NULL,
    elder_id VARCHAR(200) NOT NULL,
    idempotency_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    completed_at TIMESTAMP(6) NOT NULL,
    schema_version INT NOT NULL,
    assessment_contract_version VARCHAR(80) NOT NULL,
    source VARCHAR(100) NOT NULL,
    snapshot_revision INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    snapshot JSON NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_history_test_only_owner_key UNIQUE (owner_user_id,idempotency_key),
    CONSTRAINT fk_history_test_only_owner FOREIGN KEY (owner_user_id) REFERENCES auth_provider_identity_v1(user_id),
    CONSTRAINT fk_history_test_only_elder FOREIGN KEY (elder_id) REFERENCES elder_record_v1(elder_id),
    CONSTRAINT chk_history_test_only_version CHECK (schema_version=2 AND snapshot_revision=1
        AND assessment_contract_version='assessment-schema-v2'),
    CONSTRAINT chk_history_test_only_source CHECK (source='COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1' AND status='completed'),
    CONSTRAINT chk_history_test_only_snapshot CHECK (JSON_TYPE(snapshot)='OBJECT'
        AND JSON_CONTAINS_PATH(snapshot,'all','$.kind','$.id','$.elderId','$.status','$.schemaVersion','$.answers','$.completedAt')=1
        AND JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.kind'))='completed_assessment'
        AND JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.id'))=id
        AND JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.elderId'))=elder_id
        AND JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.status'))='completed'
        AND JSON_EXTRACT(snapshot,'$.schemaVersion')=2
        AND JSON_TYPE(JSON_EXTRACT(snapshot,'$.answers'))='OBJECT'),
    INDEX idx_history_test_only_owner_order (owner_user_id,elder_id,completed_at DESC,id DESC)
) ENGINE=InnoDB;
CREATE TRIGGER history_test_only_no_update BEFORE UPDATE ON completed_assessment_history_test_only_v1
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable history';
CREATE TRIGGER history_test_only_no_delete BEFORE DELETE ON completed_assessment_history_test_only_v1
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable history';
