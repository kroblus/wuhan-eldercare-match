package com.wuhan.eldercare.visit.history;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import javax.sql.DataSource;
import java.sql.*;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Single-elder, explicit prepare/confirm protocol. All authorization and writes share one transaction.
 * No client userId/elderId/result is accepted. No engine runs during reads or confirmation. */
public final class C2HistoryService {
    public static final String CONTRACT = "formal-single-elder-history-v1";
    private final DataSource database;
    private final AuthEvidenceResolver auth;
    private final ElderRecordRepository elders;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final C2SnapshotEngine engine;
    private final C2CatalogSource sources;
    private final C2DataPolicy policy;
    private final boolean writesEnabled;
    public C2HistoryService(DataSource database, AuthEvidenceResolver auth, ElderRecordRepository elders,
            ObjectMapper mapper, Clock clock, C2SnapshotEngine engine, C2CatalogSource sources,
            C2DataPolicy policy, boolean writesEnabled) {
        this.database = database; this.auth = auth; this.elders = elders; this.mapper = mapper;
        this.clock = clock; this.engine = engine; this.sources = sources; this.policy = policy;
        this.writesEnabled = writesEnabled;
    }
    public record Capability(String contractVersion, boolean readsAvailable, boolean writesAvailable) { }
    public record Consent(String consentId, String noticeVersion, String acceptedAt) { }
    public record Item(String recordId, String savedAt, String state, String trustedStatus) { }
    public record Prepared(String status, String intentId, String resultVersion, String displayBinding,
                           String expiresAt, JsonNode display, Item receipt) { }
    public record Detail(String availability, Item item, JsonNode display) { }
    public record Page(List<Item> items, String nextCursor) { }
    private record Scope(String owner, String elder) { }
    private record Intent(String elder, String consentId, String version, String binding, JsonNode answers,
                          JsonNode snapshot, JsonNode source, Instant expires, String recordId) { }

    public Capability capability() {
        return new Capability(CONTRACT, readable(), readable() && writesEnabled && policy != null && sources != null);
    }
    private boolean readable() {
        return database != null && auth.supportsTransactionalResolution() && elders.supportsTransactionScopedLookup();
    }
    public C2DataPolicy.Notice notice() { return writePolicy(); }
    private C2DataPolicy.Notice writePolicy() {
        if (!capability().writesAvailable()) throw new C2Failure(503, "UNAVAILABLE");
        var notice = policy.approvedNotice();
        if (notice == null) throw new C2Failure(503, "DATA_POLICY_UNAVAILABLE");
        return notice;
    }

    /** Evidence is a separate affirmative request, not inferred from viewing or saving a result. */
    public Consent consent(String evidence, String version, boolean accepted) {
        if (!accepted || version == null) throw new C2Failure(400, "INVALID_INPUT");
        return transaction(evidence, (connection, scope) -> {
            var notice = writePolicy();
            if (!notice.version().equals(version)) throw new C2Failure(409, "NOTICE_CHANGED");
            try (var query = connection.prepareStatement("SELECT consent_id, accepted_at, revoked_at, notice_json FROM c2_history_consent_v1 WHERE owner_id=? AND elder_id=? AND notice_version=? FOR UPDATE")) {
                query.setString(1, scope.owner); query.setString(2, scope.elder); query.setString(3, version);
                try (var rows = query.executeQuery()) {
                    if (rows.next()) {
                        if (rows.getTimestamp("revoked_at") != null) throw new C2Failure(403, "CONSENT_REVOKED");
                        if (!json(rows.getString("notice_json")).equals(mapper.valueToTree(notice))) throw new C2Failure(409, "NOTICE_CHANGED");
                        return new Consent(rows.getString("consent_id"), version, instant(rows, "accepted_at").toString());
                    }
                }
            }
            String id = UUID.randomUUID().toString(); Instant now = now();
            try (var insert = connection.prepareStatement("INSERT INTO c2_history_consent_v1(consent_id,owner_id,elder_id,notice_version,notice_json,accepted_at) VALUES(?,?,?,?,?,?)")) {
                insert.setString(1,id); insert.setString(2,scope.owner); insert.setString(3,scope.elder);
                insert.setString(4,version); insert.setString(5,encode(mapper.valueToTree(notice))); timestamp(insert,6,now);
                insert.executeUpdate();
            }
            return new Consent(id,version,now.toString());
        });
    }

    public Prepared prepare(String evidence, String intentId, String assessmentVersion, JsonNode answers, String consentId) {
        uuid(intentId); uuid(consentId);
        if (!"assessment-contract-v2".equals(assessmentVersion)) throw new C2Failure(422,"UNSUPPORTED_VERSION");
        if (answers == null || !answers.isObject() || encode(answers).length() > 60000) throw new C2Failure(400,"INVALID_INPUT");
        // Copy at the untrusted boundary, before any asynchronous external calculation.
        JsonNode submitted = answers.deepCopy();
        return transaction(evidence, (connection, scope) -> {
            Intent previous = intent(connection,scope,intentId);
            if (previous != null) {
                if (!previous.answers.equals(submitted) || !previous.consentId.equals(consentId)) throw new C2Failure(409,"INTENT_CONFLICT");
                return prepared(connection,scope,intentId,previous);
            }
            var notice = writePolicy();
            requireConsent(connection,scope,consentId,notice);
            // Bound simultaneously actionable intents; expiry never silently creates a new save intent.
            try (var query = connection.prepareStatement("SELECT COUNT(*) FROM c2_history_intent_v1 WHERE owner_id=? AND record_id IS NULL AND expires_at > ?")) {
                query.setString(1,scope.owner);
                timestamp(query,2,now());
                try (var rows = query.executeQuery()) { rows.next(); if (rows.getInt(1) >= 16) throw new C2Failure(429,"PENDING_LIMIT"); }
            }
            var capture = sources.capture();
            if (capture == null || !sources.authorizes(capture)) throw new C2Failure(503,"SOURCE_UNAVAILABLE");
            Instant now = now(), expires = now.plusSeconds(900);
            String version = UUID.randomUUID().toString(), binding = UUID.randomUUID().toString();
            ObjectNode completed = mapper.createObjectNode().put("kind","completed_assessment").put("id",version)
                    .put("elderId",scope.elder).put("status","completed").put("schemaVersion",2).put("completedAt",now.toString());
            completed.set("answers",submitted);
            JsonNode generated = engine.generate(completed,capture,now.toString());
            if (generated == null || generated.path("snapshotVersion").asInt() != 1
                    || !generated.path("completed").equals(completed) || !generated.path("profile").isObject()
                    || !generated.path("publicDisplay").isObject()) throw new C2Failure(503,"ENGINE_UNAVAILABLE");
            ObjectNode snapshot = generated.deepCopy();
            ObjectNode display = (ObjectNode)snapshot.path("publicDisplay");
            String state = display.path("state").asText();
            if (!Set.of("LEGACY_V2_DISPLAY","INITIAL_REFERENCE_ONLY","NO_PERSONALIZED_CANDIDATE").contains(state)
                    || !capture.catalog().path("datasetVersion").equals(display.path("datasetVersion"))
                    || !"PRODUCTION".equals(display.path("datasetMode").asText()) || !now.toString().equals(display.path("evaluationAsOf").asText()))
                throw new C2Failure(409,"RESULT_SOURCE_MISMATCH");
            display.put("resultVersion",version);
            display.put("sourceRelease",capture.releaseId()).put("sourceReference",capture.sourceReference());
            // Recheck after external work, still holding the same identity/binding locks.
            requireConsent(connection,scope,consentId,writePolicy());
            if (!sources.authorizes(capture)) throw new C2Failure(409,"RESULT_SOURCE_CHANGED");
            JsonNode source = mapper.valueToTree(capture);
            try (var insert = connection.prepareStatement("INSERT INTO c2_history_intent_v1(owner_id,elder_id,intent_id,consent_id,result_version,display_binding,answers_json,snapshot_json,source_json,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")) {
                insert.setString(1,scope.owner); insert.setString(2,scope.elder); insert.setString(3,intentId);
                insert.setString(4,consentId); insert.setString(5,version); insert.setString(6,binding);
                insert.setString(7,encode(submitted)); insert.setString(8,encode(snapshot)); insert.setString(9,encode(source));
                timestamp(insert,10,now); timestamp(insert,11,expires); insert.executeUpdate();
            }
            return new Prepared("REQUIRES_REDISPLAY_AND_CONFIRMATION",intentId,version,binding,expires.toString(),display,null);
        });
    }

    public Item confirm(String evidence, String intentId, String resultVersion, String binding) {
        uuid(intentId); uuid(resultVersion); uuid(binding);
        return transaction(evidence,(connection,scope) -> {
            Intent pending = intent(connection,scope,intentId);
            if (pending == null) throw new C2Failure(404,"INTENT_NOT_FOUND");
            if (!pending.version.equals(resultVersion) || !pending.binding.equals(binding)) throw new C2Failure(409,"RESULT_CONFIRMATION_MISMATCH");
            if (pending.recordId != null) return item(connection,scope,pending.recordId);
            var notice = writePolicy();
            requireConsent(connection,scope,pending.consentId,notice);
            if (!pending.expires.isAfter(now())) throw new C2Failure(409,"RESULT_EXPIRED");
            JsonNode pin = pending.source;
            var captured = new C2CatalogSource.Capture(pin.path("releaseId").asText(),pin.path("sourceReference").asText(),pin.path("catalog"));
            if (!sources.authorizes(captured)) throw new C2Failure(409,"RESULT_SOURCE_CHANGED");
            Instant saved = now(); String recordId = UUID.randomUUID().toString();
            String state = pending.snapshot.path("publicDisplay").path("state").asText();
            try (var insert = connection.prepareStatement("INSERT INTO c2_history_record_v1(record_id,owner_id,elder_id,intent_id,saved_at,result_state,snapshot_version,snapshot_json) VALUES(?,?,?,?,?,?,1,?)")) {
                insert.setString(1,recordId); insert.setString(2,scope.owner); insert.setString(3,scope.elder);
                insert.setString(4,intentId); timestamp(insert,5,saved); insert.setString(6,state);
                insert.setString(7,encode(pending.snapshot)); insert.executeUpdate();
            }
            try (var update = connection.prepareStatement("UPDATE c2_history_intent_v1 SET record_id=? WHERE owner_id=? AND intent_id=? AND record_id IS NULL")) {
                update.setString(1,recordId); update.setString(2,scope.owner); update.setString(3,intentId);
                if (update.executeUpdate()!=1) throw new C2Failure(503,"ERROR");
            }
            return new Item(recordId,saved.toString(),state,"SERVER_SAVED");
        });
    }

    /** Recovery uses the original intent and current authorization. Never generates a new idempotency key. */
    public Prepared reconcile(String evidence,String intentId) {
        uuid(intentId);
        return transaction(evidence,(connection,scope) -> {
            Intent pending = intent(connection,scope,intentId);
            if (pending == null) throw new C2Failure(404,"INTENT_NOT_FOUND");
            return prepared(connection,scope,intentId,pending);
        });
    }
    private Prepared prepared(Connection connection, Scope scope, String id, Intent pending) throws SQLException {
        if (pending.recordId != null) return new Prepared("SAVED",id,null,null,null,null,item(connection,scope,pending.recordId));
        if (!pending.expires.isAfter(now())) return new Prepared("RESULT_EXPIRED",id,null,null,null,null,null);
        return new Prepared("REQUIRES_REDISPLAY_AND_CONFIRMATION",id,pending.version,pending.binding,pending.expires.toString(),pending.snapshot.path("publicDisplay"),null);
    }
    public Page list(String evidence,int limit,String cursor) {
        if (limit<1 || limit>50) throw new C2Failure(400,"INVALID_INPUT");
        if (cursor!=null) uuid(cursor);
        return transaction(evidence,(connection,scope) -> {
            Item after = cursor==null?null:item(connection,scope,cursor);
            String sql="SELECT record_id,saved_at,result_state FROM c2_history_record_v1 WHERE owner_id=? AND elder_id=?";
            if (after!=null) sql+=" AND (saved_at < ? OR (saved_at = ? AND record_id < ?))";
            sql+=" ORDER BY saved_at DESC,record_id DESC LIMIT ?";
            var items=new ArrayList<Item>();
            try (var query=connection.prepareStatement(sql)) {
                query.setString(1,scope.owner); query.setString(2,scope.elder); int index=3;
                if (after!=null) { Instant time=Instant.parse(after.savedAt); timestamp(query,index++,time); timestamp(query,index++,time); query.setString(index++,cursor); }
                query.setInt(index,limit+1);
                try (var rows=query.executeQuery()) { while(rows.next())items.add(mapItem(rows)); }
            }
            boolean more=items.size()>limit; if(more)items.remove(items.size()-1);
            return new Page(List.copyOf(items),more?items.get(items.size()-1).recordId:null);
        });
    }
    public Detail detail(String evidence,String id) {
        uuid(id);
        return transaction(evidence,(connection,scope) -> {
            try (var query=connection.prepareStatement("SELECT record_id,saved_at,result_state,snapshot_version,snapshot_json FROM c2_history_record_v1 WHERE record_id=? AND owner_id=? AND elder_id=?")) {
                query.setString(1,id); query.setString(2,scope.owner); query.setString(3,scope.elder);
                try(var rows=query.executeQuery()) {
                    if(!rows.next())throw new C2Failure(404,"NOT_FOUND");
                    Item item=mapItem(rows);
                    if(rows.getInt("snapshot_version")!=1)return new Detail("UNSUPPORTED_VERSION",item,null);
                    JsonNode snapshot=json(rows.getString("snapshot_json"));
                    if(snapshot.path("snapshotVersion").asInt()!=1 || snapshot.path("publicDisplay").path("snapshotVersion").asInt()!=1)
                        return new Detail("UNSUPPORTED_VERSION",item,null);
                    return new Detail("READY",item,snapshot.path("publicDisplay"));
                }
            }
        });
    }
    private Intent intent(Connection connection,Scope scope,String id) throws SQLException {
        try(var query=connection.prepareStatement("SELECT * FROM c2_history_intent_v1 WHERE owner_id=? AND intent_id=? FOR UPDATE")) {
            query.setString(1,scope.owner); query.setString(2,id);
            try(var rows=query.executeQuery()) {
                if(!rows.next())return null;
                if(!scope.elder.equals(rows.getString("elder_id")))throw new C2Failure(403,"ELDER_SCOPE_CHANGED");
                return new Intent(rows.getString("elder_id"),rows.getString("consent_id"),rows.getString("result_version"),
                        rows.getString("display_binding"),json(rows.getString("answers_json")),json(rows.getString("snapshot_json")),
                        json(rows.getString("source_json")),instant(rows,"expires_at"),rows.getString("record_id"));
            }
        }
    }
    private void requireConsent(Connection connection,Scope scope,String id,C2DataPolicy.Notice notice) throws SQLException {
        try(var query=connection.prepareStatement("SELECT notice_json,revoked_at FROM c2_history_consent_v1 WHERE consent_id=? AND owner_id=? AND elder_id=? AND notice_version=? FOR UPDATE")) {
            query.setString(1,id); query.setString(2,scope.owner); query.setString(3,scope.elder); query.setString(4,notice.version());
            try(var rows=query.executeQuery()) {
                if(!rows.next() || rows.getTimestamp("revoked_at")!=null)throw new C2Failure(403,"CONSENT_REQUIRED");
                if(!json(rows.getString("notice_json")).equals(mapper.valueToTree(notice)))throw new C2Failure(409,"NOTICE_CHANGED");
            }
        }
    }
    private Item item(Connection connection,Scope scope,String id) throws SQLException {
        try(var query=connection.prepareStatement("SELECT record_id,saved_at,result_state FROM c2_history_record_v1 WHERE record_id=? AND owner_id=? AND elder_id=?")) {
            query.setString(1,id); query.setString(2,scope.owner); query.setString(3,scope.elder);
            try(var rows=query.executeQuery()){if(!rows.next())throw new C2Failure(404,"NOT_FOUND");return mapItem(rows);}
        }
    }
    private static Item mapItem(ResultSet rows)throws SQLException {
        return new Item(rows.getString("record_id"),instant(rows,"saved_at").toString(),rows.getString("result_state"),"SERVER_SAVED");
    }
    @FunctionalInterface private interface Work<T>{T run(Connection connection,Scope scope)throws SQLException;}
    private <T>T transaction(String evidence,Work<T> work) {
        if(!readable())throw new C2Failure(503,"UNAVAILABLE");
        try(var connection=database.getConnection()) {
            connection.setAutoCommit(false);
            try {
                var identity=auth.resolve(connection,evidence);
                if(identity.status()!=AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
                    if(Set.of(AuthEvidenceResolver.Resolution.Status.UNAVAILABLE,AuthEvidenceResolver.Resolution.Status.TECHNICAL_FAILURE).contains(identity.status()))
                        throw new C2Failure(503,"AUTH_UNAVAILABLE");
                    throw new C2Failure(401,"AUTH_REQUIRED");
                }
                String owner=identity.principal().userId();
                var binding=elders.findByResponsibleUserId(connection,owner);
                switch(binding.status()) {
                    case NOT_FOUND -> throw new C2Failure(403,"ELDER_BINDING_REQUIRED");
                    case UNAVAILABLE,TECHNICAL_FAILURE -> throw new C2Failure(503,"ELDER_SERVICE_UNAVAILABLE");
                    case FOUND -> { }
                }
                if(!owner.equals(binding.record().responsibleUserId()))throw new C2Failure(403,"ELDER_BINDING_REQUIRED");
                T value=work.run(connection,new Scope(owner,binding.record().elderId()));
                // A slow provider cannot turn an expired session into a successful receipt.
                var current=auth.resolve(connection,evidence);
                if(Set.of(AuthEvidenceResolver.Resolution.Status.UNAVAILABLE,AuthEvidenceResolver.Resolution.Status.TECHNICAL_FAILURE).contains(current.status()))
                    throw new C2Failure(503,"AUTH_UNAVAILABLE");
                if(current.status()!=AuthEvidenceResolver.Resolution.Status.AUTHENTICATED || !owner.equals(current.principal().userId()))
                    throw new C2Failure(401,"AUTH_REQUIRED");
                connection.commit(); return value;
            }catch(SQLException|RuntimeException failure){connection.rollback();throw failure;}
        }catch(C2Failure failure){throw failure;}
        catch(SQLException failure){throw new C2Failure(503,"ERROR");}
    }
    private Instant now(){return clock.instant().truncatedTo(ChronoUnit.MICROS);}
    private JsonNode json(String value){try{return mapper.readTree(value);}catch(Exception failure){throw new C2Failure(503,"ERROR");}}
    private String encode(JsonNode value){try{return mapper.writeValueAsString(value);}catch(Exception failure){throw new C2Failure(503,"ERROR");}}
    public static void uuid(String id){if(id==null||!id.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))throw new C2Failure(400,"INVALID_INPUT");}
    private static Calendar utc(){return Calendar.getInstance(TimeZone.getTimeZone("UTC"));}
    private static void timestamp(PreparedStatement query,int index,Instant value)throws SQLException{query.setTimestamp(index,Timestamp.from(value),utc());}
    private static Instant instant(ResultSet rows,String name)throws SQLException{return rows.getTimestamp(name,utc()).toInstant();}
}
