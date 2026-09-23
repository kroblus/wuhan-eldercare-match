package com.wuhan.eldercare.visit.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Minimal Backend-only WeChat jscode2session adapter. The provider response is
 * converted immediately into a private exchange result; raw JSON, session_key
 * and provider error text are never returned to Application or logs.
 */
public final class WeChatHttpAuthProvider implements WeChatAuthProvider {
    private final HttpClient client;
    private final ObjectMapper objectMapper;
    private final String appId;
    private final String appSecret;
    private final URI endpoint;

    public WeChatHttpAuthProvider(
            HttpClient client,
            ObjectMapper objectMapper,
            String appId,
            String appSecret,
            URI endpoint
    ) {
        if (client == null || objectMapper == null || appId == null || appId.isBlank()
                || appSecret == null || appSecret.isBlank() || endpoint == null) {
            throw new IllegalArgumentException("provider configuration required");
        }
        this.client = client;
        this.objectMapper = objectMapper;
        this.appId = appId;
        this.appSecret = appSecret;
        this.endpoint = endpoint;
    }

    @Override
    public ExchangeResult exchange(String loginCode) {
        if (loginCode == null || loginCode.isBlank() || loginCode.length() > 512) {
            return ExchangeResult.failure(ExchangeResult.Status.INVALID);
        }
        String query = "appid=" + encode(appId)
                + "&secret=" + encode(appSecret)
                + "&js_code=" + encode(loginCode.trim())
                + "&grant_type=authorization_code";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(new URI(endpoint.toString() + (endpoint.toString().contains("?") ? "&" : "?") + query))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return ExchangeResult.failure(ExchangeResult.Status.UNAVAILABLE);
            }
            JsonNode body = objectMapper.readTree(response.body());
            if (body == null || !body.isObject()) {
                return ExchangeResult.failure(ExchangeResult.Status.INVALID);
            }
            JsonNode error = body.get("errcode");
            if (error != null && (!error.isIntegralNumber() || !error.canConvertToInt())) {
                return ExchangeResult.failure(ExchangeResult.Status.INVALID);
            }
            // WeChat's successful code exchange can omit errcode; if present it
            // must be a numeric zero. An error message without a code is invalid.
            if (error == null && body.has("errmsg")) {
                return ExchangeResult.failure(ExchangeResult.Status.INVALID);
            }
            int errorCode = error == null ? 0 : error.intValue();
            if (errorCode != 0) {
                return ExchangeResult.failure(isInvalidCode(errorCode)
                        ? ExchangeResult.Status.INVALID
                        : ExchangeResult.Status.UNAVAILABLE);
            }
            String openId = text(body, "openid");
            String sessionKey = text(body, "session_key");
            if (openId == null || sessionKey == null) {
                return ExchangeResult.failure(ExchangeResult.Status.INVALID);
            }
            return ExchangeResult.authenticated("wechat:miniprogram:" + appId, openId);
        } catch (java.io.IOException exception) {
            return ExchangeResult.failure(ExchangeResult.Status.UNAVAILABLE);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return ExchangeResult.failure(ExchangeResult.Status.UNAVAILABLE);
        } catch (Exception ignored) {
            return ExchangeResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
        }
    }

    private static String text(JsonNode body, String field) {
        JsonNode value = body.get(field);
        return value == null || !value.isTextual() || value.asText().isBlank() ? null : value.asText();
    }

    private static boolean isInvalidCode(int code) {
        return code == 40029 || code == 40163 || code == 45011;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
