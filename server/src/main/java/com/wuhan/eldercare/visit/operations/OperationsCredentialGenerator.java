package com.wuhan.eldercare.visit.operations;

/** Generates opaque bearer evidence only inside the controlled provisioning boundary. */
public interface OperationsCredentialGenerator {
    String generate();
}
