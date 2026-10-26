'use strict'
var math=require('./interaction')
function draw(ctx,size,view,points,selected){
  var w=size.width,h=size.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#F1EEE6';ctx.fillRect(0,0,w,h)
  ctx.save();ctx.translate(w/2+view.x,h/2+view.y);ctx.scale(view.scale,view.scale);ctx.translate(-w/2,-h/2)
  ctx.fillStyle='#E1E8DB';ctx.fillRect(w*.06,h*.07,w*.9,h*.85)
  ctx.strokeStyle='#D3D5CC';ctx.lineWidth=.7;for(var i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(w*i/10,0);ctx.lineTo(w*i/10,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,h*i/10);ctx.lineTo(w,h*i/10);ctx.stroke()}
  ctx.strokeStyle='#FBFAF7';ctx.lineWidth=22;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-w*.1,h*.8);ctx.bezierCurveTo(w*.3,h*.8,w*.3,h*.3,w*1.1,h*.2);ctx.stroke();ctx.beginPath();ctx.moveTo(w*.25,-h*.2);ctx.lineTo(w*.58,h*1.2);ctx.stroke()
  ctx.fillStyle='#D9D6D0';ctx.fillRect(w*.1,h*.14,w*.17,h*.17);ctx.fillRect(w*.72,h*.44,w*.19,h*.27);ctx.fillStyle='#4B5563';ctx.font='12px sans-serif';ctx.fillText('示意区域 Ⅰ',w*.1,h*.14-7);ctx.fillText('示意区域 Ⅱ',w*.64,h*.82)
  ctx.restore()
  points.forEach(function(point,index){var p=math.project(point,view,size);if(!p)return;var active=point.id===selected;ctx.beginPath();ctx.arc(p.x,p.y,active?20:17,0,Math.PI*2);ctx.fillStyle=active?'#111827':'#D9572A';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#FBFAF7';ctx.stroke();ctx.fillStyle='#FFFFFF';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(index===0?'A':'B',p.x,p.y);ctx.textAlign='left';ctx.textBaseline='alphabetic'})
}
module.exports={draw:draw}
