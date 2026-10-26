package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import com.wuhan.eldercare.visit.elder.application.ElderRecordRepository;
import com.wuhan.eldercare.visit.elder.domain.ElderRecord;
import java.sql.Connection;
import java.time.Clock;
import java.time.Instant;
import java.security.SecureRandom;
import java.time.temporal.ChronoUnit;
import java.security.MessageDigest;
import java.util.*;

public final class HistoryService {
    private final HistoryRepository repository;
    private final AuthEvidenceResolver auth;
    private final ElderRecordRepository elders;
    private final HistoryValidator validator;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final boolean userLoop;
    private final HistoryRecommendationSource recommendationSource;
    private final HistoryIntentLimits intentLimits;
    private final boolean trustedPreviewEnabled;
    private final String testOnlyEnvironmentId;
    private final Set<JsonNode> approvedTrustedPreviewAnswers;
    private static final SecureRandom PREVIEW_RANDOM=new SecureRandom();
    private static final long TRUSTED_PREVIEW_TTL_SECONDS=600;
    public HistoryService(HistoryRepository repository,AuthEvidenceResolver auth,ElderRecordRepository elders,
            HistoryValidator validator,ObjectMapper mapper,Clock clock) {
        this(repository,auth,elders,validator,mapper,clock,false);
    }
    public HistoryService(HistoryRepository repository,AuthEvidenceResolver auth,ElderRecordRepository elders,
            HistoryValidator validator,ObjectMapper mapper,Clock clock,boolean userLoop) {
        this(repository,auth,elders,validator,mapper,clock,userLoop,null);
    }
    public HistoryService(HistoryRepository repository,AuthEvidenceResolver auth,ElderRecordRepository elders,
            HistoryValidator validator,ObjectMapper mapper,Clock clock,boolean userLoop,HistoryRecommendationSource recommendationSource) {
        this(repository,auth,elders,validator,mapper,clock,userLoop,recommendationSource,HistoryIntentLimits.TEST_ONLY_DEFAULT);
    }
    public HistoryService(HistoryRepository repository,AuthEvidenceResolver auth,ElderRecordRepository elders,
            HistoryValidator validator,ObjectMapper mapper,Clock clock,boolean userLoop,HistoryRecommendationSource recommendationSource,HistoryIntentLimits intentLimits) {
        this(repository,auth,elders,validator,mapper,clock,userLoop,recommendationSource,intentLimits,false,null);
    }
    public HistoryService(HistoryRepository repository,AuthEvidenceResolver auth,ElderRecordRepository elders,
            HistoryValidator validator,ObjectMapper mapper,Clock clock,boolean userLoop,HistoryRecommendationSource recommendationSource,
            HistoryIntentLimits intentLimits,boolean trustedPreviewEnabled,String testOnlyEnvironmentId) {
        this(repository,auth,elders,validator,mapper,clock,userLoop,recommendationSource,intentLimits,
                trustedPreviewEnabled,testOnlyEnvironmentId,null);
    }
    public HistoryService(HistoryRepository repository,AuthEvidenceResolver auth,ElderRecordRepository elders,
            HistoryValidator validator,ObjectMapper mapper,Clock clock,boolean userLoop,HistoryRecommendationSource recommendationSource,
            HistoryIntentLimits intentLimits,boolean trustedPreviewEnabled,String testOnlyEnvironmentId,
            HistoryTrustedPreviewInputSource trustedPreviewInputSource) {
        this.repository=repository; this.auth=auth; this.elders=elders; this.validator=validator; this.mapper=mapper; this.clock=clock;this.userLoop=userLoop;
        this.recommendationSource=recommendationSource;
        this.intentLimits=Objects.requireNonNull(intentLimits);
        this.trustedPreviewEnabled=trustedPreviewEnabled;
        this.testOnlyEnvironmentId=testOnlyEnvironmentId;
        this.approvedTrustedPreviewAnswers=copyApprovedInputs(trustedPreviewInputSource);
    }
    private Set<JsonNode> copyApprovedInputs(HistoryTrustedPreviewInputSource source) {
        if(source==null)return Set.of();
        try {
            Collection<JsonNode> supplied=source.approvedSyntheticAnswers();
            if(supplied==null||supplied.isEmpty()||supplied.size()>16)return Set.of();
            Set<JsonNode> copied=new HashSet<>();
            for(JsonNode value:supplied) {
                if(value==null||!value.isObject()||serializedSize(value)>65536)return Set.of();
                copied.add(canonical(value.deepCopy()));
            }
            return Collections.unmodifiableSet(copied);
        } catch(RuntimeException ignored) { return Set.of(); }
    }
    private void enabled() {
        if(!available())
            throw new HistoryFailure(503,"UNAVAILABLE");
    }
    public boolean available() {return repository!=null && auth.supportsTransactionalResolution() && elders.supportsTransactionScopedLookup();}
    public boolean userLoopAvailable(){return userLoop && available();}
    public boolean recommendationAvailable(){return recommendationSource!=null && userLoopAvailable();}
    public boolean trustedPreviewAvailable(){return trustedPreviewEnabled && recommendationAvailable() && testOnlyEnvironmentId!=null
            && testOnlyEnvironmentId.matches("TEST_ONLY_[A-Za-z0-9_-]{1,72}")&&!approvedTrustedPreviewAnswers.isEmpty();}
    private ElderRecord owner(Connection c,String evidence) {
        var resolution=auth.resolve(c,evidence);
        if(resolution.status()!=AuthEvidenceResolver.Resolution.Status.AUTHENTICATED) {
            boolean infrastructure=resolution.status()==AuthEvidenceResolver.Resolution.Status.UNAVAILABLE
                    || resolution.status()==AuthEvidenceResolver.Resolution.Status.TECHNICAL_FAILURE;
            throw new HistoryFailure(infrastructure?503:401,infrastructure?"UNAVAILABLE":"UNAUTHENTICATED");
        }
        var lookup=elders.findByResponsibleUserId(c,resolution.principal().userId());
        if(lookup.status()==ElderRecordRepository.Lookup.Status.NOT_FOUND) throw new HistoryFailure(403,"FORBIDDEN");
        if(lookup.status()!=ElderRecordRepository.Lookup.Status.FOUND) throw new HistoryFailure(503,"UNAVAILABLE");
        if(!lookup.record().responsibleUserId().equals(resolution.principal().userId())) throw new HistoryFailure(403,"FORBIDDEN");
        return lookup.record();
    }
    public record Save(HistoryMetadata item,boolean replayed) { }
    public record RecoveryScope(String scopeId) { }
    public record PreparedIntent(String scopeId,String intentId,String createdAt,String sessionId,boolean replayed) { }
    public record ReconciledIntent(String state,HistoryMetadata item,String sessionId) { }
    public record TrustedPreviewResult(String previewId,String displayBinding,String sessionId,String scopeId,String environment,
            String createdAt,String expiresAt,String state,JsonNode profileDisplay,JsonNode recommendationDisplay) { }
    public record TrustedPreviewInspection(String previewId,String sessionId,String state) { }
    private void recoveryEnabled(){if(!userLoopAvailable())throw new HistoryFailure(503,"UNAVAILABLE");}
    public RecoveryScope recoveryScope(String evidence) {
        enabled();return repository.transaction(c->{var elder=owner(c,evidence);
            return new RecoveryScope(repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId()));});
    }
    public PreparedIntent prepareIntent(String evidence) {
        // Synthetic fixture helper only; never exposed by Controller. Public roots cannot bypass /new.
        recoveryEnabled();var registration=repository.transaction(c->{var elder=owner(c,evidence);
            var scope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());var now=clock.instant().truncatedTo(ChronoUnit.MICROS);
            repository.assertSessionCapacity(c,elder.responsibleUserId(),now,intentLimits);
            return repository.insertSession(c,scope,"test_"+UUID.randomUUID(),null,now);});
        return prepareIntent(evidence,registration.id());
    }
    public TrustedPreviewResult createTrustedPreview(String evidence,TrustedPreviewRequest request) {
        if(!trustedPreviewAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
        if(request==null||!"trusted_recommendation_preview_request_v1".equals(request.kind())
                ||!"assessment-schema-v2".equals(request.assessmentContractVersion())||!Integer.valueOf(2).equals(request.schemaVersion())
                ||!validRecoveryId(request.sessionId())||request.elderId()==null||request.elderId().isBlank()||request.elderId().length()>200
                ||request.answers()==null||!request.answers().isObject())throw new HistoryFailure(400,"INVALID_INPUT");
        JsonNode answers=canonical(request.answers().deepCopy());
        var prior=repository.transaction(c->{
            ElderRecord elder=owner(c,evidence);if(!elder.elderId().equals(request.elderId()))throw new HistoryFailure(403,"FORBIDDEN");
            String scope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());repository.session(c,scope,request.sessionId());
            if(!approvedTrustedPreviewAnswers.contains(answers))throw new HistoryFailure(400,"INVALID_INPUT");
            if(repository.sessionCompletion(c,request.sessionId())!=null)throw new HistoryFailure(409,"SESSION_ALREADY_COMPLETED");
            if(repository.legacyFence(c,scope,elder.responsibleUserId(),elder.elderId()))throw new HistoryFailure(409,"LEGACY_RECOVERY_REQUIRED");
            var latest=repository.latestTrustedPreview(c,scope,request.sessionId());
            if(latest!=null&&!latest.environment().equals(testOnlyEnvironmentId))throw new HistoryFailure(409,"PREVIEW_ENVIRONMENT_MISMATCH");
            if(repository.sessionIntent(c,request.sessionId())!=null) {
                if(latest!=null&&"ACTIVE".equals(latest.state())&&sameCandidate(latest,answers,testOnlyEnvironmentId)
                        &&Instant.parse(latest.expiresAt()).isAfter(clock.instant()))return previewResult(latest);
                throw new HistoryFailure(409,"PREVIEW_INTENT_ALREADY_PREPARED");
            }
            if(latest!=null&&"ACTIVE".equals(latest.state())&&sameCandidate(latest,answers,testOnlyEnvironmentId)
                    &&Instant.parse(latest.expiresAt()).isAfter(clock.instant()))return previewResult(latest);
            if(latest!=null&&("BOUND".equals(latest.state())||"CONSUMED".equals(latest.state())))
                throw new HistoryFailure(409,"PREVIEW_ALREADY_BOUND");
            return null;
        });
        if(prior!=null)return prior;

        validator.validate(answers);
        Instant created=clock.instant().truncatedTo(ChronoUnit.MICROS),expires=created.plusSeconds(TRUSTED_PREVIEW_TTL_SECONDS);
        String previewId=UUID.randomUUID().toString(),binding=newDisplayBinding(),createdAt=created.toString(),expiresAt=expires.toString();
        ObjectNode provisional=mapper.createObjectNode();provisional.put("kind","completed_assessment").put("id",previewId)
                .put("elderId",request.elderId()).put("status","completed").put("schemaVersion",2)
                .put("completedAt",createdAt).set("answers",answers.deepCopy());
        JsonNode profile=validator.profileDisplay(provisional);
        if(!previewId.equals(profile.path("assessmentId").asText())||!createdAt.equals(profile.path("assessmentCompletedAt").asText())
                ||!profile.path("rows").isArray()||profile.path("rows").size()!=6)throw new HistoryFailure(503,"UNAVAILABLE");
        var capture=recommendationSource.capture();
        if(capture==null||capture.catalog()==null||capture.publicReference()==null
                ||!capture.publicReference().matches("TEST_ONLY_SERVER_CATALOG_[A-Za-z0-9_-]{1,80}"))throw new HistoryFailure(503,"UNAVAILABLE");
        JsonNode capturedCatalog=capture.catalog().deepCopy();ObjectNode input=mapper.createObjectNode();input.set("completed",provisional.deepCopy());input.set("catalog",capturedCatalog);
        input.put("evaluationAsOf",createdAt).put("sourceReference",capture.publicReference()).put("sourceDigest",digest(canonical(capturedCatalog)));
        JsonNode recommendation=validator.recommendationDisplay(input);
        if(!previewId.equals(recommendation.path("assessmentId").asText())||!createdAt.equals(recommendation.path("assessmentCompletedAt").asText())
                ||!"recommendation-contract-v2".equals(recommendation.path("versions").path("recommendationContractVersion").asText())
                ||!"SERVER_FORMAL_RECOMMENDATION_CAPTURE_TEST_ONLY_V1".equals(recommendation.path("source").path("kind").asText()))
            throw new HistoryFailure(503,"UNAVAILABLE");
        if(serializedSize(profile)>16384||serializedSize(recommendation)>262144)
            throw new HistoryFailure(503,"UNAVAILABLE");
        JsonNode capturedProfile=profile.deepCopy(),capturedRecommendation=recommendation.deepCopy();
        return repository.transaction(c->{
            ElderRecord elder=owner(c,evidence);if(!elder.elderId().equals(request.elderId()))throw new HistoryFailure(403,"FORBIDDEN");
            String scope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());var session=repository.session(c,scope,request.sessionId());
            if(repository.sessionCompletion(c,session.id())!=null)throw new HistoryFailure(409,"SESSION_ALREADY_COMPLETED");
            if(repository.legacyFence(c,scope,elder.responsibleUserId(),elder.elderId()))throw new HistoryFailure(409,"LEGACY_RECOVERY_REQUIRED");
            var latest=repository.latestTrustedPreview(c,scope,session.id());
            if(latest!=null&&!latest.environment().equals(testOnlyEnvironmentId))throw new HistoryFailure(409,"PREVIEW_ENVIRONMENT_MISMATCH");
            if(repository.sessionIntent(c,session.id())!=null) {
                if(latest!=null&&"ACTIVE".equals(latest.state())&&sameCandidate(latest,answers,testOnlyEnvironmentId)
                        &&Instant.parse(latest.expiresAt()).isAfter(clock.instant()))return previewResult(latest);
                throw new HistoryFailure(409,"PREVIEW_INTENT_ALREADY_PREPARED");
            }
            if(latest!=null&&"ACTIVE".equals(latest.state())) {
                if(sameCandidate(latest,answers,testOnlyEnvironmentId)&&Instant.parse(latest.expiresAt()).isAfter(clock.instant()))
                    return previewResult(latest);
                repository.revokeTrustedPreview(c,latest.id());
            }
            if(latest!=null&&("BOUND".equals(latest.state())||"CONSUMED".equals(latest.state())))
                throw new HistoryFailure(409,"PREVIEW_ALREADY_BOUND");
            repository.assertTrustedPreviewCapacity(c,elder.responsibleUserId(),created,intentLimits);
            var candidate=new HistoryRepository.TrustedPreview(previewId,scope,session.id(),elder.responsibleUserId(),elder.elderId(),
                    testOnlyEnvironmentId,binding,createdAt,expiresAt,"ACTIVE",null,null,answers,capturedProfile,capturedRecommendation);
            repository.insertTrustedPreview(c,candidate);return previewResult(candidate);
        });
    }
    private TrustedPreviewResult previewResult(HistoryRepository.TrustedPreview preview) {
        return new TrustedPreviewResult(preview.id(),preview.displayBinding(),preview.session(),preview.scope(),preview.environment(),
                preview.createdAt(),preview.expiresAt(),"READY",preview.profileDisplay(),preview.recommendationDisplay());
    }
    public TrustedPreviewInspection inspectTrustedPreview(String evidence,String sessionId,String previewId,String displayBinding) {
        if(!trustedPreviewAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
        if(!validRecoveryId(sessionId)||!validRecoveryId(previewId)||!validDisplayBinding(displayBinding))throw new HistoryFailure(400,"INVALID_INPUT");
        return repository.transaction(c->{
            ElderRecord elder=owner(c,evidence);String scope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());
            repository.session(c,scope,sessionId);var candidate=repository.trustedPreview(c,scope,previewId);
            if(candidate==null||!candidate.session().equals(sessionId)||!candidate.owner().equals(elder.responsibleUserId())
                    ||!candidate.elder().equals(elder.elderId())||!candidate.environment().equals(testOnlyEnvironmentId)
                    ||!constantTimeEquals(candidate.displayBinding(),displayBinding))throw new HistoryFailure(404,"NOT_FOUND");
            String state=Instant.parse(candidate.expiresAt()).isAfter(clock.instant())&&"ACTIVE".equals(candidate.state())?"READY"
                    :Instant.parse(candidate.expiresAt()).isAfter(clock.instant())&&"BOUND".equals(candidate.state())?"UNAVAILABLE"
                    :Instant.parse(candidate.expiresAt()).isAfter(clock.instant())?"UNAVAILABLE":"EXPIRED";
            return new TrustedPreviewInspection(previewId,sessionId,state);
        });
    }
    private boolean sameCandidate(HistoryRepository.TrustedPreview preview,JsonNode answers,String environment) {
        return preview.environment().equals(environment)&&canonical(preview.answers()).equals(answers);
    }
    private static String newDisplayBinding() {
        byte[] bytes=new byte[32];PREVIEW_RANDOM.nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private static boolean validDisplayBinding(String value) {return value!=null&&value.matches("[A-Za-z0-9_-]{43}");}
    private static boolean constantTimeEquals(String left,String right) {
        if(left==null||right==null)return false;
        return MessageDigest.isEqual(left.getBytes(java.nio.charset.StandardCharsets.US_ASCII),right.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }
    public HistoryRepository.Session registerSession(String evidence,String context,String predecessor) {
        recoveryEnabled();
        if(context==null||!context.matches("[A-Za-z0-9_-]{1,100}")||context.startsWith("legacy_"))throw new HistoryFailure(400,"INVALID_INPUT");
        return repository.transaction(c->{var elder=owner(c,evidence);String scope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());
            if(predecessor!=null) {
                if(!validRecoveryId(predecessor))throw new HistoryFailure(404,"NOT_FOUND");repository.session(c,scope,predecessor);
                if(repository.sessionCompletion(c,predecessor)==null)throw new HistoryFailure(409,"SESSION_UNCONFIRMED");
                var successor=repository.successor(c,scope,predecessor);
                if(successor!=null){if(!successor.context().equals(context))throw new HistoryFailure(409,"SESSION_TRANSITION_CONFLICT");return successor;}
            }
            var existing=repository.sessionContext(c,scope,context);if(existing!=null) {
                if(predecessor!=null)throw new HistoryFailure(409,"SESSION_TRANSITION_CONFLICT");return existing;
            }
            if(repository.legacyFence(c,scope,elder.responsibleUserId(),elder.elderId()))throw new HistoryFailure(409,"LEGACY_RECOVERY_REQUIRED");
            if(predecessor==null && repository.hasSession(c,scope))throw new HistoryFailure(409,"SESSION_TRANSITION_REQUIRED");
            repository.claimContext(c,scope,context);
            var time=clock.instant().truncatedTo(ChronoUnit.MICROS);
            repository.assertSessionCapacity(c,elder.responsibleUserId(),time,intentLimits);
            return repository.insertSession(c,scope,context,predecessor,time);
        });
    }
    public HistoryRepository.Session checkedSession(String evidence,String sessionId) {
        recoveryEnabled();return repository.transaction(c->{var elder=owner(c,evidence);
            if(!validRecoveryId(sessionId))throw new HistoryFailure(404,"NOT_FOUND");
            return repository.session(c,repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId()),sessionId);});
    }
    public record SessionInspection(String scopeId,String draftContext,String state) { }
    public SessionInspection inspectSessionContext(String evidence,String context) {
        recoveryEnabled();if(context==null||!context.matches("[A-Za-z0-9_-]{1,100}"))throw new HistoryFailure(400,"INVALID_INPUT");
        return repository.transaction(c->{var elder=owner(c,evidence);var scope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());
            var existing=repository.sessionContext(c,scope,context);
            String state=repository.legacyFence(c,scope,elder.responsibleUserId(),elder.elderId())?"RECOVERY_REQUIRED":existing==null?(repository.foreignClaim(c,scope,context)||repository.foreignContext(c,scope,context)?"CONTEXT_UNAVAILABLE":"UNREGISTERED"):repository.sessionCompletion(c,existing.id())!=null?"CONFIRMED"
                    :repository.sessionIntent(c,existing.id())!=null?"PENDING_OR_UNCERTAIN":"UNSAVED";
            return new SessionInspection(scope,context,state);});
    }
    public PreparedIntent prepareIntent(String evidence,String sessionId) {
        return prepareIntent(evidence,sessionId,null,null);
    }
    public PreparedIntent prepareIntent(String evidence,String sessionId,String previewId,String displayBinding) {
        recoveryEnabled();return repository.transaction(c->{var elder=owner(c,evidence);
            if(!validRecoveryId(sessionId))throw new HistoryFailure(404,"NOT_FOUND");
            String scope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());repository.session(c,scope,sessionId);
            String existing=repository.sessionIntent(c,sessionId);
            if(existing!=null) {
                var bound=repository.trustedPreviewForIntent(c,scope,existing);
                if(bound!=null) {
                    if(!bound.id().equals(previewId)||!constantTimeEquals(bound.displayBinding(),displayBinding))throw new HistoryFailure(409,"PREVIEW_INTENT_MISMATCH");
                } else if(previewId!=null||displayBinding!=null||repository.hasTrustedPreview(c,scope,sessionId)) {
                    throw new HistoryFailure(409,"TRUSTED_PREVIEW_REQUIRED");
                }
                return new PreparedIntent(scope,existing,repository.intentTime(c,existing),sessionId,true);
            }
            if((previewId==null)!=(displayBinding==null)||previewId!=null&&(!validRecoveryId(previewId)||!validDisplayBinding(displayBinding)))
                throw new HistoryFailure(400,"INVALID_INPUT");
            HistoryRepository.TrustedPreview candidate=null;
            if(previewId!=null) {
                if(!trustedPreviewAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
                candidate=repository.trustedPreview(c,scope,previewId);
                if(candidate==null||!candidate.session().equals(sessionId)||!candidate.owner().equals(elder.responsibleUserId())
                        ||!candidate.elder().equals(elder.elderId())||!candidate.environment().equals(testOnlyEnvironmentId)
                        ||!"ACTIVE".equals(candidate.state())||!constantTimeEquals(candidate.displayBinding(),displayBinding)
                        ||!Instant.parse(candidate.expiresAt()).isAfter(clock.instant()))throw new HistoryFailure(409,"PREVIEW_UNAVAILABLE");
            } else if(repository.hasTrustedPreview(c,scope,sessionId)) {
                throw new HistoryFailure(409,"TRUSTED_PREVIEW_REQUIRED");
            }
            if(repository.legacyFence(c,scope,elder.responsibleUserId(),elder.elderId()))throw new HistoryFailure(409,"LEGACY_RECOVERY_REQUIRED");
            var time=clock.instant().truncatedTo(ChronoUnit.MICROS);
            repository.assertIntentCapacity(c,elder.responsibleUserId(),time,intentLimits);
            String id=UUID.randomUUID().toString();
            repository.prepareIntent(c,scope,id,time);repository.bindIntent(c,sessionId,id);
            if(candidate!=null)repository.bindTrustedPreview(c,scope,sessionId,candidate.id(),displayBinding,id,time);
            return new PreparedIntent(scope,id,time.toString(),sessionId,false);});
    }
    public ReconciledIntent reconcileIntent(String evidence,String scope,String id) {
        recoveryEnabled();return repository.transaction(c->{var elder=owner(c,evidence);
            String current=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());
            if(!validRecoveryId(scope)||!validRecoveryId(id)||!current.equals(scope)||!repository.ownsIntent(c,current,id))
                throw new HistoryFailure(404,"NOT_FOUND");
            var saved=repository.existing(c,elder.responsibleUserId(),"recover_"+id);
            // An absent committed result never authorizes a new intent or changed payload.
            String sessionId=repository.intentSession(c,id);
            return saved==null?new ReconciledIntent("PENDING_OR_UNCERTAIN",null,sessionId):new ReconciledIntent("CONFIRMED",saved.item(),sessionId);});
    }
    private static boolean validRecoveryId(String id){return id!=null&&id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}");}
    public Save create(String evidence,HistoryRequest request) {
        enabled();
        // Auth/binding preflight before reading sensitive answers; revalidated at commit boundary.
        ElderRecord preflight=repository.transaction(c->owner(c,evidence));
        boolean trusted=request!=null&&"completed_assessment_save_with_trusted_preview_request_v1".equals(request.kind());
        boolean legacy=request!=null&&"completed_assessment_save_request_v1".equals(request.kind());
        if(request==null || !(legacy||trusted)
                || !"SAVE_COMPLETED_ASSESSMENT".equals(request.intent())
                || !"assessment-schema-v2".equals(request.assessmentContractVersion())
                || !Integer.valueOf(2).equals(request.schemaVersion()) || request.elderId()==null
                || request.elderId().isBlank() || request.elderId().length()>200 || request.idempotencyKey()==null
                || !request.idempotencyKey().matches("[a-zA-Z0-9_-]{1,100}")
                || request.answers()==null || !request.answers().isObject()
                || trusted&&(!validRecoveryId(request.previewId())||!validDisplayBinding(request.displayBinding()))
                || legacy&&(request.previewId()!=null||request.displayBinding()!=null)) throw new HistoryFailure(400,"INVALID_INPUT");
        if(trusted&&!trustedPreviewAvailable())throw new HistoryFailure(503,"UNAVAILABLE");
        if(!preflight.elderId().equals(request.elderId())) throw new HistoryFailure(403,"FORBIDDEN");
        JsonNode answers=canonical(request.answers().deepCopy());
        validator.validate(answers);
        String digest=digest(canonical(savePayload(request,trusted)));
        return repository.transaction(c->{
            ElderRecord elder=owner(c,evidence);
            if(!elder.elderId().equals(request.elderId())) throw new HistoryFailure(403,"FORBIDDEN");
            String scope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());
            if(!request.idempotencyKey().startsWith("recover_"))throw new HistoryFailure(400,"SESSION_REQUIRED");
            String intentId=request.idempotencyKey().substring(8);
            if(!validRecoveryId(intentId)||!repository.ownsIntent(c,scope,intentId))throw new HistoryFailure(403,"FORBIDDEN");
            var saved=repository.existing(c,elder.responsibleUserId(),request.idempotencyKey());
            if(saved!=null) {
                if(!saved.digest().equals(digest)) throw new HistoryFailure(409,"IDEMPOTENCY_CONFLICT");
                if(trusted)requireTrustedPreviewReplayBinding(c,scope,elder,intentId,request,saved.item());
                return new Save(saved.item(),true);
            }
            String sessionId=repository.intentSession(c,intentId);
            if(sessionId==null) {
                // Existing V4 pending intent may finish late; no old completed row is backfilled.
                if(trusted)throw new HistoryFailure(409,"TRUSTED_PREVIEW_REQUIRED");
                String legacyScope=repository.recoveryScope(c,elder.responsibleUserId(),elder.elderId());
                var legacySession=repository.insertSession(c,legacyScope,"legacy_"+intentId,null,clock.instant().truncatedTo(ChronoUnit.MICROS));
                sessionId=legacySession.id();repository.bindIntent(c,sessionId,intentId);
            }
            repository.session(c,scope,sessionId);
            HistoryRepository.TrustedPreview candidate=repository.trustedPreviewForIntent(c,scope,intentId);
            if(trusted) {
                if(candidate==null||!candidate.id().equals(request.previewId())||!candidate.session().equals(sessionId)
                        ||!candidate.owner().equals(elder.responsibleUserId())||!candidate.elder().equals(elder.elderId())
                        ||!candidate.environment().equals(testOnlyEnvironmentId)||!"BOUND".equals(candidate.state())
                        ||!constantTimeEquals(candidate.displayBinding(),request.displayBinding())
                        ||!canonical(candidate.answers()).equals(answers)||!Instant.parse(candidate.expiresAt()).isAfter(clock.instant()))
                    throw new HistoryFailure(409,"PREVIEW_UNAVAILABLE");
            } else if(candidate!=null||repository.hasTrustedPreview(c,scope,sessionId)) {
                throw new HistoryFailure(409,"TRUSTED_PREVIEW_REQUIRED");
            }
            if(repository.sessionCompletion(c,sessionId)!=null)throw new HistoryFailure(409,"SESSION_ALREADY_COMPLETED");
            String id=UUID.randomUUID().toString();
            String time=clock.instant().truncatedTo(ChronoUnit.MICROS).toString();
            var item=new HistoryMetadata("completed_assessment",id,"completed",2,time,"assessment-schema-v2",HistoryMetadata.SOURCE,1);
            ObjectNode snapshot=mapper.createObjectNode();
            snapshot.put("kind",item.kind()).put("id",id).put("elderId",elder.elderId()).put("status","completed")
                    .put("schemaVersion",2).put("completedAt",time).set("answers",answers);
            repository.insert(c,elder.responsibleUserId(),elder.elderId(),request.idempotencyKey(),digest,item,snapshot);
            repository.bindCompletion(c,sessionId,id);
            JsonNode profile=trusted?rebindDisplay(candidate.profileDisplay(),candidate.id(),id,time):userLoopAvailable()?validator.profileDisplay(snapshot):null;
            if(profile!=null)repository.insertProfile(c,id,profile);
            if(trusted) {
                JsonNode recommendation=rebindDisplay(candidate.recommendationDisplay(),candidate.id(),id,time);
                repository.insertRecommendation(c,id,recommendation);
                repository.consumeTrustedPreview(c,scope,sessionId,candidate.id(),intentId,id);
            } else if(recommendationAvailable()) {
                var capture=recommendationSource.capture();
                if(capture==null || capture.catalog()==null || capture.publicReference()==null
                        || !capture.publicReference().matches("TEST_ONLY_SERVER_CATALOG_[A-Za-z0-9_-]{1,80}")) throw new HistoryFailure(503,"UNAVAILABLE");
                JsonNode capturedCatalog=capture.catalog().deepCopy();
                ObjectNode input=mapper.createObjectNode();input.set("completed",snapshot);input.set("catalog",capturedCatalog);
                input.put("evaluationAsOf",clock.instant().toString()).put("sourceReference",capture.publicReference())
                        .put("sourceDigest",digest(canonical(capturedCatalog)));
                JsonNode display=validator.recommendationDisplay(input);
                if(!id.equals(display.path("assessmentId").asText()) || !time.equals(display.path("assessmentCompletedAt").asText())) throw new HistoryFailure(503,"UNAVAILABLE");
                repository.insertRecommendation(c,id,display);
            }
            return new Save(item,false);
        });
    }
    private void requireTrustedPreviewReplayBinding(Connection c,String scope,ElderRecord elder,String intentId,
            HistoryRequest request,HistoryMetadata saved) throws Exception {
        String sessionId=repository.intentSession(c,intentId);
        HistoryRepository.TrustedPreview candidate=repository.trustedPreviewForIntent(c,scope,intentId);
        if(sessionId==null||candidate==null||!"CONSUMED".equals(candidate.state())
                ||!candidate.environment().equals(testOnlyEnvironmentId)||!candidate.id().equals(request.previewId())
                ||!constantTimeEquals(candidate.displayBinding(),request.displayBinding())
                ||!candidate.owner().equals(elder.responsibleUserId())||!candidate.elder().equals(elder.elderId())
                ||!candidate.session().equals(sessionId)||!intentId.equals(candidate.intent())
                ||!saved.id().equals(candidate.completion()))throw new HistoryFailure(404,"NOT_FOUND");
        repository.session(c,scope,sessionId);
        String sessionCompletion=repository.sessionCompletion(c,sessionId);
        if(!saved.id().equals(sessionCompletion))throw new HistoryFailure(404,"NOT_FOUND");
    }
    private ObjectNode savePayload(HistoryRequest request,boolean trusted) {
        ObjectNode payload=mapper.createObjectNode().put("kind",request.kind()).put("intent",request.intent())
                .put("assessmentContractVersion",request.assessmentContractVersion()).put("schemaVersion",request.schemaVersion())
                .put("elderId",request.elderId()).put("idempotencyKey",request.idempotencyKey());
        payload.set("answers",request.answers().deepCopy());
        if(trusted)payload.put("previewId",request.previewId()).put("displayBinding",request.displayBinding());
        return payload;
    }
    private JsonNode rebindDisplay(JsonNode source,String previewId,String assessmentId,String completedAt) {
        if(source==null||!source.isObject()||!previewId.equals(source.path("assessmentId").asText()))throw new HistoryFailure(503,"UNAVAILABLE");
        ObjectNode result=(ObjectNode)source.deepCopy();result.put("assessmentId",assessmentId).put("assessmentCompletedAt",completedAt);return result;
    }
    public HistoryRepository.Page list(String evidence,int limit,String cursor) {
        enabled();
        if(limit<1 || limit>50 || (cursor!=null && !cursor.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")))
            throw new HistoryFailure(400,"INVALID_CURSOR");
        return repository.transaction(c->{var elder=owner(c,evidence); return repository.list(c,elder.responsibleUserId(),elder.elderId(),limit,cursor);});
    }
    public HistoryRepository.Detail detail(String evidence,String id) {
        if(!userLoopAvailable()) throw new HistoryFailure(503,"UNAVAILABLE");
        return repository.transaction(c->{
            var elder=owner(c,evidence);
            if(id==null || !id.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw new HistoryFailure(404,"NOT_FOUND");
            return repository.detail(c,elder.responsibleUserId(),elder.elderId(),id);
        });
    }
    public HistoryRepository.RecommendationDetail recommendation(String evidence,String id) {
        if(!userLoopAvailable()) throw new HistoryFailure(503,"UNAVAILABLE");
        return repository.transaction(c->{
            var elder=owner(c,evidence);
            if(id==null || !id.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw new HistoryFailure(404,"NOT_FOUND");
            return repository.recommendation(c,elder.responsibleUserId(),elder.elderId(),id);
        });
    }
    private JsonNode canonical(JsonNode value) {
        if(value.isObject()) {
            ObjectNode result=mapper.createObjectNode();
            List<String> keys=new ArrayList<>(); value.fieldNames().forEachRemaining(keys::add); Collections.sort(keys);
            keys.forEach(key->result.set(key,canonical(value.get(key)))); return result;
        }
        if(value.isArray()) {var array=mapper.createArrayNode(); value.forEach(item->array.add(canonical(item))); return array;}
        return value;
    }
    private String digest(JsonNode value) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(value)));}
        catch(Exception ignored) {throw new HistoryFailure(503,"ERROR");}
    }
    private int serializedSize(JsonNode value) {
        try{return mapper.writeValueAsBytes(value).length;}catch(Exception ignored){throw new HistoryFailure(503,"ERROR");}
    }
}
