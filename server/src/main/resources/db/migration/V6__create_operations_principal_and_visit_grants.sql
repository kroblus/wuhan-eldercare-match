CREATE TABLE operations_provisioning_operation_v1 (
    operation_id VARCHAR(160) NOT NULL,
    operation_type VARCHAR(32) NOT NULL,
    intent_fingerprint CHAR(64) NOT NULL,
    operations_principal_id VARCHAR(120) NOT NULL,
    visit_id VARCHAR(200) NULL,
    approval_reference VARCHAR(200) NOT NULL,
    provisioning_actor_reference VARCHAR(200) NOT NULL,
    accepted_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (operation_id),
    CONSTRAINT chk_operations_provisioning_operation_type CHECK (
        operation_type IN ('PROVISION_PRINCIPAL', 'GRANT_VISIT', 'REVOKE_GRANT', 'REVOKE_PRINCIPAL')
    )
) ENGINE = InnoDB;

CREATE TABLE operations_principal_v1 (
    operations_principal_id VARCHAR(120) NOT NULL,
    principal_state VARCHAR(16) NOT NULL,
    verified_actor_reference VARCHAR(200) NOT NULL,
    approval_reference VARCHAR(200) NOT NULL,
    created_by_operation_id VARCHAR(160) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    revoked_by_operation_id VARCHAR(160) NULL,
    revoked_at TIMESTAMP(6) NULL,
    PRIMARY KEY (operations_principal_id),
    CONSTRAINT chk_operations_principal_state CHECK (principal_state IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT chk_operations_principal_revocation CHECK (
        (principal_state = 'ACTIVE' AND revoked_by_operation_id IS NULL AND revoked_at IS NULL)
        OR (principal_state = 'REVOKED' AND revoked_by_operation_id IS NOT NULL AND revoked_at IS NOT NULL)
    )
) ENGINE = InnoDB;

CREATE TABLE operations_credential_v1 (
    operations_principal_id VARCHAR(120) NOT NULL,
    credential_digest CHAR(64) NOT NULL,
    credential_state VARCHAR(16) NOT NULL,
    created_by_operation_id VARCHAR(160) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    revoked_by_operation_id VARCHAR(160) NULL,
    revoked_at TIMESTAMP(6) NULL,
    PRIMARY KEY (operations_principal_id),
    CONSTRAINT uq_operations_credential_digest UNIQUE (credential_digest),
    CONSTRAINT chk_operations_credential_state CHECK (credential_state IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT chk_operations_credential_revocation CHECK (
        (credential_state = 'ACTIVE' AND revoked_by_operation_id IS NULL AND revoked_at IS NULL)
        OR (credential_state = 'REVOKED' AND revoked_by_operation_id IS NOT NULL AND revoked_at IS NOT NULL)
    ),
    CONSTRAINT fk_operations_credential_principal
        FOREIGN KEY (operations_principal_id) REFERENCES operations_principal_v1 (operations_principal_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE operations_visit_grant_v1 (
    operations_principal_id VARCHAR(120) NOT NULL,
    visit_id VARCHAR(200) NOT NULL,
    grant_state VARCHAR(16) NOT NULL,
    approval_reference VARCHAR(200) NOT NULL,
    created_by_operation_id VARCHAR(160) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    last_granted_by_operation_id VARCHAR(160) NOT NULL,
    last_granted_at TIMESTAMP(6) NOT NULL,
    revoked_by_operation_id VARCHAR(160) NULL,
    revoked_at TIMESTAMP(6) NULL,
    PRIMARY KEY (operations_principal_id, visit_id),
    CONSTRAINT chk_operations_visit_grant_state CHECK (grant_state IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT chk_operations_visit_grant_revocation CHECK (
        (grant_state = 'ACTIVE' AND revoked_by_operation_id IS NULL AND revoked_at IS NULL)
        OR (grant_state = 'REVOKED' AND revoked_by_operation_id IS NOT NULL AND revoked_at IS NOT NULL)
    ),
    CONSTRAINT fk_operations_visit_grant_principal
        FOREIGN KEY (operations_principal_id) REFERENCES operations_principal_v1 (operations_principal_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_operations_visit_grant_visit
        FOREIGN KEY (visit_id) REFERENCES institution_visit_v1 (visit_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX idx_operations_credential_digest_state
    ON operations_credential_v1 (credential_digest, credential_state);
CREATE INDEX idx_operations_visit_grant_visit_state
    ON operations_visit_grant_v1 (visit_id, grant_state, operations_principal_id);
CREATE INDEX idx_operations_provisioning_principal_time
    ON operations_provisioning_operation_v1 (operations_principal_id, accepted_at);
