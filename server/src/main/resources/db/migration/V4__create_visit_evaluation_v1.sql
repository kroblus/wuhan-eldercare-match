CREATE TABLE visit_evaluation_v1 (
    evaluation_id VARCHAR(80) NOT NULL,
    visit_id VARCHAR(200) NOT NULL,
    user_id VARCHAR(200) NOT NULL,
    institution_id VARCHAR(200) NOT NULL,
    institution_record_revision VARCHAR(200) NOT NULL,
    overall_rating TINYINT NOT NULL,
    consideration VARCHAR(32) NOT NULL,
    content_json JSON NOT NULL,
    idempotency_key_hash CHAR(64) NOT NULL,
    content_fingerprint CHAR(64) NOT NULL,
    submitted_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (evaluation_id),
    CONSTRAINT uq_visit_evaluation_visit UNIQUE (visit_id),
    CONSTRAINT uq_visit_evaluation_idempotency UNIQUE (user_id, visit_id, idempotency_key_hash),
    CONSTRAINT fk_visit_evaluation_visit
        FOREIGN KEY (visit_id) REFERENCES institution_visit_v1 (visit_id),
    CONSTRAINT chk_visit_evaluation_overall_rating CHECK (overall_rating BETWEEN 1 AND 5),
    CONSTRAINT chk_visit_evaluation_consideration CHECK (consideration IN ('willing', 'compare', 'not_considering'))
) ENGINE = InnoDB;
