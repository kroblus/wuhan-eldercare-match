ALTER TABLE institution_visit_v1
    DROP CHECK chk_institution_visit_status_requested,
    ADD CONSTRAINT chk_institution_visit_status_v1
        CHECK (status IN ('requested', 'contacting', 'scheduled', 'completed', 'cancelled'));
