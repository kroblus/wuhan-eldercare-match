package com.wuhan.eldercare.visit.history;

/** Public codes only; never includes submitted data or database diagnostics. */
public final class C2Failure extends RuntimeException {
    private final int status;
    private final String code;
    public C2Failure(int status, String code) { super(code); this.status = status; this.code = code; }
    public int status() { return status; }
    public String code() { return code; }
}
