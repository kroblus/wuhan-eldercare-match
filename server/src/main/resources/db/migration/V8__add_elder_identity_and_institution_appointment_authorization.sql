CREATE TABLE elder_record_v1 (
    elder_id VARCHAR(200) NOT NULL,
    responsible_user_id VARCHAR(200) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (elder_id),
    CONSTRAINT uq_elder_record_responsible_user UNIQUE (responsible_user_id),
    CONSTRAINT fk_elder_record_c5_user
        FOREIGN KEY (responsible_user_id) REFERENCES auth_provider_identity_v1 (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_elder_record_ids_nonblank CHECK (
        CHAR_LENGTH(TRIM(elder_id)) > 0 AND CHAR_LENGTH(TRIM(responsible_user_id)) > 0
    )
) ENGINE = InnoDB;

CREATE TABLE institution_appointment_authorization_event_v1 (
    authorization_sequence BIGINT NOT NULL AUTO_INCREMENT,
    operation_id VARCHAR(120) NOT NULL,
    institution_id VARCHAR(200) NOT NULL,
    record_revision BIGINT NOT NULL,
    authorization_state VARCHAR(16) NOT NULL,
    provenance_reference VARCHAR(1000) NOT NULL,
    operator_reference VARCHAR(120) NOT NULL,
    recorded_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (authorization_sequence),
    CONSTRAINT uq_institution_appointment_auth_operation UNIQUE (operation_id),
    CONSTRAINT fk_institution_appointment_auth_revision
        FOREIGN KEY (institution_id, record_revision)
        REFERENCES institution_record_revision_v1 (institution_id, record_revision)
        ON DELETE RESTRICT,
    CONSTRAINT chk_institution_appointment_auth_state CHECK (
        authorization_state IN ('AUTHORIZED', 'REVOKED')
    ),
    CONSTRAINT chk_institution_appointment_auth_revision CHECK (
        record_revision BETWEEN 1 AND 9007199254740991
    ),
    CONSTRAINT chk_institution_appointment_auth_refs_nonblank CHECK (
        CHAR_LENGTH(TRIM(operation_id)) > 0
        AND CHAR_LENGTH(TRIM(provenance_reference)) > 0
        AND CHAR_LENGTH(TRIM(operator_reference)) > 0
    ),
    INDEX idx_institution_appointment_auth_latest (
        institution_id, record_revision, authorization_sequence
    )
) ENGINE = InnoDB;

CREATE TRIGGER trg_institution_appointment_auth_no_update
BEFORE UPDATE ON institution_appointment_authorization_event_v1
FOR EACH ROW
SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'appointment authorization events are append-only';

CREATE TRIGGER trg_institution_appointment_auth_no_delete
BEFORE DELETE ON institution_appointment_authorization_event_v1
FOR EACH ROW
SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'appointment authorization events are retained';
