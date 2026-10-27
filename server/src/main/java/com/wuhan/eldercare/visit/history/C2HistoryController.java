package com.wuhan.eldercare.visit.history;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/formal-assessment-history")
public final class C2HistoryController {
    private final C2HistoryService service;
    private final ObjectMapper mapper;
    public C2HistoryController(C2HistoryService service,ObjectMapper mapper) {
        this.service=service;
        this.mapper=mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
    }
    public record Envelope(String contractVersion,Object result) { }
    public record Error(String contractVersion,String code) { }
    private Envelope response(Object value){return new Envelope(C2HistoryService.CONTRACT,value);}
    @GetMapping("/capability") public Envelope capability(){return response(service.capability());}
    @GetMapping("/notice") public Envelope notice(){return response(service.notice());}
    /** No operator handling is claimed until its independent production adapter exists. */
    @GetMapping("/data-rights") public Envelope rights(){return response(java.util.Map.of("availability","UNAVAILABLE","code","RIGHTS_HANDLER_NOT_CONFIGURED"));}
    @PostMapping(value="/consents",consumes="application/json") public Envelope consent(
            @RequestHeader(value="X-Auth-Evidence",required=false)String evidence,HttpServletRequest request) {
        JsonNode body=body(request,1024,Set.of("noticeVersion","accepted"));
        if(!body.path("accepted").isBoolean())throw new C2Failure(400,"INVALID_INPUT");
        return response(service.consent(evidence,text(body,"noticeVersion"),body.path("accepted").booleanValue()));
    }
    @PostMapping(value="/save-intents",consumes="application/json") public Envelope prepare(
            @RequestHeader(value="X-Auth-Evidence",required=false)String evidence,HttpServletRequest request) {
        // No health-body materialization if collection is not configured.
        service.notice();
        JsonNode body=body(request,65536,Set.of("intentId","assessmentVersion","answers","consentId"));
        return response(service.prepare(evidence,text(body,"intentId"),text(body,"assessmentVersion"),body.get("answers"),text(body,"consentId")));
    }
    @PostMapping(value="/confirm",consumes="application/json") public Envelope confirm(
            @RequestHeader(value="X-Auth-Evidence",required=false)String evidence,HttpServletRequest request) {
        JsonNode body=body(request,1024,Set.of("intentId","resultVersion","displayBinding"));
        return response(service.confirm(evidence,text(body,"intentId"),text(body,"resultVersion"),text(body,"displayBinding")));
    }
    @GetMapping("/save-intents/{intentId}") public Envelope reconcile(
            @RequestHeader(value="X-Auth-Evidence",required=false)String evidence,@PathVariable String intentId) {
        return response(service.reconcile(evidence,intentId));
    }
    @GetMapping public Envelope list(@RequestHeader(value="X-Auth-Evidence",required=false)String evidence,
            @RequestParam(defaultValue="20")int limit,@RequestParam(required=false)String cursor) {
        return response(service.list(evidence,limit,cursor));
    }
    @GetMapping("/{recordId}") public Envelope detail(@RequestHeader(value="X-Auth-Evidence",required=false)String evidence,
            @PathVariable String recordId) {return response(service.detail(evidence,recordId));}
    private JsonNode body(HttpServletRequest request,int limit,Set<String> fields) {
        try {
            byte[] bytes=request.getInputStream().readNBytes(limit+1);
            if(bytes.length>limit)throw new C2Failure(413,"REQUEST_TOO_LARGE");
            JsonNode body;
            try(var parser=mapper.createParser(bytes)) {
                body=mapper.readTree(parser);
                if(parser.nextToken()!=null)throw new C2Failure(400,"INVALID_INPUT");
            }
            if(body==null||!body.isObject())throw new C2Failure(400,"INVALID_INPUT");
            var keys=new HashSet<String>();body.fieldNames().forEachRemaining(keys::add);
            if(!keys.equals(fields))throw new C2Failure(400,"INVALID_INPUT");
            return body;
        }catch(IOException failure){throw new C2Failure(400,"INVALID_INPUT");}
    }
    private String text(JsonNode body,String key) {
        if(!body.path(key).isTextual())throw new C2Failure(400,"INVALID_INPUT");
        return body.path(key).textValue();
    }
    @ExceptionHandler(C2Failure.class) public ResponseEntity<Error> failure(C2Failure failure) {
        return ResponseEntity.status(failure.status()).body(new Error(C2HistoryService.CONTRACT,failure.code()));
    }
    @ExceptionHandler(MethodArgumentTypeMismatchException.class) public ResponseEntity<Error> invalidArgument() {
        return failure(new C2Failure(400,"INVALID_INPUT"));
    }
    @ExceptionHandler(Exception.class) public ResponseEntity<Error> unexpected() {
        return failure(new C2Failure(503,"ERROR"));
    }
}
