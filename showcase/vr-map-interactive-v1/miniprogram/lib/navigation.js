'use strict'
var routes={panorama:'/pages/panorama/index',map:'/pages/map/index'}
function open(page,key){var url=routes[key];if(!url||page._navigating)return;page._navigating=true;page.setData({navigationError:''});var fail=function(){page._navigating=false;page.setData({navigationError:'页面打开失败，请重试。'})};try{wx.navigateTo({url:url,fail:fail,complete:function(){page._navigating=false}})}catch(error){fail()}}
function back(page){if(page._navigating)return;page._navigating=true;var fail=function(){page._navigating=false;page.setData({navigationError:'返回失败，请重试。'})};var options={fail:fail,complete:function(){page._navigating=false}};try{if(getCurrentPages().length>1)wx.navigateBack(Object.assign({delta:1},options));else wx.redirectTo(Object.assign({url:'/pages/index/index'},options))}catch(error){fail()}}
module.exports={open:open,back:back}
