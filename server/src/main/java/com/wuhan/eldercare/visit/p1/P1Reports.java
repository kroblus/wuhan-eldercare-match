package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Aggregate-only snapshot. Reads only IDs, times and enumerated categories, never contact/notes. */
public final class P1Reports {
    public static final String POLICY="p1-aggregate-v2-k5";
    private final P1Service service;
    public P1Reports(P1Service service){this.service=service;}
    private record Request(String id,Instant created,String kind,String source,String scenario,String institution){}
    private record Visit(String id,String request,String institution,String status,Instant actual,Instant updated){}
    private record Event(String request,String type,Instant at,String result,String institution,String source,String visit){}
    private boolean during(Instant at,Instant low,Instant high){return at!=null&&!at.isBefore(low)&&at.isBefore(high);}
    public ObjectNode preview(String cookie,String csrf,JsonNode body){
        service.requireAdminConfigured();var allowed=Set.of("from","to","institutionId","source");
        if(!body.isObject())throw new P1Failure(400,"INVALID_FILTER");body.fieldNames().forEachRemaining(n->{if(!allowed.contains(n))throw new P1Failure(400,"INVALID_FILTER");});
        String from=filter(body,"from",false),to=filter(body,"to",false),institution=filter(body,"institutionId",true),source=filter(body,"source",true);
        Instant low=service.day(from,false),high=service.day(to,true);
        if(low==null||high==null||!low.isBefore(high)||Duration.between(low,high).toDays()>3660
                ||institution!=null&&!service.operations().institution(institution)
                ||source!=null&&!Set.of("MINIPROGRAM","OFFLINE_MANUAL","SELF_TEST","SYNTHETIC_TEST_ONLY").contains(source))throw new P1Failure(400,"INVALID_FILTER");
        return service.transaction(c->{
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            var admin=service.admin(c,cookie,csrf,true);
            // A consistent repeatable-read snapshot is established by the first SELECT below.
            // No list limit, and no contact/phone/free-text/health answer is selected.
            var requests=new LinkedHashMap<String,Request>();
            try(var s=c.prepareStatement("SELECT request_id,created_at,request_kind,request_source,JSON_UNQUOTE(JSON_EXTRACT(input_json,'$.serviceScenario')),institution_id FROM p1_service_request_v1 WHERE dataset_mode=?"+(source==null?"":" AND request_source=?"))){
                s.setString(1,service.datasetMode());if(source!=null)s.setString(2,source);
                try(var r=s.executeQuery()){while(r.next())requests.put(r.getString(1),new Request(r.getString(1),r.getTimestamp(2).toInstant(),r.getString(3),r.getString(4),r.getString(5),r.getString(6)));}
            }
            var visits=new ArrayList<Visit>();
            try(var s=c.prepareStatement("SELECT visit_id,request_id,institution_id,visit_status,actual_at,updated_at FROM p1_visit_v1 WHERE dataset_mode=?")){
                s.setString(1,service.datasetMode());try(var r=s.executeQuery()){while(r.next())if(requests.containsKey(r.getString(2)))visits.add(new Visit(r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getTimestamp(5)==null?null:r.getTimestamp(5).toInstant(),r.getTimestamp(6).toInstant()));}
            }
            var events=new ArrayList<Event>();
            try(var s=c.prepareStatement("SELECT e.request_id,e.event_type,e.occurred_at,JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.result')),JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.institutionId')),JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.feedbackSource')),JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.visitId')) FROM p1_operation_event_v1 e JOIN p1_service_request_v1 r ON e.request_id=r.request_id WHERE r.dataset_mode=?")){
                s.setString(1,service.datasetMode());try(var r=s.executeQuery()){while(r.next())if(requests.containsKey(r.getString(1)))events.add(new Event(r.getString(1),r.getString(2),r.getTimestamp(3).toInstant(),r.getString(4),r.getString(5),r.getString(6),r.getString(7)));}
            }
            String snapshot=UUID.randomUUID().toString();Instant now=service.clock.instant();
            var report=service.mapper.createObjectNode().put("snapshotId",snapshot).put("policyVersion",POLICY).put("datasetMode",service.datasetMode())
                    .put("warning",service.synthetic()?"合成测试，不代表真实获客":"免费信息对接服务汇总")
                    .put("from",from).put("to",to).put("timeZone","Asia/Shanghai").put("generatedAt",now.toString())
                    .put("institutionName",institution==null?"平台去重总览":service.operations().institutionName(c,institution))
                    .put("sourceFilter",source==null?"全部来源（按数据环境隔离）":source);
            if(institution==null)report.putNull("institutionId");else report.put("institutionId",institution);
            var selected=associated(requests,visits,institution);
            var metrics=aggregate(selected,visits,events,institution,low,high,now);report.set("metrics",metrics);
            var institutions=report.putArray("institutions");
            if(institution!=null){var row=institutions.addObject().put("institutionName",service.operations().institutionName(c,institution));row.set("metrics",metrics);}
            else{
                var ids=new TreeSet<String>();for(var r:requests.values())if(r.institution()!=null)ids.add(r.institution());for(var v:visits)ids.add(v.institution());
                for(String id:ids){
                    var values=aggregate(associated(requests,visits,id),visits,events,id,low,high,now);
                    boolean activity=false;for(var value:values)if(value.isNumber()&&value.asDouble()>0)activity=true;
                    if(activity){var row=institutions.addObject().put("institutionName",service.operations().institutionName(c,id));row.set("metrics",values);}
                }
            }
            var cohort=selected.values().stream().filter(r->during(r.created(),low,high)&&!r.created().isAfter(now)).toList();
            var profiles=report.putArray("profiles");
            for(String dimension:List.of("区域","预算段","年龄段","日常协助"))profiles.addObject().put("dimension",dimension).put("category","未采集").put("count",cohort.size()).put("note","未读取旧问卷，不推断或补造");
            var scenarios=new TreeMap<String,Integer>();for(var r:cohort)scenarios.merge(r.scenario()==null?"UNDECIDED":r.scenario(),1,Integer::sum);
            // Whole-dimension suppression prevents deriving a small complementary category from totals.
            boolean suppress=scenarios.values().stream().anyMatch(n->n>0&&n<5);
            if(suppress)profiles.addObject().put("dimension","服务场景").put("category","小样本分布已抑制").putNull("count").put("note","任一非零分类少于5条时，整维不展示分类数量；不输出交叉画像");
            else if(scenarios.isEmpty())profiles.addObject().put("dimension","服务场景").put("category","暂无需求").put("count",0).put("note","分母为0，无可用占比");
            else for(var e:scenarios.entrySet())profiles.addObject().put("dimension","服务场景").put("category",scenarioName(e.getKey())).put("count",e.getValue()).put("note","当前独立服务意向中的自述，不是护理评级");
            var sources=report.putArray("sources");for(String value:List.of("MINIPROGRAM","OFFLINE_MANUAL","SELF_TEST","SYNTHETIC_TEST_ONLY"))sources.addObject().put("source",value).put("count",cohort.stream().filter(r->r.source().equals(value)).count());
            long unknown=cohort.stream().filter(r->!Set.of("MINIPROGRAM","OFFLINE_MANUAL","SELF_TEST","SYNTHETIC_TEST_ONLY").contains(r.source())).count();sources.addObject().put("source","UNKNOWN").put("count",unknown);
            var rules=report.putArray("rules");
            for(String rule:List.of(
                "所有日期采用北京时间，开始日00:00至结束日次日00:00，半开区间；生成时刻为观察截止日。",
                "新需求按创建时间计数并按request_id去重。不是老人或家庭总人数；平台去重数不可由机构行相加。",
                "同批需求指筛选期间创建且截止生成时已存在的关联需求。到访/接通/反馈转化均以这同一批需求为分母；分母0时无可用比率。",
                "期间联系/确认/改期按记录事件发生时间，到访/未到访按明确填报的实际时间；与同批需求转化分开。",
                "确认场次只计首次双方确认事件，改期单列；重复操作不重复。到访场次与去重到访需求分别统计。",
                "机构关联采用生成时明确选择的目标或独立看院记录。关联需求的联系记录可能在多家机构报告中出现，不可相加为平台总数。",
                "单机构仅包含本机构的看院和有来源反馈；带看意向需求为关联需求的申请类型，不是该机构承诺的接待能力。",
                "入住反馈必须注明家属/机构/顾问来源，未知另列；不推断入住、不表示签约或收入。无访问埋点，不报告UV/PV。",
                "区域/预算/年龄/日常协助未结构化采集，保持未采集。服务场景任一非零类别不足5条时整维抑制，不输出敏感交叉组合。",
                "仅聚合数据，无个人或隐藏明细。合成、员工自测、线下和小程序来源分别计数；当前未提供线下录入或自测标记入口。",
                "预览和Excel读取同一持久化聚合快照。业务变化后请重新生成；生成期间使用同一MySQL一致性读视图。"))rules.add(rule);
            try(var s=c.prepareStatement("INSERT INTO p1_report_snapshot_v1 VALUES(?,?,?,?,?,?)")){
                s.setString(1,snapshot);s.setString(2,service.datasetMode());s.setString(3,admin.username());s.setString(4,body.toString());s.setString(5,report.toString());s.setTimestamp(6,Timestamp.from(now));s.executeUpdate();
            }return report;
        });
    }
    private String filter(JsonNode b,String field,boolean optional){var n=b.get(field);if(optional&&(n==null||n.isNull()||n.isTextual()&&n.asText().isEmpty()))return null;if(n==null||!n.isTextual()||n.asText().length()>100)throw new P1Failure(400,"INVALID_FILTER");return n.asText();}
    private LinkedHashMap<String,Request> associated(Map<String,Request> all,List<Visit> visits,String institution){
        if(institution==null)return new LinkedHashMap<>(all);var ids=new HashSet<String>();for(var v:visits)if(institution.equals(v.institution()))ids.add(v.request());
        var result=new LinkedHashMap<String,Request>();for(var r:all.values())if(institution.equals(r.institution())||ids.contains(r.id()))result.put(r.id(),r);return result;
    }
    private ObjectNode aggregate(Map<String,Request> requests,List<Visit> allVisits,List<Event> allEvents,String institution,Instant low,Instant high,Instant cutoff){
        var cohort=new HashSet<String>();long intents=0;for(var r:requests.values())if(during(r.created(),low,high)&&!r.created().isAfter(cutoff)){cohort.add(r.id());if(r.kind().equals("VISIT_INTENT"))intents++;}
        long contacts=0,connected=0,noAnswer=0,refused=0,confirmed=0,rescheduled=0,moved=0,notMoved=0,unknownFeedback=0;
        var contactedCohort=new HashSet<String>();var movedCohort=new HashSet<String>();
        for(var e:allEvents){
            if(!requests.containsKey(e.request())||e.at().isAfter(cutoff))continue;
            boolean period=during(e.at(),low,high);
            if(e.type().equals("FOLLOWUP")){
                if(Set.of("CONNECTED","NO_ANSWER","REFUSED").contains(Objects.toString(e.result(),""))){
                    if(period){contacts++;if(e.result().equals("CONNECTED"))connected++;else if(e.result().equals("NO_ANSWER"))noAnswer++;else refused++;}
                    if(e.result().equals("CONNECTED")&&cohort.contains(e.request()))contactedCohort.add(e.request());
                }else if(Set.of("FAMILY","INSTITUTION","CONSULTANT").contains(Objects.toString(e.source(),""))&&(institution==null||institution.equals(e.institution()))){
                    if(period){if("MOVED_IN".equals(e.result()))moved++;else if("NOT_MOVED_IN".equals(e.result()))notMoved++;else if("UNKNOWN_FEEDBACK".equals(e.result()))unknownFeedback++;}
                    if("MOVED_IN".equals(e.result())&&cohort.contains(e.request()))movedCohort.add(e.request());
                }
            }else if(period&&(institution==null||institution.equals(e.institution()))){
                if(e.type().equals("VISIT_CONFIRM"))confirmed++;if(e.type().equals("VISIT_RESCHEDULE"))rescheduled++;
            }
        }
        long arrivals=0,noShows=0,cancelled=0;var arrivedRequests=new HashSet<String>();var arrivedCohort=new HashSet<String>();
        for(var v:allVisits){if(!requests.containsKey(v.request())||institution!=null&&!institution.equals(v.institution()))continue;
            if(v.status().equals("ARRIVED")&&v.actual()!=null&&!v.actual().isAfter(cutoff)){
                if(during(v.actual(),low,high)){arrivals++;arrivedRequests.add(v.request());}if(cohort.contains(v.request()))arrivedCohort.add(v.request());
            }
            if(v.status().equals("NO_SHOW")&&during(v.actual(),low,high)&&!v.actual().isAfter(cutoff))noShows++;
            if(v.status().equals("CANCELLED")&&during(v.updated(),low,high)&&!v.updated().isAfter(cutoff))cancelled++;
        }
        var m=service.mapper.createObjectNode().put("newRequests",cohort.size()).put("visitIntentRequests",intents).put("contactEvents",contacts).put("connectedEvents",connected)
                .put("noAnswerEvents",noAnswer).put("refusedEvents",refused).put("confirmedSessions",confirmed).put("rescheduledEvents",rescheduled)
                .put("arrivedSessions",arrivals).put("arrivedRequests",arrivedRequests.size()).put("noShowSessions",noShows).put("cancelledSessions",cancelled)
                .put("movedInFeedbackEvents",moved).put("notMovedInFeedbackEvents",notMoved).put("unknownFeedbackEvents",unknownFeedback)
                .put("cohortDenominator",cohort.size()).put("cohortContactedRequests",contactedCohort.size()).put("cohortArrivedRequests",arrivedCohort.size()).put("cohortMovedInRequests",movedCohort.size());
        if(cohort.isEmpty())m.putNull("cohortArrivalRate");else m.put("cohortArrivalRate",(double)arrivedCohort.size()/cohort.size());return m;
    }
    private String scenarioName(String value){return switch(value){case "LONG_TERM"->"长期养老";case "SHORT_STAY"->"短期托养";case "POST_OPERATION"->"术后阶段";default->"尚未确定 / 未采集";};}
    public ObjectNode snapshot(String cookie,String csrf,String id){
        service.requireAdminConfigured();if(!P1Service.uuid(id))throw new P1Failure(400,"INVALID_INPUT");
        return service.transaction(c->{var admin=service.admin(c,cookie,csrf,true);ObjectNode result;
            try(var s=c.prepareStatement("SELECT report_json FROM p1_report_snapshot_v1 WHERE snapshot_id=? AND dataset_mode=?")){
                s.setString(1,id);s.setString(2,service.datasetMode());try(var r=s.executeQuery()){if(!r.next())throw new P1Failure(404,"NOT_FOUND");result=(ObjectNode)service.mapper.readTree(r.getString(1));}
            }
            try(var s=c.prepareStatement("INSERT INTO p1_report_export_v1(snapshot_id,admin_username,exported_at) VALUES(?,?,?)")){
                s.setString(1,id);s.setString(2,admin.username());s.setTimestamp(3,Timestamp.from(service.clock.instant()));s.executeUpdate();
            }return result;
        });
    }
}
