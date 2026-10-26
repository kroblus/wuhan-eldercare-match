'use strict';

var identity = require('./identity');
var shell = require('./shell');

// Demo-only host. Importing it allocates no session and touches no platform API.
module.exports = shell.createDemoShell(identity.readBuildIdentity());
