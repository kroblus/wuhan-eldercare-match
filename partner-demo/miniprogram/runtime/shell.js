'use strict';

var dependencies = require('./dependencies');
var ENTRY_ROUTE = '/pages/demo/index';

function createDemoShell(identity) {
  var session = null;
  var status = 'BLOCKED';
  var reason = 'DEMO_BUILD_IDENTITY_REQUIRED';
  // Validate once; later mutation of a caller-owned identity cannot enable the shell.
  var identityAllowed = dependencies.hasDemoIdentity(identity);
  var buildIdentity = identityAllowed ? Object.freeze({
    buildId: identity.buildId, kind: identity.kind, scope: identity.scope, provenance: identity.provenance
  }) : null;

  function close(nextStatus, nextReason) {
    if (session) session.destroy();
    session = null;
    status = nextStatus;
    reason = nextReason;
    return view();
  }
  function view() {
    return { status: status, reason: reason, sessionActive: !!session && session.isAlive() };
  }
  return Object.freeze({
    start: function (route, query) {
      try {
        if (!identityAllowed) return close('BLOCKED', 'DEMO_BUILD_IDENTITY_REQUIRED');
        if (route !== ENTRY_ROUTE || (query && Object.keys(query).length > 0)) return close('BLOCKED', 'ROUTE_DENIED');
        if (session && session.isAlive()) return view();
        var result = dependencies.createDemoSession(buildIdentity);
        if (!result.ok) return close('BLOCKED', result.reason);
        session = result.session;
        status = 'ACTIVE';
        reason = 'S1_SHELL_ONLY';
        return view();
      } catch (error) {
        return close('BLOCKED', 'SHELL_ERROR');
      }
    },
    // Every navigation request is refused in S1, including the entry itself.
    requestRoute: function () { return { ok: false, reason: 'NAVIGATION_DENIED' }; },
    exit: function () { return close('EXITED', 'SESSION_DESTROYED'); },
    failClosed: function () { return close('BLOCKED', 'SHELL_ERROR'); },
    view: view
  });
}

module.exports = { createDemoShell: createDemoShell, ENTRY_ROUTE: ENTRY_ROUTE };
