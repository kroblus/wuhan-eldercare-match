package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.*;
import java.time.*;
import java.util.*;

/** P1 operations: small dataset mutex plus revision checks, with explicit human outcomes. */
public final class P1Operations {
    static final Set<String> REQUEST_STATUSES=Set.of("PENDING_CONTACT","FOLLOWING_UP","PENDING_ARRANGEMENT","CONFIRMED","VISITED","NO_SHOW","CLOSED","CANCELLED");
    static final String SECOND_INSTITUTION="synthetic-reception-b";
    private final P1Service service;
    P1Operations(P1Service service){this.service=service;}
    String institutionName(Connection c,String id)throws Exception{return Objects.toString(service.publications().knownName(c,id),"机构名称未记录");}
    boolean institution(String id){return service.hasDatabase()&&service.transaction(c->service.publications().knownName(c,id)!=null);}
    void lock(Connection c)throws SQLException{
        try(var s=c.prepareStatement("SELECT dataset_mode FROM p1_operations_mutex_v1 WHERE dataset_mode=? FOR UPDATE")){
            s.setString(1,service.datasetMode());try(var r=s.executeQuery()){if(!r.next())throw new P1Failure(503,"SERVICE_UNAVAILABLE");}
        }
    }
    private String string(JsonNode body,String field,int max,boolean optional){
        var n=body.get(field);if(optional&&(n==null||n.isNull()||n.isTextual()&&n.asText().isBlank()))return null;
        if(n==null||!n.isTextual()||!P1Service.multilineText(n.asText(),max))throw new P1Failure(400,"INVALID_INPUT");return n.asText();
    }
    private String identifier(JsonNode body,String field){String id=string(body,field,36,false);if(!P1Service.uuid(id))throw new P1Failure(400,"INVALID_INPUT");return id;}
    private int integer(JsonNode b,String f,int min,int max){var n=b.get(f);if(n==null||!n.isIntegralNumber()||!n.canConvertToInt()||n.intValue()<min||n.intValue()>max)throw new P1Failure(400,"INVALID_INPUT");return n.intValue();}
    private boolean bool(JsonNode b,String f){var n=b.get(f);if(n==null||!n.isBoolean())throw new P1Failure(400,"INVALID_INPUT");return n.asBoolean();}
    private Instant instant(JsonNode b,String f){
        String v=string(b,f,40,false);try{return Instant.parse(v);}catch(DateTimeException e){throw new P1Failure(400,"INVALID_TIME");}
    }
    private void fields(JsonNode b,String... allowed){
        if(!b.isObject())throw new P1Failure(400,"INVALID_INPUT");var names=new HashSet<>(Arrays.asList(allowed));
        b.fieldNames().forEachRemaining(n->{if(!names.contains(n))throw new P1Failure(400,"INVALID_INPUT");});
    }
    private String canonical(JsonNode n){
        if(n.isObject()){var sorted=new TreeMap<String,JsonNode>();n.fields().forEachRemaining(e->sorted.put(e.getKey(),e.getValue()));return sorted.entrySet().stream().map(e->e.getKey()+":"+canonical(e.getValue())).reduce("",(a,b)->a+"|"+b);}
        return n.toString();
    }
    private boolean replay(Connection c,String id,String operation,String type,JsonNode b)throws Exception{
        try(var s=c.prepareStatement("SELECT request_id,event_type,payload_digest FROM p1_operation_event_v1 WHERE operation_id=?")){
            s.setString(1,operation);try(var r=s.executeQuery()){
                if(!r.next())return false;
                if(!id.equals(r.getString(1))||!type.equals(r.getString(2))||!P1Service.digest(canonical(b)).equals(r.getString(3)))throw new P1Failure(409,"IDEMPOTENCY_CONFLICT");
                return true;
            }
        }
    }
    private void event(Connection c,String id,String operation,String type,JsonNode b,String actor)throws Exception{
        try(var s=c.prepareStatement("INSERT INTO p1_operation_event_v1 VALUES(?,?,?,?,?,?,?)")){
            s.setString(1,operation);s.setString(2,id);s.setString(3,type);s.setString(4,P1Service.digest(canonical(b)));
            s.setString(5,b.toString());s.setString(6,actor);s.setTimestamp(7,Timestamp.from(service.clock.instant()));s.executeUpdate();
        }
    }
    private ObjectNode requireOpen(Connection c,String id)throws Exception{
        var item=service.item(c,id,null);if(Set.of("CANCELLED","CLOSED").contains(item.path("status").asText()))throw new P1Failure(409,"REQUEST_CLOSED");return item;
    }
    public ObjectNode followup(String cookie,String csrf,String id,JsonNode b){
        service.requireAdminConfigured();if(!P1Service.uuid(id))throw new P1Failure(400,"INVALID_INPUT");
        fields(b,"operationId","result","note","nextContactAt","nextAction","feedbackSource","institutionId");
        String op=identifier(b,"operationId"),result=string(b,"result",24,false),note=string(b,"note",500,true),nextAction=string(b,"nextAction",200,true);
        if(!Set.of("CONNECTED","NO_ANSWER","REFUSED","MOVED_IN","NOT_MOVED_IN","UNKNOWN_FEEDBACK").contains(result))throw new P1Failure(400,"INVALID_INPUT");
        boolean feedback=Set.of("MOVED_IN","NOT_MOVED_IN","UNKNOWN_FEEDBACK").contains(result);
        String source=string(b,"feedbackSource",24,true),institutionId=string(b,"institutionId",100,true);
        if(feedback&&(!Set.of("FAMILY","INSTITUTION","CONSULTANT").contains(P1Service.orEmpty(source))||!institution(institutionId)))throw new P1Failure(400,"FEEDBACK_SOURCE_REQUIRED");
        Instant next=string(b,"nextContactAt",40,true)==null?null:instant(b,"nextContactAt");
        if(next!=null&&(result.equals("REFUSED")||feedback||nextAction==null))throw new P1Failure(400,"INVALID_NEXT_ACTION");
        return service.transaction(c->{
            lock(c);var admin=service.admin(c,cookie,csrf,true);var item=service.item(c,id,null);
            if(replay(c,id,op,"FOLLOWUP",b))return detail(c,id);
            if(next!=null&&!next.isAfter(service.clock.instant()))throw new P1Failure(400,"INVALID_NEXT_ACTION");
            if(item.path("status").asText().equals("CANCELLED"))throw new P1Failure(409,"REQUEST_CLOSED");
            if(!feedback)requireOpen(c,id);
            if(feedback&&!associated(c,id,institutionId))throw new P1Failure(400,"INSTITUTION_NOT_ASSOCIATED");
            if(result.equals("REFUSED")){
                try(var s=c.prepareStatement("UPDATE p1_visit_v1 SET visit_status='CANCELLED',revision=revision+1,updated_at=? WHERE request_id=? AND visit_status IN ('DRAFT','CONFIRMED')")){
                    s.setTimestamp(1,Timestamp.from(service.clock.instant()));s.setString(2,id);s.executeUpdate();
                }
            }
            if(!feedback){
                String state=result.equals("REFUSED")?"CLOSED":result.equals("CONNECTED")&&item.path("kind").asText().equals("VISIT_INTENT")?"PENDING_ARRANGEMENT":"FOLLOWING_UP";
                try(var s=c.prepareStatement("UPDATE p1_service_request_v1 SET workflow_status=?,updated_at=? WHERE request_id=?")){
                    s.setString(1,state);s.setTimestamp(2,Timestamp.from(service.clock.instant()));s.setString(3,id);s.executeUpdate();
                }
            }
            event(c,id,op,"FOLLOWUP",b,admin.username());recompute(c,id);return detail(c,id);
        });
    }
    private boolean associated(Connection c,String id,String institution)throws SQLException{
        try(var s=c.prepareStatement("SELECT 1 FROM p1_service_request_v1 WHERE request_id=? AND institution_id=? UNION ALL SELECT 1 FROM p1_visit_v1 WHERE request_id=? AND institution_id=?")){
            s.setString(1,id);s.setString(2,institution);s.setString(3,id);s.setString(4,institution);try(var r=s.executeQuery()){return r.next();}
        }
    }
    public ObjectNode visit(String cookie,String csrf,String id,JsonNode b){
        service.requireAdminConfigured();if(!P1Service.uuid(id))throw new P1Failure(400,"INVALID_INPUT");
        fields(b,"operationId","visitId","action","expectedRevision","institutionId","staffId","start","end","bufferBefore","bufferAfter","familyConfirmed","institutionConfirmed","meetingNote","actualAt");
        String op=identifier(b,"operationId"),visitId=identifier(b,"visitId"),action=string(b,"action",20,false);
        if(!Set.of("SAVE_DRAFT","CONFIRM","RESCHEDULE","CANCEL","ARRIVE","NO_SHOW").contains(action))throw new P1Failure(400,"INVALID_INPUT");
        int revision=integer(b,"expectedRevision",0,Integer.MAX_VALUE-1);
        return service.transaction(c->{
            lock(c);var admin=service.admin(c,cookie,csrf,true);var item=service.item(c,id,null);
            if(replay(c,id,op,"VISIT_"+action,b))return detail(c,id);
            requireOpen(c,id);
            JsonNode old=null;
            for(var v:visits(c,id,true))if(v.path("id").asText().equals(visitId))old=v;
            if((old==null?0:old.path("revision").asInt())!=revision)throw new P1Failure(409,"STALE_REVISION");
            if(old!=null&&Set.of("CANCELLED","ARRIVED","NO_SHOW").contains(old.path("status").asText()))throw new P1Failure(409,"VISIT_ENDED");
            if(Set.of("CANCEL","ARRIVE","NO_SHOW").contains(action)){
                if(old==null||!action.equals("CANCEL")&&!old.path("status").asText().equals("CONFIRMED"))throw new P1Failure(409,"INVALID_TRANSITION");
                Instant actual=null;
                if(!action.equals("CANCEL")){
                    actual=instant(b,"actualAt");Instant start=Instant.parse(old.path("start").asText());
                    if(actual.isAfter(service.clock.instant())||actual.isBefore(start.minusSeconds(86400))||start.isAfter(service.clock.instant()))throw new P1Failure(400,"INVALID_ACTUAL_TIME");
                }
                try(var s=c.prepareStatement("UPDATE p1_visit_v1 SET visit_status=?,revision=revision+1,actual_at=?,updated_at=? WHERE visit_id=?")){
                    s.setString(1,action.equals("CANCEL")?"CANCELLED":action.equals("ARRIVE")?"ARRIVED":"NO_SHOW");
                    s.setTimestamp(2,actual==null?null:Timestamp.from(actual));s.setTimestamp(3,Timestamp.from(service.clock.instant()));s.setString(4,visitId);s.executeUpdate();
                }
            }else{
                String institution=string(b,"institutionId",100,false),staff=string(b,"staffId",80,false),meeting=string(b,"meetingNote",300,false);
                if(!P1Service.text(staff,80,false))throw new P1Failure(400,"INVALID_INPUT");
                String name=service.publications().acceptingName(c,institution);
                String nameSnapshot=old!=null&&institution.equals(old.path("institutionId").asText())?old.path("institutionName").asText():name;
                Instant start=instant(b,"start"),end=instant(b,"end");int before=integer(b,"bufferBefore",0,240),after=integer(b,"bufferAfter",0,240);
                boolean family=bool(b,"familyConfirmed"),reception=bool(b,"institutionConfirmed"),confirmed=!action.equals("SAVE_DRAFT");
                if(!start.isBefore(end)||Duration.between(start,end).toHours()>24)throw new P1Failure(400,"INVALID_TIME");
                if(confirmed&&(!family||!reception))throw new P1Failure(400,"BOTH_CONFIRMATIONS_REQUIRED");
                if(action.equals("RESCHEDULE")&&(old==null||!old.path("status").asText().equals("CONFIRMED")))
                    throw new P1Failure(409,"INVALID_TRANSITION");
                if(old!=null&&old.path("status").asText().equals("CONFIRMED")&&!action.equals("RESCHEDULE"))throw new P1Failure(409,"USE_RESCHEDULE");
                // Intake has no elder association. The verified owner is the stable conservative key.
                String subject;
                try(var s=c.prepareStatement("SELECT owner_user_id FROM p1_service_request_v1 WHERE request_id=?")){
                    s.setString(1,id);try(var r=s.executeQuery()){r.next();subject=r.getString(1);}
                }
                if(confirmed)conflicts(c,visitId,institution,staff,subject,start.minusSeconds(before*60L),end.plusSeconds(after*60L));
                try(var s=c.prepareStatement("INSERT INTO p1_visit_v1 (visit_id,request_id,dataset_mode,institution_id,staff_id,subject_key,visit_status,revision,starts_at,ends_at,buffer_before,buffer_after,family_confirmed,institution_confirmed,meeting_note,created_at,updated_at,institution_name_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE institution_id=VALUES(institution_id),staff_id=VALUES(staff_id),visit_status=VALUES(visit_status),revision=VALUES(revision),starts_at=VALUES(starts_at),ends_at=VALUES(ends_at),buffer_before=VALUES(buffer_before),buffer_after=VALUES(buffer_after),family_confirmed=VALUES(family_confirmed),institution_confirmed=VALUES(institution_confirmed),meeting_note=VALUES(meeting_note),updated_at=VALUES(updated_at),institution_name_snapshot=VALUES(institution_name_snapshot)")){
                    // A UUID belonging to another request must never be overwritten.
                    try(var check=c.prepareStatement("SELECT request_id FROM p1_visit_v1 WHERE visit_id=?")){
                        check.setString(1,visitId);try(var r=check.executeQuery()){if(r.next()&&!id.equals(r.getString(1)))throw new P1Failure(409,"VISIT_ID_CONFLICT");}
                    }
                    int i=1;s.setString(i++,visitId);s.setString(i++,id);s.setString(i++,service.datasetMode());s.setString(i++,institution);s.setString(i++,staff);s.setString(i++,subject);
                    s.setString(i++,confirmed?"CONFIRMED":"DRAFT");s.setInt(i++,revision+1);s.setTimestamp(i++,Timestamp.from(start));s.setTimestamp(i++,Timestamp.from(end));
                    s.setInt(i++,before);s.setInt(i++,after);s.setBoolean(i++,family);s.setBoolean(i++,reception);s.setString(i++,meeting);s.setTimestamp(i++,Timestamp.from(service.clock.instant()));s.setTimestamp(i++,Timestamp.from(service.clock.instant()));s.setString(i,nameSnapshot);s.executeUpdate();
                }
            }
            event(c,id,op,"VISIT_"+action,b,admin.username());recompute(c,id);return detail(c,id);
        });
    }
    private void conflicts(Connection c,String excluded,String institution,String staff,String subject,Instant low,Instant high)throws SQLException{
        var occupancy=new ArrayList<Instant[]>();int capacity=0;
        try(var s=c.prepareStatement("SELECT capacity FROM p1_institution_capacity_v1 WHERE dataset_mode=? AND institution_id=?")){
            s.setString(1,service.datasetMode());s.setString(2,institution);try(var r=s.executeQuery()){if(r.next())capacity=r.getInt(1);}
        }
        try(var s=c.prepareStatement("SELECT staff_id,subject_key,institution_id,TIMESTAMPADD(MINUTE,-buffer_before,starts_at),TIMESTAMPADD(MINUTE,buffer_after,ends_at) FROM p1_visit_v1 WHERE dataset_mode=? AND visit_status='CONFIRMED' AND visit_id<>? AND TIMESTAMPADD(MINUTE,-buffer_before,starts_at)<? AND TIMESTAMPADD(MINUTE,buffer_after,ends_at)>?")){
            s.setString(1,service.datasetMode());s.setString(2,excluded);s.setTimestamp(3,Timestamp.from(high));s.setTimestamp(4,Timestamp.from(low));
            try(var r=s.executeQuery()){while(r.next()){
                if(staff.equals(r.getString(1)))throw new P1Failure(409,"STAFF_CONFLICT");
                if(subject.equals(r.getString(2)))throw new P1Failure(409,"SUBJECT_CONFLICT");
                if(institution.equals(r.getString(3)))occupancy.add(new Instant[]{r.getTimestamp(4).toInstant(),r.getTimestamp(5).toInstant()});
            }}
        }
        // Sweep endpoints: two disjoint existing groups must not be counted as simultaneous.
        if(capacity>0){
            var points=new TreeMap<Instant,Integer>();points.merge(low,1,Integer::sum);points.merge(high,-1,Integer::sum);
            for(var interval:occupancy){points.merge(interval[0].isBefore(low)?low:interval[0],1,Integer::sum);points.merge(interval[1].isAfter(high)?high:interval[1],-1,Integer::sum);}
            int count=0;for(int delta:points.values()){count+=delta;if(count>capacity)throw new P1Failure(409,"INSTITUTION_CAPACITY_CONFLICT");}
        }
        try(var s=c.prepareStatement("SELECT 1 FROM p1_staff_block_v1 WHERE dataset_mode=? AND staff_id=? AND starts_at<? AND ends_at>?")){
            s.setString(1,service.datasetMode());s.setString(2,staff);s.setTimestamp(3,Timestamp.from(high));s.setTimestamp(4,Timestamp.from(low));try(var r=s.executeQuery()){if(r.next())throw new P1Failure(409,"STAFF_UNAVAILABLE");}
        }
    }
    ArrayNode visits(Connection c,String id,boolean internal)throws Exception{
        var result=service.mapper.createArrayNode();
        try(var s=c.prepareStatement("SELECT * FROM p1_visit_v1 WHERE request_id=? AND dataset_mode=? ORDER BY starts_at,visit_id")){
            s.setString(1,id);s.setString(2,service.datasetMode());try(var r=s.executeQuery()){while(r.next()){
                var v=result.addObject().put("id",r.getString("visit_id")).put("status",r.getString("visit_status"))
                        .put("institutionId",r.getString("institution_id")).put("institutionName",Objects.toString(r.getString("institution_name_snapshot"),"机构名称未记录"));
                // Unconfirmed draft times/meeting instructions remain internal.
                boolean visible=internal||!r.getString("visit_status").equals("DRAFT");
                if(visible)v.put("start",r.getTimestamp("starts_at").toInstant().toString()).put("end",r.getTimestamp("ends_at").toInstant().toString()).put("meetingNote",r.getString("meeting_note"));
                else v.putNull("start").putNull("end").putNull("meetingNote");
                if(r.getTimestamp("actual_at")==null)v.putNull("actualAt");else v.put("actualAt",r.getTimestamp("actual_at").toInstant().toString());
                if(internal)v.put("revision",r.getInt("revision")).put("staffId",r.getString("staff_id")).put("bufferBefore",r.getInt("buffer_before")).put("bufferAfter",r.getInt("buffer_after"))
                        .put("familyConfirmed",r.getBoolean("family_confirmed")).put("institutionConfirmed",r.getBoolean("institution_confirmed"));
            }}
        }return result;
    }
    private void recompute(Connection c,String id)throws SQLException{
        try(var s=c.prepareStatement("UPDATE p1_service_request_v1 r SET request_status=CASE WHEN workflow_status IN ('CANCELLED','CLOSED') THEN workflow_status WHEN EXISTS (SELECT 1 FROM p1_visit_v1 v WHERE v.request_id=r.request_id AND visit_status='CONFIRMED') THEN 'CONFIRMED' WHEN EXISTS (SELECT 1 FROM p1_visit_v1 v WHERE v.request_id=r.request_id AND visit_status='ARRIVED') THEN 'VISITED' WHEN EXISTS (SELECT 1 FROM p1_visit_v1 v WHERE v.request_id=r.request_id AND visit_status='NO_SHOW') THEN 'NO_SHOW' ELSE workflow_status END,updated_at=? WHERE request_id=?")){
            s.setTimestamp(1,Timestamp.from(service.clock.instant()));s.setString(2,id);s.executeUpdate();
        }
    }
    private ObjectNode detail(Connection c,String id)throws Exception{
        var result=service.mapper.createObjectNode();result.set("item",service.item(c,id,null));enrichDetail(c,id,result);return result;
    }
    void enrichDetail(Connection c,String id,ObjectNode result)throws Exception{
        ((ObjectNode)result.path("item")).set("visits",visits(c,id,true));
        var events=result.has("events")?(ArrayNode)result.path("events"):result.putArray("events");
        try(var s=c.prepareStatement("SELECT operation_id,event_type,payload_json,occurred_at FROM p1_operation_event_v1 WHERE request_id=? ORDER BY occurred_at,operation_id")){
            s.setString(1,id);try(var r=s.executeQuery()){while(r.next()){
                var e=events.addObject().put("operationId",r.getString(1)).put("type",r.getString(2)).put("occurredAt",r.getTimestamp(4).toInstant().toString());e.set("details",service.mapper.readTree(r.getString(3)));
            }}
        }
        // Latest contact (not feedback) owns the pending action. Refusal clears it by validation.
        JsonNode latest=null;for(var e:events)if(e.path("type").asText().equals("FOLLOWUP")&&!e.path("details").path("result").asText().endsWith("FEEDBACK")
                &&Set.of("CONNECTED","NO_ANSWER","REFUSED").contains(e.path("details").path("result").asText()))latest=e.path("details");
        result.set("nextContact",latest==null?service.mapper.nullNode():latest);
    }
    public ObjectNode calendar(String cookie,String from,String to){
        service.requireAdminConfigured();Instant low=service.day(from,false),high=service.day(to,true);
        if(low==null||high==null||!low.isBefore(high)||Duration.between(low,high).toDays()>93)throw new P1Failure(400,"INVALID_FILTER");
        return service.transaction(c->{service.admin(c,cookie,null,false);var result=service.mapper.createObjectNode();var entries=result.putArray("visits");
            try(var s=c.prepareStatement("SELECT DISTINCT request_id FROM p1_visit_v1 WHERE dataset_mode=? AND starts_at<? AND ends_at>?")){
                s.setString(1,service.datasetMode());s.setTimestamp(2,Timestamp.from(high));s.setTimestamp(3,Timestamp.from(low));try(var r=s.executeQuery()){while(r.next())for(var v:visits(c,r.getString(1),true)){
                    if(Instant.parse(v.path("start").asText()).isBefore(high)&&Instant.parse(v.path("end").asText()).isAfter(low)){
                        var entry=(ObjectNode)v;entry.put("requestId",r.getString(1));entries.add(entry);
                    }
                }}
            }
            var blocks=result.putArray("blocks");try(var s=c.prepareStatement("SELECT block_id,staff_id,starts_at,ends_at FROM p1_staff_block_v1 WHERE dataset_mode=? AND starts_at<? AND ends_at>?")){
                s.setString(1,service.datasetMode());s.setTimestamp(2,Timestamp.from(high));s.setTimestamp(3,Timestamp.from(low));try(var r=s.executeQuery()){while(r.next())blocks.addObject().put("id",r.getString(1)).put("staffId",r.getString(2)).put("start",r.getTimestamp(3).toInstant().toString()).put("end",r.getTimestamp(4).toInstant().toString());}
            }
            var capacities=result.putArray("capacities");try(var s=c.prepareStatement("SELECT institution_id,capacity FROM p1_institution_capacity_v1 WHERE dataset_mode=? ORDER BY institution_id")){
                s.setString(1,service.datasetMode());try(var r=s.executeQuery()){while(r.next())capacities.addObject().put("institutionName",institutionName(c,r.getString(1))).put("capacity",r.getInt(2));}
            }return result;
        });
    }
    public ObjectNode resources(String cookie,String csrf,JsonNode b){
        service.requireAdminConfigured();fields(b,"action","blockId","staffId","start","end","institutionId","capacity");String action=string(b,"action",24,false);
        return service.transaction(c->{lock(c);service.admin(c,cookie,csrf,true);
            if(action.equals("BLOCK")){
                String id=identifier(b,"blockId"),staff=string(b,"staffId",80,false);Instant low=instant(b,"start"),high=instant(b,"end");if(!low.isBefore(high))throw new P1Failure(400,"INVALID_TIME");
                try(var s=c.prepareStatement("SELECT 1 FROM p1_visit_v1 WHERE dataset_mode=? AND staff_id=? AND visit_status='CONFIRMED' AND TIMESTAMPADD(MINUTE,-buffer_before,starts_at)<? AND TIMESTAMPADD(MINUTE,buffer_after,ends_at)>?")){
                    s.setString(1,service.datasetMode());s.setString(2,staff);s.setTimestamp(3,Timestamp.from(high));s.setTimestamp(4,Timestamp.from(low));try(var r=s.executeQuery()){if(r.next())throw new P1Failure(409,"STAFF_CONFLICT");}
                }
                try(var s=c.prepareStatement("SELECT dataset_mode,staff_id,starts_at,ends_at FROM p1_staff_block_v1 WHERE block_id=?")){
                    s.setString(1,id);try(var r=s.executeQuery()){if(r.next()){
                        if(!service.datasetMode().equals(r.getString(1))||!staff.equals(r.getString(2))||!low.equals(r.getTimestamp(3).toInstant())||!high.equals(r.getTimestamp(4).toInstant()))throw new P1Failure(409,"IDEMPOTENCY_CONFLICT");return service.mapper.createObjectNode().put("saved",true);
                    }}
                }
                try(var s=c.prepareStatement("INSERT INTO p1_staff_block_v1 VALUES(?,?,?,?,?,?)")){
                    s.setString(1,id);s.setString(2,service.datasetMode());s.setString(3,staff);s.setTimestamp(4,Timestamp.from(low));s.setTimestamp(5,Timestamp.from(high));s.setTimestamp(6,Timestamp.from(service.clock.instant()));s.executeUpdate();
                }
            }else if(action.equals("REMOVE_BLOCK")){
                try(var s=c.prepareStatement("DELETE FROM p1_staff_block_v1 WHERE block_id=? AND dataset_mode=?")){s.setString(1,identifier(b,"blockId"));s.setString(2,service.datasetMode());s.executeUpdate();}
            }else if(action.equals("CAPACITY")){
                String institution=string(b,"institutionId",100,false);if(service.publications().knownName(c,institution)==null)throw new P1Failure(400,"INVALID_INPUT");int capacity=integer(b,"capacity",0,100);
                // Editing capacity with active reservations needs manual resolution first.
                try(var s=c.prepareStatement("SELECT 1 FROM p1_visit_v1 WHERE dataset_mode=? AND institution_id=? AND visit_status='CONFIRMED' AND TIMESTAMPADD(MINUTE,buffer_after,ends_at)>?")){
                    s.setString(1,service.datasetMode());s.setString(2,institution);s.setTimestamp(3,Timestamp.from(service.clock.instant()));try(var r=s.executeQuery()){if(r.next())throw new P1Failure(409,"ACTIVE_SCHEDULES_EXIST");}
                }
                try(var s=c.prepareStatement("DELETE FROM p1_institution_capacity_v1 WHERE dataset_mode=? AND institution_id=?")){s.setString(1,service.datasetMode());s.setString(2,institution);s.executeUpdate();}
                if(capacity>0)try(var s=c.prepareStatement("INSERT INTO p1_institution_capacity_v1 VALUES(?,?,?)")){s.setString(1,service.datasetMode());s.setString(2,institution);s.setInt(3,capacity);s.executeUpdate();}
            }else throw new P1Failure(400,"INVALID_INPUT");
            return service.mapper.createObjectNode().put("saved",true);
        });
    }
    public ObjectNode page(String cookie,String status,String kind,String institution,String from,String to,int limit,int offset){
        service.requireAdminConfigured();if(limit<1||limit>100||offset<0||status!=null&&!REQUEST_STATUSES.contains(status)
                ||kind!=null&&!Set.of("CONSULTATION","VISIT_INTENT").contains(kind)||institution!=null&&!institution(institution))throw new P1Failure(400,"INVALID_FILTER");
        Instant low=service.day(from,false),high=service.day(to,true);if(low!=null&&high!=null&&!low.isBefore(high))throw new P1Failure(400,"INVALID_FILTER");
        return service.transaction(c->{service.admin(c,cookie,null,false);var sql=new StringBuilder(" FROM p1_service_request_v1 r WHERE dataset_mode=?");var args=new ArrayList<Object>();args.add(service.datasetMode());
            if(status!=null){sql.append(" AND request_status=?");args.add(status);}if(kind!=null){sql.append(" AND request_kind=?");args.add(kind);}
            if(institution!=null){sql.append(" AND (institution_id=? OR EXISTS(SELECT 1 FROM p1_visit_v1 v WHERE v.request_id=r.request_id AND v.institution_id=?))");args.add(institution);args.add(institution);}
            if(low!=null){sql.append(" AND created_at>=?");args.add(Timestamp.from(low));}if(high!=null){sql.append(" AND created_at<?");args.add(Timestamp.from(high));}
            var result=service.mapper.createObjectNode();try(var s=c.prepareStatement("SELECT COUNT(*)"+sql)){for(int i=0;i<args.size();i++)s.setObject(i+1,args.get(i));try(var r=s.executeQuery()){r.next();result.put("total",r.getLong(1));}}
            var items=result.putArray("items");try(var s=c.prepareStatement("SELECT request_id"+sql+" ORDER BY created_at DESC,request_id DESC LIMIT ? OFFSET ?")){
                int i=0;for(var a:args)s.setObject(++i,a);s.setInt(++i,limit);s.setInt(++i,offset);try(var r=s.executeQuery()){while(r.next())items.add(service.item(c,r.getString(1),null));}
            }return result.put("offset",offset).put("hasMore",(long)offset+items.size()<result.path("total").asLong());
        });
    }
}
