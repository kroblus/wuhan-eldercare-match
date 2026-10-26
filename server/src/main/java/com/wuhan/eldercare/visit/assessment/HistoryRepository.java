package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import java.net.URI;
import java.sql.*;
import java.time.Instant;
import java.util.*;

/** Dedicated isolated JDBC store. No update/delete or unscoped read port. */
public final class HistoryRepository {
    private static final String TABLE="completed_assessment_history_test_only_v1";
    private static final String COLUMNS="id,completed_at,schema_version,assessment_contract_version,source,snapshot_revision,status";
    private final DataSource dataSource;
    private final ObjectMapper mapper;
    public HistoryRepository(DataSource dataSource,ObjectMapper mapper) {
        requireDisposable(dataSource); this.dataSource=dataSource; this.mapper=mapper;
    }
    public static void requireDisposable(DataSource source) {
        try(var connection=source.getConnection()) {
            String url=connection.getMetaData().getURL();
            if(!url.startsWith("jdbc:mysql://127.0.0.1:")) throw new IllegalArgumentException();
            URI uri=URI.create("http://"+url.substring(13));
            if(!"127.0.0.1".equals(uri.getHost()) || uri.getPort()<=0 || uri.getPort()==3306
                    || !uri.getPath().matches("/[a-zA-Z0-9_]*disposable[a-zA-Z0-9_]*")) throw new IllegalArgumentException();
        } catch(Exception ignored) { throw new IllegalStateException("isolated disposable MySQL required"); }
    }
    @FunctionalInterface public interface Transaction<T> { T apply(Connection connection) throws Exception; }
    public <T>T transaction(Transaction<T> task) {
        try(var connection=dataSource.getConnection()) {
            connection.setAutoCommit(false);
            connection.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
            try { T value=task.apply(connection); connection.commit(); return value;
            } catch(Exception failure) {
                connection.rollback();
                if(failure instanceof HistoryFailure known) throw known;
                throw new HistoryFailure(503,"ERROR");
            }
        } catch(HistoryFailure failure) { throw failure;
        } catch(Exception ignored) { throw new HistoryFailure(503,"ERROR"); }
    }
    public record Saved(String digest, HistoryMetadata item) { }
    public record Session(String id,String scope,String context,String createdAt) { }
    public record TrustedPreview(String id,String scope,String session,String owner,String elder,String environment,
            String displayBinding,String createdAt,String expiresAt,String state,String intent,String completion,
            JsonNode answers,JsonNode profileDisplay,JsonNode recommendationDisplay) { }
    public boolean legacyFence(Connection c,String scope,String owner,String elder) throws SQLException {
        // A late pre-Session request is readable, but its import cannot prove a retained Draft's identity.
        // Keep its recovery fence after automatic legacy association; no approved terminal release exists.
        try(var p=c.prepareStatement("SELECT 1 FROM history_assessment_session_test_only_v1 WHERE scope_id=? AND LEFT(draft_context,7)='legacy_' LIMIT 1")) {
            p.setString(1,scope);try(var r=p.executeQuery()){if(r.next())return true;}
        }
        try(var p=c.prepareStatement("SELECT 1 FROM history_save_intent_test_only_v1 i WHERE i.scope_id=? AND NOT EXISTS "
                +"(SELECT 1 FROM history_session_intent_test_only_v1 b WHERE b.intent_id=i.intent_id) LIMIT 1")) {
            p.setString(1,scope);try(var r=p.executeQuery()){if(r.next())return true;}
        }
        try(var p=c.prepareStatement("SELECT 1 FROM "+TABLE+" h WHERE owner_user_id=? AND elder_id=? AND NOT EXISTS "
                +"(SELECT 1 FROM history_session_completion_test_only_v1 b WHERE b.assessment_id=h.id) LIMIT 1")) {
            p.setString(1,owner);p.setString(2,elder);try(var r=p.executeQuery()){return r.next();}
        }
    }
    public boolean foreignContext(Connection c,String scope,String context) throws SQLException {
        try(var p=c.prepareStatement("SELECT 1 FROM history_assessment_session_test_only_v1 WHERE draft_context=? AND scope_id<>? LIMIT 1")) {
            p.setString(1,context);p.setString(2,scope);try(var r=p.executeQuery()){return r.next();}
        }
    }
    public boolean foreignClaim(Connection c,String scope,String context) throws SQLException {
        try(var p=c.prepareStatement("SELECT 1 FROM history_draft_context_claim_test_only_v1 WHERE draft_context=? AND scope_id<>?")) {
            p.setString(1,context);p.setString(2,scope);try(var r=p.executeQuery()){return r.next();}
        }
    }
    public void claimContext(Connection c,String scope,String context) throws SQLException {
        if(foreignContext(c,scope,context))throw new HistoryFailure(409,"CONTEXT_UNAVAILABLE");
        try(var p=c.prepareStatement("SELECT scope_id FROM history_draft_context_claim_test_only_v1 WHERE draft_context=? FOR UPDATE")) {
            p.setString(1,context);try(var r=p.executeQuery()){if(r.next()) {
                if(!scope.equals(r.getString(1)))throw new HistoryFailure(409,"CONTEXT_UNAVAILABLE");return;
            }}
        }
        try(var p=c.prepareStatement("INSERT INTO history_draft_context_claim_test_only_v1 VALUES (?,?)")) {
            p.setString(1,context);p.setString(2,scope);p.executeUpdate();
        }
    }
    public boolean hasSession(Connection c,String scope) throws SQLException {
        try(var p=c.prepareStatement("SELECT 1 FROM history_assessment_session_test_only_v1 WHERE scope_id=? LIMIT 1")) {
            p.setString(1,scope);try(var r=p.executeQuery()){return r.next();}
        }
    }
    public Session session(Connection c,String scope,String id) throws SQLException {
        try(var p=c.prepareStatement("SELECT session_id,scope_id,draft_context,created_at FROM history_assessment_session_test_only_v1 WHERE scope_id=? AND session_id=?")) {
            p.setString(1,scope);p.setString(2,id);try(var r=p.executeQuery()){if(!r.next())throw new HistoryFailure(404,"NOT_FOUND");return session(r);}
        }
    }
    private Session session(ResultSet r) throws SQLException {return new Session(r.getString(1),r.getString(2),r.getString(3),r.getTimestamp(4,utc()).toInstant().toString());}
    public Session sessionContext(Connection c,String scope,String context) throws SQLException {
        try(var p=c.prepareStatement("SELECT session_id,scope_id,draft_context,created_at FROM history_assessment_session_test_only_v1 WHERE scope_id=? AND draft_context=?")) {
            p.setString(1,scope);p.setString(2,context);try(var r=p.executeQuery()){return r.next()?session(r):null;}
        }
    }
    public Session successor(Connection c,String scope,String predecessor) throws SQLException {
        try(var p=c.prepareStatement("SELECT session_id,scope_id,draft_context,created_at FROM history_assessment_session_test_only_v1 WHERE scope_id=? AND predecessor_id=?")) {
            p.setString(1,scope);p.setString(2,predecessor);try(var r=p.executeQuery()){return r.next()?session(r):null;}
        }
    }
    public Session insertSession(Connection c,String scope,String context,String predecessor,java.time.Instant time) throws SQLException {
        String id=UUID.randomUUID().toString();try(var p=c.prepareStatement("INSERT INTO history_assessment_session_test_only_v1 VALUES (?,?,?,?,?)")) {
            p.setString(1,id);p.setString(2,scope);p.setString(3,context);p.setString(4,predecessor);p.setTimestamp(5,Timestamp.from(time),utc());p.executeUpdate();
        }return new Session(id,scope,context,time.toString());
    }
    public void assertSessionCapacity(Connection c,String owner,Instant now,HistoryIntentLimits limits) throws SQLException {
        try(var p=c.prepareStatement("SELECT COUNT(*),COALESCE(SUM(s.created_at>=?),0) FROM history_assessment_session_test_only_v1 s "
                +"JOIN history_save_scope_test_only_v1 o ON o.scope_id=s.scope_id WHERE o.owner_user_id=?")) {
            p.setTimestamp(1,Timestamp.from(now.minusSeconds(limits.windowSeconds())),utc());p.setString(2,owner);try(var r=p.executeQuery()) {
                if(!r.next()||r.getLong(1)>=limits.maxPerOwner()||r.getLong(2)>=limits.maxPerWindow())throw new HistoryFailure(429,"INTENT_CREATE_LIMITED");
            }
        }
    }
    public String sessionIntent(Connection c,String id) throws SQLException {
        try(var p=c.prepareStatement("SELECT intent_id FROM history_session_intent_test_only_v1 WHERE session_id=?")){p.setString(1,id);try(var r=p.executeQuery()){return r.next()?r.getString(1):null;}}
    }
    public String intentSession(Connection c,String intent) throws SQLException {
        try(var p=c.prepareStatement("SELECT session_id FROM history_session_intent_test_only_v1 WHERE intent_id=?")){p.setString(1,intent);try(var r=p.executeQuery()){return r.next()?r.getString(1):null;}}
    }
    public void bindIntent(Connection c,String session,String intent) throws SQLException {
        try(var p=c.prepareStatement("INSERT INTO history_session_intent_test_only_v1 VALUES (?,?)")){p.setString(1,session);p.setString(2,intent);p.executeUpdate();}
    }
    public boolean hasTrustedPreview(Connection c,String scope,String session) throws SQLException {
        try(var p=c.prepareStatement("SELECT 1 FROM history_trusted_preview_test_only_v1 WHERE scope_id=? AND session_id=? LIMIT 1")) {
            p.setString(1,scope);p.setString(2,session);try(var r=p.executeQuery()){return r.next();}
        }
    }
    public TrustedPreview activeTrustedPreview(Connection c,String scope,String session) throws Exception {
        try(var p=c.prepareStatement("SELECT * FROM history_trusted_preview_test_only_v1 WHERE scope_id=? AND session_id=? AND state='ACTIVE' FOR UPDATE")) {
            p.setString(1,scope);p.setString(2,session);try(var r=p.executeQuery()){return r.next()?trustedPreview(r):null;}
        }
    }
    public TrustedPreview latestTrustedPreview(Connection c,String scope,String session) throws Exception {
        try(var p=c.prepareStatement("SELECT * FROM history_trusted_preview_test_only_v1 WHERE scope_id=? AND session_id=? ORDER BY created_at DESC,preview_id DESC LIMIT 1 FOR UPDATE")) {
            p.setString(1,scope);p.setString(2,session);try(var r=p.executeQuery()){return r.next()?trustedPreview(r):null;}
        }
    }
    public TrustedPreview trustedPreview(Connection c,String scope,String id) throws Exception {
        try(var p=c.prepareStatement("SELECT * FROM history_trusted_preview_test_only_v1 WHERE scope_id=? AND preview_id=? FOR UPDATE")) {
            p.setString(1,scope);p.setString(2,id);try(var r=p.executeQuery()){return r.next()?trustedPreview(r):null;}
        }
    }
    public TrustedPreview trustedPreviewForIntent(Connection c,String scope,String intent) throws Exception {
        try(var p=c.prepareStatement("SELECT * FROM history_trusted_preview_test_only_v1 WHERE scope_id=? AND intent_id=? FOR UPDATE")) {
            p.setString(1,scope);p.setString(2,intent);try(var r=p.executeQuery()){return r.next()?trustedPreview(r):null;}
        }
    }
    private TrustedPreview trustedPreview(ResultSet r) throws Exception {
        return new TrustedPreview(r.getString("preview_id"),r.getString("scope_id"),r.getString("session_id"),
                r.getString("owner_user_id"),r.getString("elder_id"),r.getString("environment_id"),r.getString("display_binding"),
                r.getTimestamp("created_at",utc()).toInstant().toString(),r.getTimestamp("expires_at",utc()).toInstant().toString(),
                r.getString("state"),r.getString("intent_id"),r.getString("completion_id"),
                mapper.readTree(r.getString("assessment_answers")),mapper.readTree(r.getString("profile_display")),
                mapper.readTree(r.getString("recommendation_display")));
    }
    public void assertTrustedPreviewCapacity(Connection c,String owner,Instant now,HistoryIntentLimits limits) throws SQLException {
        try(var p=c.prepareStatement("SELECT COUNT(*),COALESCE(SUM(created_at>=?),0) FROM history_trusted_preview_test_only_v1 WHERE owner_user_id=?")) {
            p.setTimestamp(1,Timestamp.from(now.minusSeconds(limits.windowSeconds())),utc());p.setString(2,owner);
            try(var r=p.executeQuery()) {if(!r.next()||r.getLong(1)>=limits.maxPerOwner()||r.getLong(2)>=limits.maxPerWindow())
                throw new HistoryFailure(429,"PREVIEW_CREATE_LIMITED");}
        }
    }
    public void revokeTrustedPreview(Connection c,String id) throws SQLException {
        try(var p=c.prepareStatement("UPDATE history_trusted_preview_test_only_v1 SET state='REVOKED' WHERE preview_id=? AND state='ACTIVE'")) {
            p.setString(1,id);if(p.executeUpdate()!=1)throw new HistoryFailure(409,"PREVIEW_STATE_CONFLICT");
        }
    }
    public void insertTrustedPreview(Connection c,TrustedPreview candidate) throws Exception {
        try(var p=c.prepareStatement("INSERT INTO history_trusted_preview_test_only_v1 "
                +"(preview_id,scope_id,session_id,owner_user_id,elder_id,environment_id,display_binding,created_at,expires_at,assessment_answers,profile_display,recommendation_display,state) "
                +"VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'ACTIVE')")) {
            p.setString(1,candidate.id());p.setString(2,candidate.scope());p.setString(3,candidate.session());p.setString(4,candidate.owner());
            p.setString(5,candidate.elder());p.setString(6,candidate.environment());p.setString(7,candidate.displayBinding());
            p.setTimestamp(8,Timestamp.from(Instant.parse(candidate.createdAt())),utc());p.setTimestamp(9,Timestamp.from(Instant.parse(candidate.expiresAt())),utc());
            p.setString(10,mapper.writeValueAsString(candidate.answers()));p.setString(11,mapper.writeValueAsString(candidate.profileDisplay()));
            p.setString(12,mapper.writeValueAsString(candidate.recommendationDisplay()));p.executeUpdate();
        }
    }
    public void bindTrustedPreview(Connection c,String scope,String session,String preview,String binding,String intent,Instant now) throws SQLException {
        try(var p=c.prepareStatement("UPDATE history_trusted_preview_test_only_v1 SET state='BOUND',intent_id=? "
                +"WHERE scope_id=? AND session_id=? AND preview_id=? AND display_binding=? AND state='ACTIVE' AND expires_at>?")) {
            p.setString(1,intent);p.setString(2,scope);p.setString(3,session);p.setString(4,preview);p.setString(5,binding);
            p.setTimestamp(6,Timestamp.from(now),utc());if(p.executeUpdate()!=1)throw new HistoryFailure(409,"PREVIEW_UNAVAILABLE");
        }
    }
    public void consumeTrustedPreview(Connection c,String scope,String session,String preview,String intent,String completion) throws SQLException {
        try(var p=c.prepareStatement("UPDATE history_trusted_preview_test_only_v1 SET state='CONSUMED',completion_id=? "
                +"WHERE scope_id=? AND session_id=? AND preview_id=? AND intent_id=? AND state='BOUND'")) {
            p.setString(1,completion);p.setString(2,scope);p.setString(3,session);p.setString(4,preview);p.setString(5,intent);
            if(p.executeUpdate()!=1)throw new HistoryFailure(409,"PREVIEW_STATE_CONFLICT");
        }
    }
    public String sessionCompletion(Connection c,String session) throws SQLException {
        try(var p=c.prepareStatement("SELECT assessment_id FROM history_session_completion_test_only_v1 WHERE session_id=?")){p.setString(1,session);try(var r=p.executeQuery()){return r.next()?r.getString(1):null;}}
    }
    public void bindCompletion(Connection c,String session,String assessment) throws SQLException {
        try(var p=c.prepareStatement("INSERT INTO history_session_completion_test_only_v1 VALUES (?,?)")){p.setString(1,session);p.setString(2,assessment);p.executeUpdate();}
    }
    public String intentTime(Connection c,String intent) throws SQLException {
        try(var p=c.prepareStatement("SELECT created_at FROM history_save_intent_test_only_v1 WHERE intent_id=?")){p.setString(1,intent);try(var r=p.executeQuery()){if(!r.next())throw new HistoryFailure(404,"NOT_FOUND");return r.getTimestamp(1,utc()).toInstant().toString();}}
    }
    public String recoveryScope(Connection c,String owner,String elder) throws SQLException {
        try(var p=c.prepareStatement("SELECT scope_id FROM history_save_scope_test_only_v1 WHERE owner_user_id=? AND elder_id=?")) {
            p.setString(1,owner);p.setString(2,elder);try(var r=p.executeQuery()){if(r.next())return r.getString(1);}
        }
        String id=UUID.randomUUID().toString();
        try(var p=c.prepareStatement("INSERT INTO history_save_scope_test_only_v1 VALUES (?,?,?)")) {
            p.setString(1,id);p.setString(2,owner);p.setString(3,elder);p.executeUpdate();return id;
        }
    }
    public void prepareIntent(Connection c,String scope,String id,Instant created) throws SQLException {
        try(var p=c.prepareStatement("INSERT INTO history_save_intent_test_only_v1 VALUES (?,?,?)")) {
            p.setString(1,id);p.setString(2,scope);p.setTimestamp(3,Timestamp.from(created),utc());p.executeUpdate();
        }
    }
    /** Caller holds the authenticated session + current sole Elder row locks in this transaction. */
    public void assertIntentCapacity(Connection c,String owner,Instant now,HistoryIntentLimits limits) throws SQLException {
        try(var p=c.prepareStatement("SELECT COUNT(*),COALESCE(SUM(i.created_at>=?),0) FROM history_save_intent_test_only_v1 i "
                +"JOIN history_save_scope_test_only_v1 s ON s.scope_id=i.scope_id WHERE s.owner_user_id=?")) {
            p.setTimestamp(1,Timestamp.from(now.minusSeconds(limits.windowSeconds())),utc());p.setString(2,owner);
            try(var r=p.executeQuery()) {
                if(!r.next() || r.getLong(1)>=limits.maxPerOwner() || r.getLong(2)>=limits.maxPerWindow())
                    throw new HistoryFailure(429,"INTENT_CREATE_LIMITED");
            }
        }
    }
    public boolean ownsIntent(Connection c,String scope,String id) throws SQLException {
        try(var p=c.prepareStatement("SELECT intent_id FROM history_save_intent_test_only_v1 WHERE intent_id=? AND scope_id=?")) {
            p.setString(1,id);p.setString(2,scope);try(var r=p.executeQuery()){return r.next();}
        }
    }
    public Saved existing(Connection c,String owner,String key) throws SQLException {
        try(var p=c.prepareStatement("SELECT "+COLUMNS+",payload_digest FROM "+TABLE+" WHERE owner_user_id=? AND idempotency_key=?")) {
            p.setString(1,owner); p.setString(2,key);
            try(var rs=p.executeQuery()) { return rs.next()?new Saved(rs.getString("payload_digest"),metadata(rs)):null; }
        }
    }
    public void insert(Connection c,String owner,String elder,String key,String digest,HistoryMetadata item,JsonNode snapshot) throws Exception {
        try(var p=c.prepareStatement("INSERT INTO "+TABLE+" (id,owner_user_id,elder_id,idempotency_key,payload_digest,completed_at,schema_version,assessment_contract_version,source,snapshot_revision,status,snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")) {
            p.setString(1,item.id()); p.setString(2,owner); p.setString(3,elder); p.setString(4,key); p.setString(5,digest);
            p.setTimestamp(6,Timestamp.from(Instant.parse(item.completedAt())),utc());
            p.setInt(7,item.schemaVersion()); p.setString(8,item.assessmentContractVersion()); p.setString(9,item.source());
            p.setInt(10,item.snapshotRevision()); p.setString(11,item.status()); p.setString(12,mapper.writeValueAsString(snapshot));
            p.executeUpdate();
        }
    }
    public record Page(List<HistoryMetadata> items,String nextCursor) { }
    public void insertProfile(Connection c,String id,JsonNode display) throws Exception {
        try(var p=c.prepareStatement("INSERT INTO historical_profile_display_test_only_v1 (assessment_id,snapshot_version,display_snapshot) VALUES (?,1,?)")) {
            p.setString(1,id);p.setString(2,mapper.writeValueAsString(display));p.executeUpdate();
        }
    }
    public record Detail(HistoryMetadata item,JsonNode profileDisplay) { }
    public void insertRecommendation(Connection c,String id,JsonNode display) throws Exception {
        try(var p=c.prepareStatement("INSERT INTO historical_recommendation_display_test_only_v1 (assessment_id,snapshot_version,display_snapshot) VALUES (?,1,?)")) {
            p.setString(1,id);p.setString(2,mapper.writeValueAsString(display));p.executeUpdate();
        }
    }
    public record RecommendationDetail(HistoryMetadata item,String availability,JsonNode display) { }
    public RecommendationDetail recommendation(Connection c,String owner,String elder,String id) throws Exception {
        // Authorize against the completed row before any snapshot-table access; no raw Assessment answers.
        var item=ownedMetadata(c,owner,elder,id);
        try(var p=c.prepareStatement("SELECT snapshot_version,display_snapshot FROM historical_recommendation_display_test_only_v1 WHERE assessment_id=?")) {
            p.setString(1,id);try(var rs=p.executeQuery()) {
                if(!rs.next())return new RecommendationDetail(item,"unavailable",null);
                JsonNode display=mapper.readTree(rs.getString(2));
                Set<String> fields=new HashSet<>();display.fieldNames().forEachRemaining(fields::add);
                boolean version=rs.getInt(1)==1 && display.path("snapshotVersion").asInt()==1
                        && fields.equals(Set.of("kind","snapshotVersion","assessmentId","assessmentCompletedAt","assessmentSchemaVersion","versions","evaluationAsOf","source","state","elderReadiness","exactMatch","noExactMatch","cards","conditionalCandidates","nearMatches","advisories","poolRevisions"))
                        && "historical_recommendation_display_v1".equals(display.path("kind").asText())
                        && id.equals(display.path("assessmentId").asText())
                        && item.completedAt().equals(display.path("assessmentCompletedAt").asText())
                        && display.path("assessmentSchemaVersion").asInt()==2
                        && "recommendation-contract-v2".equals(display.path("versions").path("recommendationContractVersion").asText())
                        && "recommendation-ruleset-v2".equals(display.path("versions").path("recommendationRulesetVersion").asText())
                        && "conservative-exact-with-conditional-v1".equals(display.path("versions").path("policyVersion").asText())
                        && "elder-profile-contract-v2".equals(display.path("versions").path("elderProfileContractVersion").asText())
                        && "elder-profile-ruleset-v2".equals(display.path("versions").path("elderProfileDerivationRulesetVersion").asText())
                        && "adl-ruleset-v1".equals(display.path("versions").path("adlRulesetVersion").asText())
                        && "institution-contract-v1.1".equals(display.path("versions").path("institutionContractVersion").asText())
                        && "institution-capability-contract-v1".equals(display.path("versions").path("institutionCapabilityContractVersion").asText())
                        && "SERVER_FORMAL_RECOMMENDATION_CAPTURE_TEST_ONLY_V1".equals(display.path("source").path("kind").asText())
                        && "MOCK_DEVELOPMENT_ONLY".equals(display.path("source").path("datasetMode").asText());
                return new RecommendationDetail(item,version?"ready":"unsupported_version",version?display:null);
            }
        }
    }
    public Detail detail(Connection c,String owner,String elder,String id) throws Exception {
        HistoryMetadata item=ownedMetadata(c,owner,elder,id);
        JsonNode display=null;
        try(var d=c.prepareStatement("SELECT display_snapshot FROM historical_profile_display_test_only_v1 WHERE assessment_id=? AND snapshot_version=1")) {
            d.setString(1,id);try(var rs=d.executeQuery()){if(rs.next())display=mapper.readTree(rs.getString(1));}
        }
        return new Detail(item,display);
    }
    private HistoryMetadata ownedMetadata(Connection c,String owner,String elder,String id) throws SQLException {
        try(var p=c.prepareStatement("SELECT "+COLUMNS+" FROM "+TABLE+" WHERE owner_user_id=? AND elder_id=? AND id=? AND status='completed'")) {
            p.setString(1,owner);p.setString(2,elder);p.setString(3,id);
            try(var rs=p.executeQuery()){if(!rs.next())throw new HistoryFailure(404,"NOT_FOUND");return metadata(rs);}
        }
    }
    public Page list(Connection c,String owner,String elder,int limit,String cursor) throws SQLException {
        Instant after=null;
        if(cursor!=null) {
            try(var p=c.prepareStatement("SELECT completed_at FROM "+TABLE+" WHERE owner_user_id=? AND elder_id=? AND id=? AND status='completed'")) {
                p.setString(1,owner); p.setString(2,elder); p.setString(3,cursor);
                try(var rs=p.executeQuery()) { if(!rs.next()) throw new HistoryFailure(400,"INVALID_CURSOR"); after=rs.getTimestamp(1,utc()).toInstant(); }
            }
        }
        String boundary=after==null?"":" AND (completed_at<? OR (completed_at=? AND id<?))";
        try(var p=c.prepareStatement("SELECT "+COLUMNS+" FROM "+TABLE+" WHERE owner_user_id=? AND elder_id=? AND status='completed' AND schema_version=2 AND source=?"+boundary+" ORDER BY completed_at DESC,id DESC LIMIT ?")) {
            int index=1; p.setString(index++,owner); p.setString(index++,elder); p.setString(index++,HistoryMetadata.SOURCE);
            if(after!=null) {p.setTimestamp(index++,Timestamp.from(after),utc()); p.setTimestamp(index++,Timestamp.from(after),utc()); p.setString(index++,cursor);}
            p.setInt(index,limit+1);
            List<HistoryMetadata> items=new ArrayList<>();
            try(var rs=p.executeQuery()) {while(rs.next()) items.add(metadata(rs));}
            boolean more=items.size()>limit;
            if(more) items.removeLast();
            return new Page(List.copyOf(items),more?items.getLast().id():null);
        }
    }
    private HistoryMetadata metadata(ResultSet rs) throws SQLException {
        return new HistoryMetadata("completed_assessment",rs.getString("id"),rs.getString("status"),rs.getInt("schema_version"),
                rs.getTimestamp("completed_at",utc()).toInstant().toString(),rs.getString("assessment_contract_version"),rs.getString("source"),rs.getInt("snapshot_revision"));
    }
    private static Calendar utc() { return Calendar.getInstance(TimeZone.getTimeZone("UTC")); }
}
