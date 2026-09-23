CREATE TABLE auth_provider_identity_v1 (
    provider_namespace VARCHAR(200) NOT NULL,
    provider_subject_digest CHAR(64) NOT NULL,
    user_id VARCHAR(200) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (provider_namespace, provider_subject_digest),
    CONSTRAINT uq_auth_provider_identity_user UNIQUE (user_id)
) ENGINE = InnoDB;

CREATE TABLE auth_session_v1 (
    session_digest CHAR(64) NOT NULL,
    user_id VARCHAR(200) NOT NULL,
    issued_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    revoked_at TIMESTAMP(6) NULL,
    PRIMARY KEY (session_digest),
    CONSTRAINT fk_auth_session_user
        FOREIGN KEY (user_id) REFERENCES auth_provider_identity_v1 (user_id)
) ENGINE = InnoDB;

CREATE INDEX idx_auth_session_user ON auth_session_v1 (user_id, expires_at);
