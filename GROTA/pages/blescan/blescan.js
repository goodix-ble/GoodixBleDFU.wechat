function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i
    }
  }
  return -1
}
const SHOW_NOTE = '默认升级设备广播中会包含升级服务UUID，开启过滤，会只显示包含服务UUID的设备，升级服务UUIID为A6ED0401-D344-460A-8075-B9E8EC90D71B'
Page({
  data: {
    theme: 'light',
    devices: [],
    triggered: false,
    switchFlag:true,
  },

  onUnload() {
    this.closeBluetoothAdapter()
  },

  openBluetoothAdapter() {
    const that = this
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('openBluetoothAdapter success', res)
        that.startBluetoothDevicesDiscovery()
      },
      fail: (res) => {
        if (res.errCode === 10001) {
          wx.showModal({
            title: '错误',
            content: '未找到蓝牙设备, 请打开蓝牙后重试。',
            showCancel: false
          })
          wx.onBluetoothAdapterStateChange(function (res) {
            if (res && res.available) {
              that.startBluetoothDevicesDiscovery()
            }
          })
        }
      }
    })
  },
  getBluetoothAdapterState() {
    wx.getBluetoothAdapterState({
      success: (res) => {
        console.log('getBluetoothAdapterState', res)
        if (res.discovering) {
          this.onBluetoothDeviceFound()
        } else if (res.available) {
          this.startBluetoothDevicesDiscovery()
        }
      }
    })
  },
  startBluetoothDevicesDiscovery() {
    if (this._discoveryStarted) {
      return
    }
    this._discoveryStarted = true
    
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: (res) => {
        console.log('startBluetoothDevicesDiscovery success', res)
        this.onBluetoothDeviceFound()
      },
    })
  },
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery({
      complete: () => {
        this._discoveryStarted = false
      }
    })
  },
  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) {
          return
        }
        if(this.data.switchFlag) {
          const FilterAdvUUID ="A6ED0401-D344-460A-8075-B9E8EC90D71B"
          if(device.advertisServiceUUIDs != FilterAdvUUID){
            return
          }
        } 
        const foundDevices = this.data.devices
        const idx = inArray(foundDevices, 'deviceId', device.deviceId)
        const data = {}
        if (idx === -1) {
          data[`devices[${foundDevices.length}]`] = device
        } else {
          data[`devices[${idx}]`] = device
        }
        this.setData(data)
      })
    })
  },

  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter()
    this._discoveryStarted = false
  },

onSelectDevice(e){
  const ds = e.currentTarget.dataset
  let pages = getCurrentPages();
  let prevPage = pages[pages.length - 2];
  console.info(ds.name,ds.deviceId)
  prevPage.setData({
    deviceName: ds.name,
    deviceID: ds.deviceId,
    startConnect:true,
  })
  wx.navigateBack({
        delta: 1,
  })
},

onScrollRefresh() {
  console.log("onScrollRefresh")
  this.stopBluetoothDevicesDiscovery()
  var devices = this.data.devices
  devices = []
  this.setData({devices:devices})
  setTimeout(()=>{
    this.startBluetoothDevicesDiscovery();
  },500)
  var that=this;
  setTimeout(function () {
    that.setData({
      triggered: false,
    })
  }, 1500)
},

switchChange(){
  console.log("switch change")
  if(this.data.switchFlag) {
    this.data.switchFlag = false
  } else {
    this.data.switchFlag = true
  }
  
  this.stopBluetoothDevicesDiscovery()
  var devices = this.data.devices
  devices = []
  this.setData({devices:devices})
  setTimeout(()=>{
    this.startBluetoothDevicesDiscovery();
  },500)
},

onUnload() {
  if (wx.offThemeChange) {
    wx.offThemeChange()
  }
  this.stopBluetoothDevicesDiscovery()
},
onLoad() {
  this.setData({
    theme: wx.getSystemInfoSync().theme || 'light'
  })
  if (wx.onThemeChange) {
    wx.onThemeChange(({theme}) => {
      this.setData({theme})
    })
  }
  this.openBluetoothAdapter()
},

onTapHelpImg(){
  wx.showModal({
    content: SHOW_NOTE,
    showCancel: false, // 是否显示取消按钮
    success(res) {
      if (res.confirm) {
        console.log('用户点击确定');
      }
    }
  });
}

})
