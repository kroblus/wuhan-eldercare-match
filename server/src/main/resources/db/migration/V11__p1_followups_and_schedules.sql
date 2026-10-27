-- Additive upgrade: preserve V10 requests and immutable intake/cancellation events.
ALTER TABLE p1_service_request_v1 DROP CHECK ck_p1_status;
ALTER TABLE p1_service_request_v1 DROP CHECK ck_p1_no_confirmed_schedule;
ALTER TABLE p1_service_request_v1 ADD workflow_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_CONTACT';
UPDATE p1_service_request_v1 SET workflow_status=request_status;
ALTER TABLE p1_service_request_v1 ADD CONSTRAINT ck_p1_status CHECK
 (request_status IN ('PENDING_CONTACT','FOLLOWING_UP','PENDING_ARRANGEMENT','CONFIRMED','VISITED','NO_SHOW','CLOSED','CANCELLED'));

-- One small dataset mutex, deliberately serializing P1 scheduling at this single-admin scale.
-- Lock it BEFORE request/session rows. It exists even when the calendar is empty.
CREATE TABLE p1_operations_mutex_v1 (dataset_mode VARCHAR(32) PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO p1_operations_mutex_v1 VALUES ('SYNTHETIC_TEST_ONLY'),('PRODUCTION');

CREATE TABLE p1_operation_event_v1 (
 operation_id CHAR(36) PRIMARY KEY,
 request_id CHAR(36) NOT NULL,
 event_type VARCHAR(32) NOT NULL,
 payload_digest CHAR(64) NOT NULL,
 payload_json JSON NOT NULL,
 actor_username VARCHAR(80) NOT NULL,
 occurred_at DATETIME(6) NOT NULL,
 FOREIGN KEY (request_id) REFERENCES p1_service_request_v1(request_id),
 INDEX idx_p1_operation_request (request_id,occurred_at),
 INDEX idx_p1_operation_period (occurred_at,event_type)
) ENGINE=InnoDB;

CREATE TABLE p1_visit_v1 (
 visit_id CHAR(36) PRIMARY KEY,
 request_id CHAR(36) NOT NULL,
 dataset_mode VARCHAR(32) NOT NULL,
 institution_id VARCHAR(100) NOT NULL,
 staff_id VARCHAR(80) NOT NULL,
 subject_key VARCHAR(200) NOT NULL,
 visit_status VARCHAR(16) NOT NULL,
 revision INT NOT NULL,
 starts_at DATETIME(6) NOT NULL,
 ends_at DATETIME(6) NOT NULL,
 buffer_before INT NOT NULL,
 buffer_after INT NOT NULL,
 family_confirmed BOOLEAN NOT NULL,
 institution_confirmed BOOLEAN NOT NULL,
 meeting_note VARCHAR(300) NOT NULL,
 actual_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL,
 updated_at DATETIME(6) NOT NULL,
 FOREIGN KEY (request_id) REFERENCES p1_service_request_v1(request_id),
 CONSTRAINT ck_p1_visit_status CHECK (visit_status IN ('DRAFT','CONFIRMED','CANCELLED','ARRIVED','NO_SHOW')),
 CONSTRAINT ck_p1_visit_times CHECK (starts_at < ends_at AND buffer_before BETWEEN 0 AND 240 AND buffer_after BETWEEN 0 AND 240),
 CONSTRAINT ck_p1_visit_confirm CHECK (visit_status <> 'CONFIRMED' OR (family_confirmed=1 AND institution_confirmed=1)),
 INDEX idx_p1_visit_request (request_id),
 INDEX idx_p1_visit_period (dataset_mode,starts_at,ends_at)
) ENGINE=InnoDB;

CREATE TABLE p1_staff_block_v1 (
 block_id CHAR(36) PRIMARY KEY,
 dataset_mode VARCHAR(32) NOT NULL,
 staff_id VARCHAR(80) NOT NULL,
 starts_at DATETIME(6) NOT NULL,
 ends_at DATETIME(6) NOT NULL,
 created_at DATETIME(6) NOT NULL,
 CONSTRAINT ck_p1_block_times CHECK (starts_at < ends_at)
) ENGINE=InnoDB;
CREATE TABLE p1_institution_capacity_v1 (
 dataset_mode VARCHAR(32) NOT NULL,
 institution_id VARCHAR(100) NOT NULL,
 capacity INT NOT NULL,
 PRIMARY KEY (dataset_mode,institution_id),
 CONSTRAINT ck_p1_capacity CHECK (capacity BETWEEN 1 AND 100)
) ENGINE=InnoDB;

CREATE TABLE p1_report_snapshot_v1 (
 snapshot_id CHAR(36) PRIMARY KEY,
 dataset_mode VARCHAR(32) NOT NULL,
 admin_username VARCHAR(80) NOT NULL,
 scope_json JSON NOT NULL,
 report_json JSON NOT NULL,
 generated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE p1_report_export_v1 (
 export_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 snapshot_id CHAR(36) NOT NULL,
 admin_username VARCHAR(80) NOT NULL,
 exported_at DATETIME(6) NOT NULL,
 FOREIGN KEY (snapshot_id) REFERENCES p1_report_snapshot_v1(snapshot_id)
) ENGINE=InnoDB;
