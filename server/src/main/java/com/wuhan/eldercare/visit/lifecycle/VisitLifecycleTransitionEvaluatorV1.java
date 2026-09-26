package com.wuhan.eldercare.visit.lifecycle;

import java.util.Map;
import java.util.Set;

/** Java application adapter for C1 §10.2's sole frozen lifecycle transition rule source. */
public final class VisitLifecycleTransitionEvaluatorV1 {
    private static final Set<String> STATUSES = Set.of("requested", "contacting", "scheduled", "completed", "cancelled");

    // Kept byte-for-byte equivalent in meaning to the C1 evaluator at
    // miniprogram/domain/appointment-institution-visit/lifecycle.ts.
    private static final Map<String, Set<String>> C1_ALLOWED = Map.of(
            "create", Set.of("requested"),
            "requested", Set.of("contacting", "scheduled", "cancelled"),
            "contacting", Set.of("scheduled", "cancelled"),
            "scheduled", Set.of("completed", "cancelled"),
            "completed", Set.of(),
            "cancelled", Set.of()
    );

    public Evaluation evaluate(String from, String to) {
        if (!STATUSES.contains(to) || (!"create".equals(from) && !STATUSES.contains(from))) {
            return new Evaluation(Kind.INVALID_STATUS);
        }
        if (!"create".equals(from) && from.equals(to)) return new Evaluation(Kind.NO_OP);
        return C1_ALLOWED.get(from).contains(to)
                ? new Evaluation(Kind.ALLOWED)
                : new Evaluation(Kind.ILLEGAL_TRANSITION);
    }

    public record Evaluation(Kind kind) {
        public Evaluation {
            if (kind == null) throw new IllegalArgumentException("transition result required");
        }
    }

    public enum Kind { ALLOWED, NO_OP, ILLEGAL_TRANSITION, INVALID_STATUS }
}
