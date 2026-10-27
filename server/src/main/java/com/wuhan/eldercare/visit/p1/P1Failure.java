package com.wuhan.eldercare.visit.p1;

public final class P1Failure extends RuntimeException {
    private final int status;
    private final String code;
    public P1Failure(int status, String code) { super(code); this.status = status; this.code = code; }
    public int status() { return status; }
    public String code() { return code; }
}
