// pages/dataUpdate.js
import {BLEConnect} from '../../utils/BLEConnect.js';//引入定义的类
import {DfuFile} from '../../utils/DfuFile.js';//引入定义的类
import {GR5xxxDfu} from '../../utils/GR5xxxDfu.js';//引入定义的类

let bleConnect = new BLEConnect()
let dfuFile = new DfuFile();//实例化类
let gr5xxxDfu = new GR5xxxDfu();

const FILE_SIZE = "文件大小（Byte）："
const SHOW_NOTE = '资源升级指对图片、字体、音频等不作为代码的数据进行升级。GR5xx支持内部Flash及外部Flash资源升级两种方式,目前小程序只支持内部资源升级，如果需要外部资源升级，请使用GRToolbox工具'

Page({
  startUpdate:false,
  data: {
    deviceName: '(未连接设备)',
    deviceID: ' ',
    connected:false,
    startConnect:false,
    connectedState: '连接',
    showImage:true,
    selectFileName:'请选择资源文件',
    inputValue: 0, 
    selectFileSize:FILE_SIZE,
    updateModeValue: 'FAST',

    updateProgress:0,
    showUpdateProgress:false,

    clickZIndex:1,
  },

  onReady() {
    //获得popup组件
    this.circleProgress = this.selectComponent("#circleProgress");
    gr5xxxDfu.initDfu(dfuFile, bleConnect, this.gr5xxxDfu_Callback);
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  onShow() {
    const app = getApp();
    if(app.globalData.initTab == false){
      app.globalData.initTab = true;
      wx.switchTab({
        url: '/pages/fwUpdate/fwUpdate',
      })
    }
    if(this.data.startConnect){
      this.data.startConnect = false
      console.log("开始连接",this.data.deviceID)
      bleConnect.createBLEConnection(this.data.deviceID, this.bleEventProcess)
      this._timeoutID = setTimeout(function(){
        bleConnect.closeBLEConnection()
        wx.hideLoading()
        wx.showToast({
          title: '连接超时失败',
          image: '/images/ic_note.png',
          duration:1000,
        })
      },10000)
      wx.showLoading({
        title: '正在连接',
        mask:true,
      })
    }
  },

  gr5xxxDfu_Callback(event, data) {
    switch(event) {
      case GR5xxxDfu.PROGRAM_START_EVENT:
          this.setData({
            showUpdateProgress:true,
            clickZIndex:0,
          })
        break;
      case GR5xxxDfu.PROGRAM_FLASH_EVENT:
        this.setData({
          updateProgress:data,
        })
        break;
      case GR5xxxDfu.PROGRAM_END_EVENT:
      case GR5xxxDfu.PROGRAM_ACK_ERROR:
        this.setData({
          showUpdateProgress:false,
          updateProgress:0,
          clickZIndex:1,
        })
        let showUpdateResult = "升级失败";
        if(data == 0x01) {
          showUpdateResult = "升级成功";
        } 
        this.startUpdate = false;
        wx.showToast({
          title: showUpdateResult,
          duration:1000,
        })
        break;

     case GR5xxxDfu.DFU_CMD_ACK_ERROR:
     case GR5xxxDfu.DFU_CMD_ACK_TIMEOUT:
       if(this.data.showUpdateProgress) {

       } else {
        bleConnect.closeBLEConnection();
        wx.showToast({
          title: '获取升级信息失败',
          image: '/images/ic_note.png',
          duration:1000,
        })
       }
     break;

     case GR5xxxDfu.DFU_GET_INFO_COMPLETE:
        wx.hideLoading()
        wx.showToast({
          title: '连接成功',
          duration:1000,
        })
       break;

      default:break;
    }
  },

  bleEventProcess(res, data){
    console.log(res)
    switch (res) {
      case BLEConnect.CONNECT_EVENT.SET_NOTIFY_SUCCESS:
        {
          clearTimeout(this._timeoutID)
          this.data.connected = true
          this.setData({
            connectedState:'断开连接'
          })
          wx.showLoading({
            title: '正在获取升级信息',
            mask:true,
          })
          gr5xxxDfu.dfuInfoGet();
        }
        break;
  
        case BLEConnect.CONNECT_EVENT.BLE_DISCONNECT:
        case BLEConnect.CONNECT_EVENT.CONNECT_FAIL:
          console.log("device disconnect")
          this.data.connected = false
          this.setData({
            connectedState:'连接',
            deviceName: '(未连接设备)',
            deviceID: ' ',
            showUpdateProgress:false,
            updateProgress:0,
            clickZIndex:1,
          })
          if(this.startUpdate) {
            this.startUpdate = false;
            wx.showToast({
              title: "升级失败",
              image: '/images/ic_note.png',
              duration:1000,
            })
          }
          if(this.data.showUpdateProgress) {
            gr5xxxDfu.stopDfu();
            this.setData({
              showUpdateProgress:false,
              updateProgress:0,
            })
          }
          break;
/*-----------------------------------------------------------------------------------*/
        //接收到control point数据
        case BLEConnect.CONNECT_EVENT.RECEIVE_CONTROL_POINT_DATA:
          console.log('RECEIVE_CONTROL_POINT_DATA: 成功', HexString.toHexString(data))
        break;

        //接收到response数据
        case BLEConnect.CONNECT_EVENT.RECEIVE_RESPONSE_DATA:
          gr5xxxDfu.dfuBleRxDataProcess(data)
          break;
  
      default:
        break;
    }
  },
  
  onTapConnectButton(){
    if(this.data.connected){
      wx.showModal({
        title: '提示',
        content: '确认要断开连接吗？',
        success (res) {
          if (res.confirm) {
            bleConnect.closeBLEConnection()
          } 
        }
      })
    }else{
      wx.navigateTo({
        url: '/pages/blescan/blescan',
      })
    }
  },

  onTapStartUpdate(){
    if(this.data.connected){
      let isFastDfu = false;
      if(this.data.updateModeValue === 'FAST') {
        isFastDfu = true;
      }
      if(this.data.inputValue == 0) {
        wx.showToast({
          title: '起始地址输入为空',
          image: '/images/ic_note.png',
          duration:1000,
          mask:true,
        })
      } else {
        if(gr5xxxDfu.dfuCheck(this.data.inputValue)) {
          this.startUpdate = true;
          gr5xxxDfu.startDataDfu(isFastDfu, this.data.inputValue);
        } else {
          wx.showToast({
            title: '升级数据与设备冲突，请检查固件类型和固件地址！',
            image: '/images/ic_note.png',
            duration:1000,
            mask:true,
          })
        }
      }
    } else{
      wx.showToast({
        title: '请先连接设备',
        image: '/images/ic_note.png',
        duration:1000,
        mask:true,
      })
      }
  },

  updateModeRadioChange(e){
    const value = e.detail.value;
    this.setData({
      updateModeValue: value
    });
  },

  inputChange(e){
    const value = e.detail.value;
    let intValue = parseInt(value,16);
    this.setData({
      inputValue: intValue
    });
  },

  onTapgetBinFile(){
    let fileName = '';
    const that = this;
    wx.chooseMessageFile({
      count: 10,
      type: 'file',
      success(res) {
        console.log(res);
        fileName = res.tempFiles[0].name;
        wx.getFileSystemManager().readFile({
          filePath:res.tempFiles[0].path,
          success:function(res){
            let fileSize = new Uint8Array(res.data).length;
            that.setData({
              showImage:false,
              selectFileName:fileName,
              selectFileSize:FILE_SIZE+fileSize,
            })
            dfuFile.load(res.data, false)//解析成功
          }
        })
      }
    })
  },

  onTapHelpImg(){
    wx.showModal({
      content: SHOW_NOTE,
      showCancel:false,
      success(res) {
        if (res.confirm) {
        }
      }
    });
  }

})