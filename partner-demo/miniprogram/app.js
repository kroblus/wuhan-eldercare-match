'use strict';

var host = require('./runtime/host');

App({
  onLaunch: function (options) {
    var route = options && options.path ? '/' + options.path : '/pages/demo/index';
    host.start(route, options && options.query);
  },
  onHide: function () { host.exit(); },
  onError: function () { host.failClosed(); },
  onPageNotFound: function () { host.failClosed(); }
});
