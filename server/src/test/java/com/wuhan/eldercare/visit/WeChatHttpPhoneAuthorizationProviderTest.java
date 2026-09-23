package com.wuhan.eldercare.visit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.auth.PhoneAuthorizationProvider;
import com.wuhan.eldercare.visit.auth.WeChatHttpPhoneAuthorizationProvider;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Queue;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WeChatHttpPhoneAuthorizationProviderTest {
    @Test
    void exchangesCodeThroughOfficialTokenAndPhoneEndpointsAndKeepsValuesPrivate() {
        String syntheticToken = "test-token-" + UUID.randomUUID();
        String syntheticPhone = "0".repeat(11);
        String firstCode = "test-phone-code-" + UUID.randomUUID();
        String secondCode = "test-phone-code-" + UUID.randomUUID();
        StubHttpClient client = new StubHttpClient(
                "{\"access_token\":\"" + syntheticToken + "\",\"expires_in\":7200}",
                "{\"errcode\":0,\"phone_info\":{\"phoneNumber\":\"" + syntheticPhone
                        + "\",\"purePhoneNumber\":\"" + syntheticPhone + "\",\"countryCode\":\"0\"}}",
                "{\"errcode\":0,\"phone_info\":{\"phoneNumber\":\"" + syntheticPhone
                        + "\",\"purePhoneNumber\":\"" + syntheticPhone + "\",\"countryCode\":\"0\"}}");
        WeChatHttpPhoneAuthorizationProvider provider = new WeChatHttpPhoneAuthorizationProvider(
                client, new ObjectMapper(), "test-app", "test-app-secret-" + UUID.randomUUID(), Clock.systemUTC());

        PhoneAuthorizationProvider.ExchangeResult first = provider.exchange(firstCode);
        PhoneAuthorizationProvider.ExchangeResult second = provider.exchange(secondCode);

        assertEquals(PhoneAuthorizationProvider.ExchangeResult.Status.AUTHORIZED, first.status());
        assertEquals(PhoneAuthorizationProvider.ExchangeResult.Status.AUTHORIZED, second.status());
        assertEquals(3, client.requests.size());
        assertEquals(WeChatHttpPhoneAuthorizationProvider.ACCESS_TOKEN_ENDPOINT.getPath(),
                client.requests.get(0).uri().getPath());
        assertEquals(WeChatHttpPhoneAuthorizationProvider.PHONE_NUMBER_ENDPOINT.getPath(),
                client.requests.get(1).uri().getPath());
        assertTrue(client.requestBodies.get(1).contains(firstCode));
        assertTrue(client.requestBodies.get(2).contains(secondCode));
        String safe = first.toString();
        assertFalse(safe.contains(syntheticPhone));
        assertFalse(safe.contains(syntheticToken));
        assertFalse(safe.contains(firstCode));
    }

    @Test
    void unknownProviderErrorFailsClosedWithoutExposingRawError() {
        String syntheticError = "test-provider-detail-" + UUID.randomUUID();
        StubHttpClient client = new StubHttpClient(
                "{\"access_token\":\"test-token-" + UUID.randomUUID() + "\",\"expires_in\":7200}",
                "{\"errcode\":49999,\"errmsg\":\"" + syntheticError + "\"}");
        WeChatHttpPhoneAuthorizationProvider provider = new WeChatHttpPhoneAuthorizationProvider(
                client, new ObjectMapper(), "test-app", "test-app-secret-" + UUID.randomUUID(), Clock.systemUTC());

        PhoneAuthorizationProvider.ExchangeResult result = provider.exchange("test-phone-code-" + UUID.randomUUID());

        assertEquals(PhoneAuthorizationProvider.ExchangeResult.Status.UNAVAILABLE, result.status());
        assertFalse(result.toString().contains(syntheticError));
        assertEquals(2, client.requests.size());
    }

    @Test
    void phoneResponseRequiresExplicitIntegralZeroErrorCode() {
        String syntheticPhone = "0".repeat(11);
        String validPhoneInfo = "\"phone_info\":{\"phoneNumber\":\"" + syntheticPhone
                + "\",\"purePhoneNumber\":\"" + syntheticPhone + "\"}";
        for (String phoneResponse : new String[]{
                "{" + validPhoneInfo + "}",
                "{\"errcode\":0.0," + validPhoneInfo + "}"
        }) {
            StubHttpClient client = new StubHttpClient(
                    "{\"access_token\":\"test-token-" + UUID.randomUUID() + "\",\"expires_in\":7200}",
                    phoneResponse);
            WeChatHttpPhoneAuthorizationProvider provider = new WeChatHttpPhoneAuthorizationProvider(
                    client, new ObjectMapper(), "test-app", "test-app-secret-" + UUID.randomUUID(), Clock.systemUTC());

            PhoneAuthorizationProvider.ExchangeResult result = provider.exchange("test-phone-code-" + UUID.randomUUID());

            assertEquals(PhoneAuthorizationProvider.ExchangeResult.Status.TECHNICAL_FAILURE, result.status());
            assertFalse(result.toString().contains(syntheticPhone));
        }
    }

    @Test
    void malformedPhoneFieldsCannotProduceAuthorizedResult() {
        String validDigits = "0".repeat(11);
        String[] malformedPhoneInfos = {
                "\"phoneNumber\":\"letters\",\"purePhoneNumber\":\"" + validDigits + "\"",
                "\"phoneNumber\":\"+00 (000) 000-0000\",\"purePhoneNumber\":\"+" + validDigits + "\"",
                "\"phoneNumber\":\"12345\",\"purePhoneNumber\":\"12345\"",
                "\"phoneNumber\":\"" + validDigits + "\",\"purePhoneNumber\":\"" + "０".repeat(11) + "\""
        };
        for (String phoneInfo : malformedPhoneInfos) {
            StubHttpClient client = new StubHttpClient(
                    "{\"access_token\":\"test-token-" + UUID.randomUUID() + "\",\"expires_in\":7200}",
                    "{\"errcode\":0,\"phone_info\":{" + phoneInfo + "}}");
            WeChatHttpPhoneAuthorizationProvider provider = new WeChatHttpPhoneAuthorizationProvider(
                    client, new ObjectMapper(), "test-app", "test-app-secret-" + UUID.randomUUID(), Clock.systemUTC());

            PhoneAuthorizationProvider.ExchangeResult result = provider.exchange("test-phone-code-" + UUID.randomUUID());

            assertEquals(PhoneAuthorizationProvider.ExchangeResult.Status.TECHNICAL_FAILURE, result.status());
        }
    }

    @Test
    void supportedPhoneSeparatorsRemainAccepted() {
        String fullPhone = "+00 (000) 000-0000";
        String purePhone = "0".repeat(11);
        StubHttpClient client = new StubHttpClient(
                "{\"access_token\":\"test-token-" + UUID.randomUUID() + "\",\"expires_in\":7200}",
                "{\"errcode\":0,\"phone_info\":{\"phoneNumber\":\"" + fullPhone
                        + "\",\"purePhoneNumber\":\"" + purePhone + "\"}}");
        WeChatHttpPhoneAuthorizationProvider provider = new WeChatHttpPhoneAuthorizationProvider(
                client, new ObjectMapper(), "test-app", "test-app-secret-" + UUID.randomUUID(), Clock.systemUTC());

        PhoneAuthorizationProvider.ExchangeResult result = provider.exchange("test-phone-code-" + UUID.randomUUID());

        assertEquals(PhoneAuthorizationProvider.ExchangeResult.Status.AUTHORIZED, result.status());
    }

    @Test
    void missingCodeDoesNotCallWeChat() {
        StubHttpClient client = new StubHttpClient();
        WeChatHttpPhoneAuthorizationProvider provider = new WeChatHttpPhoneAuthorizationProvider(
                client, new ObjectMapper(), "test-app", "test-app-secret-" + UUID.randomUUID(), Clock.systemUTC());

        PhoneAuthorizationProvider.ExchangeResult result = provider.exchange("  ");

        assertEquals(PhoneAuthorizationProvider.ExchangeResult.Status.MISSING, result.status());
        assertTrue(client.requests.isEmpty());
    }

    private static final class StubHttpClient extends HttpClient {
        private final Queue<String> responses = new ArrayDeque<>();
        private final java.util.List<HttpRequest> requests = new java.util.ArrayList<>();
        private final java.util.List<String> requestBodies = new java.util.ArrayList<>();

        private StubHttpClient(String... responses) {
            this.responses.addAll(java.util.List.of(responses));
        }

        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            requests.add(request);
            String body = request.bodyPublisher().map(publisher -> {
                try {
                    var output = new java.io.ByteArrayOutputStream();
                    publisher.subscribe(new java.util.concurrent.Flow.Subscriber<>() {
                        @Override public void onSubscribe(java.util.concurrent.Flow.Subscription value) {
                            value.request(Long.MAX_VALUE);
                        }
                        @Override public void onNext(java.nio.ByteBuffer item) {
                            byte[] chunk = new byte[item.remaining()];
                            item.get(chunk);
                            output.writeBytes(chunk);
                        }
                        @Override public void onError(Throwable throwable) { throw new RuntimeException(throwable); }
                        @Override public void onComplete() { }
                    });
                    return output.toString(java.nio.charset.StandardCharsets.UTF_8);
                } catch (RuntimeException ignored) {
                    return "";
                }
            }).orElse("");
            requestBodies.add(body);
            @SuppressWarnings("unchecked")
            HttpResponse<T> response = (HttpResponse<T>) new StubResponse(responses.remove());
            return response;
        }

        @Override public <T> java.util.concurrent.CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request, HttpResponse.BodyHandler<T> handler) { throw new UnsupportedOperationException(); }
        @Override public <T> java.util.concurrent.CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request, HttpResponse.BodyHandler<T> handler, HttpResponse.PushPromiseHandler<T> pushHandler) { throw new UnsupportedOperationException(); }
        @Override public java.util.Optional<java.net.Authenticator> authenticator() { return java.util.Optional.empty(); }
        @Override public java.util.Optional<java.net.CookieHandler> cookieHandler() { return java.util.Optional.empty(); }
        @Override public java.util.Optional<java.time.Duration> connectTimeout() { return java.util.Optional.empty(); }
        @Override public java.util.Optional<java.net.ProxySelector> proxy() { return java.util.Optional.empty(); }
        @Override public javax.net.ssl.SSLContext sslContext() { return null; }
        @Override public javax.net.ssl.SSLParameters sslParameters() { return null; }
        @Override public HttpClient.Redirect followRedirects() { return HttpClient.Redirect.NEVER; }
        @Override public HttpClient.Version version() { return HttpClient.Version.HTTP_1_1; }
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
        @Override public URI uri() { return URI.create("https://api.weixin.qq.com/"); }
        @Override public HttpClient.Version version() { return HttpClient.Version.HTTP_1_1; }
    }
}
