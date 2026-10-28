package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.application.AuthEvidenceResolver;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class P1BoundaryTest {
    private P1Service service(){return new P1Service(null,e->AuthEvidenceResolver.Resolution.failure(AuthEvidenceResolver.Resolution.Status.UNAVAILABLE),new ObjectMapper(),Clock.systemUTC(),
            new P1Service.Settings(false,false,"notice","notice text","approval","","",""));}
    private P1Service.Input input(String id,String institution,String phone,String consent,boolean accepted,int count){return new P1Service.Input(id,P1Service.CONTRACT,"VISIT_INTENT",institution,"合成联系人",phone,"FAMILY","UNDECIDED",null,count,null,consent,accepted);}
    @Test void serviceDefaultsFailClosedAndUnknownPhoneIsNotAnOfficialContact(){var s=service();assertFalse(s.config().path("enabled").asBoolean());assertTrue(s.config().path("platformContact").path("phone").isNull());assertEquals("平台咨询",s.config().path("platformContact").path("label").asText());assertThrows(P1Failure.class,()->s.ownList("anything"));}
    @Test void inputHasItsOwnVersionAndPreservesOptionalUnknowns(){var s=service();var i=input(UUID.randomUUID().toString(),null,"13900000000","notice",true,2);assertEquals(i,s.validate(i));assertNull(i.institutionId());assertNull(i.preferredWindow());}
    @Test void malformedIdUnknownInstitutionPhoneMissingConsentAndInvalidSizeReject(){var s=service();String id=UUID.randomUUID().toString();
        assertThrows(P1Failure.class,()->s.validate(input("../file",null,"13900000000","notice",true,2)));
        assertThrows(P1Failure.class,()->s.validate(input(id,"../invented","13900000000","notice",true,2)));
        assertThrows(P1Failure.class,()->s.validate(input(id,null,"not-phone","notice",true,2)));
        assertThrows(P1Failure.class,()->s.validate(input(id,null,"13900000000","old-notice",true,2)));
        assertThrows(P1Failure.class,()->s.validate(input(id,null,"13900000000","notice",false,2)));
        assertThrows(P1Failure.class,()->s.validate(input(id,null,"13900000000","notice",true,11)));
    }
    @Test void passwordCredentialIsSaltedHashAndRejectsMalformedOrWrongPasswords(){String hash=P1Service.passwordHash("synthetic-password",new byte[16]);assertTrue(P1Service.validPasswordHash(hash));assertTrue(P1Service.verifyPassword("synthetic-password",hash));assertFalse(P1Service.verifyPassword("wrong-password",hash));assertFalse(P1Service.validPasswordHash("plaintext"));}
    @Test void multilineIntentAndAssistanceAllowLineBreaksButNoOtherControls(){
        var base=input(UUID.randomUUID().toString(),null,"13900000000","notice",true,2);
        var lines=new P1Service.Input(base.requestId(),base.inputVersion(),base.kind(),base.institutionId(),base.contactName(),base.contactPhone(),base.relationship(),base.serviceScenario(),"周六上午\n或周日下午",base.partySize(),"需轮椅\r\n请先联系",base.consentVersion(),true);
        assertEquals(lines,service().validate(lines));assertFalse(P1Service.multilineText("看院\u0000说明",200));assertFalse(P1Service.multilineText("看院\t说明",200));
    }
    @Test void oldTestProfilesCannotBePromotedByFormalFlags(){
        for(String profile:new String[]{"test","demo","assessment-history-test-only","production","p1-synthetic"}){
            try(var context=new org.springframework.context.annotation.AnnotationConfigApplicationContext()){
                context.getEnvironment().setActiveProfiles(profile);
                context.getEnvironment().getPropertySources().addFirst(new org.springframework.core.env.MapPropertySource("synthetic-test",java.util.Map.of(
                    "c4.persistence.enabled",true,"c5.auth.enabled",true,"p1.intake.enabled",true,
                    "p1.intake.notice-version","test","p1.intake.notice-text","synthetic","p1.intake.notice-approval-ref","synthetic")));
                context.registerBean(javax.sql.DataSource.class,()->org.mockito.Mockito.mock(javax.sql.DataSource.class,org.mockito.Mockito.RETURNS_DEEP_STUBS));
                context.registerBean(ObjectMapper.class,()->new ObjectMapper());context.registerBean(Clock.class,()->Clock.systemUTC());
                context.registerBean(AuthEvidenceResolver.class,()->new AuthEvidenceResolver(){
                    public Resolution resolve(String evidence){return Resolution.failure(Resolution.Status.UNAVAILABLE);}
                    public boolean supportsTransactionalResolution(){return true;}
                });
                context.register(com.wuhan.eldercare.visit.config.P1ServiceConfiguration.class);context.refresh();
                assertEquals(profile.equals("production")||profile.equals("p1-synthetic"),context.getBean(P1Service.class).config().path("enabled").asBoolean(),profile);
                assertEquals(profile.equals("p1-synthetic")?"SYNTHETIC_TEST_ONLY":"PRODUCTION",context.getBean(P1Service.class).datasetMode());
            }
        }
    }
}
