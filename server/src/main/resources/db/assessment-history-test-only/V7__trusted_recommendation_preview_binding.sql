-- Additive TEST_ONLY trusted Preview candidates; never included in the default or production migration chain.
-- Candidate payloads contain only explicitly submitted synthetic TEST_ONLY assessment input and allowlisted displays.
CREATE UNIQUE INDEX uq_history_save_scope_binding ON history_save_scope_test_only_v1 (scope_id,owner_user_id,elder_id);
CREATE UNIQUE INDEX uq_history_session_scope_binding ON history_assessment_session_test_only_v1 (session_id,scope_id);
CREATE TABLE history_trusted_preview_test_only_v1 (
    preview_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    scope_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owner_user_id VARCHAR(200) NOT NULL,
    elder_id VARCHAR(200) NOT NULL,
    environment_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_binding VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    assessment_answers JSON NOT NULL,
    profile_display JSON NOT NULL,
    recommendation_display JSON NOT NULL,
    state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    intent_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    completion_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    active_session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin
        GENERATED ALWAYS AS (CASE WHEN state='ACTIVE' THEN session_id ELSE NULL END) STORED,
    PRIMARY KEY (preview_id),
    UNIQUE KEY uq_history_trusted_preview_active_session (active_session_id),
    UNIQUE KEY uq_history_trusted_preview_intent (intent_id),
    UNIQUE KEY uq_history_trusted_preview_completion (completion_id),
    KEY idx_history_trusted_preview_owner_created (owner_user_id,created_at),
    CONSTRAINT fk_history_trusted_preview_scope_owner_elder FOREIGN KEY (scope_id,owner_user_id,elder_id)
        REFERENCES history_save_scope_test_only_v1(scope_id,owner_user_id,elder_id) ON DELETE RESTRICT,
    CONSTRAINT fk_history_trusted_preview_session_scope FOREIGN KEY (session_id,scope_id)
        REFERENCES history_assessment_session_test_only_v1(session_id,scope_id) ON DELETE RESTRICT,
    CONSTRAINT fk_history_trusted_preview_intent FOREIGN KEY (intent_id)
        REFERENCES history_save_intent_test_only_v1(intent_id) ON DELETE RESTRICT,
    CONSTRAINT fk_history_trusted_preview_completion FOREIGN KEY (completion_id)
        REFERENCES completed_assessment_history_test_only_v1(id) ON DELETE RESTRICT,
    CONSTRAINT chk_history_trusted_preview_times CHECK (expires_at > created_at),
    CONSTRAINT chk_history_trusted_preview_state CHECK (
        (state='ACTIVE' AND intent_id IS NULL AND completion_id IS NULL)
        OR (state='REVOKED' AND intent_id IS NULL AND completion_id IS NULL)
        OR (state='BOUND' AND intent_id IS NOT NULL AND completion_id IS NULL)
        OR (state='CONSUMED' AND intent_id IS NOT NULL AND completion_id IS NOT NULL)),
    CONSTRAINT chk_history_trusted_preview_content CHECK (
        JSON_TYPE(assessment_answers)='OBJECT'
        AND JSON_UNQUOTE(JSON_EXTRACT(profile_display,'$.kind'))='historical_profile_display_v1'
        AND JSON_UNQUOTE(JSON_EXTRACT(profile_display,'$.assessmentId'))=preview_id
        AND JSON_UNQUOTE(JSON_EXTRACT(recommendation_display,'$.kind'))='historical_recommendation_display_v1'
        AND JSON_UNQUOTE(JSON_EXTRACT(recommendation_display,'$.assessmentId'))=preview_id
        AND JSON_UNQUOTE(JSON_EXTRACT(profile_display,'$.assessmentCompletedAt')) IS NOT NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(recommendation_display,'$.assessmentCompletedAt')) IS NOT NULL)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER history_trusted_preview_update_guard BEFORE UPDATE ON history_trusted_preview_test_only_v1 FOR EACH ROW
BEGIN
    IF NOT (
        OLD.preview_id=NEW.preview_id AND OLD.scope_id=NEW.scope_id AND OLD.session_id=NEW.session_id
        AND OLD.owner_user_id=NEW.owner_user_id AND OLD.elder_id=NEW.elder_id
        AND OLD.environment_id=NEW.environment_id AND OLD.display_binding=NEW.display_binding
        AND OLD.created_at=NEW.created_at AND OLD.expires_at=NEW.expires_at
        AND OLD.assessment_answers=NEW.assessment_answers AND OLD.profile_display=NEW.profile_display
        AND OLD.recommendation_display=NEW.recommendation_display
    ) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable trusted Preview payload'; END IF;
    IF NOT ((OLD.state='ACTIVE' AND NEW.state IN ('REVOKED','BOUND') AND NEW.completion_id IS NULL)
        OR (OLD.state='BOUND' AND NEW.state='CONSUMED' AND OLD.intent_id=NEW.intent_id
            AND NEW.completion_id IS NOT NULL)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='invalid trusted Preview lifecycle transition';
    END IF;
END$$
CREATE TRIGGER history_trusted_preview_no_delete BEFORE DELETE ON history_trusted_preview_test_only_v1 FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='trusted Preview retention is owner controlled'; END$$
DELIMITER ;
