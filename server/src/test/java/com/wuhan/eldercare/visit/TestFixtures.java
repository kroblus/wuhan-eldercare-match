package com.wuhan.eldercare.visit;

import com.wuhan.eldercare.visit.domain.SubmissionCommandV1;

final class TestFixtures {
    private TestFixtures() {
    }

    static SubmissionCommandV1 command(String key) {
        return new SubmissionCommandV1(
                "appointment-institution-visit-contract-v1",
                "appointment_submission_v1",
                key,
                "institution-1",
                "revision-7",
                "elder-1",
                "2026-10-01",
                "morning",
                2,
                false,
                "张三",
                "13800000000",
                "appointment_or_consultant_contact",
                "explicit",
                "需要无障碍接待"
        );
    }
}
