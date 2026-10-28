import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, pbkdf2Sync, createHash } from "node:crypto";
// External diagnostic harness only. This file is not a production authentication provider or JAR resource.
// Database secrets are read only from a guarded local private file; administrator secrets are random per run.
const root = path.resolve(import.meta.dirname, "../..");
function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  assert.ok(
    process.argv[index + 1] && !process.argv[index + 1].startsWith("--"),
    "Missing " + name,
  );
  return process.argv[index + 1];
}
const out = path.resolve(
  root,
  option(
    "--output",
    "output/admin-react-rebuild-v1-20261028/backend/jar-auth-final",
  ),
);
const privateSettings = path.resolve(
  root,
  option("--database-settings", "output/p1-1/mysql.private.json"),
);
const outputRoot = path.join(root, "output") + path.sep;
assert.ok(
  out.toLowerCase().startsWith(outputRoot.toLowerCase()),
  "Evidence must stay under project output",
);
assert.ok(
  privateSettings.toLowerCase().startsWith(outputRoot.toLowerCase()),
  "Database settings must stay under project output",
);
assert.ok(
  privateSettings.endsWith(".private.json"),
  "Explicit private database settings required",
);
fs.mkdirSync(out, { recursive: true });
const settings = JSON.parse(
  fs.readFileSync(privateSettings, "utf8").replace(/^\uFEFF/, ""),
);
assert.equal(settings.P1_DISPOSABLE_MYSQL, "true");
assert.ok(
  typeof settings.P1_MYSQL_USERNAME === "string" &&
    /^p1_test_[a-z0-9]+$/.test(settings.P1_MYSQL_USERNAME),
  "Restricted disposable database username required",
);
assert.ok(
  typeof settings.P1_MYSQL_PASSWORD === "string" &&
    settings.P1_MYSQL_PASSWORD.length > 0,
  "Restricted disposable database credentials required",
);
const match =
  /^jdbc:mysql:\/\/127\.0\.0\.1:(?!3306\/)([0-9]+)\/(p1_intake_disposable_[a-z0-9]+)\?/.exec(
    settings.P1_MYSQL_URL,
  );
assert.ok(match, "Known loopback disposable database required");
const selectedInstance = option("--mysql-instance", "");
const instance = path.resolve(
  root,
  selectedInstance ||
    fs
      .readFileSync(path.join(root, "output/c2-a/active-instance.txt"), "utf8")
      .trim(),
);
assert.ok(
  instance
    .toLowerCase()
    .startsWith(path.join(root, "output").toLowerCase() + path.sep),
);
assert.match(path.basename(instance), /^mysql-disposable-[a-f0-9]{32}$/);
const rootConfig = fs
  .readFileSync(path.join(instance, "root-client.private.cnf"), "utf8")
  .split(/\r?\n/);
assert.ok(
  rootConfig.includes("host=127.0.0.1") &&
    rootConfig.includes("port=" + match[1]),
  "Count queries must use the same loopback MySQL port",
);
const mysql = option(
  "--mysql",
  "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe",
);
const tables = [
  "p1_service_request_v1",
  "p1_service_event_v1",
  "p1_visit_v1",
  "p1_operation_event_v1",
  "institution_publication_draft_v1",
  "institution_publication_v1",
  "institution_publication_scope_v1",
  "p1_staff_block_v1",
  "p1_institution_capacity_v1",
  "p1_report_snapshot_v1",
];
function counts() {
  const sql =
    tables
      .map((t) => `SELECT '${t}',COUNT(*) FROM ${match[2]}.${t}`)
      .join(" UNION ALL ") + ";";
  const result = spawnSync(
    mysql,
    [
      "--defaults-file=" + path.join(instance, "root-client.private.cnf"),
      "--batch",
      "--skip-column-names",
    ],
    { input: sql, encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, "Read-only business count query failed");
  return Object.fromEntries(
    result.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const [table, count] = line.split("\t");
        return [table, Number(count)];
      }),
  );
}
const before = counts(),
  password = "JAR_SYNTHETIC_" + randomBytes(20).toString("hex"),
  salt = randomBytes(16);
const scopeQuery = spawnSync(
  mysql,
  [
    "--defaults-file=" + path.join(instance, "root-client.private.cnf"),
    "--batch",
    "--skip-column-names",
  ],
  {
    input: `SELECT DISTINCT institution_id FROM ${match[2]}.institution_publication_scope_v1 WHERE dataset_mode='SYNTHETIC_TEST_ONLY';`,
    encoding: "utf8",
    windowsHide: true,
  },
);
assert.equal(scopeQuery.status, 0, "Read-only publication scope query failed");
const syntheticIds = new Set(
  scopeQuery.stdout.trim().split(/\r?\n/).filter(Boolean),
);
const hash =
  "pbkdf2-sha256$210000$" +
  salt.toString("base64") +
  "$" +
  pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("base64");
const username = "jar-synthetic-admin";
if (fs.existsSync(path.join(out, "runtime.private.json")))
  assert.equal(
    JSON.parse(
      fs
        .readFileSync(path.join(out, "runtime.private.json"), "utf8")
        .replace(/^\uFEFF/, ""),
    ).fixtureOnly,
    true,
    "Refusing to replace a non-fixture private runtime",
  );
fs.writeFileSync(
  path.join(out, "runtime.private.json"),
  JSON.stringify({ username, password, fixtureOnly: true }, null, 2),
  { mode: 0o600 },
);
const jar = path.resolve(
  root,
  option("--jar", "server/target/visit-submission-server-0.1.0-SNAPSHOT.jar"),
);
const java = option(
  "--java",
  process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, "bin/java.exe")
    : "java",
);
const log = fs.createWriteStream(path.join(out, "server.log"));
let startup = "",
  startFailure;
const child = spawn(
  java,
  [
    "-jar",
    jar,
    "--server.address=127.0.0.1",
    "--server.port=0",
    "--spring.profiles.active=production",
    "--c4.persistence.enabled=true",
    "--c5.auth.enabled=false",
    "--c2.history.writes-enabled=false",
    "--p1.intake.enabled=false",
    "--institution.publications.enabled=true",
  ],
  {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      C4_MYSQL_URL: settings.P1_MYSQL_URL,
      C4_MYSQL_USERNAME: settings.P1_MYSQL_USERNAME,
      C4_MYSQL_PASSWORD: settings.P1_MYSQL_PASSWORD,
      P1_ADMIN_USERNAME: username,
      P1_ADMIN_PASSWORD_HASH: hash,
    },
  },
);
child.stdout.on("data", (chunk) => {
  startup += chunk.toString();
  log.write(chunk);
});
child.stderr.on("data", (chunk) => log.write(chunk));
child.on("error", (error) => {
  startFailure = error;
});
const exited = new Promise((resolve) => child.once("close", resolve));
const checks = [];
try {
  let port;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startFailure)
      throw Error(
        "Packaged JAR process could not start; check the Java21 executable",
      );
    const found = /Tomcat started on port ([0-9]+)/.exec(startup);
    if (found) {
      port = Number(found[1]);
      break;
    }
    if (child.exitCode !== null)
      throw Error(
        "Actual packaged JAR exited before readiness; inspect private local server log",
      );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(port, "Packaged JAR did not start in bounded readiness window");
  const origin = "http://127.0.0.1:" + port,
    prefix = "/api/v1/p1-service/admin";
  async function request(route, expected, options = {}) {
    const response = await fetch(origin + route, {
      ...options,
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, expected, route + " status");
    checks.push({ route, status: expected });
    return response;
  }
  const config = await (await request("/api/v1/p1-service/config", 200)).json();
  assert.equal(config.enabled, false);
  assert.equal(config.datasetMode, "PRODUCTION");
  await request(prefix + "/session", 401);
  await request(prefix + "/login", 403, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  await request(prefix + "/login", 401, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-P1-Admin-Request": "1" },
    body: JSON.stringify({ username, password: password + "_wrong" }),
  });
  const login = await request(prefix + "/login", 200, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-P1-Admin-Request": "1" },
    body: JSON.stringify({ username, password }),
  });
  const cookieHeader = login.headers.get("set-cookie") || "",
    cookie = cookieHeader.split(";")[0];
  const cookieFlags = {
    secure: /;\s*Secure(?:;|$)/i.test(cookieHeader),
    httpOnly: /;\s*HttpOnly(?:;|$)/i.test(cookieHeader),
    sameSiteStrict: /;\s*SameSite=Strict(?:;|$)/i.test(cookieHeader),
    adminApiPath: /;\s*Path=\/api\/v1\/p1-service\/admin(?:;|$)/i.test(
      cookieHeader,
    ),
  };
  assert.ok(
    Object.values(cookieFlags).every(Boolean),
    "Cookie security attributes must remain intact",
  );
  const body = await login.json();
  assert.equal(body.authenticated, true);
  assert.ok(body.csrfToken);
  const session = await (
    await request(prefix + "/session", 200, { headers: { Cookie: cookie } })
  ).json();
  assert.ok(
    session.csrfToken === body.csrfToken,
    "Session CSRF binding mismatch",
  );
  await request(prefix + "/requests", 503, { headers: { Cookie: cookie } });
  const institutions = await (
    await request(prefix + "/institutions", 200, {
      headers: { Cookie: cookie },
    })
  ).json();
  assert.equal(institutions.dataEnvironment, "PRODUCTION");
  assert.ok(
    institutions.items.every((item) => !syntheticIds.has(item.institutionId)),
    "Synthetic publication scope must not leak into production protocol pool",
  );
  await request(prefix + "/logout", 403, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  await request(prefix + "/logout", 403, {
    method: "POST",
    headers: { Cookie: cookie, "X-P1-CSRF": "INVALID_SYNTHETIC_CSRF" },
  });
  await request(prefix + "/session", 200, { headers: { Cookie: cookie } });
  const logout = await request(prefix + "/logout", 200, {
    method: "POST",
    headers: { Cookie: cookie, "X-P1-CSRF": body.csrfToken },
  });
  assert.equal((await logout.json()).authenticated, false);
  await request(prefix + "/session", 401, { headers: { Cookie: cookie } });
  const after = counts();
  assert.deepEqual(
    after,
    before,
    "No business records may be created or altered",
  );
  const result = {
    checkedAt: new Date().toISOString(),
    actualPackagedJar: true,
    jarSha256: createHash("sha256").update(fs.readFileSync(jar)).digest("hex"),
    loopbackOrigin: origin,
    fixtureDatabaseOnly: true,
    productionProtocolBranch: true,
    flags: {
      p1Intake: false,
      c5Auth: false,
      c2HistoryWrites: false,
      institutionPublicationMaintenance: true,
      c4Persistence: true,
    },
    cookieFlags,
    csrfMissingAndWrongRejected: true,
    logoutRevokesSession: true,
    syntheticPublicationScopeExcluded: true,
    businessCountsBefore: before,
    businessCountsAfter: after,
    checks,
    note: "Only this isolated process temporarily enables institution maintenance so the existing admin login gate is available; no publish/create/update calls. Node manually transports the Secure cookie over loopback HTTP; this does not prove browser HTTPS cookie delivery.",
  };
  fs.writeFileSync(
    path.join(out, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      actualJar: true,
      httpChecks: checks.length,
      cookieFlags,
      businessRecordsUnchanged: true,
      httpsBrowserVerified: false,
    }),
  );
} finally {
  if (child.exitCode === null) child.kill();
  await exited;
  log.end();
}
