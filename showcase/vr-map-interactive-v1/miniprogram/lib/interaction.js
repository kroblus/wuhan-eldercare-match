'use strict'
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function finite(value,fallback){return typeof value==='number'&&isFinite(value)?value:fallback}
function camera(){return {yaw:0,pitch:0,fov:75}}
function turn(view,dx,dy,width){var unit=view.fov/Math.max(1,width);return {yaw:((view.yaw-dx*unit)%360+360)%360,pitch:clamp(view.pitch+dy*unit,-85,85),fov:view.fov}}
function fieldOfView(view,fov){return {yaw:view.yaw,pitch:view.pitch,fov:clamp(finite(fov,75),45,100)}}
function mapView(){return {scale:1,x:0,y:0}}
function boundMap(view,size){var x=size.width*(.5*Math.max(0,view.scale-1)+.15),y=size.height*(.5*Math.max(0,view.scale-1)+.15);return {scale:clamp(view.scale,.8,3),x:clamp(view.x,-x,x),y:clamp(view.y,-y,y)}}
function pan(view,dx,dy,size){return boundMap({scale:view.scale,x:view.x+dx,y:view.y+dy},size)}
function zoom(view,scale,anchor,size){var next=clamp(finite(scale,1),.8,3),ratio=next/view.scale;return boundMap({scale:next,x:anchor.x-size.width/2-(anchor.x-size.width/2-view.x)*ratio,y:anchor.y-size.height/2-(anchor.y-size.height/2-view.y)*ratio},size)}
function project(point,view,size){if(point.u===null||point.v===null)return null;return {x:size.width*(.5+(point.u-.5)*view.scale)+view.x,y:size.height*(.5+(point.v-.5)*view.scale)+view.y}}
function hit(points,view,size,position){var selected=null,nearest=24;points.forEach(function(p){var s=project(p,view,size);if(!s)return;var d=Math.hypot(position.x-s.x,position.y-s.y);if(d<=nearest){nearest=d;selected=p}});return selected}
function centroid(touches){return touches.reduce(function(a,t){return {x:a.x+t.x/touches.length,y:a.y+t.y/touches.length}},{x:0,y:0})}
function distance(touches){return touches.length>1?Math.max(1,Math.hypot(touches[0].x-touches[1].x,touches[0].y-touches[1].y)):0}
module.exports={clamp:clamp,camera:camera,turn:turn,fieldOfView:fieldOfView,mapView:mapView,pan:pan,zoom:zoom,project:project,hit:hit,centroid:centroid,distance:distance}
