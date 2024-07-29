var log = require('./log.js')
const TAG = 'BLEConnect'
class BLEConnect{
  static DFU_SERVICE_UUID = "A6ED0401-D344-460A-8075-B9E8EC90D71B"
  static DFU_NOTIFY_CHARACTERISTIC_UUID =  "A6ED0402-D344-460A-8075-B9E8EC90D71B"
  static DFU_WRITE_CHARACTERISTIC_UUID =   "A6ED0403-D344-460A-8075-B9E8EC90D71B"
  static DFU_CONTROL_CHARACTERISTIC_UUID = "A6ED0404-D344-460A-8075-B9E8EC90D71B"

  static CONNECT_EVENT = {
    "CONNECT_SUCCESS":1,
    "CONNECT_FAIL":2,
    "DISCOVERY_SERVICE_FAIL":3,
    "DISCOVERY_SERVICE_SUCCESS":4,
    "DISCOVERY_CHARACTERISTIC_FAIL":5,
    "DISCOVERY_CHARACTERISTIC_SUCCESS":6,
    "SET_NOTIFY_SUCCESS":7,
    "BLE_DISCONNECT":8,
    "RECEIVE_CONTROL_POINT_DATA":9,
    "RECEIVE_RESPONSE_DATA":10,
    "WRITE_SUCCESS":11,
    "WRITE_FAIL":12,
    "SET_INDICATE_SUCCESS":13,
    "DFU_OLD_VERSION":14,
    "GET_MTU_SUCCESS":15,
    "CHANGE_MTU_SUCCESS":16,
  }

  constructor() {
    this._dfuService = null;
    this._dfuWriteChar = null;
    this._dfuControlChar = null;
    this._deviceId = ' ';
    this._bleConnectListener = null;
    this.mtu = 23;
    this.bleWillSendData = new Uint8Array();
    this.sendedBytes = 0;
    this.intervalId = null;
  }

  createBLEConnection(device_id, listener) {
    this._deviceId = device_id
    this._bleConnectListener = listener
    wx.createBLEConnection({
      deviceId:device_id,
      success: () => {
        this._getBLEDeviceServices(device_id)
      },
      fail:(res)=>{
        log.error(TAG,"连接失败",res)
        this._bleConnectListener(BLEConnect.CONNECT_EVENT.CONNECT_FAIL,null)
      },
      error:(res)=>{
        log.error(TAG,"连接错误",res)
        this._bleConnectListener(BLEConnect.CONNECT_EVENT.CONNECT_FAIL,null)
      }
    })
//--------------------------------------------------------------------------------------//
    wx.onBLEConnectionStateChange(res => {
      if(res.deviceId == this._deviceId) {
        if(res.connected) {
          this._bleConnectListener(BLEConnect.CONNECT_EVENT.CONNECT_SUCCESS,null)
        } else {
          this._bleConnectListener(BLEConnect.CONNECT_EVENT.BLE_DISCONNECT,null)
        }
      }
    })
//--------------------------------------------------------------------------------------//
    wx.onBLECharacteristicValueChange((res) => {
      if(res.deviceId == this._deviceId) {
        let rxData = new Uint8Array(res.value)
        if(res.characteristicId === BLEConnect.DFU_NOTIFY_CHARACTERISTIC_UUID) {
          this._bleConnectListener(BLEConnect.CONNECT_EVENT.RECEIVE_RESPONSE_DATA, rxData)
        } else if(res.characteristicId === BLEConnect.DFU_CONTROL_CHARACTERISTIC_UUID) {
          this._bleConnectListener(BLEConnect.CONNECT_EVENT.RECEIVE_CONTROL_POINT_DATA, rxData)
        }
      }
    })
  }

  closeBLEConnection() {
    wx.closeBLEConnection({
      deviceId:this._deviceId,
    })
  }

  _getBLEDeviceServices(device_id) {
    wx.getBLEDeviceServices({
      deviceId:device_id,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          if (res.services[i].isPrimary) {
            if(res.services[i].uuid == BLEConnect.DFU_SERVICE_UUID){
              this._dfuService = res.services[i]
              this._bleConnectListener(BLEConnect.CONNECT_EVENT.DISCOVERY_CHARACTERISTIC_SUCCESS,null)
              this._getBLEDeviceCharacteristics(device_id, res.services[i].uuid)
            }
            return
          }
        }
        //没有发现DFU服务
        this._bleConnectListener(BLEConnect.CONNECT_EVENT.DISCOVERY_SERVICE_FAIL,null)
        log.error(TAG,"未发现服务")
      },
      fail:(res)=>{
        log.error(TAG,"发现服务失败",res)
        this._bleConnectListener(BLEConnect.CONNECT_EVENT.DISCOVERY_SERVICE_FAIL,null)
      },
      error:(res)=>{
        log.error(TAG,"发现服务错误".res)
        this._bleConnectListener(BLEConnect.CONNECT_EVENT.DISCOVERY_SERVICE_FAIL,null)
      }
    })
  }

  _getBLEDeviceCharacteristics(device_id, service_id) {
    wx.getBLEDeviceCharacteristics({
      deviceId:device_id,
      serviceId:service_id,
      success: (res) => {
        console.log('getBLEDeviceCharacteristics success')
        for (let i = 0; i < res.characteristics.length; i++) {
          const item = res.characteristics[i]
          if(item.uuid == BLEConnect.DFU_NOTIFY_CHARACTERISTIC_UUID){
            if (item.properties.notify) {
              wx.notifyBLECharacteristicValueChange({
                deviceId:device_id,
                serviceId:service_id,
                characteristicId: item.uuid,
                state: true,
                success:()=>{
                  this._bleConnectListener(BLEConnect.CONNECT_EVENT.SET_NOTIFY_SUCCESS,null)
                }
              })
            }
          } else if(item.uuid == BLEConnect.DFU_WRITE_CHARACTERISTIC_UUID){
            this._dfuWriteChar = item
          }else if(item.uuid == BLEConnect.DFU_CONTROL_CHARACTERISTIC_UUID) {
            this._dfuControlChar = item
            if(item.properties.indicate) {//新的升级协议
              wx.notifyBLECharacteristicValueChange({
                deviceId:device_id,
                serviceId:service_id,
                characteristicId: item.uuid,
                state: true,
                success:()=>{
                  this._bleConnectListener(BLEConnect.CONNECT_EVENT.SET_INDICATE_SUCCESS,null)
                  this._setMtu()
                }
              })
            } else {//旧的升级协议，小程序不支持
              this._bleConnectListener(BLEConnect.CONNECT_EVENT.DFU_OLD_VERSION,null)
            }
          }
        }
      },
      fail(res) {
        log.error(TAG,'发现特征值失败', res)
        this._ble_connect_listener(BLEConnect.CONNECT_EVENT.DISCOVERY_CHARACTERISTIC_FAIL,null)
      },
      error:(res)=>{
        log.error(TAG,'发现特征值错误',res)
        this._bleConnectListener(BLEConnect.CONNECT_EVENT.DISCOVERY_CHARACTERISTIC_FAIL,null)
      }
    })
  }

  _setMtu() {
    let systemInfo = wx.getSystemInfoSync()
    let that = this;
    if(systemInfo.platform ==='ios'){
      wx.getBLEMTU({
        deviceId: this._deviceId,
        success:(res)=>{
          let readMtu = res.mtu;
          if(readMtu < 247) {
            that.mtu = readMtu;
          } else {
            that.mtu = 247;
          }
          that._bleConnectListener(BLEConnect.CONNECT_EVENT.GET_MTU_SUCCESS, readMtu);
        }
      })
    }
    else {
      wx.setBLEMTU({
        deviceId: this._deviceId,
        mtu: 247,
        success:(res)=>{
          let changeMtu = res.mtu;
          that.mtu = changeMtu;
          that._bleConnectListener(BLEConnect.CONNECT_EVENT.CHANGE_MTU_SUCCESS, changeMtu);
        },
        fail:()=>{
          log.error(TAG,'MTU设置失败',res)
        }
      })
    }
  }

  //data -> Uint8Array
  _writeDfuCharacteristic(data, start, end) {
    let that = this;
    let sendData = data.slice(start, end);
    wx.writeBLECharacteristicValue({
      deviceId:this._deviceId,
      serviceId:this._dfuService.uuid,
      characteristicId:this._dfuWriteChar.uuid,
      value:sendData.buffer,
      success() {
        that._bleConnectListener(BLEConnect.CONNECT_EVENT.WRITE_SUCCESS, null);
        console.log('write: success');
      },
      fail(res) {
        that._bleConnectListener(BLEConnect.CONNECT_EVENT.WRITE_FAIL,null);
        console.error('write: fail',res)
      },
    })
    }

  writeDfuData(data) {
    let that = this;
    if(data != null) {
			this.sendedBytes = 0;
			if(data.length <= (this.mtu-3)) {
        this._writeDfuCharacteristic(data, 0, data.length);
			} else {
        this.bleWillSendData = new Uint8Array(data);
        this.intervalId = setInterval(()=>{
          let remain = that.bleWillSendData.length - that.sendedBytes;
          let onceSendSize = that.mtu-3;
          if (remain >= onceSendSize) {
            that._writeDfuCharacteristic(that.bleWillSendData, that.sendedBytes, that.sendedBytes + onceSendSize);
            that.sendedBytes += onceSendSize;
          } else if(remain > 0) {//发送完毕
            that._writeDfuCharacteristic(that.bleWillSendData, that.sendedBytes, that.bleWillSendData.length);
            that.sendedBytes += onceSendSize;
            clearInterval(that.intervalId);
          } 
        },15);
			}
		}
  }

}

export { BLEConnect };


