'use strict'
var navigation=require('../../lib/navigation')
Page({data:{navigationError:''},onShow:function(){this._navigating=false},onOpen:function(event){navigation.open(this,event.currentTarget.dataset.page)}})
