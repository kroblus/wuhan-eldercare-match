'use strict';

// This module has no platform, persistence, provider, or authentication dependency.
var PROVENANCE = 'development-synthetic';

function denied(reason) {
  return Object.freeze({ ok: false, reason: reason });
}

function hasDemoIdentity(identity) {
  return !!identity && identity.buildId === 'partner-demo-s1-isolation-shell-v0-1' &&
    identity.kind === 'isolated-partner-demo' && identity.scope === 'DEMO_SHELL_ONLY' &&
    identity.provenance === PROVENANCE;
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

// No production adapter can be supplied to this S1 composition.
function createDemoSession(identity) {
  if (!hasDemoIdentity(identity)) return denied('DEMO_BUILD_IDENTITY_REQUIRED');
  var alive = true;
  var state = Object.create(null);
  var memory = Object.freeze({
    read: function (key) {
      if (!alive) return denied('SESSION_DESTROYED');
      if (typeof key !== 'string' || !key) return denied('INVALID_MEMORY_KEY');
      return { ok: true, value: Object.prototype.hasOwnProperty.call(state, key) ? copy(state[key]) : null };
    },
    write: function (key, envelope) {
      if (!alive) return denied('SESSION_DESTROYED');
      if (typeof key !== 'string' || !key) return denied('INVALID_MEMORY_KEY');
      if (!envelope || envelope.provenance !== PROVENANCE) return denied('SYNTHETIC_PROVENANCE_REQUIRED');
      try {
        var detached = copy(envelope);
        if (!detached || detached.provenance !== PROVENANCE) return denied('SYNTHETIC_PROVENANCE_REQUIRED');
        state[key] = detached;
        return { ok: true };
      } catch (error) {
        return denied('INVALID_SYNTHETIC_STATE');
      }
    }
  });
  var session = {
    provenance: PROVENANCE,
    memory: memory,
    institutionSource: Object.freeze({
      list: function () {
        return alive ? { ok: true, provenance: PROVENANCE, institutions: [] } : denied('SESSION_DESTROYED');
      }
    }),
    businessActions: Object.freeze({
      perform: function () { return denied(alive ? 'S1_BUSINESS_ACTION_NOT_IMPLEMENTED' : 'SESSION_DESTROYED'); }
    }),
    externalActions: Object.freeze({
      perform: function () { return denied('EXTERNAL_ACTION_DENIED'); }
    }),
    isAlive: function () { return alive; },
    destroy: function () {
      alive = false;
      state = Object.create(null);
      return { ok: true, status: 'SESSION_DESTROYED' };
    }
  };
  return Object.freeze({ ok: true, session: Object.freeze(session) });
}

module.exports = { createDemoSession: createDemoSession, hasDemoIdentity: hasDemoIdentity };
