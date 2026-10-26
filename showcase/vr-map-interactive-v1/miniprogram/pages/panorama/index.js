'use strict'
var math=require('../../lib/interaction'),resources=require('../../lib/resources'),renderer=require('../../lib/panorama-renderer'),touches=require('../../lib/touches'),navigation=require('../../lib/navigation')
var copy={loading:'正在读取本地合成全景…',ready:'左右或上下拖动环顾，双指或按钮调整视野。',MISSING_RESOURCE:'当前没有全景素材，不展示替代图片。',INVALID_RESOURCE:'全景素材格式不符合要求，暂不能展示。',LOAD_FAILED:'本地全景加载失败，请重试或返回。',UNSUPPORTED:'当前环境不支持全景渲染，可返回查看位置示意。',RENDER_FAILED:'场景渲染失败，请重试或返回。'}
Page({
  data:{status:'loading',message:copy.loading,yaw:0,pitch:0,fov:75,showInfo:false,navigationError:''},
  onLoad:function(){this._alive=true;this._camera=math.camera();this._renderer=null;this._gesture=null;this._loadId=0},
  onReady:function(){this._initialize()},
  onShow:function(){this._navigating=false},
  onUnload:function(){this._alive=false;this._loadId++;if(this._renderer)this._renderer.destroy();this._renderer=null;this._gesture=null},
  _initialize:function(){
    if(!this._alive)return;var id=++this._loadId,self=this;if(this._renderer)this._renderer.destroy();this._renderer=null;this.setData({status:'loading',message:copy.loading})
    wx.createSelectorQuery().in(this).select('#panorama').fields({node:true,size:true,rect:true}).exec(function(result){
      if(!self._alive||id!==self._loadId)return
      try{var field=result&&result[0];if(!field||!field.node||!field.width||!field.height){self._fail('UNSUPPORTED');return}self._rect=field;var info=wx.getSystemInfoSync();self._renderer=renderer.create(field.node,field.width,field.height,info.pixelRatio,undefined,function(error){if(self._alive&&id===self._loadId)self._fail(error.code)});self._renderer.load(resources.scene).then(function(){if(!self._alive||id!==self._loadId)return;self._renderer.draw(self._camera);self.setData({status:'ready',message:copy.ready});self._publish()}).catch(function(error){if(self._alive&&id===self._loadId)self._fail(error.code)})}catch(error){self._fail(error.code||'RENDER_FAILED')}
    })
  },
  _fail:function(code){if(!this._alive)return;this._loadId++;if(this._renderer)this._renderer.destroy();this._renderer=null;this._gesture=null;this.setData({status:copy[code]?code:'RENDER_FAILED',message:copy[code]||copy.RENDER_FAILED})},
  _publish:function(){this.setData({yaw:Math.round(this._camera.yaw),pitch:Math.round(this._camera.pitch),fov:Math.round(this._camera.fov)})},
  _draw:function(){try{if(this._renderer)this._renderer.draw(this._camera)}catch(error){this._fail(error.code||'RENDER_FAILED')}},
  onTouchStart:function(event){if(this.data.status!=='ready')return;var list=touches.read(event,this._rect);if(!list.length)return;this._gesture={count:list.length,center:math.centroid(list),distance:math.distance(list)}},
  onTouchMove:function(event){if(this.data.status!=='ready')return;var list=touches.read(event,this._rect),g=this._gesture;if(!list.length)return;if(!g||g.count!==list.length){this.onTouchStart(event);return}var center=math.centroid(list),distance=math.distance(list);if(list.length===1)this._camera=math.turn(this._camera,center.x-g.center.x,center.y-g.center.y,this._rect.width);else this._camera=math.fieldOfView(this._camera,this._camera.fov*g.distance/distance);this._gesture={count:list.length,center:center,distance:distance};this._draw()},
  onTouchEnd:function(){this._gesture=null;if(this.data.status==='ready')this._publish()},
  onZoom:function(event){if(this.data.status!=='ready')return;var direction=event.currentTarget.dataset.direction;if(direction!=='in'&&direction!=='out')return;this._camera=math.fieldOfView(this._camera,this._camera.fov+(direction==='in'?-10:10));this._draw();this._publish()},
  onReset:function(){if(this.data.status!=='ready')return;this._camera=math.camera();this._gesture=null;this._draw();this._publish()},
  onInfo:function(){this.setData({showInfo:!this.data.showInfo})},onCanvasError:function(){this._fail('RENDER_FAILED')},onRetry:function(){this._initialize()},onBack:function(){navigation.back(this)}
})
