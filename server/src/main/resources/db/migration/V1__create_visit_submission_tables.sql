CREATE TABLE institution_visit_v1 (
    visit_id VARCHAR(200) NOT NULL,
    user_id VARCHAR(200) NOT NULL,
    elder_id VARCHAR(200) NOT NULL,
    institution_id VARCHAR(200) NOT NULL,
    institution_record_revision VARCHAR(200) NOT NULL,
    visit_date VARCHAR(32) NOT NULL,
    visit_time_preference VARCHAR(128) NOT NULL,
    participant_count INT NOT NULL,
    pickup_requested BOOLEAN NULL,
    contact_name VARCHAR(200) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    phone_purpose VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    accepted_at TIMESTAMP(6) NOT NULL,
    notes VARCHAR(2000) NULL,
    PRIMARY KEY (visit_id),
    CONSTRAINT chk_institution_visit_status_requested CHECK (status = 'requested'),
    CONSTRAINT chk_institution_visit_phone_purpose CHECK (phone_purpose = 'appointment_or_consultant_contact')
) ENGINE = InnoDB;

CREATE TABLE appointment_idempotency_v1 (
    user_id VARCHAR(200) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    canonical_hash CHAR(64) NOT NULL,
    visit_id VARCHAR(200) NOT NULL,
    accepted_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (user_id, idempotency_key),
    CONSTRAINT fk_appointment_idempotency_visit
        FOREIGN KEY (visit_id) REFERENCES institution_visit_v1 (visit_id)
) ENGINE = InnoDB;

CREATE INDEX idx_institution_visit_owner ON institution_visit_v1 (user_id, accepted_at, visit_id);
