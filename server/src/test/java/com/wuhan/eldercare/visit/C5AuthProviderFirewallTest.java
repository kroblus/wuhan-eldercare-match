package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.auth.WeChatHttpAuthProvider;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;

class C5AuthProviderFirewallTest {
    @Test
    void malformedProviderErrorCodeNeverAuthenticates() {
        for (String body : new String[]{
                "{\"errmsg\":\"provider-error\",\"openid\":\"subject\",\"session_key\":\"key\"}",
                "{\"errcode\":\"malformed\",\"openid\":\"subject\",\"session_key\":\"key\"}",
                "{\"errcode\":0.5,\"openid\":\"subject\",\"session_key\":\"key\"}"}) {
            WeChatHttpAuthProvider provider = new WeChatHttpAuthProvider(new StubHttpClient(body),
                    new ObjectMapper(), "test-app", "test-secret", URI.create("https://provider.invalid/session"));
            assertEquals(com.wuhan.eldercare.visit.auth.WeChatAuthProvider.ExchangeResult.Status.INVALID,
                    provider.exchange("one-time-code").status());
        }
    }

    @Test
    void validSuccessWithoutErrcodeIsAccepted() {
        WeChatHttpAuthProvider provider = new WeChatHttpAuthProvider(
                new StubHttpClient("{\"openid\":\"subject\",\"session_key\":\"key\"}"),
                new ObjectMapper(), "test-app", "test-secret", URI.create("https://provider.invalid/session"));
        assertEquals(com.wuhan.eldercare.visit.auth.WeChatAuthProvider.ExchangeResult.Status.AUTHENTICATED,
                provider.exchange("one-time-code").status());
    }

    @Test
    void providerErrorDoesNotExposeRawErrorOrSubject() {
        HttpClient client = new StubHttpClient("{\"errcode\":40029,\"errmsg\":\"secret-provider-detail\"}");
        WeChatHttpAuthProvider provider = new WeChatHttpAuthProvider(client, new ObjectMapper(),
                "test-app", "test-secret", URI.create("https://provider.invalid/session"));

        var result = provider.exchange("one-time-code");

        assertEquals(com.wuhan.eldercare.visit.auth.WeChatAuthProvider.ExchangeResult.Status.INVALID, result.status());
        assertEquals(null, result.providerNamespace());
        assertEquals(null, result.providerSubject());
    }

    private static final class StubHttpClient extends HttpClient {
        private final String body;

        private StubHttpClient(String body) {
            this.body = body;
        }

        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            @SuppressWarnings("unchecked")
            HttpResponse<T> response = (HttpResponse<T>) new StubResponse(body);
            return response;
        }

        @Override
        public <T> java.util.concurrent.CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            throw new UnsupportedOperationException();
        }

        @Override
        public <T> java.util.concurrent.CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            throw new UnsupportedOperationException();
        }

        @Override public java.util.Optional<java.net.Authenticator> authenticator() { return java.util.Optional.empty(); }
        @Override public java.util.Optional<java.net.CookieHandler> cookieHandler() { return java.util.Optional.empty(); }
        @Override public java.util.Optional<java.time.Duration> connectTimeout() { return java.util.Optional.empty(); }
        @Override public java.util.Optional<java.net.ProxySelector> proxy() { return java.util.Optional.empty(); }
        @Override public javax.net.ssl.SSLContext sslContext() { return null; }
        @Override public javax.net.ssl.SSLParameters sslParameters() { return null; }
        @Override public java.net.http.HttpClient.Redirect followRedirects() { return java.net.http.HttpClient.Redirect.NEVER; }
        @Override public java.net.http.HttpClient.Version version() { return java.net.http.HttpClient.Version.HTTP_1_1; }
        @Override public java.util.Optional<java.util.concurrent.Executor> executor() { return java.util.Optional.empty(); }
    }

    private static final class StubResponse implements HttpResponse<String> {
        private final String body;

        private StubResponse(String body) { this.body = body; }
        @Override public int statusCode() { return 200; }
        @Override public HttpRequest request() { return null; }
        @Override public java.util.Optional<HttpResponse<String>> previousResponse() { return java.util.Optional.empty(); }
        @Override public java.net.http.HttpHeaders headers() { return java.net.http.HttpHeaders.of(java.util.Map.of(), (a, b) -> true); }
        @Override public String body() { return body; }
        @Override public java.util.Optional<javax.net.ssl.SSLSession> sslSession() { return java.util.Optional.empty(); }
        @Override public java.net.URI uri() { return URI.create("https://provider.invalid/session"); }
        @Override public java.net.http.HttpClient.Version version() { return java.net.http.HttpClient.Version.HTTP_1_1; }
    }
}
