package com.wuhan.eldercare.visit.assessment;

import com.wuhan.eldercare.visit.C4Application;
import com.wuhan.eldercare.visit.auth.WeChatAuthProvider;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import java.net.URI;
import java.util.List;
import java.util.*;

/** TEST CLASSPATH ONLY. Not packaged or accepted by the normal application. */
public final class HistorySyntheticE2eServer {
    public static void main(String[] args) {
        String url=System.getenv("HISTORY_TEST_MYSQL_URL");
        if(!"true".equals(System.getenv("HISTORY_DISPOSABLE_MYSQL")) || url==null || !url.startsWith("jdbc:mysql://127.0.0.1:"))
            throw new IllegalStateException("TEST_ONLY disposable environment required");
        URI uri=URI.create("http://"+url.substring(13));
        if(uri.getPort()==3306 || uri.getPort()<=0 || !uri.getPath().matches("/[a-zA-Z0-9_]*disposable[a-zA-Z0-9_]*"))
            throw new IllegalStateException("TEST_ONLY database boundary");
        boolean disabled=Arrays.asList(args).contains("--disabled");
        boolean loop=Arrays.asList(args).contains("--user-loop");
        boolean recommendation=Arrays.asList(args).contains("--recommendation");
        boolean trustedPreview=Arrays.asList(args).contains("--trusted-preview");
        boolean guardCheck=Arrays.asList(args).contains("--intent-guard-check");
        new SpringApplication(C4Application.class,SyntheticProvider.class).run(
                "--server.address=127.0.0.1","--server.port="+(disabled?34480:guardCheck?34481:34479),
                "--spring.profiles.active=assessment-history-test-only","--c4.persistence.enabled=true",
                "--C4_MYSQL_URL="+url,"--C4_MYSQL_USERNAME=root","--C4_MYSQL_PASSWORD=",
                "--C5_AUTH_HASH_SECRET=TEST_ONLY_HISTORY_SYNTHETIC_HASH_SECRET",
                "--c5.auth.enabled=false","--assessment.history.disposable-mysql=true",
                "--assessment.history.test-only-enabled="+!disabled,
                "--assessment.history.user-loop-enabled="+loop,
                "--assessment.history.recommendation-snapshot-enabled="+recommendation,
                "--assessment.history.trusted-preview-enabled="+(trustedPreview&&loop&&recommendation&&!disabled),
                "--assessment.history.test-only-environment-id=TEST_ONLY_HISTORY_SYNTHETIC_V1",
                "--assessment.history.test-only-intent-max-per-owner="+(guardCheck?4:256),
                "--assessment.history.test-only-intent-max-per-window="+(guardCheck?2:16),
                "--assessment.history.test-only-intent-window-seconds="+(guardCheck?5:60),
                "--logging.level.root=WARN","--spring.main.banner-mode=off");
        System.out.println("HISTORY_SYNTHETIC_HTTP_READY");
    }
    @TestConfiguration(proxyBeanMethods=false)
    static class SyntheticProvider {
        @Bean HistoryRecommendationSource syntheticHistoryRecommendationSource(com.fasterxml.jackson.databind.ObjectMapper mapper) throws Exception {
            // Input-only synthetic catalog, never a saved result; Formal Domain evaluates it at explicit save.
            var catalog=mapper.readTree(HistorySyntheticE2eServer.class.getResourceAsStream("/assessment-history/test-only-server-recommendation-catalog-v1.json"));
            return ()->new HistoryRecommendationSource.Capture(catalog.deepCopy(),"TEST_ONLY_SERVER_CATALOG_CURRENT_V121");
        }
        @Bean HistoryTrustedPreviewInputSource syntheticHistoryTrustedPreviewInputSource(com.fasterxml.jackson.databind.ObjectMapper mapper) throws Exception {
            var standard=mapper.readTree(HistorySyntheticE2eServer.class.getResourceAsStream("/assessment-history/test-only-answers.json"));
            var noSafe=standard.deepCopy();((com.fasterxml.jackson.databind.node.ObjectNode)noSafe).set("cognitive.symptoms",mapper.createArrayNode().add("unknown"));
            List<com.fasterxml.jackson.databind.JsonNode> fixtures=List.of(standard.deepCopy(),noSafe.deepCopy());
            return ()->List.<com.fasterxml.jackson.databind.JsonNode>of(fixtures.get(0).deepCopy(),fixtures.get(1).deepCopy());
        }
        @Bean @Primary WeChatAuthProvider syntheticHistoryAuthProvider() {
            return code->code!=null && (Set.of("TEST_ONLY_LOGIN_A","TEST_ONLY_LOGIN_B","TEST_ONLY_LOGIN_C").contains(code)
                    || code.matches("TEST_ONLY_LOGIN_[ABC]_[0-9a-f-]{36}"))
                    ? WeChatAuthProvider.ExchangeResult.authenticated("TEST_ONLY_HISTORY",code)
                    : WeChatAuthProvider.ExchangeResult.failure(WeChatAuthProvider.ExchangeResult.Status.INVALID);
        }
    }
}
