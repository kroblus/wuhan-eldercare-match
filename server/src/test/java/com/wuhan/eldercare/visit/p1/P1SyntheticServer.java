package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.auth.AuthResultV1;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.web.bind.annotation.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

/** Test-classpath-only loopback server. Never packaged as a production authentication mechanism. */
public final class P1SyntheticServer {
    static P1TestSupport support;
    public static void main(String[] args)throws Exception {
        if(args.length<1||args.length>3)throw new IllegalArgumentException("private runtime output path required");
        int port=args.length==2?Integer.parseInt(args[1]):18341;
        if(args.length==3)port=Integer.parseInt(args[1]);
        if(port!=18341&&port!=18342)throw new IllegalArgumentException("explicit isolated synthetic port required");
        String bind=args.length==3?args[2]:"127.0.0.1";
        if(!bind.equals("127.0.0.1")){
            if(port!=18342||!bind.matches("(?:10\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}|192\\.168\\.[0-9]{1,3}\\.[0-9]{1,3}|172\\.(?:1[6-9]|2[0-9]|3[01])\\.[0-9]{1,3}\\.[0-9]{1,3})")
                    ||java.net.NetworkInterface.getByInetAddress(java.net.InetAddress.getByName(bind))==null)throw new IllegalArgumentException("only this host's explicit private IPv4 is allowed");
        }
        support=new P1TestSupport(System.getenv());
        // Each startup has a clearly synthetic pending example; no fake confirmed times or contact events.
        var example=support.service.submit(support.alice,support.input("VISIT_INTENT"));
        Path target=Path.of(args[0]).toAbsolutePath().normalize();
        if(!target.getFileName().toString().endsWith(".private.json"))throw new IllegalArgumentException("private output marker required");
        support.mapper.writerWithDefaultPrettyPrinter().writeValue(target.toFile(),Map.of(
                "baseUrl","http://"+bind+":"+port,"adminUsername","p1-synthetic-admin","adminPassword",support.adminPassword,
                "ownerSessionEvidence",support.alice,"otherSessionEvidence",support.bob,"exampleRequestId",example.path("id").asText(),
                "datasetMode","SYNTHETIC_TEST_ONLY"));
        var application=new SpringApplication(SyntheticConfiguration.class);
        application.setDefaultProperties(Map.of("server.port",Integer.toString(port),"server.address",bind,
                "spring.flyway.enabled","false","spring.main.banner-mode","off","logging.level.root","WARN"));
        application.run();
    }
    @Configuration(proxyBeanMethods=false)
    @EnableAutoConfiguration(exclude={DataSourceAutoConfiguration.class,DataSourceTransactionManagerAutoConfiguration.class})
    @Import({P1Controller.class,InstitutionPublicationController.class,P1AdminWebController.class,SyntheticAuth.class})
    public static class SyntheticConfiguration {
        @Bean P1Service p1Service(){return support.service;}
        @Bean ObjectMapper objectMapper(){return support.mapper;}
    }
    @RestController
    public static class SyntheticAuth {
        @PostMapping("/api/v1/auth/wechat") public AuthResultV1 authenticate(@RequestBody(required=false)Map<String,Object> body){
            if(body==null||!body.keySet().equals(Set.of("contractVersion","kind","loginCode"))
                    ||!"wechat-authenticated-principal-contract-v1".equals(body.get("contractVersion"))
                    ||!"wechat_authentication_request_v1".equals(body.get("kind"))
                    ||!(body.get("loginCode") instanceof String code)||code.isBlank())return AuthResultV1.invalid("AUTH_REQUEST_INVALID");
            return AuthResultV1.authenticated(support.alice,Instant.now().plusSeconds(3600));
        }
    }
}
