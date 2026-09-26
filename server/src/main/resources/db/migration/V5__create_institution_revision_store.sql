CREATE TABLE institution_revision_sequence_v1 (
    institution_id VARCHAR(200) NOT NULL,
    next_revision BIGINT NOT NULL,
    PRIMARY KEY (institution_id),
    CONSTRAINT chk_institution_revision_sequence_positive
        CHECK (next_revision BETWEEN 1 AND 9007199254740992)
) ENGINE = InnoDB;

CREATE TABLE institution_record_revision_v1 (
    institution_id VARCHAR(200) NOT NULL,
    record_revision BIGINT NOT NULL,
    contract_version VARCHAR(64) NOT NULL,
    snapshot_json JSON NOT NULL,
    operation_id VARCHAR(120) NOT NULL,
    source_reference VARCHAR(1000) NOT NULL,
    operator_reference VARCHAR(120) NOT NULL,
    published_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (institution_id, record_revision),
    CONSTRAINT uq_institution_revision_operation UNIQUE (operation_id),
    CONSTRAINT chk_institution_record_revision_positive
        CHECK (record_revision BETWEEN 1 AND 9007199254740991)
) ENGINE = InnoDB;

CREATE TABLE institution_current_head_v1 (
    institution_id VARCHAR(200) NOT NULL,
    record_revision BIGINT NOT NULL,
    promoted_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (institution_id),
    CONSTRAINT fk_institution_current_head_revision
        FOREIGN KEY (institution_id, record_revision)
        REFERENCES institution_record_revision_v1 (institution_id, record_revision)
        ON DELETE RESTRICT,
    CONSTRAINT chk_institution_current_head_revision_positive
        CHECK (record_revision BETWEEN 1 AND 9007199254740991)
) ENGINE = InnoDB;

CREATE TRIGGER trg_institution_record_revision_no_update
BEFORE UPDATE ON institution_record_revision_v1
FOR EACH ROW
SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'published institution revisions are immutable';

CREATE TRIGGER trg_institution_record_revision_no_delete
BEFORE DELETE ON institution_record_revision_v1
FOR EACH ROW
SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'published institution revisions are retained';
