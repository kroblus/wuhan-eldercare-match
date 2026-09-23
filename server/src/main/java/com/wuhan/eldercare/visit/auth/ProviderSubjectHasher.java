package com.wuhan.eldercare.visit.auth;

import java.util.Optional;

/** Hashes provider identity material before durable storage. */
public interface ProviderSubjectHasher {
    Optional<String> digest(String providerNamespace, String providerSubject);
}
