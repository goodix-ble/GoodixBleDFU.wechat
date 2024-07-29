
import {DfuFile} from '../../utils/DfuFile.js';//引入定义的类
import {HexString} from '../../utils/HexString.js';//引入定义的类
import {BLEConnect} from '../../utils/BLEConnect.js';//引入定义的类
import {GR5xxxDfu} from '../../utils/GR5xxxDfu.js';//引入定义的类
import { DfuCmd } from '../../utils/DfuCmd.js';

let dfuFile = new DfuFile();//实例化类
let bleConnect = new BLEConnect();
let gr5xxxDfu = new GR5xxxDfu();

const COMMENT_STR = 'Comment:'
const VERSION_STR = 'Version:'
const LOAD_ADDR_STR = 'Load Addr:'
const SIZE_STR = 'Size(Bytes):'
const RUN_ADDR_STR = 'Run Addr:'
const CHECK_SUM_STR = 'CheckSum:'
const XQSPI_SPEED_STR = 'XQSPI Speed:'
const CHECK_IMAGE_STR = 'Check Image:'
const SYSTEM_CLOCK_STR = 'System Clock:'
const BOOT_DELAY_STR = 'Boot Delay:'
const SPI_ACCESS_MODE ='SPI Access Mode:'
const CODE_COPY_MODE = 'Code Copy Mode:'

const SHOW_NOTE = 'GR5xx提供三种固件格式：非加密非加签固件、加密加签固件和仅加签固件，升级固件必须是bin文件，打开文件后，会按照固件格式进行固件解析，解析判断为正确的升级固件才会显示。'

Page({
  _timeoutID:0,
  data:{
    deviceName: '(未连接设备)',
    deviceID: ' ',
    connected:false,
    startConnect:false,
    connectedState: '连接',
    selectFileName:'请选择升级文件',
    showImage:true,
    displayStyle: 'none',
    inputValue: 0, 
    showInputValue:'0',
    updateModeValue: 'FAST',
    bankModeValue:'SINGLE',
    showCopyAddr: false,

    comment: COMMENT_STR,
    version: VERSION_STR,
    loadAddr: LOAD_ADDR_STR,
    size: SIZE_STR,
    runAddr: RUN_ADDR_STR,
    checkSum: CHECK_SUM_STR,
    xqspiSpeed: XQSPI_SPEED_STR,
    checkImage: CHECK_IMAGE_STR,
    systemClock: SYSTEM_CLOCK_STR,
    bootDelay: BOOT_DELAY_STR,
    spiAccessMode: SPI_ACCESS_MODE,
    codeCopyMode: CODE_COPY_MODE,

    updateProgress:0,
    showUpdateProgress:false,
  },

  onReady() {
    this.circleProgress = this.selectComponent("#circleProgress");
    gr5xxxDfu.initDfu(dfuFile, bleConnect, this.gr5xxxDfu_Callback);
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },
  
onShow() {
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

bleEventProcess(res, data){
  switch (res) {
/*-----------------------------------------------------------------------------------*/
    case BLEConnect.CONNECT_EVENT.CHANGE_MTU_SUCCESS:
    case BLEConnect.CONNECT_EVENT.GET_MTU_SUCCESS:
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
/*-----------------------------------------------------------------------------------*/
      //旧的升级协议不支持
      case BLEConnect.CONNECT_EVENT.DFU_OLD_VERSION:
        wx.showModal({
          title: '提示',
          content: '小程序目前只支持新的升级协议，旧版升级协议请使用GRToolbox工具进行升级',
          showCancel:false,
          complete: (res) => {
            if (res.confirm) {
              bleConnect.closeBLEConnection()
            }
          }
        })
        break;
/*-----------------------------------------------------------------------------------*/
      case BLEConnect.CONNECT_EVENT.BLE_DISCONNECT:
      case BLEConnect.CONNECT_EVENT.CONNECT_FAIL:
        this.data.connected = false
        this.setData({
          connectedState:'连接',
          deviceName: '(未连接设备)',
          deviceID: ' ',
        })
        if(this.data.showUpdateProgress) {
          gr5xxxDfu.stopDfu();
          this.setData({
            showUpdateProgress:false,
            updateProgress:0,
          })
          wx.showToast({
            title: "升级失败",
            image: '/images/ic_note.png',
            duration:1000,
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

gr5xxxDfu_Callback(event, data) {
  switch(event) {
    case GR5xxxDfu.PROGRAM_START_EVENT:
        this.setData({
          showUpdateProgress:true,
        })
      break;
    case GR5xxxDfu.PROGRAM_FLASH_EVENT:
      this.setData({
        updateProgress:data,
      })
      break;
    case GR5xxxDfu.PROGRAM_END_EVENT:
      this.setData({
        showUpdateProgress:false,
        updateProgress:0,
      })
      let showUpdateResult = "升级失败";
      if(data == 0x01) {
        showUpdateResult = "升级成功";
      } 
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
        let copyaddrStr = gr5xxxDfu.appFwInfo.copyLoadAddr.toString(16);
        this.setData({
          showInputValue:copyaddrStr,
          inputValue:gr5xxxDfu.appFwInfo.copyLoadAddr,
        })
       break;
    default:break;
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

onTapStartUpdateButton(){
  if(this.data.connected){
    let isFastDfu = false;
    let writeAddress = dfuFile.imgInfo.loadAddr;
    let startDfuCheck = true;
    let dfuMode = 0x02;//单区
    if(this.data.updateModeValue === 'FAST') {
      isFastDfu = true;
    }
    if(this.data.bankModeValue === 'DUAL') {//双区升级
      writeAddress = this.data.inputValue;
      dfuMode = 0x01;
    } else {
      if(gr5xxxDfu.appFwInfo.runPosition == 1) {//不是在bootloaer中
        startDfuCheck = false;
        wx.showModal({
          title: '提示',
          content: '设备此时运行在应用中，单区升级需要设备运行在Bootloader中。点击确认按钮，应用会跳转到Bootloader运行，当前蓝牙会断连，需要重新连接设备',
          complete: (res) => {
            if (res.confirm) {
              gr5xxxDfu.dfuSetDfuMode(0x02);
            }
          }
        })
      }
    }
    if(startDfuCheck) {
      if(gr5xxxDfu.dfuCheck(writeAddress)) {
        if(dfuMode == 0x01) {
          gr5xxxDfu.dfuSetDfuMode(dfuMode);
          setTimeout(()=>{
            gr5xxxDfu.startFWDfu(isFastDfu, writeAddress);
          },100);
        } else {
          gr5xxxDfu.startFWDfu(isFastDfu, writeAddress);
        }
      } else {
        wx.showToast({
          title: '升级固件与设备冲突，请检查固件类型和固件地址！',
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

inputChange(e){
  const value = e.detail.value;
  let intValue = parseInt(value,16);
  this.setData({
    inputValue: intValue
  });
},

updateModeRadioChange(e){
  const value = e.detail.value;
  this.setData({
    updateModeValue: value
  });
},

bankModeRadioChange(e){
  const value = e.detail.value;
  let showFlag = false;
  if(value === "DUAL") {
    showFlag = true;
  } 
  this.setData({
    bankModeValue: value,
    showCopyAddr: showFlag
  });
},

onTapgetBinFile(){
  let fileName = ''
  const that = this;
  wx.chooseMessageFile({
    count: 10,
    type: 'file',
    success(res) {
      fileName = res.tempFiles[0].name
      console.log(res.tempFiles, fileName);
      wx.getFileSystemManager().readFile({
        filePath:res.tempFiles[0].path,
        success:function(res){
          if(dfuFile.load(res.data, true))//解析成功
          {
            console.log("file open success")
            that.setData({
              selectFileName:fileName,
              showImage:false,
              displayStyle:'block',
              comment:COMMENT_STR+dfuFile.imgInfo.comments,
              version:VERSION_STR+dfuFile.imgInfo.version,
              loadAddr:LOAD_ADDR_STR+HexString.intToByteString(dfuFile.imgInfo.loadAddr),
              size:SIZE_STR+dfuFile.imgInfo.binSize,
              runAddr:RUN_ADDR_STR+HexString.intToByteString(dfuFile.imgInfo.runAddr),
              checkSum:CHECK_SUM_STR+HexString.intToByteString(dfuFile.imgInfo.checkSum),
              xqspiSpeed:XQSPI_SPEED_STR+dfuFile.imgInfo.xqspiSpeed,
              checkImage:CHECK_IMAGE_STR+dfuFile.imgInfo.checkImage,
              systemClock:SYSTEM_CLOCK_STR+dfuFile.imgInfo.systemClk,
              bootDelay:BOOT_DELAY_STR+dfuFile.imgInfo.bootDelay,
              spiAccessMode:SPI_ACCESS_MODE+HexString.uint8ToByteString(dfuFile.imgInfo.xqspiXipCmd),
              codeCopyMode:CODE_COPY_MODE+dfuFile.imgInfo.codeCopyMode,
            })
          }
          else {//解析失败
            console.error(dfuFile.lastError)
            that.setData({
              selectFileName:'请选择升级文件',
              showImage:true,
              displayStyle:'none'
            })

            wx.showToast({
              title: '非升级文件！',
              image: '/images/ic_note.png',
              duration:1000,
              mask:true
            })
          }
        }
      })
    }
  })
},

onTapDfuHelpImg(){
  wx.showModal({
    content: SHOW_NOTE,
    showCancel:false,
    confirmText: '确定',
    cancelText: '跳转',
    success(res) {
    }
  });
},

onTapSetHelpImg(){
  wx.showModal({
    content: 'GR5xx固件升级可设置成快速模式，普通模式，双区升级和单区升级，在升级前会根据选择模式，进行地址冲突检查。',
    showCancel:false,
    confirmText: '确定',
    cancelText: '跳转',
    success(res) {
    }
  });
}
    
})
