-- TEST_ONLY metadata only; no answers, tokens, payload digest or results.
CREATE TABLE history_save_scope_test_only_v1 (
  scope_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  owner_user_id VARCHAR(200) NOT NULL,
  elder_id VARCHAR(200) NOT NULL,
  UNIQUE KEY uq_history_save_scope (owner_user_id,elder_id),
  FOREIGN KEY (owner_user_id) REFERENCES auth_provider_identity_v1(user_id),
  FOREIGN KEY (elder_id) REFERENCES elder_record_v1(elder_id)
);
CREATE TABLE history_save_intent_test_only_v1 (
  intent_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  scope_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  FOREIGN KEY (scope_id) REFERENCES history_save_scope_test_only_v1(scope_id)
);
