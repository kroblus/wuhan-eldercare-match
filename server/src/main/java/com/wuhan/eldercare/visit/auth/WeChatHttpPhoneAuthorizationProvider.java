package com.wuhan.eldercare.visit.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Backend-only WeChat User.phone adapter. Access tokens and phone values stay
 * in process memory; provider responses and errors never cross this boundary.
 */
public final class WeChatHttpPhoneAuthorizationProvider implements PhoneAuthorizationProvider {
    public static final URI ACCESS_TOKEN_ENDPOINT = URI.create("https://api.weixin.qq.com/cgi-bin/token");
    public static final URI PHONE_NUMBER_ENDPOINT = URI.create("https://api.weixin.qq.com/wxa/business/getuserphonenumber");

    private final HttpClient client;
    private final ObjectMapper objectMapper;
    private final String appId;
    private final String appSecret;
    private final Clock clock;
    private volatile CachedToken cachedToken;

    public WeChatHttpPhoneAuthorizationProvider(
            HttpClient client,
            ObjectMapper objectMapper,
            String appId,
            String appSecret,
            Clock clock
    ) {
        if (client == null || objectMapper == null || appId == null || appId.isBlank()
                || appSecret == null || appSecret.isBlank() || clock == null) {
            throw new IllegalArgumentException("provider configuration required");
        }
        this.client = client;
        this.objectMapper = objectMapper;
        this.appId = appId;
        this.appSecret = appSecret;
        this.clock = clock;
    }

    @Override
    public ExchangeResult exchange(String oneTimeCode) {
        if (oneTimeCode == null || oneTimeCode.isBlank()) {
            return ExchangeResult.failure(ExchangeResult.Status.MISSING);
        }
        String code = oneTimeCode.trim();
        if (code.length() > 512 || containsControlCharacter(code)) {
            return ExchangeResult.failure(ExchangeResult.Status.INVALID);
        }

        TokenResult token = accessToken();
        if (token.status != null) return ExchangeResult.failure(token.status);
        try {
            URI endpoint = URI.create(PHONE_NUMBER_ENDPOINT + "?access_token=" + encode(token.token.value));
            String requestBody = objectMapper.writeValueAsString(new PhoneCodeRequest(code));
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = client.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return ExchangeResult.failure(ExchangeResult.Status.UNAVAILABLE);
            }
            JsonNode body = objectMapper.readTree(response.body());
            if (body == null || !body.isObject()) {
                return ExchangeResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
            }
            ProviderStatus providerStatus = phoneProviderStatus(body);
            if (providerStatus != ProviderStatus.SUCCESS) {
                return ExchangeResult.failure(providerStatus == ProviderStatus.UNAVAILABLE
                        ? ExchangeResult.Status.UNAVAILABLE : ExchangeResult.Status.TECHNICAL_FAILURE);
            }
            JsonNode phoneInfo = body.get("phone_info");
            if (phoneInfo == null || !phoneInfo.isObject()) {
                return ExchangeResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
            }
            String phoneNumber = text(phoneInfo, "phoneNumber");
            String purePhoneNumber = text(phoneInfo, "purePhoneNumber");
            if (!isSupportedFullPhone(phoneNumber) || !isPurePhone(purePhoneNumber)) {
                return ExchangeResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
            }
            return ExchangeResult.authorized(phoneNumber, purePhoneNumber);
        } catch (java.io.IOException exception) {
            return ExchangeResult.failure(ExchangeResult.Status.UNAVAILABLE);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return ExchangeResult.failure(ExchangeResult.Status.UNAVAILABLE);
        } catch (Exception ignored) {
            return ExchangeResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
        }
    }

    private TokenResult accessToken() {
        CachedToken current = cachedToken;
        Instant refreshBefore = clock.instant().plusSeconds(60);
        if (current != null && current.expiresAt.isAfter(refreshBefore)) return TokenResult.available(current);
        synchronized (this) {
            current = cachedToken;
            refreshBefore = clock.instant().plusSeconds(60);
            if (current != null && current.expiresAt.isAfter(refreshBefore)) return TokenResult.available(current);
            try {
                String query = "grant_type=client_credential&appid=" + encode(appId)
                        + "&secret=" + encode(appSecret);
                URI endpoint = URI.create(ACCESS_TOKEN_ENDPOINT + "?" + query);
                HttpRequest request = HttpRequest.newBuilder(endpoint)
                        .timeout(Duration.ofSeconds(8))
                        .GET()
                        .build();
                HttpResponse<String> response = client.send(request,
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    return TokenResult.failure(ExchangeResult.Status.UNAVAILABLE);
                }
                JsonNode body = objectMapper.readTree(response.body());
                if (body == null || !body.isObject()) {
                    return TokenResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
                }
                ProviderStatus providerStatus = providerStatus(body);
                if (providerStatus != ProviderStatus.SUCCESS) {
                    return TokenResult.failure(providerStatus == ProviderStatus.UNAVAILABLE
                            ? ExchangeResult.Status.UNAVAILABLE : ExchangeResult.Status.TECHNICAL_FAILURE);
                }
                String value = text(body, "access_token");
                JsonNode expiresInNode = body.get("expires_in");
                if (value == null || expiresInNode == null || !expiresInNode.isIntegralNumber()
                        || !expiresInNode.canConvertToLong()) {
                    return TokenResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
                }
                long expiresIn = expiresInNode.longValue();
                if (expiresIn <= 60 || expiresIn > 86_400) {
                    return TokenResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
                }
                CachedToken fresh = new CachedToken(value, clock.instant().plusSeconds(expiresIn - 60));
                cachedToken = fresh;
                return TokenResult.available(fresh);
            } catch (java.io.IOException exception) {
                return TokenResult.failure(ExchangeResult.Status.UNAVAILABLE);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return TokenResult.failure(ExchangeResult.Status.UNAVAILABLE);
            } catch (Exception ignored) {
                return TokenResult.failure(ExchangeResult.Status.TECHNICAL_FAILURE);
            }
        }
    }

    private static ProviderStatus providerStatus(JsonNode body) {
        JsonNode errcode = body.get("errcode");
        if (errcode == null) return ProviderStatus.SUCCESS;
        if (!errcode.isIntegralNumber() || !errcode.canConvertToInt()) return ProviderStatus.MALFORMED;
        return errcode.intValue() == 0 ? ProviderStatus.SUCCESS : ProviderStatus.UNAVAILABLE;
    }

    private static ProviderStatus phoneProviderStatus(JsonNode body) {
        JsonNode errcode = body.get("errcode");
        if (errcode == null || !errcode.isIntegralNumber() || !errcode.canConvertToInt()) {
            return ProviderStatus.MALFORMED;
        }
        return errcode.intValue() == 0 ? ProviderStatus.SUCCESS : ProviderStatus.UNAVAILABLE;
    }

    private static String text(JsonNode body, String field) {
        JsonNode value = body.get(field);
        return value == null || !value.isTextual() || value.asText().isBlank() ? null : value.asText();
    }

    private static boolean isSupportedFullPhone(String value) {
        if (value == null || value.length() < 6 || value.length() > 32) return false;
        int digits = 0;
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (current >= '0' && current <= '9') {
                digits++;
            } else if (current != '+' && current != '(' && current != ')' && current != '-'
                    && !isAsciiWhitespace(current)) {
                return false;
            }
        }
        return digits >= 6 && digits <= 20;
    }

    private static boolean isPurePhone(String value) {
        if (value == null || value.length() < 6 || value.length() > 20) return false;
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (current < '0' || current > '9') return false;
        }
        return true;
    }

    private static boolean isAsciiWhitespace(char value) {
        return value == ' ' || value == '\t' || value == '\n' || value == '\u000B'
                || value == '\f' || value == '\r';
    }

    private static boolean containsControlCharacter(String value) {
        return value.chars().anyMatch(character -> character <= 0x1F || character == 0x7F);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record PhoneCodeRequest(String code) {
        @Override public String toString() { return "PhoneCodeRequest[code=redacted]"; }
    }

    private enum ProviderStatus { SUCCESS, UNAVAILABLE, MALFORMED }

    private static final class CachedToken {
        private final String value;
        private final Instant expiresAt;

        private CachedToken(String value, Instant expiresAt) {
            this.value = value;
            this.expiresAt = expiresAt;
        }

        @Override public String toString() { return "CachedToken[redacted]"; }
    }

    private static final class TokenResult {
        private final CachedToken token;
        private final ExchangeResult.Status status;

        private TokenResult(CachedToken token, ExchangeResult.Status status) {
            this.token = token;
            this.status = status;
        }

        private static TokenResult available(CachedToken token) { return new TokenResult(token, null); }
        private static TokenResult failure(ExchangeResult.Status status) { return new TokenResult(null, status); }
    }
}
