package com.wuhan.eldercare.visit.domain;

/**
 * Private, purpose-bound contact value. Do not expose this type from HTTP results
 * or log it. It is deliberately not an identity type.
 */
public record PrivateContact(String contactName, String phone) {
    public PrivateContact {
        if (contactName == null || contactName.isBlank() || phone == null || phone.isBlank()) {
            throw new IllegalArgumentException("contact values must be non-blank");
        }
        contactName = contactName.trim();
        phone = phone.trim();
    }
}
