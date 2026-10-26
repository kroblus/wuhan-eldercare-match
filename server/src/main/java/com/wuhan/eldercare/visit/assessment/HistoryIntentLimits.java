package com.wuhan.eldercare.visit.assessment;

/** Independent disposable TEST_ONLY resource bounds; never a retention/production policy. */
public record HistoryIntentLimits(int maxPerOwner,int maxPerWindow,int windowSeconds) {
    public static final HistoryIntentLimits TEST_ONLY_DEFAULT=new HistoryIntentLimits(256,16,60);
    public HistoryIntentLimits {
        if(maxPerOwner<1 || maxPerOwner>1000 || maxPerWindow<1 || maxPerWindow>32
                || maxPerWindow>maxPerOwner || windowSeconds<1 || windowSeconds>3600)
            throw new IllegalArgumentException("invalid TEST_ONLY intent resource bounds");
    }
}
