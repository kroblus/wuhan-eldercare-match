/* Shared by Apps Script V8 and the local Node client. No IO or credentials. */
var ReceiptContract = (function () {
  var keys = ['receipt_id', 'time', 'task', 'branch', 'commit', 'push', 'body'];
  var uuid = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  function exact(value, expected) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).length === expected.length
      && expected.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); });
  }
  function validate(r) {
    if (!exact(r, keys) || keys.some(function (k) { return typeof r[k] !== 'string'; })) return false;
    if (!new RegExp(uuid).test(r.receipt_id)) return false;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(r.time)) return false;
    var ms = Date.parse(r.time);
    if (!Number.isFinite(ms) || new Date(ms + 28800000).toISOString().slice(0, 19) + '+08:00' !== r.time) return false;
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.task)) return false;
    if (!/^codex\/[a-z0-9][a-z0-9._/-]{0,95}$/.test(r.branch)
      || /\.\.|\/\/|\/$|\.$|\.lock(?:\/|$)/.test(r.branch)) return false;
    if (!/^(?:[0-9a-f]{40}|NO_CODE_CHANGE)$/.test(r.commit)) return false;
    if (['VERIFIED', 'FAILED', 'NOT_NEEDED'].indexOf(r.push) < 0) return false;
    if (r.push === 'VERIFIED' && r.commit === 'NO_CODE_CHANGE') return false;
    if (Array.from(r.body).length > 300 || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(r.body)) return false;
    var lines = r.body.split('\n');
    var labels = ['完成：', '验证：', '遗留：', '下一步：'];
    if (lines.length !== 4 || !labels.every(function (label, i) {
      return lines[i].indexOf(label) === 0 && lines[i].slice(label.length).trim().length > 0;
    })) return false;
    // This receipt channel does not accept links or filesystem paths, even in prose.
    if (/(?:[a-z][a-z0-9+.-]*:\/\/|www\.|[a-z]:[\\/]|\\\\|(?:^|[\s：])(?:\/|\.\.\/|\.\/))/i.test(r.body)) return false;
    return true;
  }
  function canonical(r) {
    if (!validate(r)) throw new Error('INVALID_RECEIPT');
    var result = {};
    keys.forEach(function (k) { result[k] = r[k]; });
    return JSON.stringify(result);
  }
  function document(r) {
    canonical(r);
    return keys.slice(0, 6).map(function (k) { return k + ': ' + r[k]; }).join('\n') + '\n\n' + r.body + '\n';
  }
  return {
    exact: exact, validate: validate, canonical: canonical, document: document,
    schema: {
      type: 'object', additionalProperties: false, required: keys,
      properties: {
        receipt_id: { type: 'string', pattern: uuid, maxLength: 36 },
        time: { type: 'string', maxLength: 25, description: 'Original task time, YYYY-MM-DDTHH:mm:ss+08:00' },
        task: { type: 'string', maxLength: 64 },
        branch: { type: 'string', maxLength: 102 },
        commit: { type: 'string', maxLength: 40 },
        push: { type: 'string', enum: ['VERIFIED', 'FAILED', 'NOT_NEEDED'] },
        body: { type: 'string', maxLength: 300, description: 'Exactly four lines: 完成： / 验证： / 遗留： / 下一步：. No URLs or paths.' }
      }
    }
  };
}());
if (typeof module !== 'undefined') module.exports = ReceiptContract;
