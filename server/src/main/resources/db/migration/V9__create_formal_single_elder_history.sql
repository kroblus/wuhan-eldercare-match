-- Formal C2 storage. No dependency on or promotion of TEST_ONLY History tables.
CREATE TABLE c2_history_consent_v1 (
    consent_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    owner_id VARCHAR(200) NOT NULL,
    elder_id VARCHAR(200) NOT NULL,
    notice_version VARCHAR(120) NOT NULL,
    notice_json JSON NOT NULL,
    accepted_at TIMESTAMP(6) NOT NULL,
    revoked_at TIMESTAMP(6) NULL,
    UNIQUE KEY uq_c2_consent (owner_id, elder_id, notice_version),
    FOREIGN KEY (owner_id) REFERENCES auth_provider_identity_v1(user_id),
    FOREIGN KEY (elder_id) REFERENCES elder_record_v1(elder_id)
) ENGINE=InnoDB;

CREATE TABLE c2_history_intent_v1 (
    owner_id VARCHAR(200) NOT NULL,
    elder_id VARCHAR(200) NOT NULL,
    intent_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    consent_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    result_version VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_binding VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    answers_json JSON NOT NULL,
    snapshot_json JSON NOT NULL,
    source_json JSON NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    record_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    PRIMARY KEY(owner_id, intent_id),
    UNIQUE KEY uq_c2_result_version (result_version),
    UNIQUE KEY uq_c2_intent_record (record_id),
    FOREIGN KEY (consent_id) REFERENCES c2_history_consent_v1(consent_id),
    FOREIGN KEY (owner_id) REFERENCES auth_provider_identity_v1(user_id),
    FOREIGN KEY (elder_id) REFERENCES elder_record_v1(elder_id)
) ENGINE=InnoDB;

CREATE TABLE c2_history_record_v1 (
    record_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    owner_id VARCHAR(200) NOT NULL,
    elder_id VARCHAR(200) NOT NULL,
    intent_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    saved_at TIMESTAMP(6) NOT NULL,
    result_state VARCHAR(40) NOT NULL,
    snapshot_version INT NOT NULL,
    snapshot_json JSON NOT NULL,
    UNIQUE KEY uq_c2_record_intent (owner_id, intent_id),
    INDEX idx_c2_history_owner (owner_id, elder_id, saved_at, record_id),
    FOREIGN KEY(owner_id, intent_id) REFERENCES c2_history_intent_v1(owner_id, intent_id),
    CHECK(result_state IN ('LEGACY_V2_DISPLAY', 'INITIAL_REFERENCE_ONLY', 'NO_PERSONALIZED_CANDIDATE'))
) ENGINE=InnoDB;

ALTER TABLE c2_history_intent_v1 ADD CONSTRAINT fk_c2_intent_receipt
    FOREIGN KEY(record_id) REFERENCES c2_history_record_v1(record_id);

CREATE TRIGGER trg_c2_record_immutable BEFORE UPDATE ON c2_history_record_v1 FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'C2 historical snapshots are immutable';
-- Rights erasure requires a separately approved operational path; no public deletion endpoint.
CREATE TRIGGER trg_c2_intent_immutable BEFORE UPDATE ON c2_history_intent_v1 FOR EACH ROW
BEGIN
    IF NOT (OLD.owner_id <=> NEW.owner_id) OR NOT (OLD.elder_id <=> NEW.elder_id)
       OR NOT (OLD.intent_id <=> NEW.intent_id) OR NOT (OLD.consent_id <=> NEW.consent_id)
       OR NOT (OLD.result_version <=> NEW.result_version) OR NOT (OLD.display_binding <=> NEW.display_binding)
       OR NOT (OLD.answers_json <=> NEW.answers_json) OR NOT (OLD.snapshot_json <=> NEW.snapshot_json)
       OR NOT (OLD.source_json <=> NEW.source_json) OR NOT (OLD.created_at <=> NEW.created_at)
       OR NOT (OLD.expires_at <=> NEW.expires_at) OR OLD.record_id IS NOT NULL OR NEW.record_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'C2 save intent is immutable except first receipt';
    END IF;
END;
