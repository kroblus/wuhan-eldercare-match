'use strict'
function read(event,rect){return Array.prototype.map.call(event.touches||[],function(t){return {x:typeof t.clientX==='number'?t.clientX-rect.left:t.x,y:typeof t.clientY==='number'?t.clientY-rect.top:t.y}}).filter(function(t){return isFinite(t.x)&&isFinite(t.y)})}
module.exports={read:read}
