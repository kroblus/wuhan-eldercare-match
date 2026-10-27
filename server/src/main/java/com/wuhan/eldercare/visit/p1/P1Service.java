package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.*;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.util.*;

/** P1 contact/visit intent. No assessment completion, care eligibility or confirmed appointment is derived. */
public final class P1Service {
    public static final String CONTRACT = "p1-service-request-v1";
    public static final String INSTITUTION = "ningyue-yiyang-center";
    public record Settings(boolean enabled, boolean synthetic, String noticeVersion, String noticeText,
            String noticeApprovalRef, String platformPhone, String adminUsername, String adminPasswordHash) {}
    public record Input(String requestId, String inputVersion, String kind, String institutionId,
            String contactName, String contactPhone, String relationship, String serviceScenario,
            String preferredWindow, int partySize, String assistanceNote, String consentVersion, boolean consentAccepted) {}
    public record Login(String username, String token, String csrfToken) {}
    public record Admin(String username, String csrfToken) {}
    @FunctionalInterface interface Transaction<T> { T run(Connection connection) throws Exception; }
    private final DataSource database;
    private final AuthEvidenceResolver auth;
    final ObjectMapper mapper;
    final Clock clock;
    private final P1Operations operations;
    private final Settings settings;
    private final SecureRandom random = new SecureRandom();
    private int failedLogins;
    private Instant loginWindow = Instant.EPOCH;

    public P1Service(DataSource database, AuthEvidenceResolver auth, ObjectMapper mapper, Clock clock, Settings settings) {
        this.database = database; this.auth = auth; this.mapper = mapper; this.clock = clock; this.settings = settings;
        this.operations = new P1Operations(this);
    }
    public P1Operations operations() { return operations; }
    public boolean synthetic() { return settings.synthetic(); }
    public String datasetMode() { return synthetic() ? "SYNTHETIC_TEST_ONLY" : "PRODUCTION"; }
    private boolean noticeConfigured() {
        return text(settings.noticeVersion(), 80, false) && settings.noticeText()!=null
                && !settings.noticeText().isBlank() && settings.noticeText().length()<=5000 && settings.noticeText().indexOf('\0')<0
                && text(settings.noticeApprovalRef(), 200, false);
    }
    private boolean available() {
        return settings.enabled() && database != null && auth.supportsTransactionalResolution() && noticeConfigured();
    }
    private void requireAvailable() { if (!available()) throw new P1Failure(503, "SERVICE_UNAVAILABLE"); }
    public ObjectNode config() {
        var result = mapper.createObjectNode().put("contractVersion", CONTRACT).put("enabled", available())
                .put("datasetMode", datasetMode());
        var contact = result.putObject("platformContact").put("label", "平台咨询");
        if (validPhone(settings.platformPhone())) contact.put("phone", settings.platformPhone()); else contact.putNull("phone");
        if (available()) result.putObject("notice").put("version", settings.noticeVersion()).put("text", settings.noticeText());
        else result.putNull("notice");
        return result;
    }
    public Input validate(Input input) {
        if (input == null || !uuid(input.requestId()) || !CONTRACT.equals(input.inputVersion())
                || !Set.of("CONSULTATION", "VISIT_INTENT").contains(orEmpty(input.kind()))
                || (input.institutionId() != null && !INSTITUTION.equals(input.institutionId()))
                || !text(input.contactName(), 40, false) || !validPhone(input.contactPhone())
                || !Set.of("SELF", "FAMILY", "OTHER").contains(orEmpty(input.relationship()))
                || !Set.of("LONG_TERM", "SHORT_STAY", "POST_OPERATION", "UNDECIDED").contains(orEmpty(input.serviceScenario()))
                || !multilineText(input.preferredWindow(), 120) || !multilineText(input.assistanceNote(), 200)
                || input.partySize() < 1 || input.partySize() > 10 || !input.consentAccepted()
                || !settings.noticeVersion().equals(input.consentVersion())) throw new P1Failure(400, "INVALID_INPUT");
        return input;
    }
    public ObjectNode submit(String evidence, Input candidate) {
        requireAvailable(); var input = validate(candidate);
        return transaction(connection -> {
            var owner = owner(connection, evidence);
            String json = mapper.writeValueAsString(input);
            String digest = digest(json);
            String status = input.kind().equals("VISIT_INTENT") ? "PENDING_ARRANGEMENT" : "PENDING_CONTACT";
            Instant now = clock.instant();
            try (var statement = connection.prepareStatement("INSERT INTO p1_service_request_v1 "
                    + "(request_id,owner_user_id,input_digest,input_json,request_kind,institution_id,request_status,dataset_mode,request_source,created_at,updated_at,workflow_status) "
                    + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE request_id=request_id")) {
                statement.setString(1, input.requestId()); statement.setString(2, owner); statement.setString(3, digest);
                statement.setString(4, json); statement.setString(5, input.kind()); statement.setString(6, input.institutionId());
                statement.setString(7, status); statement.setString(8, datasetMode());
                statement.setString(9, synthetic() ? "SYNTHETIC_TEST_ONLY" : "MINIPROGRAM");
                statement.setTimestamp(10, Timestamp.from(now)); statement.setTimestamp(11, Timestamp.from(now)); statement.setString(12,status); statement.executeUpdate();
            }
            try (var statement = connection.prepareStatement("SELECT owner_user_id,input_digest,dataset_mode FROM p1_service_request_v1 WHERE request_id=? FOR UPDATE")) {
                statement.setString(1, input.requestId());
                try (var rows = statement.executeQuery()) {
                    if (!rows.next() || !owner.equals(rows.getString(1)) || !datasetMode().equals(rows.getString(3))) throw new P1Failure(404, "NOT_FOUND");
                    if (!digest.equals(rows.getString(2))) throw new P1Failure(409, "IDEMPOTENCY_CONFLICT");
                }
            }
            event(connection, input.requestId(), "REQUEST_SUBMITTED", owner, now);
            return item(connection, input.requestId(), owner);
        });
    }
    public List<ObjectNode> ownList(String evidence) {
        requireAvailable();
        return transaction(connection -> list(connection, owner(connection, evidence), null, null, null, null, null, 100));
    }
    public ObjectNode ownDetail(String evidence, String id) {
        requireAvailable(); if (!uuid(id)) throw new P1Failure(400, "INVALID_INPUT");
        return transaction(connection -> item(connection, id, owner(connection, evidence)));
    }
    public ObjectNode cancel(String evidence, String id) {
        requireAvailable(); if (!uuid(id)) throw new P1Failure(400, "INVALID_INPUT");
        return transaction(connection -> {
            operations.lock(connection);
            String owner = owner(connection, evidence);
            var current = item(connection, id, owner);
            if (!current.path("status").asText().equals("CANCELLED")) {
                if (current.path("visits").findValuesAsText("status").contains("ARRIVED")) throw new P1Failure(409,"VISIT_HISTORY_EXISTS");
                var now = clock.instant();
                try (var statement = connection.prepareStatement("UPDATE p1_service_request_v1 SET request_status='CANCELLED',workflow_status='CANCELLED',updated_at=? WHERE request_id=? AND owner_user_id=?")) {
                    statement.setTimestamp(1, Timestamp.from(now)); statement.setString(2, id); statement.setString(3, owner); statement.executeUpdate();
                }
                try(var statement=connection.prepareStatement("UPDATE p1_visit_v1 SET visit_status='CANCELLED',revision=revision+1,updated_at=? WHERE request_id=? AND visit_status IN ('DRAFT','CONFIRMED')")) {
                    statement.setTimestamp(1,Timestamp.from(now));statement.setString(2,id);statement.executeUpdate();
                }
                event(connection, id, "REQUEST_CANCELLED", owner, now);
            }
            return item(connection, id, owner);
        });
    }
    private String owner(Connection connection, String evidence) {
        var result = auth.resolve(connection, evidence);
        if (result.status() == AuthEvidenceResolver.Resolution.Status.UNAVAILABLE
                || result.status() == AuthEvidenceResolver.Resolution.Status.TECHNICAL_FAILURE) throw new P1Failure(503, "AUTH_UNAVAILABLE");
        if (result.status() != AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) throw new P1Failure(401, "AUTH_REQUIRED");
        return result.principal().userId();
    }
    private void event(Connection connection, String id, String type, String owner, Instant now) throws SQLException {
        try (var statement = connection.prepareStatement("INSERT IGNORE INTO p1_service_event_v1(request_id,event_type,occurred_at,actor_user_id) VALUES(?,?,?,?)")) {
            statement.setString(1,id); statement.setString(2,type); statement.setTimestamp(3,Timestamp.from(now)); statement.setString(4,owner); statement.executeUpdate();
        }
    }
    ObjectNode item(Connection connection, String id, String owner) throws Exception {
        try (var statement = connection.prepareStatement("SELECT * FROM p1_service_request_v1 WHERE request_id=? AND dataset_mode=? "
                + (owner == null ? "" : "AND owner_user_id=? ") + "FOR UPDATE")) {
            statement.setString(1,id); statement.setString(2,datasetMode()); if (owner != null) statement.setString(3,owner);
            try (var rows = statement.executeQuery()) {
                if (!rows.next()) throw new P1Failure(404,"NOT_FOUND");
                return row(connection,rows);
            }
        }
    }
    private ObjectNode row(Connection connection,ResultSet rows) throws Exception {
        Input input = mapper.readValue(rows.getString("input_json"), Input.class);
        var item = (ObjectNode) mapper.valueToTree(input);
        item.remove(List.of("requestId", "inputVersion", "consentAccepted"));
        item.put("id", rows.getString("request_id")).put("status",rows.getString("request_status"))
                .put("createdAt",rows.getTimestamp("created_at").toInstant().toString())
                .put("updatedAt",rows.getTimestamp("updated_at").toInstant().toString())
                .put("datasetMode",rows.getString("dataset_mode")).put("source",rows.getString("request_source"));
        if (input.institutionId() == null) item.putNull("institutionName"); else item.put("institutionName","柠月颐养中心");
        item.putNull("assignedTo"); item.putNull("scheduledStart"); item.putNull("scheduledEnd");
        item.set("visits",operations.visits(connection,rows.getString("request_id"),false));
        item.put("canCancel",!rows.getString("request_status").equals("CANCELLED")
                && !item.path("visits").findValuesAsText("status").contains("ARRIVED"));
        return item;
    }
    private List<ObjectNode> list(Connection connection, String owner, String status, String kind, String institution,
            String from, String to, int limit) throws Exception {
        if (limit < 1 || limit > 100 || (status != null && !P1Operations.REQUEST_STATUSES.contains(status))
                || (kind != null && !Set.of("CONSULTATION","VISIT_INTENT").contains(kind))
                || (institution != null && !INSTITUTION.equals(institution))) throw new P1Failure(400,"INVALID_FILTER");
        Instant lower = day(from, false), upper = day(to, true);
        if (lower != null && upper != null && !lower.isBefore(upper)) throw new P1Failure(400,"INVALID_FILTER");
        var sql = new StringBuilder("SELECT * FROM p1_service_request_v1 WHERE dataset_mode=?");
        var values = new ArrayList<Object>(); values.add(datasetMode());
        if (owner != null) {sql.append(" AND owner_user_id=?");values.add(owner);}
        if (status != null) {sql.append(" AND request_status=?");values.add(status);}
        if (kind != null) {sql.append(" AND request_kind=?");values.add(kind);}
        if (institution != null) {sql.append(" AND institution_id=?");values.add(institution);}
        if (lower != null) {sql.append(" AND created_at>=?");values.add(Timestamp.from(lower));}
        if (upper != null) {sql.append(" AND created_at<?");values.add(Timestamp.from(upper));}
        sql.append(" ORDER BY created_at DESC,request_id DESC LIMIT ?");values.add(limit);
        var result = new ArrayList<ObjectNode>();
        try (var statement = connection.prepareStatement(sql.toString())) {
            for(int i=0;i<values.size();i++) statement.setObject(i+1,values.get(i));
            try(var rows=statement.executeQuery()){while(rows.next())result.add(row(connection,rows));}
        }
        return result;
    }
    Instant day(String value, boolean upper) {
        if(value==null)return null;
        try {
            if(!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw new DateTimeParseException("invalid",value,0);
            var date=LocalDate.parse(value);return (upper?date.plusDays(1):date).atStartOfDay(ZoneId.of("Asia/Shanghai")).toInstant();
        } catch(DateTimeParseException failure){throw new P1Failure(400,"INVALID_FILTER");}
    }
    void requireAdminConfigured() {
        requireAvailable();
        if(!text(settings.adminUsername(),80,false)||!validPasswordHash(settings.adminPasswordHash()))throw new P1Failure(503,"ADMIN_UNAVAILABLE");
    }
    public synchronized Login login(String username, String password) {
        requireAdminConfigured();
        Instant now=clock.instant();
        if(now.isAfter(loginWindow.plusSeconds(60))){loginWindow=now;failedLogins=0;}
        if(failedLogins>=8)throw new P1Failure(429,"LOGIN_RATE_LIMITED");
        if(!text(username,80,false)||password==null||password.length()<8||password.length()>128){failedLogins++;throw new P1Failure(401,"ADMIN_AUTH_REQUIRED");}
        boolean passwordMatches=verifyPassword(password,settings.adminPasswordHash());
        if(!settings.adminUsername().equals(username)||!passwordMatches){failedLogins++;throw new P1Failure(401,"ADMIN_AUTH_REQUIRED");}
        failedLogins=0;
        String token=token(),csrf=digest(token+"|csrf");
        transaction(connection->{
            try(var statement=connection.prepareStatement("INSERT INTO p1_admin_session_v1(session_digest,csrf_digest,admin_username,issued_at,expires_at) VALUES(?,?,?,?,?)")){
                statement.setString(1,adminSessionDigest(token));statement.setString(2,digest(csrf));statement.setString(3,username);
                statement.setTimestamp(4,Timestamp.from(now));statement.setTimestamp(5,Timestamp.from(now.plusSeconds(7200)));statement.executeUpdate();
            }return null;
        });
        return new Login(username,token,csrf);
    }
    public Admin admin(String cookie,String csrf,boolean mutation) {
        requireAdminConfigured();
        return transaction(connection->admin(connection,cookie,csrf,mutation));
    }
    Admin admin(Connection connection,String cookie,String csrf,boolean mutation)throws SQLException {
        if(cookie==null||!cookie.matches("[A-Za-z0-9_-]{43}"))throw new P1Failure(401,"ADMIN_AUTH_REQUIRED");
        try(var statement=connection.prepareStatement("SELECT admin_username,csrf_digest,expires_at,revoked_at FROM p1_admin_session_v1 WHERE session_digest=? FOR UPDATE")){
            statement.setString(1,adminSessionDigest(cookie));
            try(var rows=statement.executeQuery()){
                if(!rows.next()||rows.getTimestamp(4)!=null||!rows.getTimestamp(3).toInstant().isAfter(clock.instant())
                        ||!settings.adminUsername().equals(rows.getString(1)))throw new P1Failure(401,"ADMIN_AUTH_REQUIRED");
                // A token-bound CSRF value is returned by login and can be re-derived after refresh.
                String expected=digest(cookie+"|csrf");
                if(mutation&&(csrf==null||!MessageDigest.isEqual(digest(csrf).getBytes(StandardCharsets.US_ASCII),rows.getString(2).getBytes(StandardCharsets.US_ASCII))))throw new P1Failure(403,"CSRF_REQUIRED");
                return new Admin(rows.getString(1),expected);
            }
        }
    }
    public List<ObjectNode> adminList(String cookie,String status,String kind,String institution,String from,String to,int limit){
        requireAdminConfigured();
        return transaction(connection->{admin(connection,cookie,null,false);return list(connection,null,status,kind,institution,from,to,limit);});
    }
    public ObjectNode adminDetail(String cookie,String id){
        requireAdminConfigured();if(!uuid(id))throw new P1Failure(400,"INVALID_INPUT");
        return transaction(connection->{
            admin(connection,cookie,null,false);var result=mapper.createObjectNode();result.set("item",item(connection,id,null));
            var events=result.putArray("events");
            try(var statement=connection.prepareStatement("SELECT event_type,occurred_at FROM p1_service_event_v1 WHERE request_id=? ORDER BY occurred_at,event_type")){
                statement.setString(1,id);try(var rows=statement.executeQuery()){
                    while(rows.next())events.addObject().put("type",rows.getString(1)).put("occurredAt",rows.getTimestamp(2).toInstant().toString());
                }
            }
            operations.enrichDetail(connection,id,result);
            return result;
        });
    }
    public void logout(String cookie,String csrf){
        requireAdminConfigured();transaction(connection->{admin(connection,cookie,csrf,true);
            try(var statement=connection.prepareStatement("UPDATE p1_admin_session_v1 SET revoked_at=? WHERE session_digest=?")){
                statement.setTimestamp(1,Timestamp.from(clock.instant()));statement.setString(2,adminSessionDigest(cookie));statement.executeUpdate();
            }return null;
        });
    }
    <T>T transaction(Transaction<T> work){
        if(database==null)throw new P1Failure(503,"SERVICE_UNAVAILABLE");
        try(var connection=database.getConnection()){
            connection.setAutoCommit(false);
            try {var result=work.run(connection);connection.commit();return result;}
            catch(Exception failure){connection.rollback();if(failure instanceof P1Failure expected)throw expected;throw new P1Failure(503,"SERVICE_UNAVAILABLE");}
        }catch(SQLException failure){throw new P1Failure(503,"SERVICE_UNAVAILABLE");}
    }
    private String token(){var bytes=new byte[32];random.nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
    private String adminSessionDigest(String token){return digest(datasetMode()+"|"+settings.adminUsername()+"|"+settings.adminPasswordHash()+"|"+token);}
    static String digest(String value){
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(Exception impossible){throw new IllegalStateException("digest unavailable");}
    }
    public static String passwordHash(String password,byte[] salt){
        try {var spec=new PBEKeySpec(password.toCharArray(),salt,210000,256);var key=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();spec.clearPassword();
            return "pbkdf2-sha256$210000$"+Base64.getEncoder().encodeToString(salt)+"$"+Base64.getEncoder().encodeToString(key);
        }catch(Exception failure){throw new IllegalStateException("password hashing unavailable");}
    }
    static boolean validPasswordHash(String hash){
        if(hash==null)return false;String[] parts=hash.split("\\$",-1);
        if(parts.length!=4||!parts[0].equals("pbkdf2-sha256")||!parts[1].matches("[0-9]{6}"))return false;
        int iterations=Integer.parseInt(parts[1]);if(iterations<210000||iterations>600000)return false;
        try{return Base64.getDecoder().decode(parts[2]).length>=16&&Base64.getDecoder().decode(parts[2]).length<=64&&Base64.getDecoder().decode(parts[3]).length==32;}
        catch(IllegalArgumentException failure){return false;}
    }
    static boolean verifyPassword(String password,String hash){
        if(!validPasswordHash(hash))return false;String[] parts=hash.split("\\$");
        try {var spec=new PBEKeySpec(password.toCharArray(),Base64.getDecoder().decode(parts[2]),Integer.parseInt(parts[1]),256);
            var derived=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();spec.clearPassword();return MessageDigest.isEqual(derived,Base64.getDecoder().decode(parts[3]));
        }catch(Exception failure){return false;}
    }
    static boolean uuid(String value){return value!=null&&value.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}");}
    static boolean validPhone(String value){return value!=null&&value.matches("1[3-9][0-9]{9}");}
    static String orEmpty(String value){return value==null?"":value;}
    static boolean text(String value,int max,boolean optional){return value==null?optional:!value.isBlank()&&value.length()<=max&&value.equals(value.trim())&&!value.matches("(?s).*[\\p{Cntrl}].*");}
    static boolean multilineText(String value,int max){return value==null||!value.isBlank()&&value.length()<=max&&value.equals(value.trim())&&!value.matches("(?s).*[\\p{Cntrl}&&[^\\r\\n]].*");}
}
