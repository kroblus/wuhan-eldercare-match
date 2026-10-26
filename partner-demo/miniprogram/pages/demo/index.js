'use strict';

var host = require('../../runtime/host');
var shell = require('../../runtime/shell');

function render(page, view) {
  page.setData({
    sessionActive: view.sessionActive,
    message: view.status === 'ACTIVE' ? '安全演示外壳已启动，业务场景尚未开放。' :
      view.status === 'EXITED' ? '演示内存会话已销毁。' : '演示入口已拒绝，请检查独立演示构建身份或入口。'
  });
}

Page({
  data: { sessionActive: false, message: '演示入口尚未开放。' },
  onLoad: function (query) {
    try {
      render(this, host.start(shell.ENTRY_ROUTE, query));
    } catch (error) {
      host.failClosed();
      render(this, host.view());
    }
  },
  onShow: function () { render(this, host.view()); },
  onExit: function () { render(this, host.exit()); },
  onUnload: function () { host.exit(); }
});
