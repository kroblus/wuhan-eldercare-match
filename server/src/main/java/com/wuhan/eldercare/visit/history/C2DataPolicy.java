package com.wuhan.eldercare.visit.history;

/** Installed only after notice, retention and operational rights handling have actually been approved.
 * A boolean property alone cannot create this approval. There is no bundled production implementation. */
public interface C2DataPolicy {
    Notice approvedNotice();
    record Notice(String version, String text, String retention, String rightsContact, String approvalReference) {
        public Notice {
            for (String value : new String[]{version, text, retention, rightsContact, approvalReference})
                if (value == null || value.isBlank()) throw new IllegalArgumentException("Approved policy fields required");
            if (version.length() > 120) throw new IllegalArgumentException("Policy version too long");
        }
    }
}
