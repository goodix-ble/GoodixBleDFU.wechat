// pages/useGuide/useGuide.js
Page({

  onLoad() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  onTapSupportSDKVerison(){
    wx.showModal({
      content: 'GR551x: SDK_V2.0.1\r\nGR5525: SDK_V1.0.0\r\nGR5526: SDK_V1.0.2\r\nGR533x: SDK_V1.0.5',
      showCancel:false,
      confirmText: '确定',
    });
  },

})