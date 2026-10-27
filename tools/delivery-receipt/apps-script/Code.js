/* Apps Script web app. Only Drive.Files.create is used; never read/list/search. */
var RECEIPT_INBOX = '1d-DE2eNyq78DnbZspC_UpvExUHke1aFR';

function receiptJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return receiptJson_({ status: 'REJECTED', code: 'METHOD_NOT_ALLOWED' });
}

function doPost(e) {
  var lock;
  try {
    if (!e || !e.postData || e.postData.type !== 'application/json'
      || typeof e.postData.contents !== 'string' || e.postData.contents.length > 8192
      || (e.parameters && Object.keys(e.parameters).length) || e.queryString) {
      return receiptJson_({ status: 'REJECTED', code: 'INVALID_REQUEST' });
    }
    var request;
    try { request = JSON.parse(e.postData.contents); } catch (_) {
      return receiptJson_({ status: 'REJECTED', code: 'INVALID_REQUEST' });
    }
    if (!ReceiptContract.exact(request, ['credential', 'receipt'])) {
      return receiptJson_({ status: 'REJECTED', code: 'INVALID_REQUEST' });
    }
    var properties = PropertiesService.getScriptProperties();
    var secret = properties.getProperty('RECEIPT_TOKEN');
    if (typeof secret !== 'string' || !/^[0-9a-f]{64}$/.test(secret)) {
      return receiptJson_({ status: 'NOT_ACCEPTED', code: 'NOT_CONFIGURED' });
    }
    var supplied = request.credential;
    var different = 0;
    if (typeof supplied !== 'string' || !/^[0-9a-f]{64}$/.test(supplied)) {
      return receiptJson_({ status: 'REJECTED', code: 'UNAUTHORIZED' });
    }
    for (var i = 0; i < 64; i++) different |= secret.charCodeAt(i) ^ supplied.charCodeAt(i);
    if (different !== 0) return receiptJson_({ status: 'REJECTED', code: 'UNAUTHORIZED' });
    var r = request.receipt;
    if (!ReceiptContract.validate(r)) return receiptJson_({ status: 'REJECTED', code: 'INVALID_RECEIPT' });
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      ReceiptContract.canonical(r), Utilities.Charset.UTF_8)
      .map(function (n) { return ('0' + ((n + 256) % 256).toString(16)).slice(-2); }).join('');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return receiptJson_({ receipt_id: r.receipt_id, status: 'NOT_ACCEPTED', code: 'BUSY' });
    var key = 'receipt:' + r.receipt_id;
    var prior = properties.getProperty(key);
    if (prior !== null) {
      var saved = JSON.parse(prior);
      if (saved.digest !== digest) return receiptJson_({ receipt_id: r.receipt_id, status: 'REJECTED', code: 'ID_CONFLICT' });
      if (saved.status === 'CREATED' && /^[A-Za-z0-9_-]{10,200}$/.test(saved.file_id)) {
        return receiptJson_({ receipt_id: r.receipt_id, status: 'ALREADY_CREATED', file_id: saved.file_id,
          url: 'https://drive.google.com/file/d/' + saved.file_id + '/view' });
      }
      // A crash or ambiguous create must never start another creation, even years later.
      return receiptJson_({ receipt_id: r.receipt_id, status: 'UNKNOWN', code: 'CREATION_UNCERTAIN' });
    }
    var pending = JSON.stringify({ digest: digest, status: 'PENDING' });
    properties.setProperty(key, pending);
    if (properties.getProperty(key) !== pending) throw new Error('LEDGER_NOT_DURABLE');
    // Name/content/parent are derived entirely here; no client file/directory arguments.
    var name = r.time.slice(0, 19).replace(/[-:]/g, '').replace('T', '-') + '-' + r.task
      + '-' + r.commit.slice(0, 7) + '-' + r.receipt_id + '.md';
    var created = Drive.Files.create({ name: name, mimeType: 'text/plain', parents: [RECEIPT_INBOX] },
      Utilities.newBlob(ReceiptContract.document(r), 'text/plain', name), { fields: 'id' });
    if (!created || typeof created.id !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(created.id)) {
      throw new Error('INVALID_CREATE_RESPONSE');
    }
    var completed = JSON.stringify({ digest: digest, status: 'CREATED', file_id: created.id });
    properties.setProperty(key, completed);
    if (properties.getProperty(key) !== completed) throw new Error('LEDGER_NOT_DURABLE');
    return receiptJson_({ receipt_id: r.receipt_id, status: 'CREATED', file_id: created.id,
      url: 'https://drive.google.com/file/d/' + created.id + '/view' });
  } catch (_) {
    // Never log the event, token, body, provider response or raw exception.
    return receiptJson_({ status: 'UNKNOWN', code: 'RECEIVER_UNCERTAIN' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
