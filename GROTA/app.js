// app.js
App({
  onLaunch() {
    wx.switchTab({
      url: '/pages/dataUpdate/dataUpdate',
    })
  },
  globalData: {
    initTab: false // 全局数据，可以在其他页面中访问和修改
  },

})
