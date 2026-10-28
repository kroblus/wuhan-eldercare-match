-- Public content workflow is independent from service intake and care eligibility.
CREATE TABLE institution_publication_draft_v1 (
 dataset_mode VARCHAR(32) NOT NULL,
 institution_id VARCHAR(100) NOT NULL,
 draft_revision BIGINT NOT NULL,
 base_record_revision BIGINT NOT NULL,
 workflow_status VARCHAR(16) NOT NULL,
 record_json JSON NOT NULL,
 public_profile_json JSON NULL,
 content_digest CHAR(64) NOT NULL,
 confirmed_digest CHAR(64) NULL,
 source_reference VARCHAR(1000) NULL,
 confirmed_by VARCHAR(80) NULL,
 confirmed_on DATE NULL,
 confirmed_at DATETIME(6) NULL,
 confirmed_actor VARCHAR(80) NULL,
 published_record_revision BIGINT NULL,
 updated_at DATETIME(6) NOT NULL,
 updated_by VARCHAR(80) NOT NULL,
 PRIMARY KEY(dataset_mode,institution_id),
 CONSTRAINT ck_institution_draft_status CHECK (workflow_status IN ('DRAFT','CONFIRMED','PUBLISHED')),
 CONSTRAINT ck_institution_draft_revision CHECK (draft_revision > 0 AND base_record_revision >= 0)
) ENGINE=InnoDB;

CREATE TABLE institution_publication_v1 (
 institution_id VARCHAR(100) NOT NULL,
 record_revision BIGINT NOT NULL,
 dataset_mode VARCHAR(32) NOT NULL,
 operation_id CHAR(36) NOT NULL,
 request_digest CHAR(64) NOT NULL,
 draft_revision BIGINT NOT NULL,
 content_digest CHAR(64) NOT NULL,
 public_profile_json JSON NULL,
 source_reference VARCHAR(1000) NOT NULL,
 confirmed_by VARCHAR(80) NOT NULL,
 confirmed_on DATE NOT NULL,
 confirmed_at DATETIME(6) NOT NULL,
 confirmed_actor VARCHAR(80) NOT NULL,
 published_at DATETIME(6) NOT NULL,
 published_by VARCHAR(80) NOT NULL,
 PRIMARY KEY(institution_id,record_revision),
 UNIQUE KEY uq_institution_publication_operation(operation_id),
 FOREIGN KEY(institution_id,record_revision) REFERENCES institution_record_revision_v1(institution_id,record_revision)
) ENGINE=InnoDB;
CREATE TRIGGER trg_institution_publication_no_update BEFORE UPDATE ON institution_publication_v1 FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='published institution content is immutable';
CREATE TRIGGER trg_institution_publication_no_delete BEFORE DELETE ON institution_publication_v1 FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='published institution content is retained';
CREATE TABLE institution_baseline_import_v1 (
 operation_id CHAR(36) NOT NULL PRIMARY KEY,
 dataset_mode VARCHAR(32) NOT NULL,
 request_digest CHAR(64) NOT NULL,
 imported_count INT NOT NULL,
 actor_username VARCHAR(80) NOT NULL,
 imported_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE institution_publication_scope_v1 (
 institution_id VARCHAR(100) NOT NULL,
 record_revision BIGINT NOT NULL,
 dataset_mode VARCHAR(32) NOT NULL,
 publication_source VARCHAR(24) NOT NULL,
 PRIMARY KEY(institution_id,record_revision),
 FOREIGN KEY(institution_id,record_revision) REFERENCES institution_record_revision_v1(institution_id,record_revision)
) ENGINE=InnoDB;
CREATE TRIGGER trg_institution_publication_scope_no_update BEFORE UPDATE ON institution_publication_scope_v1 FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='publication environment binding is immutable';
CREATE TRIGGER trg_institution_publication_scope_no_delete BEFORE DELETE ON institution_publication_scope_v1 FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='publication environment binding is retained';

CREATE TABLE p1_institution_access_v1 (
 dataset_mode VARCHAR(32) NOT NULL,
 institution_id VARCHAR(100) NOT NULL,
 public_name VARCHAR(200) NOT NULL,
 enabled BOOLEAN NOT NULL,
 access_revision BIGINT NOT NULL,
 source_reference VARCHAR(1000) NOT NULL,
 updated_at DATETIME(6) NOT NULL,
 updated_by VARCHAR(80) NOT NULL,
 PRIMARY KEY(dataset_mode,institution_id)
) ENGINE=InnoDB;
-- Preserve the pre-existing P1 allowlist. This is migration provenance, not a new human fact confirmation.
INSERT INTO p1_institution_access_v1 VALUES
 ('PRODUCTION','ningyue-yiyang-center','柠月颐养中心',TRUE,1,'legacy-p1-allowlist',UTC_TIMESTAMP(6),'legacy-migration'),
 ('SYNTHETIC_TEST_ONLY','ningyue-yiyang-center','柠月颐养中心',TRUE,1,'legacy-p1-allowlist',UTC_TIMESTAMP(6),'legacy-migration'),
 ('SYNTHETIC_TEST_ONLY','synthetic-reception-b','合成接待点 B（虚构）',TRUE,1,'legacy-synthetic-allowlist',UTC_TIMESTAMP(6),'legacy-migration');
CREATE TABLE p1_institution_access_event_v1 (
 operation_id CHAR(36) NOT NULL PRIMARY KEY,
 dataset_mode VARCHAR(32) NOT NULL,
 institution_id VARCHAR(100) NOT NULL,
 request_digest CHAR(64) NOT NULL,
 result_json JSON NOT NULL,
 actor_username VARCHAR(80) NOT NULL,
 occurred_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
CREATE TRIGGER trg_p1_institution_access_event_no_update BEFORE UPDATE ON p1_institution_access_event_v1 FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='institution access audit is immutable';
CREATE TRIGGER trg_p1_institution_access_event_no_delete BEFORE DELETE ON p1_institution_access_event_v1 FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='institution access audit is retained';

ALTER TABLE p1_service_request_v1 ADD institution_name_snapshot VARCHAR(200) NULL;
ALTER TABLE p1_visit_v1 ADD institution_name_snapshot VARCHAR(200) NULL;
-- These names reproduce the old UI mapping; original input/event JSON is untouched.
UPDATE p1_service_request_v1 SET institution_name_snapshot='柠月颐养中心' WHERE institution_id='ningyue-yiyang-center';
UPDATE p1_visit_v1 SET institution_name_snapshot='柠月颐养中心' WHERE institution_id='ningyue-yiyang-center';
UPDATE p1_visit_v1 SET institution_name_snapshot='合成接待点 B（虚构）' WHERE institution_id='synthetic-reception-b' AND dataset_mode='SYNTHETIC_TEST_ONLY';
