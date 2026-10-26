-- Additive TEST_ONLY formal Recommendation display, never backfill old records.
CREATE TABLE historical_recommendation_display_test_only_v1 (
    assessment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    snapshot_version INT NOT NULL,
    display_snapshot JSON NOT NULL,
    PRIMARY KEY (assessment_id),
    CONSTRAINT fk_history_recommendation FOREIGN KEY (assessment_id) REFERENCES completed_assessment_history_test_only_v1(id) ON DELETE RESTRICT,
    CONSTRAINT chk_history_recommendation CHECK (snapshot_version=1
      AND JSON_CONTAINS_PATH(display_snapshot,'all','$.kind','$.snapshotVersion','$.assessmentId','$.assessmentCompletedAt','$.versions','$.source','$.state','$.cards')=1
      AND JSON_UNQUOTE(JSON_EXTRACT(display_snapshot,'$.kind'))='historical_recommendation_display_v1'
      AND JSON_UNQUOTE(JSON_EXTRACT(display_snapshot,'$.assessmentId'))=assessment_id
      AND JSON_EXTRACT(display_snapshot,'$.snapshotVersion')=1)
) ENGINE=InnoDB;
CREATE TRIGGER history_recommendation_no_update BEFORE UPDATE ON historical_recommendation_display_test_only_v1
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable recommendation display';
CREATE TRIGGER history_recommendation_no_delete BEFORE DELETE ON historical_recommendation_display_test_only_v1
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable recommendation display';
