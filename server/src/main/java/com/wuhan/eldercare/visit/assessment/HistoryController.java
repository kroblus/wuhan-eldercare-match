package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.*;

@RestController
@RequestMapping("/api/v1/completed-assessments")
public final class HistoryController {
    private final HistoryService service;
    private final ObjectMapper mapper;
    public HistoryController(HistoryService service,ObjectMapper mapper) {this.service=service;this.mapper=mapper;}
    public record ListResult(String contractVersion,String kind,String availability,List<HistoryMetadata> items,String nextCursor) { }
    public record SaveResult(String contractVersion,String kind,String availability,HistoryMetadata item) { }
    public record Failure(String contractVersion,String kind,String availability,String code) { }
    private static final String CONTRACT="completed-assessment-history-api-v1";
    public record Capability(String contractVersion,String kind,String availability,String source) { }
    /** Public capability only: no authentication, identity, counts, or record reads. */
    @GetMapping("/capability") public Capability capability() {
        boolean ready=service.available();
        return new Capability(CONTRACT,"completed_assessment_history_capability_v1",ready?"ready":"unavailable",ready?HistoryMetadata.SOURCE:null);
    }
    @GetMapping("/user-loop-capability") public Capability userLoopCapability() {
        boolean ready=service.userLoopAvailable();
        return new Capability(CONTRACT,"completed_assessment_user_loop_capability_v1",ready?"ready":"unavailable",ready?HistoryMetadata.SOURCE:null);
    }
    @GetMapping("/recommendation-capability") public Capability recommendationCapability() {
        boolean ready=service.recommendationAvailable();
        return new Capability(CONTRACT,"historical_recommendation_capability_v1",ready?"ready":"unavailable",ready?HistoryMetadata.SOURCE:null);
    }
    @GetMapping("/trusted-preview-capability") public Capability trustedPreviewCapability() {
        boolean ready=service.trustedPreviewAvailable();
        return new Capability(CONTRACT,"trusted_recommendation_preview_capability_v1",ready?"ready":"unavailable",ready?HistoryMetadata.SOURCE:null);
    }
    public record RecommendationResult(String contractVersion,String kind,HistoryMetadata item,String availability,JsonNode display) { }
    public record RecoveryResult(String contractVersion,String kind,String scopeId,String intentId,String createdAt,String state,HistoryMetadata item,String sessionId) { }
    public record SessionResult(String contractVersion,String kind,String scopeId,String sessionId,String draftContext,String createdAt) { }
    public record SessionInspectionResult(String contractVersion,String kind,String scopeId,String draftContext,String state) { }
    public record TrustedPreviewResult(String contractVersion,String kind,String previewId,String displayBinding,String sessionId,
            String scopeId,String environment,String createdAt,String expiresAt,String state,JsonNode profileDisplay,JsonNode recommendationDisplay) { }
    public record TrustedPreviewInspectionResult(String contractVersion,String kind,String sessionId,String previewId,String state) { }
    @PostMapping(value="/trusted-previews",consumes="application/json") public ResponseEntity<?> trustedPreview(
            @RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        try {
            if(!service.trustedPreviewAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
            JsonNode body=boundedBody(request,65536);Set<String> keys=new HashSet<>();body.fieldNames().forEachRemaining(keys::add);
            if(!keys.equals(Set.of("kind","sessionId","assessmentContractVersion","schemaVersion","elderId","answers"))
                    ||!body.path("kind").isTextual()||!body.path("sessionId").isTextual()
                    ||!body.path("assessmentContractVersion").isTextual()||!body.path("schemaVersion").isInt()
                    ||!body.path("elderId").isTextual()||!body.path("answers").isObject())throw new HistoryFailure(400,"INVALID_INPUT");
            var result=service.createTrustedPreview(evidence,mapper.treeToValue(body,TrustedPreviewRequest.class));
            return ResponseEntity.ok(new TrustedPreviewResult(CONTRACT,"trusted_recommendation_preview_v1",result.previewId(),
                    result.displayBinding(),result.sessionId(),result.scopeId(),result.environment(),result.createdAt(),result.expiresAt(),
                    result.state(),result.profileDisplay(),result.recommendationDisplay()));
        }catch(HistoryFailure failure){return failure(failure);}catch(Exception ignored){return failure(new HistoryFailure(400,"INVALID_INPUT"));}
    }
    @PostMapping(value="/trusted-previews/check",consumes="application/json") public ResponseEntity<?> inspectTrustedPreview(
            @RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        try {
            if(!service.trustedPreviewAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
            var body=smallBody(request,Set.of("sessionId","previewId","displayBinding"));
            var result=service.inspectTrustedPreview(evidence,body.path("sessionId").asText(),body.path("previewId").asText(),body.path("displayBinding").asText());
            return ResponseEntity.ok(new TrustedPreviewInspectionResult(CONTRACT,"trusted_recommendation_preview_inspection_v1",
                    result.sessionId(),result.previewId(),result.state()));
        }catch(HistoryFailure failure){return failure(failure);}catch(Exception ignored){return failure(new HistoryFailure(400,"INVALID_INPUT"));}
    }
    @PostMapping(value="/assessment-sessions/inspect-context",consumes="application/json") public ResponseEntity<?> inspectSession(
            @RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        try {if(!service.userLoopAvailable())throw new HistoryFailure(503,"UNAVAILABLE");var body=smallBody(request,Set.of("draftContext"));
            var r=service.inspectSessionContext(evidence,body.path("draftContext").asText());
            return ResponseEntity.ok(new SessionInspectionResult(CONTRACT,"history_assessment_session_inspection_v1",r.scopeId(),r.draftContext(),r.state()));
        }catch(HistoryFailure f){return failure(f);}catch(Exception ignored){return failure(new HistoryFailure(400,"INVALID_INPUT"));}
    }
    @PostMapping(value="/assessment-sessions/check",consumes="application/json") public ResponseEntity<?> checkSession(
            @RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        try {if(!service.userLoopAvailable())throw new HistoryFailure(503,"UNAVAILABLE");var body=smallBody(request,Set.of("sessionId"));
            var r=service.checkedSession(evidence,body.path("sessionId").asText());return ResponseEntity.ok(new SessionResult(CONTRACT,"history_assessment_session_v1",r.scope(),r.id(),r.context(),r.createdAt()));
        }catch(HistoryFailure f){return failure(f);}catch(Exception ignored){return failure(new HistoryFailure(400,"INVALID_INPUT"));}
    }
    @PostMapping(value="/assessment-sessions/register",consumes="application/json") public ResponseEntity<?> registerSession(
            @RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        return sessionOperation(evidence,request,false);
    }
    @PostMapping(value="/assessment-sessions/new",consumes="application/json") public ResponseEntity<?> newSession(
            @RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        return sessionOperation(evidence,request,true);
    }
    private ResponseEntity<?> sessionOperation(String evidence,jakarta.servlet.http.HttpServletRequest request,boolean successor) {
        try {
            if(!service.userLoopAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
            var body=smallBody(request,successor?Set.of("intent","draftContext","fromSessionId"):Set.of("intent","draftContext"));
            if(!body.path("intent").asText().equals(successor?"CONFIRMED_NEW_ASSESSMENT":"REGISTER_CURRENT_ASSESSMENT"))throw new HistoryFailure(400,"INVALID_INPUT");
            var r=service.registerSession(evidence,body.path("draftContext").asText(),successor?body.path("fromSessionId").asText():null);
            return ResponseEntity.ok(new SessionResult(CONTRACT,"history_assessment_session_v1",r.scope(),r.id(),r.context(),r.createdAt()));
        }catch(HistoryFailure f){return failure(f);}catch(Exception ignored){return failure(new HistoryFailure(400,"INVALID_INPUT"));}
    }
    private JsonNode smallBody(jakarta.servlet.http.HttpServletRequest request,Set<String> fields) throws Exception {
        JsonNode body=boundedBody(request,512);Set<String> keys=new HashSet<>();if(body!=null&&body.isObject())body.fieldNames().forEachRemaining(keys::add);
        if(body==null||!body.isObject()||!keys.equals(fields))throw new HistoryFailure(400,"INVALID_INPUT");
        for(String key:fields)if(!body.path(key).isTextual())throw new HistoryFailure(400,"INVALID_INPUT");return body;
    }
    private JsonNode boundedBody(jakarta.servlet.http.HttpServletRequest request,int limit) throws Exception {
        byte[] bytes=request.getInputStream().readNBytes(limit+1);if(bytes.length>limit)throw new HistoryFailure(400,"INVALID_INPUT");
        JsonNode body=mapper.readTree(bytes);if(body==null||!body.isObject())throw new HistoryFailure(400,"INVALID_INPUT");return body;
    }
    @GetMapping("/save-intents/scope") public ResponseEntity<?> recoveryScope(@RequestHeader(value="X-Auth-Evidence",required=false) String evidence) {
        try {var r=service.recoveryScope(evidence);return ResponseEntity.ok(new RecoveryResult(CONTRACT,"history_save_recovery_v1",r.scopeId(),null,null,"SCOPE",null,null));}
        catch(HistoryFailure f){return failure(f);}catch(Exception ignored){return failure(new HistoryFailure(503,"ERROR"));}
    }
    @PostMapping(value="/save-intents",consumes="application/json") public ResponseEntity<?> prepareIntent(@RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        try {if(!service.userLoopAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
            JsonNode body=boundedBody(request,512);Set<String> keys=new HashSet<>();body.fieldNames().forEachRemaining(keys::add);
            boolean legacy=keys.equals(Set.of("sessionId")),trusted=keys.equals(Set.of("sessionId","previewId","displayBinding"));
            if(!legacy&&!trusted||!body.path("sessionId").isTextual()
                    ||trusted&&(!body.path("previewId").isTextual()||!body.path("displayBinding").isTextual()))throw new HistoryFailure(400,"INVALID_INPUT");
            var r=service.prepareIntent(evidence,body.path("sessionId").asText(),trusted?body.path("previewId").asText():null,
                    trusted?body.path("displayBinding").asText():null);
            return ResponseEntity.ok(new RecoveryResult(CONTRACT,"history_save_recovery_v1",r.scopeId(),r.intentId(),r.createdAt(),r.replayed()?"ALREADY_PREPARED":"PREPARED",null,r.sessionId()));}
        catch(HistoryFailure f){return failure(f);}catch(Exception ignored){return failure(new HistoryFailure(503,"ERROR"));}
    }
    @PostMapping(value="/save-intents/reconcile",consumes="application/json") public ResponseEntity<?> reconcileIntent(
            @RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        try {
            if(!service.userLoopAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
            byte[] bytes=request.getInputStream().readNBytes(513);if(bytes.length>512)throw new HistoryFailure(400,"INVALID_INPUT");
            JsonNode body=mapper.readTree(bytes);Set<String> keys=new HashSet<>();if(body!=null)body.fieldNames().forEachRemaining(keys::add);
            if(body==null||!body.isObject()||!keys.equals(Set.of("scopeId","intentId"))||!body.path("scopeId").isTextual()||!body.path("intentId").isTextual())throw new HistoryFailure(400,"INVALID_INPUT");
            var r=service.reconcileIntent(evidence,body.path("scopeId").asText(),body.path("intentId").asText());
            return ResponseEntity.ok(new RecoveryResult(CONTRACT,"history_save_recovery_v1",body.path("scopeId").asText(),body.path("intentId").asText(),null,r.state(),r.item(),r.sessionId()));
        }catch(HistoryFailure f){return failure(f);}catch(Exception ignored){return failure(new HistoryFailure(400,"INVALID_INPUT"));}
    }
    @GetMapping("/{id}/recommendation") public ResponseEntity<?> recommendation(@RequestHeader(value="X-Auth-Evidence",required=false) String evidence,@PathVariable String id) {
        try {var detail=service.recommendation(evidence,id);return ResponseEntity.ok(new RecommendationResult(CONTRACT,
                "historical_recommendation_result_v1",detail.item(),detail.availability(),detail.display()));}
        catch(HistoryFailure failure){return failure(failure);}catch(Exception ignored){return failure(new HistoryFailure(503,"ERROR"));}
    }
    public record DetailResult(String contractVersion,String kind,HistoryMetadata item,String profileAvailability,
            JsonNode profileDisplay,String recommendationAvailability) { }
    @GetMapping("/{id}") public ResponseEntity<?> detail(@RequestHeader(value="X-Auth-Evidence",required=false) String evidence,@PathVariable String id) {
        try {var detail=service.detail(evidence,id);
            return ResponseEntity.ok(new DetailResult(CONTRACT,"completed_assessment_detail_v1",detail.item(),
                    detail.profileDisplay()==null?"unavailable":"ready",detail.profileDisplay(),"unavailable"));
        } catch(HistoryFailure failure){return failure(failure);}catch(Exception ignored){return failure(new HistoryFailure(503,"ERROR"));}
    }
    @GetMapping public ResponseEntity<?> list(@RequestHeader(value="X-Auth-Evidence",required=false) String evidence,
            @RequestParam(defaultValue="20") int limit,@RequestParam(required=false) String cursor) {
        try {var page=service.list(evidence,limit,cursor);
            return ResponseEntity.ok(new ListResult(CONTRACT,"completed_assessment_history_result_v1","ready",page.items(),page.nextCursor()));
        } catch(HistoryFailure failure) {return failure(failure);} catch(RuntimeException ignored) {return failure(new HistoryFailure(503,"ERROR"));}
    }
    @PostMapping(consumes="application/json") public ResponseEntity<?> create(@RequestHeader(value="X-Auth-Evidence",required=false) String evidence,jakarta.servlet.http.HttpServletRequest request) {
        try {
            if(!service.available()) throw new HistoryFailure(503,"UNAVAILABLE");
            // Bound the stream before JSON materialization, including chunked requests.
            byte[] bytes=request.getInputStream().readNBytes(65537);
            if(bytes.length>65536) throw new HistoryFailure(400,"INVALID_INPUT");
            JsonNode body=mapper.readTree(bytes);
            if(body==null) throw new HistoryFailure(400,"INVALID_INPUT");
            Set<String> keys=new HashSet<>(); body.fieldNames().forEachRemaining(keys::add);
            Set<String> legacyFields=Set.of("kind","intent","assessmentContractVersion","schemaVersion","elderId","idempotencyKey","answers");
            Set<String> trustedFields=Set.of("kind","intent","assessmentContractVersion","schemaVersion","elderId","idempotencyKey","answers","previewId","displayBinding");
            if(!body.isObject() || !(keys.equals(legacyFields)||keys.equals(trustedFields))
                    || mapper.writeValueAsBytes(body).length>65536 || !body.path("schemaVersion").isInt())
                throw new HistoryFailure(400,"INVALID_INPUT");
            var result=service.create(evidence,mapper.treeToValue(body,HistoryRequest.class));
            return ResponseEntity.status(result.replayed()?200:201).body(new SaveResult(CONTRACT,"completed_assessment_save_result_v1",result.replayed()?"replayed":"created",result.item()));
        } catch(HistoryFailure failure) {return failure(failure);} catch(Exception ignored) {return failure(new HistoryFailure(400,"INVALID_INPUT"));}
    }
    private static ResponseEntity<Failure> failure(HistoryFailure failure) {
        String availability=switch(failure.code()) {case "UNAVAILABLE"->"unavailable";case "UNAUTHENTICATED"->"unauthenticated";case "FORBIDDEN"->"forbidden";default->"error";};
        return ResponseEntity.status(failure.status()).body(new Failure(CONTRACT,"completed_assessment_history_error_v1",availability,failure.code()));
    }
    @RestControllerAdvice(assignableTypes=HistoryController.class)
    @Order(-100)
    public static class Errors {
        @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class})
        ResponseEntity<Failure> malformed(Exception ignored) {return failure(new HistoryFailure(400,"INVALID_INPUT"));}
        @ExceptionHandler(RuntimeException.class)
        ResponseEntity<Failure> unexpected(RuntimeException ignored) {return failure(new HistoryFailure(503,"ERROR"));}
    }
}
