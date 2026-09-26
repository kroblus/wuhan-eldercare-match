package com.wuhan.eldercare.visit.lifecycle;

import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Executes a full matrix comparison against the C1 TypeScript evaluator source packaged as a test resource. */
class VisitLifecycleTransitionEvaluatorV1ParityTest {
    private static final Pattern ENTRY = Pattern.compile("(?m)^\\s*(create|requested|contacting|scheduled|completed|cancelled):\\s*\\[([^\\]]*)]\\s*,?\\s*$");
    private static final Pattern STATUS = Pattern.compile("'([a-z_]+)'");
    private static final List<String> TARGETS = List.of("requested", "contacting", "scheduled", "completed", "cancelled");

    @Test
    void javaAdapterMatchesEveryC1TransitionAndSameStatusNoOp() throws Exception {
        Map<String, List<String>> c1 = readC1Transitions();
        assertEquals(SetBuilder.EXPECTED_ROWS, c1.size());
        VisitLifecycleTransitionEvaluatorV1 evaluator = new VisitLifecycleTransitionEvaluatorV1();

        for (Map.Entry<String, List<String>> row : c1.entrySet()) {
            String from = row.getKey();
            for (String to : TARGETS) {
                VisitLifecycleTransitionEvaluatorV1.Kind actual = evaluator.evaluate(from, to).kind();
                if (!"create".equals(from) && from.equals(to)) {
                    assertEquals(VisitLifecycleTransitionEvaluatorV1.Kind.NO_OP, actual, from + " -> " + to);
                } else if (row.getValue().contains(to)) {
                    assertEquals(VisitLifecycleTransitionEvaluatorV1.Kind.ALLOWED, actual, from + " -> " + to);
                } else {
                    assertEquals(VisitLifecycleTransitionEvaluatorV1.Kind.ILLEGAL_TRANSITION, actual, from + " -> " + to);
                }
            }
        }
        assertEquals(VisitLifecycleTransitionEvaluatorV1.Kind.INVALID_STATUS, evaluator.evaluate("unknown", "completed").kind());
        assertEquals(VisitLifecycleTransitionEvaluatorV1.Kind.INVALID_STATUS, evaluator.evaluate("requested", "unknown").kind());
        assertTrue(c1.get("create").contains("requested"));
        assertFalse(c1.get("create").contains("scheduled"));
    }

    private static Map<String, List<String>> readC1Transitions() throws Exception {
        try (InputStream stream = VisitLifecycleTransitionEvaluatorV1ParityTest.class.getResourceAsStream("/lifecycle.ts")) {
            if (stream == null) throw new IllegalStateException("C1 lifecycle TypeScript source test resource missing");
            String source = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            int start = source.indexOf("const allowedTransitions:");
            int open = start < 0 ? -1 : source.indexOf('{', start);
            int close = open < 0 ? -1 : source.indexOf("\n}", open);
            if (start < 0 || open < 0 || close < 0) throw new IllegalStateException("C1 evaluator matrix source shape changed");
            String body = source.substring(open + 1, close);
            Matcher entries = ENTRY.matcher(body);
            Map<String, List<String>> parsed = new LinkedHashMap<>();
            while (entries.find()) {
                List<String> targets = new ArrayList<>();
                Matcher status = STATUS.matcher(entries.group(2));
                while (status.find()) targets.add(status.group(1));
                parsed.put(entries.group(1), List.copyOf(targets));
            }
            return parsed;
        }
    }

    private static final class SetBuilder {
        private static final int EXPECTED_ROWS = 6;
    }
}
