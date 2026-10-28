package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.io.IOException;

@RestController
@RequestMapping("/api/v1")
public final class InstitutionPublicationController {
    private static final String COOKIE="P1_ADMIN_SESSION";
    private final P1Publications publications;
    private final ObjectMapper mapper;
    public InstitutionPublicationController(P1Service service,ObjectMapper mapper){this.publications=service.publications();this.mapper=mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);}
    private ResponseEntity<?> ok(Object body){return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store").body(body);}
    @GetMapping("/institution-publications/catalog")public ResponseEntity<?> catalog(){return ok(publications.catalog());}
    @GetMapping("/institution-publications/{institution}/revisions/{revision}")public ResponseEntity<?> exact(@PathVariable String institution,@PathVariable long revision){return ok(publications.exact(institution,revision));}
    @GetMapping("/p1-service/admin/institutions")public ResponseEntity<?> list(@CookieValue(name=COOKIE,required=false)String cookie){return ok(publications.list(cookie));}
    @GetMapping("/p1-service/admin/institutions/template")public ResponseEntity<?> template(@CookieValue(name=COOKIE,required=false)String cookie,@RequestParam String institutionId){return ok(publications.template(cookie,institutionId));}
    @GetMapping("/p1-service/admin/institutions/{institution}/draft")public ResponseEntity<?> draft(@CookieValue(name=COOKIE,required=false)String cookie,@PathVariable String institution){return ok(publications.getDraft(cookie,institution));}
    @PostMapping(value="/p1-service/admin/institutions",consumes="application/json")public ResponseEntity<?> create(@CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,HttpServletRequest request){
        JsonNode body=body(cookie,csrf,request,2*1024*1024);return ok(publications.save(cookie,csrf,body.path("institutionId").asText(),body,true));
    }
    @PutMapping(value="/p1-service/admin/institutions/{institution}/draft",consumes="application/json")public ResponseEntity<?> save(@CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,@PathVariable String institution,HttpServletRequest request){return ok(publications.save(cookie,csrf,institution,body(cookie,csrf,request,2*1024*1024),false));}
    @PostMapping(value="/p1-service/admin/institutions/{institution}/confirm",consumes="application/json")public ResponseEntity<?> confirm(@CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,@PathVariable String institution,HttpServletRequest request){return ok(publications.confirm(cookie,csrf,institution,body(cookie,csrf,request,4096)));}
    @PostMapping(value="/p1-service/admin/institutions/{institution}/publish",consumes="application/json")public ResponseEntity<?> publish(@CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,@PathVariable String institution,HttpServletRequest request){return ok(publications.publish(cookie,csrf,institution,body(cookie,csrf,request,1024)));}
    @PostMapping(value="/p1-service/admin/institutions/{institution}/service-access",consumes="application/json")public ResponseEntity<?> access(@CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,@PathVariable String institution,HttpServletRequest request){return ok(publications.serviceAccess(cookie,csrf,institution,body(cookie,csrf,request,4096)));}
    @PostMapping(value="/p1-service/admin/institutions/import-baseline",consumes="application/json")public ResponseEntity<?> baseline(@CookieValue(name=COOKIE,required=false)String cookie,@RequestHeader(value="X-P1-CSRF",required=false)String csrf,HttpServletRequest request){return ok(publications.importBaseline(cookie,csrf,body(cookie,csrf,request,12*1024*1024)));}
    private JsonNode body(String cookie,String csrf,HttpServletRequest request,int limit){
        publications.authorize(cookie,csrf,true);
        try{
            byte[] bytes=request.getInputStream().readNBytes(limit+1);if(bytes.length>limit)throw new P1Failure(413,"REQUEST_TOO_LARGE");
            try(var parser=mapper.createParser(bytes)){
                JsonNode body=mapper.readTree(parser);if(body==null||!body.isObject()||parser.nextToken()!=null)throw new P1Failure(400,"INVALID_INPUT");return body;
            }
        }catch(IOException failure){throw new P1Failure(400,"INVALID_INPUT");}
    }
    @ExceptionHandler(P1Failure.class)public ResponseEntity<?> failure(P1Failure failure){
        var body=mapper.createObjectNode().put("contractVersion",P1Publications.CONTRACT).put("code",failure.code());
        if("INVALID_RECORD".equals(failure.code()))body.set("validationIssues",mapper.valueToTree(failure.validationIssues()));
        return ResponseEntity.status(failure.status()).header(HttpHeaders.CACHE_CONTROL,"no-store").body(body);
    }
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)public ResponseEntity<?> invalidArgument(){return failure(new P1Failure(400,"INVALID_INPUT"));}
    @ExceptionHandler(Exception.class)public ResponseEntity<?> unexpected(){return failure(new P1Failure(503,"PUBLICATION_UNAVAILABLE"));}
}
