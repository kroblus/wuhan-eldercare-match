-- P1 intake is independent from CompletedAssessment and formal C2 history.
CREATE TABLE p1_service_request_v1 (
    request_id CHAR(36) NOT NULL PRIMARY KEY,
    owner_user_id VARCHAR(200) NOT NULL,
    input_digest CHAR(64) NOT NULL,
    input_json JSON NOT NULL,
    request_kind VARCHAR(24) NOT NULL,
    institution_id VARCHAR(100) NULL,
    request_status VARCHAR(32) NOT NULL,
    dataset_mode VARCHAR(32) NOT NULL,
    request_source VARCHAR(32) NOT NULL,
    assigned_to VARCHAR(100) NULL,
    scheduled_start DATETIME(6) NULL,
    scheduled_end DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT ck_p1_kind CHECK (request_kind IN ('CONSULTATION', 'VISIT_INTENT')),
    CONSTRAINT ck_p1_status CHECK (request_status IN ('PENDING_CONTACT', 'PENDING_ARRANGEMENT', 'CANCELLED')),
    CONSTRAINT ck_p1_dataset CHECK (dataset_mode IN ('PRODUCTION', 'SYNTHETIC_TEST_ONLY')),
    CONSTRAINT ck_p1_no_confirmed_schedule CHECK (scheduled_start IS NULL AND scheduled_end IS NULL)
) ENGINE=InnoDB;
CREATE INDEX idx_p1_request_owner ON p1_service_request_v1(owner_user_id, dataset_mode, created_at);
CREATE INDEX idx_p1_request_admin ON p1_service_request_v1(dataset_mode, request_status, created_at);

CREATE TABLE p1_service_event_v1 (
    request_id CHAR(36) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    actor_user_id VARCHAR(200) NOT NULL,
    PRIMARY KEY(request_id, event_type),
    CONSTRAINT fk_p1_event_request FOREIGN KEY(request_id) REFERENCES p1_service_request_v1(request_id),
    CONSTRAINT ck_p1_event_type CHECK (event_type IN ('REQUEST_SUBMITTED', 'REQUEST_CANCELLED'))
) ENGINE=InnoDB;

CREATE TABLE p1_admin_session_v1 (
    session_digest CHAR(64) NOT NULL PRIMARY KEY,
    csrf_digest CHAR(64) NOT NULL,
    admin_username VARCHAR(80) NOT NULL,
    issued_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL
) ENGINE=InnoDB;
