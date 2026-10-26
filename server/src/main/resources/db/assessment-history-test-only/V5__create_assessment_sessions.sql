-- TEST_ONLY correlation/uniqueness only. Existing V1-V4 rows/snapshots are untouched.
CREATE TABLE history_assessment_session_test_only_v1 (
 session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 draft_context VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 predecessor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at TIMESTAMP(6) NOT NULL,
 UNIQUE KEY uq_history_session_context (scope_id,draft_context),
 UNIQUE KEY uq_history_session_successor (predecessor_id),
 FOREIGN KEY (scope_id) REFERENCES history_save_scope_test_only_v1(scope_id),
 FOREIGN KEY (predecessor_id) REFERENCES history_assessment_session_test_only_v1(session_id)
);
CREATE TABLE history_session_intent_test_only_v1 (
 session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 intent_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 FOREIGN KEY (session_id) REFERENCES history_assessment_session_test_only_v1(session_id),
 FOREIGN KEY (intent_id) REFERENCES history_save_intent_test_only_v1(intent_id)
);
CREATE TABLE history_session_completion_test_only_v1 (
 session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 assessment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 FOREIGN KEY (session_id) REFERENCES history_assessment_session_test_only_v1(session_id),
 FOREIGN KEY (assessment_id) REFERENCES completed_assessment_history_test_only_v1(id)
);

CREATE TRIGGER history_session_reject_update BEFORE UPDATE ON history_assessment_session_test_only_v1 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable TEST_ONLY session relation';

CREATE TRIGGER history_session_reject_delete BEFORE DELETE ON history_assessment_session_test_only_v1 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable TEST_ONLY session relation';

CREATE TRIGGER history_session_intent_reject_update BEFORE UPDATE ON history_session_intent_test_only_v1 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable TEST_ONLY session relation';

CREATE TRIGGER history_session_intent_reject_delete BEFORE DELETE ON history_session_intent_test_only_v1 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable TEST_ONLY session relation';

CREATE TRIGGER history_session_completion_reject_update BEFORE UPDATE ON history_session_completion_test_only_v1 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable TEST_ONLY session relation';

CREATE TRIGGER history_session_completion_reject_delete BEFORE DELETE ON history_session_completion_test_only_v1 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable TEST_ONLY session relation';
