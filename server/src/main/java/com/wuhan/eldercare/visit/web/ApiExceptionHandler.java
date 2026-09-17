package com.wuhan.eldercare.visit.web;

import com.wuhan.eldercare.visit.application.BackendSubmissionResultV1;
import com.wuhan.eldercare.visit.domain.SubmissionResultV1;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Converts malformed/authority-bearing requests into the stable C3 rejection
 * taxonomy. Framework details never cross the API firewall.
 */
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<BackendSubmissionResultV1> malformedRequest(HttpMessageNotReadableException ignored) {
        return ResponseEntity.status(HttpStatus.OK).body(
                BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.REJECTED, "VALIDATION_FAILED"));
    }

    @ExceptionHandler(RuntimeException.class)
    ResponseEntity<BackendSubmissionResultV1> unexpectedRequest(RuntimeException ignored) {
        return ResponseEntity.status(HttpStatus.OK).body(
                BackendSubmissionResultV1.from(SubmissionResultV1.Outcome.TECHNICAL_FAILURE, "TECHNICAL_FAILURE"));
    }
}
