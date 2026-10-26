package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Collection;

/** Server-installed TEST_ONLY allowlist of exact synthetic Assessment answer fixtures. */
public interface HistoryTrustedPreviewInputSource {
    Collection<JsonNode> approvedSyntheticAnswers();
}
