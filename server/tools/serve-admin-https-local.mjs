// Local browser acceptance of the actual JAR and production Secure-cookie settings.
// Requires a separately approved/trusted localhost certificate; never edits trust stores.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, pbkdf2Sync } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const output = path.resolve(root, option('--output', 'output/admin-device-https-20261029/https'));
const tlsFile = path.resolve(root, option('--tls-settings', 'output/admin-device-https-20261029/tls/tls.private.json'));
const databaseFile = path.resolve(root, option('--database-settings', 'output/p1-1/mysql.private.json'));
const outputRoot = path.join(root, 'output') + path.sep;
for (const file of [output, tlsFile, databaseFile]) {
  assert.ok(file.toLowerCase().startsWith(outputRoot.toLowerCase()), 'Local diagnostics stay under project output');
}
for (const file of [tlsFile, databaseFile]) assert.ok(file.endsWith('.private.json'));
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const database = read(databaseFile), tls = read(tlsFile);
assert.equal(database.P1_DISPOSABLE_MYSQL, 'true');
assert.match(database.P1_MYSQL_URL, /^jdbc:mysql:\/\/127\.0\.0\.1:(?!3306\/)[0-9]+\/p1_intake_disposable_[a-z0-9]+\?/);
assert.match(database.P1_MYSQL_USERNAME, /^p1_test_[a-z0-9]+$/);
for (const file of [tls.keystore, tls.certificate]) {
  assert.ok(path.resolve(file).toLowerCase().startsWith(outputRoot.toLowerCase()));
  assert.ok(fs.existsSync(file));
}
assert.ok(typeof tls.password === 'string' && tls.password.length >= 16);
fs.mkdirSync(output, { recursive: true });
const occupied = await new Promise((resolve) => {
  const socket = net.connect({ host: '127.0.0.1', port: 18443 });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
assert.equal(occupied, false, 'Local HTTPS port is already occupied; stop the prior diagnostic first');
const runtimeFile = path.join(output, 'runtime.private.json');
if (fs.existsSync(runtimeFile)) assert.equal(read(runtimeFile).fixtureOnly, true);
const baseUrl = 'https://127.0.0.1:18443';
const username = 'https-local-admin', password = randomBytes(24).toString('base64url');
const salt = randomBytes(16);
const passwordHash = 'pbkdf2-sha256$210000$' + salt.toString('base64') + '$' +
  pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('base64');
const java = option('--java', process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java.exe') : 'java');
const jar = path.join(root, 'server/target/visit-submission-server-0.1.0-SNAPSHOT.jar');
const log = fs.createWriteStream(path.join(output, 'server.log'));
const child = spawn(java, [
  '-jar', jar, '--server.address=127.0.0.1', '--server.port=18443',
  '--spring.profiles.active=production', '--c4.persistence.enabled=true',
  '--c5.auth.enabled=false', '--c2.history.writes-enabled=false', '--p1.intake.enabled=false',
  '--institution.publications.enabled=true', '--server.ssl.enabled=true',
  '--server.ssl.key-store-type=PKCS12', '--server.ssl.key-alias=admin-local',
], {
  cwd: root, windowsHide: true,
  env: {
    ...process.env,
    C4_MYSQL_URL: database.P1_MYSQL_URL,
    C4_MYSQL_USERNAME: database.P1_MYSQL_USERNAME,
    C4_MYSQL_PASSWORD: database.P1_MYSQL_PASSWORD,
    P1_ADMIN_USERNAME: username, P1_ADMIN_PASSWORD_HASH: passwordHash,
    SERVER_SSL_KEY_STORE: tls.keystore,
    SERVER_SSL_KEY_STORE_PASSWORD: tls.password,
  },
});
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
let spawnError;
child.on('error', (error) => { spawnError = error; });
const closed = new Promise((resolve) => child.once('close', resolve));
const stop = () => { if (child.exitCode === null && !child.killed) child.kill(); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const ca = fs.readFileSync(tls.certificate);
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (spawnError || child.exitCode !== null) throw Error('Local HTTPS JAR failed to start; inspect server.log');
    ready = await new Promise((resolve) => {
      const request = https.get(baseUrl + '/api/v1/p1-service/config', { ca, timeout: 500 }, (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          if (response.statusCode !== 200) return resolve(false);
          try { const config = JSON.parse(body); resolve(config.datasetMode === 'PRODUCTION' && config.enabled === false); }
          catch { resolve(false); }
        });
      });
      request.on('error', () => resolve(false));
      request.on('timeout', () => request.destroy());
    });
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'TLS verification and disabled-intake configuration must pass before browser acceptance');
  fs.writeFileSync(runtimeFile, JSON.stringify({
    fixtureOnly: true, baseUrl, adminUrl: baseUrl + '/p1-admin/',
    adminUsername: username, adminPassword: password, processId: child.pid,
  }, null, 2), { mode: 0o600 });
  console.log('Local HTTPS JAR ready: ' + baseUrl + '/p1-admin/');
  console.log('Disposable database only; intake/history disabled. Credentials stay in runtime.private.json.');
  await closed;
} finally {
  stop();
  await closed;
  log.end();
}
