package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.institution.application.*;
import com.wuhan.eldercare.visit.institution.persistence.NodeInstitutionSnapshotValidator;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Small institution publishing workflow. Published records remain in the existing immutable version store. */
public final class P1Publications {
    public static final String CONTRACT="institution-publications-v1";
    private static final long MAX_REVISION=9_007_199_254_740_991L;
    private final P1Service service;
    private final InstitutionRevisionRepository repository;
    private final boolean enabled;
    private final NodeInstitutionSnapshotValidator template;

    P1Publications(P1Service service,InstitutionRevisionRepository repository,boolean enabled,String nodeExecutable){
        this.service=service;this.repository=repository;this.enabled=enabled;
        template=new NodeInstitutionSnapshotValidator(nodeExecutable,service.mapper);
    }
    boolean enabled(){return enabled&&service.hasDatabase()&&repository.supportsTransactionalPublication();}
    private void requireEnabled(){if(!enabled())throw new P1Failure(503,"PUBLICATION_UNAVAILABLE");}
    public void authorize(String cookie,String csrf,boolean mutation){requireEnabled();service.publicationAdmin(cookie,csrf,mutation);}
    ObjectNode envelope(){return service.mapper.createObjectNode().put("contractVersion",CONTRACT).put("dataEnvironment",service.datasetMode());}
    private static void id(String id){if(id==null||!id.matches("[a-z][a-z0-9-]{1,99}"))throw new P1Failure(400,"INVALID_INPUT");}
    private static void fields(JsonNode body,String... names){InstitutionPublicProfile.exact(body,Set.of(names));}
    private static String text(JsonNode body,String field,int max){var v=body.get(field);if(v==null||!v.isTextual()||!P1Service.text(v.asText(),max,false))throw new P1Failure(400,"INVALID_INPUT");return v.asText();}
    private static long revision(JsonNode body,String key){var v=body.get(key);if(v==null||!v.isIntegralNumber()||!v.canConvertToLong()||v.longValue()<0||v.longValue()>=MAX_REVISION)throw new P1Failure(400,"INVALID_INPUT");return v.longValue();}
    private static String operation(JsonNode body){String op=text(body,"operationId",36);if(!P1Service.uuid(op))throw new P1Failure(400,"INVALID_INPUT");return op;}
    static String canonical(JsonNode value){
        if(value==null||value.isNull())return "null";
        if(value.isArray()){var result=new ArrayList<String>();value.forEach(v->result.add(canonical(v)));return "["+String.join(",",result)+"]";}
        if(value.isObject()){var names=new TreeSet<String>();value.fieldNames().forEachRemaining(names::add);var result=new ArrayList<String>();for(String name:names)result.add(value.get(name).getNodeType()+":"+name.length()+":"+name+":"+canonical(value.get(name)));return "{"+String.join(",",result)+"}";}
        return value.toString();
    }
    private static String digest(JsonNode body){return P1Service.digest(canonical(body));}
    private static String contentDigest(JsonNode record,JsonNode profile){return P1Service.digest(canonical(record)+"\n"+canonical(profile));}
    private static void recordShape(String institution,JsonNode record){
        if(record==null||!record.isObject()||!institution.equals(record.path("institutionId").asText())
                ||!"institution-contract-v1.2.1".equals(record.path("contractVersion").asText())
                ||!"PRODUCTION_CANDIDATE".equals(record.path("recordProvenance").asText()))throw new P1Failure(400,"INVALID_RECORD");
    }
    private long head(Connection c,String institution)throws SQLException{
        try(var s=c.prepareStatement("SELECT record_revision FROM institution_current_head_v1 WHERE institution_id=?")){
            s.setString(1,institution);try(var r=s.executeQuery()){return r.next()?r.getLong(1):0;}
        }
    }
    private boolean publicScope(Connection c,String institution,long rev)throws SQLException{
        try(var s=c.prepareStatement("SELECT dataset_mode FROM institution_publication_scope_v1 WHERE institution_id=? AND record_revision=?")){
            s.setString(1,institution);s.setLong(2,rev);try(var r=s.executeQuery()){return r.next()&&service.datasetMode().equals(r.getString(1));}
        }
    }
    private boolean belongsEnvironment(Connection c,String institution)throws SQLException{
        try(var s=c.prepareStatement("SELECT dataset_mode FROM institution_publication_scope_v1 WHERE institution_id=? LIMIT 1")){
            s.setString(1,institution);try(var r=s.executeQuery()){return !r.next()||service.datasetMode().equals(r.getString(1));}
        }
    }
    private void environment(Connection c,String institution)throws SQLException{if(!belongsEnvironment(c,institution))throw new P1Failure(404,"NOT_FOUND");}
    private void bindScope(Connection c,String institution,long rev,String source)throws SQLException{
        try(var s=c.prepareStatement("INSERT IGNORE INTO institution_publication_scope_v1 (institution_id,record_revision,dataset_mode,publication_source) VALUES(?,?,?,?)")){
            s.setString(1,institution);s.setLong(2,rev);s.setString(3,service.datasetMode());s.setString(4,source);s.executeUpdate();
        }
        // An importer may have waited for the core sequence lock while another environment bound this revision.
        try(var s=c.prepareStatement("SELECT dataset_mode FROM institution_publication_scope_v1 WHERE institution_id=? AND record_revision=? FOR UPDATE")){
            s.setString(1,institution);s.setLong(2,rev);try(var r=s.executeQuery()){
                if(!r.next()||!service.datasetMode().equals(r.getString(1)))throw new P1Failure(409,"PUBLICATION_ENVIRONMENT_CONFLICT");
            }
        }
    }
    private JsonNode exactRecord(Connection c,String institution,long rev)throws Exception{
        if(rev<1)return null;
        try(var s=c.prepareStatement("SELECT snapshot_json FROM institution_record_revision_v1 WHERE institution_id=? AND record_revision=?")){
            s.setString(1,institution);s.setLong(2,rev);try(var r=s.executeQuery()){return r.next()?service.mapper.readTree(r.getString(1)):null;}
        }
    }
    private JsonNode exactProfile(Connection c,String institution,long rev)throws Exception{
        try(var s=c.prepareStatement("SELECT public_profile_json FROM institution_publication_v1 WHERE institution_id=? AND record_revision=? AND dataset_mode=?")){
            s.setString(1,institution);s.setLong(2,rev);s.setString(3,service.datasetMode());try(var r=s.executeQuery()){return r.next()&&r.getString(1)!=null?service.mapper.readTree(r.getString(1)):null;}
        }
    }
    private ObjectNode draft(Connection c,String institution,boolean lock)throws Exception{
        environment(c,institution);
        long current=head(c,institution);var item=service.mapper.createObjectNode().put("institutionId",institution).put("draftRevision",0).put("baseRecordRevision",current)
                .put("currentRecordRevision",current).put("status","NONE");
        if(current==0)item.putNull("currentRecordRevision");
        JsonNode record=exactRecord(c,institution,current),profile=exactProfile(c,institution,current);
        item.set("record",record==null?service.mapper.nullNode():record);item.set("publicProfile",profile==null?service.mapper.nullNode():profile);item.putNull("confirmation");
        if(current==0)item.putNull("publishedRecordRevision");else item.put("publishedRecordRevision",current);
        try(var s=c.prepareStatement("SELECT * FROM institution_publication_draft_v1 WHERE dataset_mode=? AND institution_id=?"+(lock?" FOR UPDATE":""))){
            s.setString(1,service.datasetMode());s.setString(2,institution);try(var r=s.executeQuery()){if(r.next()){
                item.put("draftRevision",r.getLong("draft_revision")).put("baseRecordRevision",r.getLong("base_record_revision")).put("status",r.getString("workflow_status"));
                item.set("record",service.mapper.readTree(r.getString("record_json")));String p=r.getString("public_profile_json");item.set("publicProfile",p==null?service.mapper.nullNode():service.mapper.readTree(p));
                item.put("updatedAt",r.getTimestamp("updated_at").toInstant().toString());
                if(r.getString("confirmed_digest")!=null)item.putObject("confirmation").put("sourceReference",r.getString("source_reference")).put("confirmedBy",r.getString("confirmed_by"))
                        .put("confirmedOn",r.getDate("confirmed_on").toLocalDate().toString()).put("confirmedAt",r.getTimestamp("confirmed_at").toInstant().toString());
                long published=r.getLong("published_record_revision");if(r.wasNull())item.putNull("publishedRecordRevision");else item.put("publishedRecordRevision",published);
            }}
        }
        item.set("serviceAccess",access(c,institution));return item;
    }
    public ObjectNode getDraft(String cookie,String institution){id(institution);authorize(cookie,null,false);return service.transaction(c->{service.admin(c,cookie,null,false);var result=envelope();result.set("item",draft(c,institution,false));return result;});}
    public ObjectNode template(String cookie,String institution){id(institution);authorize(cookie,null,false);JsonNode record=template.draftTemplate(institution);if(record==null)throw new P1Failure(503,"VALIDATOR_UNAVAILABLE");var result=envelope();result.set("record",record);result.putNull("publicProfile");return result;}
    public ObjectNode list(String cookie){
        authorize(cookie,null,false);return service.transaction(c->{service.admin(c,cookie,null,false);var result=envelope();var items=result.putArray("items");
            var ids=new TreeSet<String>();
            try(var s=c.prepareStatement("SELECT institution_id FROM institution_current_head_v1 UNION SELECT institution_id FROM institution_publication_draft_v1 WHERE dataset_mode=? UNION SELECT institution_id FROM p1_institution_access_v1 WHERE dataset_mode=?")){
                s.setString(1,service.datasetMode());s.setString(2,service.datasetMode());try(var r=s.executeQuery()){while(r.next())ids.add(r.getString(1));}
            }
            for(String institution:ids){
                if(!belongsEnvironment(c,institution))continue;
                var d=draft(c,institution,false);var row=items.addObject().put("institutionId",institution).put("name",d.path("record").path("identity").path("name").path("value").asText(institution))
                    .put("draftRevision",d.path("draftRevision").asLong()).put("status",d.path("status").asText());
                row.set("currentRecordRevision",d.get("currentRecordRevision"));row.set("serviceAccess",d.get("serviceAccess"));if(d.has("updatedAt"))row.set("updatedAt",d.get("updatedAt"));else row.putNull("updatedAt");
            }
            result.set("institutions",institutions(c,true));result.set("serviceInstitutions",institutions(c,false));return result;
        });
    }
    public ObjectNode save(String cookie,String csrf,String institution,JsonNode body,boolean create){
        id(institution);authorize(cookie,csrf,true);fields(body,create?new String[]{"institutionId","record","publicProfile"}:new String[]{"expectedDraftRevision","record","publicProfile"});
        if(create&&!institution.equals(text(body,"institutionId",100)))throw new P1Failure(400,"INVALID_INPUT");
        JsonNode record=body.get("record"),profile=body.get("publicProfile");recordShape(institution,record);
        if(profile==null||(!profile.isNull()&&!profile.isObject()))throw new P1Failure(400,"INVALID_PUBLIC_PROFILE");
        long expected=create?0:revision(body,"expectedDraftRevision");
        return service.transaction(c->{service.operations().lock(c);var admin=service.admin(c,cookie,csrf,true);var old=draft(c,institution,true);long oldRevision=old.path("draftRevision").asLong();
            if(oldRevision!=expected)throw new P1Failure(409,"STALE_DRAFT_REVISION");long current=head(c,institution);
            long base=oldRevision==0||old.path("status").asText().equals("PUBLISHED")?current:old.path("baseRecordRevision").asLong();
            if(base!=current)throw new P1Failure(409,"BASE_REVISION_CONFLICT");
            try(var s=c.prepareStatement("INSERT INTO institution_publication_draft_v1 (dataset_mode,institution_id,draft_revision,base_record_revision,workflow_status,record_json,public_profile_json,content_digest,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE draft_revision=VALUES(draft_revision),base_record_revision=VALUES(base_record_revision),workflow_status='DRAFT',record_json=VALUES(record_json),public_profile_json=VALUES(public_profile_json),content_digest=VALUES(content_digest),confirmed_digest=NULL,source_reference=NULL,confirmed_by=NULL,confirmed_on=NULL,confirmed_at=NULL,confirmed_actor=NULL,published_record_revision=NULL,updated_at=VALUES(updated_at),updated_by=VALUES(updated_by)")){
                s.setString(1,service.datasetMode());s.setString(2,institution);s.setLong(3,oldRevision+1);s.setLong(4,base);s.setString(5,"DRAFT");s.setString(6,service.mapper.writeValueAsString(record));s.setString(7,profile.isNull()?null:service.mapper.writeValueAsString(profile));s.setString(8,contentDigest(record,profile));s.setTimestamp(9,Timestamp.from(service.clock.instant()));s.setString(10,admin.username());s.executeUpdate();
            }
            var result=envelope();result.set("item",draft(c,institution,false));return result;
        });
    }
    public ObjectNode confirm(String cookie,String csrf,String institution,JsonNode body){
        id(institution);authorize(cookie,csrf,true);fields(body,"expectedDraftRevision","sourceReference","confirmedBy","confirmedOn");long expected=revision(body,"expectedDraftRevision");
        String source=text(body,"sourceReference",1000),by=text(body,"confirmedBy",80),day=text(body,"confirmedOn",10);LocalDate confirmed;
        try{if(!day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw new DateTimeException("date");confirmed=LocalDate.parse(day);}
        catch(DateTimeException failure){throw new P1Failure(400,"INVALID_CONFIRMATION_DATE");}
        if(confirmed.isAfter(service.clock.instant().atZone(ZoneId.of("Asia/Shanghai")).toLocalDate()))throw new P1Failure(400,"INVALID_CONFIRMATION_DATE");
        return service.transaction(c->{service.operations().lock(c);var admin=service.admin(c,cookie,csrf,true);var d=draft(c,institution,true);if(expected==0||d.path("draftRevision").asLong()!=expected)throw new P1Failure(409,"STALE_DRAFT_REVISION");
            if(d.path("status").asText().equals("PUBLISHED"))throw new P1Failure(409,"CONFIRMATION_REQUIRED");
            if(head(c,institution)!=d.path("baseRecordRevision").asLong())throw new P1Failure(409,"BASE_REVISION_CONFLICT");
            InstitutionPublicProfile.validate(d.get("publicProfile"),d.get("record"));
            try(var s=c.prepareStatement("UPDATE institution_publication_draft_v1 SET draft_revision=draft_revision+1,workflow_status='CONFIRMED',confirmed_digest=content_digest,source_reference=?,confirmed_by=?,confirmed_on=?,confirmed_at=?,confirmed_actor=?,updated_at=?,updated_by=? WHERE dataset_mode=? AND institution_id=?")){
                s.setString(1,source);s.setString(2,by);s.setDate(3,java.sql.Date.valueOf(confirmed));s.setTimestamp(4,Timestamp.from(service.clock.instant()));s.setString(5,admin.username());s.setTimestamp(6,Timestamp.from(service.clock.instant()));s.setString(7,admin.username());s.setString(8,service.datasetMode());s.setString(9,institution);s.executeUpdate();
            }
            var result=envelope();result.set("item",draft(c,institution,false));return result;
        });
    }
    public ObjectNode publish(String cookie,String csrf,String institution,JsonNode body){
        id(institution);authorize(cookie,csrf,true);fields(body,"operationId","expectedDraftRevision");String op=operation(body);long expected=revision(body,"expectedDraftRevision");String requestDigest=digest(body);
        return service.transaction(c->{service.operations().lock(c);var admin=service.admin(c,cookie,csrf,true);
            try(var s=c.prepareStatement("SELECT * FROM institution_publication_v1 WHERE operation_id=?")){
                s.setString(1,op);try(var r=s.executeQuery()){if(r.next()){
                    if(!institution.equals(r.getString("institution_id"))||!service.datasetMode().equals(r.getString("dataset_mode"))||!requestDigest.equals(r.getString("request_digest")))throw new P1Failure(409,"IDEMPOTENCY_CONFLICT");
                    return publishedResponse(c,institution,r.getLong("record_revision"),"REPLAYED",r.getTimestamp("published_at").toInstant());
                }}
            }
            var d=draft(c,institution,true);if(expected==0||d.path("draftRevision").asLong()!=expected)throw new P1Failure(409,"STALE_DRAFT_REVISION");
            if(!d.path("status").asText().equals("CONFIRMED")||d.path("confirmation").isNull())throw new P1Failure(409,"CONFIRMATION_REQUIRED");
            var record=(ObjectNode)d.get("record");var profile=d.get("publicProfile");InstitutionPublicProfile.validate(profile,record);
            String hash=contentDigest(record,profile);String confirmedDigest,confirmedActor;
            try(var s=c.prepareStatement("SELECT confirmed_digest,confirmed_actor FROM institution_publication_draft_v1 WHERE dataset_mode=? AND institution_id=?")){s.setString(1,service.datasetMode());s.setString(2,institution);try(var r=s.executeQuery()){r.next();confirmedDigest=r.getString(1);confirmedActor=r.getString(2);}}
            if(!hash.equals(confirmedDigest))throw new P1Failure(409,"CONFIRMATION_REQUIRED");
            long base=d.path("baseRecordRevision").asLong();if(base>0&&!publicScope(c,institution,base))throw new P1Failure(409,"CATALOG_NOT_ADOPTED");
            Instant now=service.clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);var confirmation=d.path("confirmation");
            var pack=new InstitutionPublishPackageV1("web-"+op,confirmation.path("sourceReference").asText(),"ops:web-admin",record);
            var published=repository.publish(c,pack,now,d.path("baseRecordRevision").asLong());
            if(published.status()==InstitutionPublishResult.Status.CURRENT_REVISION_CONFLICT)throw new P1Failure(409,"BASE_REVISION_CONFLICT");
            if(published.status()==InstitutionPublishResult.Status.OPERATION_ID_CONFLICT||published.status()==InstitutionPublishResult.Status.REPLAYED)throw new P1Failure(409,"IDEMPOTENCY_CONFLICT");
            if(published.status()==InstitutionPublishResult.Status.INVALID_RECORD)throw new P1Failure(400,"INVALID_RECORD",published.validationIssues());
            if(published.status()!=InstitutionPublishResult.Status.PUBLISHED)throw new P1Failure(503,published.status()==InstitutionPublishResult.Status.VALIDATOR_UNAVAILABLE?"VALIDATOR_UNAVAILABLE":"PUBLICATION_UNAVAILABLE");
            bindScope(c,institution,published.recordRevision(),"WEB_PUBLICATION");
            try(var s=c.prepareStatement("INSERT INTO institution_publication_v1 (institution_id,record_revision,dataset_mode,operation_id,request_digest,draft_revision,content_digest,public_profile_json,source_reference,confirmed_by,confirmed_on,confirmed_at,confirmed_actor,published_at,published_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")){
                s.setString(1,institution);s.setLong(2,published.recordRevision());s.setString(3,service.datasetMode());s.setString(4,op);s.setString(5,requestDigest);s.setLong(6,expected);s.setString(7,hash);s.setString(8,profile.isNull()?null:service.mapper.writeValueAsString(profile));s.setString(9,confirmation.path("sourceReference").asText());s.setString(10,confirmation.path("confirmedBy").asText());s.setDate(11,java.sql.Date.valueOf(confirmation.path("confirmedOn").asText()));s.setTimestamp(12,Timestamp.from(Instant.parse(confirmation.path("confirmedAt").asText())));s.setString(13,confirmedActor);s.setTimestamp(14,Timestamp.from(now));s.setString(15,admin.username());s.executeUpdate();
            }
            try(var s=c.prepareStatement("UPDATE institution_publication_draft_v1 SET draft_revision=draft_revision+1,workflow_status='PUBLISHED',published_record_revision=?,updated_at=?,updated_by=? WHERE dataset_mode=? AND institution_id=?")){
                s.setLong(1,published.recordRevision());s.setTimestamp(2,Timestamp.from(now));s.setString(3,admin.username());s.setString(4,service.datasetMode());s.setString(5,institution);s.executeUpdate();
            }
            return publishedResponse(c,institution,published.recordRevision(),"PUBLISHED",now);
        });
    }
    private ObjectNode publishedResponse(Connection c,String institution,long revision,String status,Instant at)throws Exception{
        var result=envelope();result.set("item",draft(c,institution,false));result.putObject("publication").put("status",status).put("institutionId",institution).put("recordRevision",revision).put("publishedAt",at.toString());return result;
    }
    public ObjectNode catalog(){
        requireEnabled();return service.transaction(c->{var result=envelope();var catalog=result.putObject("catalog").put("datasetMode","PRODUCTION");var records=catalog.putArray("records");var pointers=catalog.putArray("currentPointers");var profiles=result.putArray("publicProfiles");
            try(var s=c.prepareStatement("SELECT h.institution_id,h.record_revision,r.snapshot_json,p.public_profile_json FROM institution_current_head_v1 h JOIN institution_record_revision_v1 r ON r.institution_id=h.institution_id AND r.record_revision=h.record_revision JOIN institution_publication_scope_v1 q ON q.institution_id=h.institution_id AND q.record_revision=h.record_revision AND q.dataset_mode=? LEFT JOIN institution_publication_v1 p ON p.institution_id=h.institution_id AND p.record_revision=h.record_revision AND p.dataset_mode=q.dataset_mode ORDER BY h.institution_id")){
                s.setString(1,service.datasetMode());try(var r=s.executeQuery()){while(r.next()){
                    if(records.size()>=200)throw new P1Failure(503,"PUBLICATION_UNAVAILABLE");JsonNode record=service.mapper.readTree(r.getString(3));
                    if(!record.path("recordStatus").asText().equals("published"))continue;
                    records.add(record);pointers.addObject().put("institutionId",r.getString(1)).put("recordRevision",r.getLong(2));
                    if(r.getString(4)!=null)profiles.addObject().put("institutionId",r.getString(1)).put("recordRevision",r.getLong(2)).set("profile",service.mapper.readTree(r.getString(4)));
                }}
            }
            catalog.put("datasetVersion","institution-publications-"+P1Service.digest(canonical(pointers)).substring(0,24));catalog.putObject("presentation").put("orderingPolicy","CANONICAL_IDENTITY_ASC_V1").putArray("displayOrder");return result;
        });
    }
    public ObjectNode exact(String institution,long rev){
        requireEnabled();id(institution);if(rev<1||rev>MAX_REVISION)throw new P1Failure(400,"INVALID_INPUT");return service.transaction(c->{if(!publicScope(c,institution,rev))throw new P1Failure(404,"NOT_FOUND");var record=exactRecord(c,institution,rev);if(record==null||!record.path("recordStatus").asText().equals("published"))throw new P1Failure(404,"NOT_FOUND");var result=envelope().put("institutionId",institution).put("recordRevision",rev);result.set("record",record);JsonNode profile=exactProfile(c,institution,rev);result.set("publicProfile",profile==null?service.mapper.nullNode():profile);return result;});
    }

    public ObjectNode importBaseline(String cookie,String csrf,JsonNode body){
        authorize(cookie,csrf,true);fields(body,body.has("historicalRecords")?new String[]{"operationId","sourceReference","preserveExistingFacts","catalog","historicalRecords"}:new String[]{"operationId","sourceReference","preserveExistingFacts","catalog"});String op=operation(body),source=text(body,"sourceReference",1000);
        if(!body.path("preserveExistingFacts").isBoolean()||!body.path("preserveExistingFacts").asBoolean())throw new P1Failure(400,"INVALID_INPUT");
        JsonNode catalog=body.get("catalog");fields(catalog,"datasetVersion","datasetMode","records","currentPointers","presentation");
        text(catalog,"datasetVersion",200);if(!"PRODUCTION".equals(catalog.path("datasetMode").asText())||!catalog.path("records").isArray()
                ||!catalog.path("currentPointers").isArray()||catalog.path("records").isEmpty()||catalog.path("records").size()>200)throw new P1Failure(400,"INVALID_INPUT");
        JsonNode presentation=catalog.path("presentation");fields(presentation,"orderingPolicy","displayOrder");
        if(!"CANONICAL_IDENTITY_ASC_V1".equals(presentation.path("orderingPolicy").asText())||!presentation.path("displayOrder").isArray()||!presentation.path("displayOrder").isEmpty())throw new P1Failure(400,"INVALID_INPUT");
        var records=new TreeMap<String,ObjectNode>();
        for(JsonNode record:catalog.path("records")){String institution=record.path("institutionId").asText();id(institution);recordShape(institution,record);
            if(!record.path("recordRevision").isIntegralNumber()||!record.path("recordRevision").canConvertToLong()||record.path("recordRevision").longValue()<1
                    ||record.path("recordRevision").longValue()>MAX_REVISION||records.put(institution,(ObjectNode)record)!=null)throw new P1Failure(400,"INVALID_INPUT");}
        var seen=new HashSet<String>();
        for(JsonNode pointer:catalog.path("currentPointers")){fields(pointer,"institutionId","recordRevision");String institution=pointer.path("institutionId").asText();JsonNode record=records.get(institution);
            if(record==null||!seen.add(institution)||!pointer.path("recordRevision").isIntegralNumber()||!pointer.path("recordRevision").canConvertToLong()||pointer.path("recordRevision").longValue()!=record.path("recordRevision").longValue())throw new P1Failure(400,"INVALID_INPUT");}
        if(seen.size()!=records.size())throw new P1Failure(400,"INVALID_INPUT");
        var historical=new ArrayList<ObjectNode>();var historicalIdentities=new HashSet<String>();
        if(body.has("historicalRecords")){
            JsonNode past=body.get("historicalRecords");if(!past.isArray()||past.size()>2000)throw new P1Failure(400,"INVALID_INPUT");
            for(JsonNode record:past){String institution=record.path("institutionId").asText();id(institution);recordShape(institution,record);JsonNode current=records.get(institution);
                if(current==null||!record.path("recordRevision").isIntegralNumber()||!record.path("recordRevision").canConvertToLong()
                        ||record.path("recordRevision").longValue()<1||record.path("recordRevision").longValue()>=current.path("recordRevision").longValue()
                        ||!historicalIdentities.add(institution+":"+record.path("recordRevision").longValue()))throw new P1Failure(400,"INVALID_INPUT");
                historical.add((ObjectNode)record);
            }
        }
        String hash=digest(body);
        return service.transaction(c->{service.operations().lock(c);var admin=service.admin(c,cookie,csrf,true);
            try(var s=c.prepareStatement("SELECT dataset_mode,request_digest,imported_count FROM institution_baseline_import_v1 WHERE operation_id=?")){s.setString(1,op);try(var r=s.executeQuery()){if(r.next()){
                if(!service.datasetMode().equals(r.getString(1))||!hash.equals(r.getString(2)))throw new P1Failure(409,"IDEMPOTENCY_CONFLICT");return envelope().put("imported",r.getInt(3)).put("replayed",true);
            }}}
            int index=0;var all=new ArrayList<ObjectNode>(historical);all.addAll(records.values());
            all.sort(Comparator.comparing((ObjectNode r)->r.path("institutionId").asText()).thenComparingLong(r->r.path("recordRevision").longValue()));
            for(var record:all){
                if(!belongsEnvironment(c,record.path("institutionId").asText()))throw new P1Failure(409,"PUBLICATION_ENVIRONMENT_CONFLICT");
                boolean promote=record.path("recordRevision").longValue()==records.get(record.path("institutionId").asText()).path("recordRevision").longValue();
                var result=repository.importBaseline(c,record,"baseline-"+op+"-"+(++index),source,service.clock.instant(),promote);
                if(result.status()==InstitutionPublishResult.Status.BASELINE_REVISION_CONFLICT)throw new P1Failure(409,"BASELINE_REVISION_CONFLICT");
                if(result.status()==InstitutionPublishResult.Status.INVALID_RECORD)throw new P1Failure(400,"INVALID_RECORD",result.validationIssues());
                if(result.status()!=InstitutionPublishResult.Status.PUBLISHED&&result.status()!=InstitutionPublishResult.Status.REPLAYED)throw new P1Failure(503,result.status()==InstitutionPublishResult.Status.VALIDATOR_UNAVAILABLE?"VALIDATOR_UNAVAILABLE":"PUBLICATION_UNAVAILABLE");
                bindScope(c,result.institutionId(),result.recordRevision(),"BASELINE_IMPORT");
            }
            try(var s=c.prepareStatement("INSERT INTO institution_baseline_import_v1 VALUES(?,?,?,?,?,?)")){s.setString(1,op);s.setString(2,service.datasetMode());s.setString(3,hash);s.setInt(4,index);s.setString(5,admin.username());s.setTimestamp(6,Timestamp.from(service.clock.instant()));s.executeUpdate();}
            return envelope().put("imported",index).put("replayed",false);
        });
    }

    ObjectNode access(Connection c,String institution)throws SQLException{
        var result=service.mapper.createObjectNode().put("enabled",false).put("accessRevision",0);
        try(var s=c.prepareStatement("SELECT enabled,access_revision FROM p1_institution_access_v1 WHERE dataset_mode=? AND institution_id=?")){
            s.setString(1,service.datasetMode());s.setString(2,institution);try(var r=s.executeQuery()){if(r.next())result.put("enabled",r.getBoolean(1)).put("accessRevision",r.getLong(2));}
        }return result;
    }
    ArrayNode institutions(Connection c,boolean onlyEnabled)throws Exception{
        var rows=service.mapper.createArrayNode();try(var s=c.prepareStatement("SELECT institution_id,public_name,enabled,access_revision FROM p1_institution_access_v1 WHERE dataset_mode=?"+(onlyEnabled?" AND enabled=1":"")+" ORDER BY institution_id")){
            s.setString(1,service.datasetMode());try(var r=s.executeQuery()){while(r.next()){
                long current=head(c,r.getString(1));JsonNode record=exactRecord(c,r.getString(1),current);boolean published=record!=null&&record.path("recordStatus").asText().equals("published")&&publicScope(c,r.getString(1),current);
                if(onlyEnabled&&current>0&&!published)continue;
                String name=published?record.path("identity").path("name").path("value").asText():r.getString(2);
                var item=rows.addObject().put("institutionId",r.getString(1)).put("institutionName",name);
                if(!published)item.putNull("recordRevision");else item.put("recordRevision",current);
                if(!onlyEnabled)item.put("enabled",r.getBoolean(3)).put("accessRevision",r.getLong(4));
            }}
        }return rows;
    }
    public ObjectNode serviceAccess(String cookie,String csrf,String institution,JsonNode body){
        requireEnabled();id(institution);authorize(cookie,csrf,true);fields(body,"operationId","expectedAccessRevision","enabled","sourceReference");String op=operation(body),source=text(body,"sourceReference",1000);long expected=revision(body,"expectedAccessRevision");if(!body.path("enabled").isBoolean())throw new P1Failure(400,"INVALID_INPUT");String requestDigest=digest(body);
        return service.transaction(c->{service.operations().lock(c);var admin=service.admin(c,cookie,csrf,true);
            try(var s=c.prepareStatement("SELECT dataset_mode,institution_id,request_digest,result_json FROM p1_institution_access_event_v1 WHERE operation_id=?")){s.setString(1,op);try(var r=s.executeQuery()){if(r.next()){
                if(!service.datasetMode().equals(r.getString(1))||!institution.equals(r.getString(2))||!requestDigest.equals(r.getString(3)))throw new P1Failure(409,"IDEMPOTENCY_CONFLICT");var result=envelope();result.set("access",service.mapper.readTree(r.getString(4)));return result;
            }}}
            var previous=access(c,institution);if(previous.path("accessRevision").asLong()!=expected)throw new P1Failure(409,"STALE_ACCESS_REVISION");
            long current=head(c,institution);JsonNode record=exactRecord(c,institution,current);boolean active=body.path("enabled").asBoolean();
            if(active&&(record==null||!record.path("recordStatus").asText().equals("published")||!publicScope(c,institution,current)))throw new P1Failure(400,"INSTITUTION_NOT_PUBLISHED");
            String name=record==null?knownName(c,institution):record.path("identity").path("name").path("value").asText();if(name==null)throw new P1Failure(404,"NOT_FOUND");
            try(var s=c.prepareStatement("INSERT INTO p1_institution_access_v1 (dataset_mode,institution_id,public_name,enabled,access_revision,source_reference,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE public_name=VALUES(public_name),enabled=VALUES(enabled),access_revision=VALUES(access_revision),source_reference=VALUES(source_reference),updated_at=VALUES(updated_at),updated_by=VALUES(updated_by)")){
                s.setString(1,service.datasetMode());s.setString(2,institution);s.setString(3,name);s.setBoolean(4,active);s.setLong(5,expected+1);s.setString(6,source);s.setTimestamp(7,Timestamp.from(service.clock.instant()));s.setString(8,admin.username());s.executeUpdate();
            }
            var access=service.mapper.createObjectNode().put("institutionId",institution).put("institutionName",name).put("enabled",active).put("accessRevision",expected+1);if(current==0)access.putNull("recordRevision");else access.put("recordRevision",current);
            try(var s=c.prepareStatement("INSERT INTO p1_institution_access_event_v1 VALUES(?,?,?,?,?,?,?)")){s.setString(1,op);s.setString(2,service.datasetMode());s.setString(3,institution);s.setString(4,requestDigest);s.setString(5,service.mapper.writeValueAsString(access));s.setString(6,admin.username());s.setTimestamp(7,Timestamp.from(service.clock.instant()));s.executeUpdate();}
            var result=envelope();result.set("access",access);return result;
        });
    }
    String knownName(Connection c,String institution)throws Exception{
        if(institution==null)return null;
        try(var s=c.prepareStatement("SELECT public_name FROM p1_institution_access_v1 WHERE dataset_mode=? AND institution_id=?")){s.setString(1,service.datasetMode());s.setString(2,institution);try(var r=s.executeQuery()){return r.next()?r.getString(1):null;}}
    }
    String acceptingName(Connection c,String institution)throws Exception{
        if(institution==null)return null;
        try(var s=c.prepareStatement("SELECT enabled,public_name FROM p1_institution_access_v1 WHERE dataset_mode=? AND institution_id=? FOR UPDATE")){
            s.setString(1,service.datasetMode());s.setString(2,institution);try(var r=s.executeQuery()){
                if(!r.next()||!r.getBoolean(1))throw new P1Failure(400,"INSTITUTION_UNAVAILABLE");
                long current=head(c,institution);JsonNode record=exactRecord(c,institution,current);
                if(current>0&&(record==null||!record.path("recordStatus").asText().equals("published")||!publicScope(c,institution,current)))throw new P1Failure(400,"INSTITUTION_UNAVAILABLE");
                return record==null?r.getString(2):record.path("identity").path("name").path("value").asText();
            }
        }
    }
}
