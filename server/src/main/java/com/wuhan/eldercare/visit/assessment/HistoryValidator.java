package com.wuhan.eldercare.visit.assessment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Semaphore;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.io.IOException;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/** Uses packaged pure validators, not a Java translation. No source/payload logs. */
public final class HistoryValidator {
    private final ObjectMapper mapper;
    private final String node;
    private Path assets;
    private final Semaphore slots=new Semaphore(4);
    public HistoryValidator(ObjectMapper mapper, String node) { this.mapper=mapper; this.node=node; }
    public void validate(JsonNode answers) {
        JsonNode response=invoke(answers,"bridge",65536,8192);
        if(response.path("technicalFailure").asBoolean(true)) throw new HistoryFailure(503,"UNAVAILABLE");
        if(!response.path("valid").asBoolean(false)) throw new HistoryFailure(400,"INVALID_INPUT");
    }
    public JsonNode profileDisplay(JsonNode completed) {
        JsonNode response=invoke(completed,"profile",131072,8192);
        if(!response.path("ok").asBoolean(false) || !response.path("display").isObject()) throw new HistoryFailure(503,"UNAVAILABLE");
        return response.get("display");
    }
    public JsonNode recommendationDisplay(JsonNode input) {
        JsonNode response=invoke(input,"recommendation",1048576,262144);
        if(!response.path("ok").asBoolean(false) || !response.path("display").isObject()) throw new HistoryFailure(503,"UNAVAILABLE");
        return response.get("display");
    }
    private JsonNode invoke(JsonNode input,String operation,int inputLimit,int outputLimit) {
        Process process=null;
        ExecutorService io=null;
        boolean acquired=false;
        try {
            byte[] bytes=mapper.writeValueAsBytes(input);
            if(bytes.length>inputLimit) throw new HistoryFailure(400,"INVALID_INPUT");
            acquired=slots.tryAcquire(1,TimeUnit.SECONDS);
            if(!acquired) throw new HistoryFailure(503,"UNAVAILABLE");
            Path root = assets();
            process = new ProcessBuilder(node, "--no-warnings", root.resolve(operation+".mjs").toString(),
                    "--source-root",root.resolve(operation.equals("bridge")?"types":"miniprogram").toString()).redirectError(ProcessBuilder.Redirect.DISCARD).start();
            final Process child=process;
            io=Executors.newVirtualThreadPerTaskExecutor();
            var writer=io.submit(()->{try(var stdin=child.getOutputStream()){stdin.write(bytes);}return true;});
            var reader=io.submit(()->child.getInputStream().readNBytes(outputLimit+1));
            if (!process.waitFor(8,TimeUnit.SECONDS)) throw new HistoryFailure(503,"UNAVAILABLE");
            writer.get(1,TimeUnit.SECONDS);
            byte[] output=reader.get(1,TimeUnit.SECONDS);
            if(output.length>outputLimit || process.exitValue()!=0) throw new HistoryFailure(503,"UNAVAILABLE");
            JsonNode response=mapper.readTree(output);
            if(response==null) throw new HistoryFailure(503,"UNAVAILABLE");
            return response;
        } catch(HistoryFailure failure) { throw failure;
        } catch(InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new HistoryFailure(503,"UNAVAILABLE");
        } catch(Exception ignored) { throw new HistoryFailure(503,"UNAVAILABLE");
        } finally {
            if(process!=null && process.isAlive()) process.destroyForcibly();
            if(io!=null) io.shutdownNow();
            if(acquired) slots.release();
        }
    }
    private synchronized Path assets() throws Exception {
        if(assets!=null) return assets;
        Path root=Files.createTempDirectory("assessment-pure-validator-");
        Files.createDirectories(root.resolve("types"));
        for(String name: new String[]{"assessment.ts","assessment-v2.ts"}) {
            try(var input=new ClassPathResource("assessment-validator/types/"+name).getInputStream()) {
                Files.copy(input,root.resolve("types").resolve(name));
            }
        }
        try(var input=new ClassPathResource("assessment-validator/tools/validate-completed-assessment.mjs").getInputStream()) {
            Files.copy(input,root.resolve("bridge.mjs"));
        }
        try(var input=new ClassPathResource("assessment-validator/tools/derive-historical-profile.mjs").getInputStream()) {
            Files.copy(input,root.resolve("profile.mjs"));
        }
        try(var input=new ClassPathResource("assessment-validator/tools/derive-historical-recommendation.mjs").getInputStream()) {
            Files.copy(input,root.resolve("recommendation.mjs"));
        }
        var resources=new PathMatchingResourcePatternResolver(getClass().getClassLoader())
                .getResources("classpath*:assessment-validator/miniprogram/**/*.ts");
        if(resources.length==0) throw new IOException("packaged profile source missing");
        for(var resource:resources) {
            String url=resource.getURL().toExternalForm();
            String marker="assessment-validator/miniprogram/";
            int index=url.indexOf(marker);
            if(index<0) throw new IOException("source path");
            Path relative=Path.of(url.substring(index+marker.length())).normalize();
            if(relative.isAbsolute() || relative.startsWith("..")) throw new IOException("source boundary");
            Path destination=root.resolve("miniprogram").resolve(relative);
            Files.createDirectories(destination.getParent());
            try(var input=resource.getInputStream()){Files.copy(input,destination);}
        }
        Files.writeString(root.resolve("package.json"),"{\"type\":\"module\"}");
        assets=root;
        return root;
    }
}
