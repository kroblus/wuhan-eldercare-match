'use strict'
var scene=Object.freeze({id:'original-teaching-room-360',title:'几何教学展厅',path:'/assets/teaching-room-360.png',width:2048,height:1024,projection:'equirectangular',provenance:'ORIGINAL_PROCEDURAL_SYNTHETIC',institutionId:null})
var points=Object.freeze([{id:'demo-a',title:'演示地点 A',u:.34,v:.43},{id:'demo-b',title:'演示地点 B',u:.69,v:.65}].map(Object.freeze))
var states=Object.freeze({schematic:{title:'合成位置示意',message:'点选标记查看演示说明；没有真实地址或导航能力。',draw:true},unknown:{title:'位置未知',message:'尚无位置信息，不绘制位置标记，也不能导航。',draw:false},unverified:{title:'位置待核验',message:'未通过位置核验，不绘制位置标记，也不能导航。',draw:false},expired:{title:'位置资料已过期',message:'需要重新核验，不沿用过期点位，也不能导航。',draw:false},unavailable:{title:'位置不可用',message:'当前不能提供位置，不绘制位置标记，也不能导航。',draw:false}})
module.exports={scene:scene,points:points,states:states}
