-- Additive TEST_ONLY snapshot. Existing raw records are not changed/backfilled.
CREATE TABLE historical_profile_display_test_only_v1 (
    assessment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    snapshot_version INT NOT NULL,
    display_snapshot JSON NOT NULL,
    PRIMARY KEY (assessment_id),
    CONSTRAINT fk_history_profile_display FOREIGN KEY (assessment_id)
        REFERENCES completed_assessment_history_test_only_v1(id) ON DELETE RESTRICT,
    CONSTRAINT chk_history_profile_display CHECK (snapshot_version=1
        AND JSON_CONTAINS_PATH(display_snapshot,'all','$.kind','$.snapshotVersion','$.assessmentId','$.assessmentCompletedAt','$.assessmentSchemaVersion','$.profileContractVersion','$.derivationRulesetVersion','$.rows')=1
        AND JSON_UNQUOTE(JSON_EXTRACT(display_snapshot,'$.kind'))='historical_profile_display_v1'
        AND JSON_UNQUOTE(JSON_EXTRACT(display_snapshot,'$.assessmentId'))=assessment_id
        AND JSON_EXTRACT(display_snapshot,'$.snapshotVersion')=1
        AND JSON_TYPE(JSON_EXTRACT(display_snapshot,'$.rows'))='ARRAY')
) ENGINE=InnoDB;
CREATE TRIGGER history_profile_display_no_update BEFORE UPDATE ON historical_profile_display_test_only_v1
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable profile display';
CREATE TRIGGER history_profile_display_no_delete BEFORE DELETE ON historical_profile_display_test_only_v1
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable profile display';
