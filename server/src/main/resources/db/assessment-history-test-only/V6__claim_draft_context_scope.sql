-- TEST_ONLY non-sensitive workflow provenance; no answer/history backfill or production migration.
CREATE INDEX history_session_context_lookup ON history_assessment_session_test_only_v1 (draft_context);
CREATE TABLE history_draft_context_claim_test_only_v1 (
  draft_context VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  scope_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  CONSTRAINT history_context_claim_scope_fk FOREIGN KEY (scope_id) REFERENCES history_save_scope_test_only_v1(scope_id)
);
DELIMITER $$
CREATE TRIGGER history_context_claim_no_update BEFORE UPDATE ON history_draft_context_claim_test_only_v1 FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable TEST_ONLY context claim'; END$$
CREATE TRIGGER history_context_claim_no_delete BEFORE DELETE ON history_draft_context_claim_test_only_v1 FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable TEST_ONLY context claim'; END$$
DELIMITER ;
