package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.util.concurrent.*;
import java.util.ArrayList;
import java.nio.file.*;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class HistoryBridgeIsolationTest {
    private final ObjectMapper mapper=new ObjectMapper();
    @Test void hungChildIncludingBlockedInputIsBoundedAndShellTextIsNotExecuted(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("bridge.mjs"),"setInterval(()=>{},1000)");
        var validator=new HistoryValidator(mapper,"node");
        var assets=HistoryValidator.class.getDeclaredField("assets");assets.setAccessible(true);assets.set(validator,dir);
        var input=mapper.createObjectNode().put("TEST_ONLY_SENSITIVE_SENTINEL","x".repeat(60000));
        long started=System.nanoTime();
        assertEquals(503,assertThrows(HistoryFailure.class,()->validator.validate(input)).status());
        assertTrue(TimeUnit.NANOSECONDS.toSeconds(System.nanoTime()-started)<12);
        Path sentinel=dir.resolve("COMMAND_MUST_NOT_EXECUTE");
        var injected=new HistoryValidator(mapper,"node & echo injected > "+sentinel);
        assertEquals(503,assertThrows(HistoryFailure.class,()->injected.validate(mapper.createObjectNode())).status());
        assertFalse(Files.exists(sentinel));
    }
    @Test void separateConcurrentInputsAndSafeRuntimeFailures() throws Exception {
        var validator=new HistoryValidator(mapper,"node");
        var answers=mapper.readTree(getClass().getResourceAsStream("/assessment-history/test-only-answers.json"));
        try(var pool=Executors.newFixedThreadPool(4)) {
            var futures=new ArrayList<Future<Boolean>>();
            for(int i=0;i<12;i++) {
                boolean valid=i%2==0;
                futures.add(pool.submit(()->{
                    try {validator.validate(valid?answers.deepCopy():mapper.createObjectNode());return valid;}
                    catch(HistoryFailure rejected){return !valid && rejected.status()==400;}
                }));
            }
            for(var future:futures)assertTrue(future.get(15,TimeUnit.SECONDS));
        }
        var absent=new HistoryValidator(mapper,"TEST_ONLY_NODE_EXECUTABLE_NOT_INSTALLED");
        assertEquals(503,assertThrows(HistoryFailure.class,()->absent.validate(answers)).status());
        ObjectNode oversized=mapper.createObjectNode().put("TEST_ONLY","x".repeat(70000));
        assertEquals(400,assertThrows(HistoryFailure.class,()->validator.validate(oversized)).status());
    }
}
