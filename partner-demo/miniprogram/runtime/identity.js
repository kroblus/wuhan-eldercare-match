'use strict';

function readBuildIdentity() {
  try {
    return require('./build-identity.json');
  } catch (error) {
    return null;
  }
}

module.exports = { readBuildIdentity: readBuildIdentity };
