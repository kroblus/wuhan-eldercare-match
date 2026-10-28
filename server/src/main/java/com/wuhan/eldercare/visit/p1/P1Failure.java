package com.wuhan.eldercare.visit.p1;

import com.wuhan.eldercare.visit.institution.application.InstitutionSnapshotValidator;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class P1Failure extends RuntimeException {
    private final int status;
    private final String code;
    private final List<Map<String,String>> validationIssues;
    public P1Failure(int status, String code) { this(status,code,List.of()); }
    public P1Failure(int status,String code,List<InstitutionSnapshotValidator.Issue> issues) {
        super(code);this.status=status;this.code=code;
        var safe=new ArrayList<Map<String,String>>();
        for(var issue:issues){
            if(safe.size()==32)break;
            if(issue==null||issue.code()==null||issue.path()==null||issue.path().length()>240
                    ||!issue.code().matches("[A-Z][A-Z0-9_]{0,79}")
                    ||!issue.path().matches("\\$|[A-Za-z][A-Za-z0-9_]*(?:\\.[A-Za-z][A-Za-z0-9_]*|\\[[0-9]{1,6}\\])*"))continue;
            safe.add(Map.of("code",issue.code(),"path",issue.path()));
        }
        validationIssues=List.copyOf(safe);
    }
    public int status() { return status; }
    public String code() { return code; }
    public List<Map<String,String>> validationIssues(){return validationIssues;}
}
