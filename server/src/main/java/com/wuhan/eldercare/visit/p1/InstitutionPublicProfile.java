package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;

/** Public service information is never translated into clinical eligibility or official contact facts. */
final class InstitutionPublicProfile {
    private static final Set<String> FIELDS=Set.of("schemaVersion","id","name","source","room","address","nature","tags","tagNote","prices","otherFees","priceNote","historyNote");
    static void validate(JsonNode profile, JsonNode record) {
        if (profile == null || profile.isNull()) return;
        exact(profile,FIELDS);
        if (!"institution-public-profile-v1".equals(profile.path("schemaVersion").asText())
                || !record.path("institutionId").asText().equals(profile.path("id").asText())
                || !"provided".equals(record.path("identity").path("name").path("availability").asText())
                || !record.path("identity").path("name").path("value").asText().equals(profile.path("name").asText())) fail();
        for(String key:new String[]{"id","name","source"}) text(profile,key,1000,false);
        for(String key:new String[]{"room","address","nature"}) text(profile,key,1000,true);
        for(String key:new String[]{"tagNote","otherFees","priceNote","historyNote"}) text(profile,key,4000,true);
        JsonNode tags=profile.get("tags"),prices=profile.get("prices");
        if(tags==null||!tags.isArray()||tags.size()>12||prices==null||!prices.isArray()||prices.size()>30) fail();
        var seen=new HashSet<String>();
        for(JsonNode tag:tags)if(!tag.isTextual()||!P1Service.text(tag.asText(),60,false)||!seen.add(tag.asText()))fail();
        seen.clear();
        for(JsonNode row:prices){
            exact(row,Set.of("level","bed","care","food","total"));text(row,"level",80,false);
            if(!seen.add(row.path("level").asText()))fail();
            long sum=0;
            for(String key:new String[]{"bed","care","food","total"}){
                JsonNode amount=row.get(key);if(amount==null||!amount.isIntegralNumber()||!amount.canConvertToLong()||amount.longValue()<0||amount.longValue()>10_000_000)fail();
                if(!key.equals("total"))sum+=amount.longValue();
            }
            if(sum!=row.path("total").longValue())fail();
        }
    }
    static void exact(JsonNode node,Set<String> fields){
        if(node==null||!node.isObject()||node.size()!=fields.size())fail();
        var actual=new HashSet<String>();node.fieldNames().forEachRemaining(actual::add);if(!actual.equals(fields))fail();
    }
    private static void text(JsonNode node,String key,int max,boolean blank){
        var value=node.get(key);if(value==null||!value.isTextual()||value.asText().length()>max||(!blank&&value.asText().isBlank())
                ||value.asText().chars().anyMatch(c->Character.isISOControl(c)&&c!='\n'&&c!='\r'))fail();
    }
    private static void fail(){throw new P1Failure(400,"INVALID_PUBLIC_PROFILE");}
}
