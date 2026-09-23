package com.wuhan.eldercare.visit.auth;

import java.util.UUID;

@FunctionalInterface
public interface ServerOpaquePrincipalSource {
    String newUserId();

    static ServerOpaquePrincipalSource production() {
        return () -> "usr_" + UUID.randomUUID();
    }
}
