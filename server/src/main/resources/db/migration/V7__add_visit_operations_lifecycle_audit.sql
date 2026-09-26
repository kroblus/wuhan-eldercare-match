ALTER TABLE institution_visit_v1
    ADD COLUMN scheduled_at TIMESTAMP(6) NULL,
    ADD COLUMN completed_at TIMESTAMP(6) NULL,
    ADD COLUMN lifecycle_version BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_institution_visit_lifecycle_version CHECK (lifecycle_version >= 0),
    ADD CONSTRAINT chk_institution_visit_completed_at CHECK (completed_at IS NULL OR status = 'completed');

CREATE TABLE institution_visit_lifecycle_audit_v1 (
    operations_principal_id VARCHAR(120) NOT NULL,
    operation_id VARCHAR(160) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    visit_id VARCHAR(200) NOT NULL,
    expected_status VARCHAR(16) NOT NULL,
    target_status VARCHAR(16) NOT NULL,
    previous_status VARCHAR(16) NOT NULL,
    outcome VARCHAR(40) NOT NULL,
    evidence_kind VARCHAR(48) NULL,
    evidence_reference VARCHAR(200) NULL,
    fact_at TIMESTAMP(6) NULL,
    result_status VARCHAR(16) NULL,
    result_scheduled_at TIMESTAMP(6) NULL,
    result_completed_at TIMESTAMP(6) NULL,
    recorded_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (operations_principal_id, operation_id),
    CONSTRAINT chk_lifecycle_expected_status CHECK (
        expected_status IN ('requested', 'contacting', 'scheduled', 'completed', 'cancelled')
    ),
    CONSTRAINT chk_lifecycle_target_status CHECK (
        target_status IN ('requested', 'contacting', 'scheduled', 'completed', 'cancelled')
    ),
    CONSTRAINT chk_lifecycle_previous_status CHECK (
        previous_status IN ('requested', 'contacting', 'scheduled', 'completed', 'cancelled')
    ),
    CONSTRAINT chk_lifecycle_result_status CHECK (
        result_status IS NULL OR result_status IN ('requested', 'contacting', 'scheduled', 'completed', 'cancelled')
    ),
    CONSTRAINT chk_lifecycle_result_snapshot CHECK (
        (outcome IN ('ACCEPTED', 'NO_OP') AND result_status IS NOT NULL)
        OR (outcome NOT IN ('ACCEPTED', 'NO_OP') AND result_status IS NULL
            AND result_scheduled_at IS NULL AND result_completed_at IS NULL)
    ),
    CONSTRAINT chk_lifecycle_outcome CHECK (
        outcome IN ('ACCEPTED', 'NO_OP', 'ILLEGAL_TRANSITION', 'EVIDENCE_INSUFFICIENT', 'CONFLICT')
    ),
    CONSTRAINT chk_lifecycle_evidence_kind CHECK (
        evidence_kind IS NULL OR evidence_kind IN (
            'follow_up_underway', 'confirmed_visit_plan', 'in_person_visit_occurred', 'cancellation_confirmed'
        )
    ),
    CONSTRAINT fk_lifecycle_audit_principal FOREIGN KEY (operations_principal_id)
        REFERENCES operations_principal_v1 (operations_principal_id) ON DELETE RESTRICT,
    CONSTRAINT fk_lifecycle_audit_visit FOREIGN KEY (visit_id)
        REFERENCES institution_visit_v1 (visit_id) ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX idx_visit_lifecycle_audit_visit_time
    ON institution_visit_lifecycle_audit_v1 (visit_id, recorded_at);
