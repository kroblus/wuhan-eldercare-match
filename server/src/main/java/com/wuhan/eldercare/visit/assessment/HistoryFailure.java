package com.wuhan.eldercare.visit.assessment;

public final class HistoryFailure extends RuntimeException {
    private final int status;
    private final String code;
    public HistoryFailure(int status, String code) { super(code); this.status=status; this.code=code; }
    public int status() { return status; }
    public String code() { return code; }
}
