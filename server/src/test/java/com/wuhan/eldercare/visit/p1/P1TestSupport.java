package com.wuhan.eldercare.visit.p1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wuhan.eldercare.visit.auth.*;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import java.net.URI;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Only loaded from test classes. Requires an explicit fresh isolated MySQL environment. */
public final class P1TestSupport implements AutoCloseable {
    public final HikariDataSource database;
    public final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules()
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    public final Clock clock = Clock.systemUTC();
    public final C5AuthEvidenceResolver auth;
    public final String alice="P1_SYNTHETIC_ALICE_"+UUID.randomUUID();
    public final String bob="P1_SYNTHETIC_BOB_"+UUID.randomUUID();
    public final String adminPassword="P1_SYNTHETIC_ADMIN_"+UUID.randomUUID();
    public final String passwordHash;
    public final P1Service.Settings settings;
    public final P1Service service;
    public P1TestSupport(Map<String,String> env) throws Exception {
        if(!"true".equals(env.get("P1_DISPOSABLE_MYSQL")))throw new IllegalArgumentException("explicit P1 disposable marker required");
        String url=env.get("P1_MYSQL_URL");
        if(url==null||!url.startsWith("jdbc:mysql://127.0.0.1:"))throw new IllegalArgumentException("isolated loopback required");
        URI address=URI.create("http://"+url.substring("jdbc:mysql://".length()).split("\\?",2)[0]);
        if(address.getPort()<1||address.getPort()==3306||!address.getPath().startsWith("/p1_intake_disposable_"))throw new IllegalArgumentException("production schema or port forbidden");
        database=new HikariDataSource();database.setJdbcUrl(url);database.setUsername(env.get("P1_MYSQL_USERNAME"));database.setPassword(env.get("P1_MYSQL_PASSWORD"));database.setMaximumPoolSize(8);database.setPoolName("p1-synthetic-disposable");
        Flyway.configure().dataSource(database).locations("classpath:db/migration").load().migrate();
        var sessions=new JdbcAuthIdentitySessionRepository(database,ServerOpaquePrincipalSource.production());
        auth=new C5AuthEvidenceResolver(sessions,new Sha256SessionEvidenceHasher(),clock);
        var now=clock.instant();
        sessions.createOrLogin("P1_SYNTHETIC",P1Service.digest(alice),P1Service.digest(alice),now,now.plusSeconds(7200));
        sessions.createOrLogin("P1_SYNTHETIC",P1Service.digest(bob),P1Service.digest(bob),now,now.plusSeconds(7200));
        passwordHash=P1Service.passwordHash(adminPassword,new byte[16]);
        settings=new P1Service.Settings(true,true,"P1_SYNTHETIC_NOTICE_V1","仅用于合成测试，不采集真实客户资料。","P1_SYNTHETIC_NOT_PRODUCTION_APPROVAL","","p1-synthetic-admin",passwordHash);
        service=new P1Service(database,auth,mapper,clock,settings);
    }
    public P1Service.Input input(String kind){return new P1Service.Input(UUID.randomUUID().toString(),P1Service.CONTRACT,kind,P1Service.INSTITUTION,
            "合成联系人","13900000000","FAMILY","UNDECIDED","周六上午，待顾问沟通",2,null,settings.noticeVersion(),true);}
    public void close(){database.close();}
}
