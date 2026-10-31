#!/usr/bin/env node
/** Local-only pre-publication inventory. Never emits matched values or uploads source. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const out = path.resolve(root, process.argv[2] || 'output/admin-pages-mock-demo-v1-20261031/security-scan.json');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 512 * 1024 * 1024 });
const lines = (buffer) => buffer.toString('utf8').trim().split('\n').filter(Boolean);
const tracked = git('ls-files', '-z').toString('utf8').split('\0').filter(Boolean);
const untrackedInputs = git('ls-files', '--others', '--exclude-standard', '-z', '--', 'admin-web').toString('utf8').split('\0').filter(Boolean);
const findings = [];
const inventory = [];
const maxText = 8 * 1024 * 1024;
let scannedCurrent = 0, scannedHistory = 0, skippedBinaryCurrent = 0, skippedBinaryHistory = 0;

// Credential signatures only; generic config names alone are not credentials.
const signatures = [
  ['private-key-material', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
  ['openai-key-shape', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g],
  ['github-token-shape', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['slack-token-shape', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['aws-access-key-shape', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['google-api-key-shape', /\bAIza[A-Za-z0-9_-]{35}\b/g],
  ['bcrypt-hash-candidate', /\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}/g],
  ['jwt-shape', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
  ['literal-secret-candidate', /(?<![A-Za-z0-9_])(?:api[_-]?key|app[_-]?secret|access[_-]?token|auth[_-]?token|client[_-]?secret|password(?:[_-]?hash)?|passwd|secret|authorization)\s*['"]?\s*[:=]\s*['"]([^'"\r\n]{8,})['"]/gi],
  ['config-secret-literal-candidate', /^\s*(?:[\w.-]+\.)?(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret|app[_-]?secret)\s*[:=]\s*['"]?([^\s'"#]{6,})/gmi],
  ['environment-secret-literal-candidate', /\b(?:[A-Z][A-Z0-9_]*_)?(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|ACCESS_KEY)\s*=\s*['"]?([^\s'"`]{8,})/g],
  ['credential-url-candidate', /\b(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis|https?):\/\/[^\s\/@:]+:[^\s\/@]{5,}@[^\s"'<>]+/gi],
  ['china-mobile-candidate', /(?<![A-Za-z0-9_.])1[3-9]\d{9}(?![A-Za-z0-9_.])/g],
  ['china-id-candidate', /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g],
  ['email-candidate', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
];
const fixturePath = (file) => /(?:^|\/)(?:test|tests|__tests__|fixtures|test-fixtures)(?:\/|$)|\.test\.[^/]+$|Test\.java$|TestSupport\.java$|check-[^/]+\.(?:mjs|js|ts)$|^scripts\/p1-|^tools\/.*(?:test|fixture)/i.test(file);
const syntheticPhone = (value) => /^(?:1[3-9]\d0{7}\d|13800138000|13900139000|1[3-9]123456789|12345678901)$/.test(value);
const publicExample = (value) => /(?:example\.(?:com|org|net|invalid)|localhost|127\.0\.0\.1|test\.invalid|synthetic|placeholder|change[-_]?me|not[-_]?a[-_]?real|your[-_]|x{8,}|\*{4,}|\$\{|process\.env|System\.getenv|REDACTED|脱敏|示例|合成)/i.test(value);
const passwordFixture = (value) => /^(?:.{0,20}(?:password|synthetic|test-only|test-password|not-real|development-only|change-me|example).{0,20}|123456(?:78)?|admin123|p1-synthetic-admin)$/i.test(value);
function scan(file, bytes, location) {
  if (bytes.length > maxText || bytes.subarray(0, 8192).includes(0)) return false;
  const text = bytes.toString('utf8');
  for (const [category, regex] of signatures) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const value = match[1] ?? match[0];
      let disposition = 'review-required';
      if (category === 'china-mobile-candidate' && syntheticPhone(value)) disposition = 'known-synthetic-number';
      else if (publicExample(value)) disposition = 'example-or-placeholder';
      else if (['literal-secret-candidate', 'config-secret-literal-candidate', 'environment-secret-literal-candidate'].includes(category) && (fixturePath(file) || passwordFixture(value))) disposition = 'test-or-development-literal';
      else if (['credential-url-candidate', 'email-candidate'].includes(category) && fixturePath(file)) disposition = 'test-url-or-fixture';
      else if (category === 'email-candidate' && /(?:^|\/)(?:LICENSE|package-lock\.json|package\.json)$/.test(file)) disposition = 'dependency-public-metadata';
      findings.push({ scope: location.scope, path: file, ...(location.commit ? { blob: location.commit } : {}),
        line: text.slice(0, match.index).split('\n').length, category, disposition });
    }
  }
  return true;
}
function inspectPath(file, scope, blob) {
  let category;
  if (/(?:^|\/)(?:runtime\.private(?:\.[^/]*)?|\.env(?:\.[^/]*)?|[^/]*\.private(?:\.config)?\.json)(?:\/|$)|(?:^|\/)(?:secrets?|credentials?)(?:\/|$)|\.(?:pem|p12|pfx|jks|keystore|key)$/i.test(file)) category = 'private-config-or-key-path';
  else if (/\.(?:sql|sqlite3?|db|dump|bak|xlsx?|csv|tsv|zip|7z|rar)$/i.test(file)) category = 'database-export-or-archive-path';
  else if (/\.(?:png|jpe?g|webp|gif|pdf|docx?)$/i.test(file)) category = 'binary-document-or-image-not-content-scanned';
  if (category) inventory.push({ scope, path: file, ...(blob ? { blob } : {}), category });
}
for (const file of [...new Set([...tracked, ...untrackedInputs])]) {
  const scope = tracked.includes(file) ? 'current-tracked' : 'build-input-untracked';
  const absolute = path.resolve(root, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  inspectPath(file, scope);
  if (scan(file, fs.readFileSync(absolute), { scope })) scannedCurrent++; else skippedBinaryCurrent++;
}

// All locally reachable refs, not just HEAD. Scan each distinct blob once.
const reachable = lines(git('rev-list', '--objects', '--all'));
const objectPaths = new Map();
for (const line of reachable) {
  const split = line.indexOf(' ');
  if (split > 0) objectPaths.set(line.slice(0, split), line.slice(split + 1));
}
const objectIds = [...objectPaths.keys()];
const info = execFileSync('git', ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { cwd: root, input: objectIds.join('\n') + '\n', maxBuffer: 64 * 1024 * 1024 });
const blobs = lines(info).map((line) => line.split(' ')).filter(([, type]) => type === 'blob');
let batch = [], batchBytes = 0;
function scanBatch() {
  if (!batch.length) return;
  const data = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: batch.join('\n') + '\n', maxBuffer: 64 * 1024 * 1024 });
  let offset = 0;
  for (const oid of batch) {
    const end = data.indexOf(10, offset);
    const [, type, size] = data.subarray(offset, end).toString('ascii').split(' ');
    if (type !== 'blob') throw new Error('Unexpected local Git object type');
    offset = end + 1;
    const bytes = data.subarray(offset, offset + Number(size));
    if (scan(objectPaths.get(oid), bytes, { scope: 'reachable-history', commit: oid })) scannedHistory++; else skippedBinaryHistory++;
    offset += Number(size) + 1;
  }
  batch = []; batchBytes = 0;
}
for (const [oid, , rawSize] of blobs) {
  inspectPath(objectPaths.get(oid), 'reachable-history', oid);
  if (Number(rawSize) > maxText) { skippedBinaryHistory++; continue; }
  if (batchBytes + Number(rawSize) > 32 * 1024 * 1024) scanBatch();
  batch.push(oid); batchBytes += Number(rawSize);
}
scanBatch();
// rev-list names each blob only once; also inventory historical aliases/renames.
const historicalPaths = [...new Set(git('log', '--all', '--format=', '--name-only', '-z', '--no-renames').toString('utf8').split('\0').map((file) => file.replace(/^\n+/, '')).filter(Boolean))];
const namedHistory = new Set(inventory.filter((item) => item.scope === 'reachable-history').map((item) => item.path));
for (const file of historicalPaths) if (!namedHistory.has(file)) inspectPath(file, 'reachable-history-path');
const countBy = (items, key) => Object.fromEntries([...new Set(items.map((item) => item[key]))].sort().map((value) => [value, items.filter((item) => item[key] === value).length]));
const result = {
  generatedAt: new Date().toISOString(), localOnly: true, matchedValuesIncluded: false,
  scope: { currentTrackedFiles: tracked.length, untrackedAdminInputs: untrackedInputs.length, reachableCommits: Number(git('rev-list', '--count', '--all').toString().trim()),
    reachableBlobs: blobs.length, historicalPaths: historicalPaths.length, scannedTextCurrent: scannedCurrent, scannedTextHistory: scannedHistory, skippedBinaryOrOversizeCurrent: skippedBinaryCurrent, skippedBinaryOrOversizeHistory: skippedBinaryHistory, maxTextBytes: maxText },
  limitations: ['Pattern matching is not proof of absence.', 'Binary images, Office/PDF and archives are inventoried, not OCRed or recursively extracted.', 'Unknown mobile/email candidates require context review; public institution facts and synthetic fixtures are not private by definition.', 'Only locally reachable Git refs are covered; remote-only/unreachable objects and provider secret stores are not queried.'],
  candidateCounts: countBy(findings, 'category'), dispositions: countBy(findings, 'disposition'), inventoryCounts: countBy(inventory, 'category'), findings, inventory,
};
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output: path.relative(root, out).replaceAll('\\', '/'), scope: result.scope, candidateCounts: result.candidateCounts, dispositions: result.dispositions, inventoryCounts: result.inventoryCounts }, null, 2));
