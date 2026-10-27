package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.io.IOException;
import java.time.Duration;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/p1-service")
public final class P1Controller {
    private static final String COOKIE="P1_ADMIN_SESSION";
    private static final Set<String> INPUT_FIELDS=Set.of("requestId","inputVersion","kind","institutionId","contactName","contactPhone","relationship","serviceScenario","preferredWindow","partySize","assistanceNote","consentVersion","consentAccepted");
    private final P1Service service;
    private final ObjectMapper mapper;
    public P1Controller(P1Service service,ObjectMapper mapper){this.service=service;this.mapper=mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);}
    private Object envelope(String key,Object value){return Map.of("contractVersion",P1Service.CONTRACT,key,value);}
    private ResponseEntity<?> ok(Object value){return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store, private").body(value);}
    @GetMapping("/config") public ResponseEntity<?> config(){return ok(service.config());}
    @PostMapping(value="/requests",consumes="application/json") public ResponseEntity<?> submit(
            @RequestHeader(value="X-Auth-Evidence",required=false)String evidence,HttpServletRequest request){
        if(!service.config().path("enabled").asBoolean())throw new P1Failure(503,"SERVICE_UNAVAILABLE");
        var body=body(request,4096,INPUT_FIELDS);
        if(!body.path("partySize").isIntegralNumber()||!body.path("partySize").canConvertToInt()||!body.path("consentAccepted").isBoolean())throw new P1Failure(400,"INVALID_INPUT");
        var input=new P1Service.Input(text(body,"requestId",false),text(body,"inputVersion",false),text(body,"kind",false),
                text(body,"institutionId",true),text(body,"contactName",false),text(body,"contactPhone",false),
                text(body,"relationship",false),text(body,"serviceScenario",false),text(body,"preferredWindow",true),
                body.path("partySize").intValue(),text(body,"assistanceNote",true),text(body,"consentVersion",false),body.path("consentAccepted").booleanValue());
        return ok(envelope("item",service.submit(evidence,input)));
    }
    @GetMapping("/requests")public ResponseEntity<?> list(@RequestHeader(value="X-Auth-Evidence",required=false)String evidence){return ok(envelope("items",service.ownList(evidence)));}
    @GetMapping("/requests/{id}")public ResponseEntity<?> detail(@RequestHeader(value="X-Auth-Evidence",required=false)String evidence,@PathVariable String id){return ok(envelope("item",service.ownDetail(evidence,id)));}
    @PostMapping("/requests/{id}/cancel")public ResponseEntity<?> cancel(@RequestHeader(value="X-Auth-Evidence",required=false)String evidence,@PathVariable String id){return ok(envelope("item",service.cancel(evidence,id)));}
    @PostMapping(value="/admin/login",consumes="application/json")public ResponseEntity<?> login(
            @RequestHeader(value="X-P1-Admin-Request",required=false)String requested,HttpServletRequest request){
        if(!"1".equals(requested))throw new P1Failure(403,"ADMIN_REQUEST_HEADER_REQUIRED");
        var body=body(request,1024,Set.of("username","password"));
        var login=service.login(text(body,"username",false),text(body,"password",false));
        var cookie=ResponseCookie.from(COOKIE,login.token()).httpOnly(true).secure(!service.synthetic()).sameSite("Strict")
                .path("/api/v1/p1-service/admin").maxAge(Duration.ofHours(2)).build();
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store, private").header(HttpHeaders.SET_COOKIE,cookie.toString())
                .body(Map.of("contractVersion",P1Service.CONTRACT,"authenticated",true,"username",login.username(),"csrfToken",login.csrfToken()));
    }
    @GetMapping("/admin/session")public ResponseEntity<?> session(@CookieValue(name=COOKIE,required=false)String cookie){
        var admin=service.admin(cookie,null,false);
        return ok(Map.of("contractVersion",P1Service.CONTRACT,"authenticated",true,"username",admin.username(),"csrfToken",admin.csrfToken()));
    }
    @PostMapping("/admin/logout")public ResponseEntity<?> logout(@CookieValue(name=COOKIE,required=false)String cookie,
            @RequestHeader(value="X-P1-CSRF",required=false)String csrf){
        service.logout(cookie,csrf);
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store, private").header(HttpHeaders.SET_COOKIE,
                ResponseCookie.from(COOKIE,"").httpOnly(true).secure(!service.synthetic()).sameSite("Strict").path("/api/v1/p1-service/admin").maxAge(0).build().toString())
                .body(Map.of("contractVersion",P1Service.CONTRACT,"authenticated",false));
    }
    @GetMapping("/admin/requests")public ResponseEntity<?> adminList(@CookieValue(name=COOKIE,required=false)String cookie,
            @RequestParam(required=false)String status,@RequestParam(required=false)String kind,@RequestParam(required=false)String institutionId,
            @RequestParam(required=false)String from,@RequestParam(required=false)String to,@RequestParam(defaultValue="50")int limit,@RequestParam(defaultValue="0")int offset){
        var result=service.operations().page(cookie,status,kind,institutionId,from,to,limit,offset);result.put("contractVersion",P1Service.CONTRACT);return ok(result);
    }
    @GetMapping("/admin/requests/{id}")public ResponseEntity<?> adminDetail(@CookieValue(name=COOKIE,required=false)String cookie,@PathVariable String id){
        var result=service.adminDetail(cookie,id);result.put("contractVersion",P1Service.CONTRACT);return ok(result);
    }
    @PostMapping(value="/admin/requests/{id}/followups",consumes="application/json")public ResponseEntity<?> followup(
            @CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,@PathVariable String id,HttpServletRequest request){
        var result=service.operations().followup(cookie,csrf,id,operationBody(request));result.put("contractVersion",P1Service.CONTRACT);return ok(result);
    }
    @PostMapping(value="/admin/requests/{id}/visits",consumes="application/json")public ResponseEntity<?> visit(
            @CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,@PathVariable String id,HttpServletRequest request){
        var result=service.operations().visit(cookie,csrf,id,operationBody(request));result.put("contractVersion",P1Service.CONTRACT);return ok(result);
    }
    @GetMapping("/admin/calendar")public ResponseEntity<?> calendar(@CookieValue(name=COOKIE,required=false)String cookie,@RequestParam String from,@RequestParam String to){
        var result=service.operations().calendar(cookie,from,to);result.put("contractVersion",P1Service.CONTRACT);return ok(result);
    }
    @PostMapping(value="/admin/resources",consumes="application/json")public ResponseEntity<?> resources(
            @CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,HttpServletRequest request){
        var result=service.operations().resources(cookie,csrf,operationBody(request));result.put("contractVersion",P1Service.CONTRACT);return ok(result);
    }
    @PostMapping(value="/admin/reports",consumes="application/json")public ResponseEntity<?> report(
            @CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,HttpServletRequest request){
        return ok(envelope("report",new P1Reports(service).preview(cookie,csrf,operationBody(request))));
    }
    @GetMapping("/admin/reports/{id}/xlsx")public ResponseEntity<?> workbook(
            @CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,@PathVariable String id){
        var report=new P1Reports(service).snapshot(cookie,csrf,id);
        String institution=report.path("institutionId").isNull()?"platform":report.path("institutionId").asText();
        String generatedDay=java.time.Instant.parse(report.path("generatedAt").asText()).atZone(java.time.ZoneId.of("Asia/Shanghai")).toLocalDate().toString();
        String filename="p1-"+institution+"-"+report.path("from").asText()+"-"+report.path("to").asText()+"-"+generatedDay+".xlsx";
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store, private").header(HttpHeaders.CONTENT_TYPE,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\""+filename+"\"").body(P1Workbook.create(report));
    }
    JsonNode operationBody(HttpServletRequest request){
        try{
            var bytes=request.getInputStream().readNBytes(8193);if(bytes.length>8192)throw new P1Failure(413,"REQUEST_TOO_LARGE");
            try(var parser=mapper.createParser(bytes)){
                JsonNode result=mapper.readTree(parser);if(result==null||!result.isObject()||parser.nextToken()!=null)throw new P1Failure(400,"INVALID_INPUT");return result;
            }
        }catch(IOException failure){throw new P1Failure(400,"INVALID_INPUT");}
    }
    private JsonNode body(HttpServletRequest request,int limit,Set<String> fields){
        try{
            var bytes=request.getInputStream().readNBytes(limit+1);if(bytes.length>limit)throw new P1Failure(413,"REQUEST_TOO_LARGE");
            JsonNode body;
            try(var parser=mapper.createParser(bytes)){body=mapper.readTree(parser);if(parser.nextToken()!=null)throw new P1Failure(400,"INVALID_INPUT");}
            if(body==null||!body.isObject())throw new P1Failure(400,"INVALID_INPUT");
            var actual=new HashSet<String>();body.fieldNames().forEachRemaining(actual::add);if(!actual.equals(fields))throw new P1Failure(400,"INVALID_INPUT");
            return body;
        }catch(IOException failure){throw new P1Failure(400,"INVALID_INPUT");}
    }
    private String text(JsonNode body,String key,boolean nullable){
        var value=body.get(key);if(nullable&&value!=null&&value.isNull())return null;
        if(value==null||!value.isTextual())throw new P1Failure(400,"INVALID_INPUT");return value.textValue();
    }
    @ExceptionHandler(P1Failure.class)public ResponseEntity<?> failure(P1Failure failure){
        return ResponseEntity.status(failure.status()).header(HttpHeaders.CACHE_CONTROL,"no-store, private").body(Map.of("contractVersion",P1Service.CONTRACT,"code",failure.code()));
    }
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)public ResponseEntity<?> invalidArgument(){return failure(new P1Failure(400,"INVALID_FILTER"));}
    @ExceptionHandler(Exception.class)public ResponseEntity<?> unexpected(){return failure(new P1Failure(503,"SERVICE_UNAVAILABLE"));}
}
