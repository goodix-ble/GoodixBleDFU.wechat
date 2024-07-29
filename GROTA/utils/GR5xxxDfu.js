import { DfuFile } from './DfuFile.js';
import { DfuCmdParse } from './DfuCmdParse.js';
import { BLEConnect } from './BLEConnect.js';
import { DfuCmd } from './DfuCmd.js';
import {HexEndian} from './HexEndian.js';//引入定义的类

const NORMAL_DFU_BLOCK_SIZE = 1024;
const DFU_STATE_GET_CHIP_INFO = 0x01;
const DFU_START_GET_BOOT_INFO = 0x02;
const DFU_START_GET_APP_FW_INFO = 0x03;
const DFU_START_GET_INFO_COMPLETE = 0x04;

class GR5xxxDfu {
  static  PROGRAM_START_EVENT = 0x02;
  static  PROGRAM_FLASH_EVENT = 0x03;
  static  PROGRAM_END_EVENT = 0x04;
  static  DFU_CMD_ACK_ERROR = 0x05;
  static  DFU_GET_INFO_COMPLETE = 0x06;
  static  DFU_CMD_ACK_TIMEOUT = 0x07;

  constructor() {
    this.dfuFile = new DfuFile();
    this.bleConnect = new BLEConnect();
    this.isFastDfu = true;
    this.programStartType = 0;
    this.programFlashType = 0;
    this.resetType = 0;
    this.startWriteAddr = 0;
    this.progressCallback = null;
    this.dfuCmdParse = new DfuCmdParse();
    this.dfuCmdParse.setHandler(this.dfuCmdHandler.bind(this));

    this.appFwInfo = {
      runPosition:0,
      copyLoadAddr:0,
      deviceSize:0,
      deviceLoadAddr:0,
      deviceRunAddr:0,
      isVaild:false,
    };

    /*----------------------数据发送-----------------------------*/
    this.allSendCount = 0;
    this.lastSendBytes = 0;
    this.onceSendBytes = 0;
    this.writedBytes = 0;
    this.sendedCount = 0;
    this.startProgramFlash = false;
    this.intervalId = null;
    this.proramAddr = 0;
    this.sendBytes = new Uint8Array();

    this.startDfuState = DFU_STATE_GET_CHIP_INFO;
    this.addrOfSCA = 0;
    this.bootInfo = {
      binSize:0,
      loadAddr:0,
      runAddr:0,
      isEncryped:false,
    };
    this.timer;
  }

  initDfu(dfuFile, bleConnect, progressCallback) {
    this.dfuFile = dfuFile;
    this.bleConnect = bleConnect;
    this.progressCallback = progressCallback;
  }

  stopDfu() {
    if(this.isFastDfu) {
      clearInterval(this.intervalId);
    }
  }

  _setDfuFWProgramType(isFastDfu, encrypted, signed) {
    let temp = 0;
    if (encrypted && signed) {
      if(isFastDfu) {
        temp = 0x22;
      } else {
        temp = 0x20;
      }
      this.programStartType = temp;
    } else if (!encrypted && !signed) {
      if(isFastDfu) {
        temp = 0x02;
      } else {
        temp = 0x00;
      }
      this.programStartType = temp;
    } else if (!encrypted && signed) {
      if(isFastDfu) {
        temp = 0x12;
      } else {
        temp = 0x10;
      }
      this.programStartType = temp;
    }
  }

  startFWDfu(isFastDfu, addr) { 
    let encrypted = this.dfuFile.encrypted;
    let signed = this.dfuFile.signed;
    this.isFastDfu = isFastDfu;
    this.startWriteAddr = addr;
    this.resetType = 0x01;
    this.programFlashType = 0x01;
    this._setDfuFWProgramType(isFastDfu, encrypted, signed);
    this._startProgram();
  }

  startDataDfu(isFastDfu, addr) {
    this.resetType = 0x02;
    this.programFlashType = 0x00;
    this.startWriteAddr = addr;
    this.isFastDfu = isFastDfu;
    if(isFastDfu) {
      this.programStartType = 0x02;
    } else {
      this.programStartType = 0x00;
    }
    console.log("startDataDfu", addr);
    this._startProgram();
  }

  dfuBleRxDataProcess(data) {
    this.dfuCmdParse.receiveParse(data);
  }

  dfuCmdHandler(msg, cmd) {
    if (msg === DfuCmdParse.RECEIVE_CMD_MSG) {
      const cmdFrame = {
        cmdType: cmd.cmdType,
        cmdLen: cmd.cmdLen,
        cmdData: cmd.cmdData,
        cmdCheckSum: cmd.cmdCheckSum
      };
      this._handleCmd(cmdFrame);
    } else if (msg === DfuCmdParse.RECEIVE_CMD_CHECK_ERROR_MSG) {
      console.error("RECEIVE_CMD_CHECK_ERROR_MSG");
    }
  }

  _handleCmd(cmdFrame) {
    let ack  = cmdFrame.cmdData[0];
    switch (cmdFrame.cmdType) {
/*--------------------------------------------------------------------------*/      
      case DfuCmd.PROGRAM_START_CMD:
        this._handleProgramStartCmd(cmdFrame.cmdData, cmdFrame.cmdLen);
        break;

      case DfuCmd.PROGRAM_FLASH_CMD:
        if(ack == 0x01) {
          if(this.sendedCount != this.allSendCount) {
            this._programFlash();
          } else {
            console.log("program end")
            this._programEnd();//下发升级完成指令
          }
        } else {
          this.progressCallback(GR5xxxDfu.DFU_CMD_ACK_ERROR, 0);
          console.error("program flash error");
        }
        break;

      case DfuCmd.PROGRAM_END_CMD:
        if(ack == 0x01) {
          if(this.isFastDfu) {
            let getCheckSum = HexEndian.fromByte(cmdFrame.cmdData,1,4);
            if(getCheckSum == this.dfuFile.fileCheckSum) {
              this.progressCallback(GR5xxxDfu.PROGRAM_END_EVENT, 1);
            } else {
              this.progressCallback(GR5xxxDfu.PROGRAM_END_EVENT, 0);
            }
          } else {
            this.progressCallback(GR5xxxDfu.PROGRAM_END_EVENT, 1);
          }
        } else {
          this.progressCallback(GR5xxxDfu.PROGRAM_END_EVENT, 0);
          console.error("program end ack error");
        }
        break;

        case DfuCmd.FAST_DFU_WRITE_FLASH_END_ACK:
        console.log("fast dfu write flash end");
        this.progressCallback(GR5xxxDfu.PROGRAM_FLASH_EVENT, 100);
        this._programEnd();//下发升级完成指令
        break;
/*--------------------------------------------------------------------------*/ 
      case DfuCmd.GET_INFO_CMD:
        console.log("GET_INFO_CMD");
        if(ack == 0x01) {
          let stackSVN = HexEndian.fromByte(cmdFrame.cmdData, 5, 4, false);
          switch (stackSVN) {
            case 0x00001EA8://GR5515_C1
            case 0x00000B88://GR5515_C4
                this.addrOfSCA = 0x01000000;
              break;
            case 0XCA0F33C7://GR5525
            case 0xF83A64D9://GR5526
            case 0x00354083://GR5332_B0
            default:
              this.addrOfSCA =  0x0020_0000;
              break;
          }
          console.log(stackSVN, this.addrOfSCA);
          this.startDfuState = DFU_START_GET_BOOT_INFO;
          this._startDfuGetInfo();
        } else {
          console.error("DFU_CMD_ACK_ERROR");
          this.progressCallback(GR5xxxDfu.DFU_CMD_ACK_ERROR, 0);
        }
        break;
      case DfuCmd.SYSTEM_CONFIG_CMD:
        if(ack == 0x01) {
          let op = cmdFrame.cmdData[1];
          let addr = HexEndian.fromByte(cmdFrame.cmdData, 2, 4, false);
          let len  = HexEndian.fromByte(cmdFrame.cmdData, 6, 2, false);
          this.bootInfo.isEncryped = (op & 0xf0) != 0x00;
          this.bootInfo.binSize = HexEndian.fromByte(cmdFrame.cmdData, 8, 4, false);
          this.bootInfo.loadAddr = HexEndian.fromByte(cmdFrame.cmdData, 16, 4, false);
          this.bootInfo.runAddr = HexEndian.fromByte(cmdFrame.cmdData, 20, 4, false);
          this.startDfuState = DFU_START_GET_APP_FW_INFO;
          console.log("boot info", addr, len, this.bootInfo.binSize, this.bootInfo.loadAddr, this.bootInfo.runAddr );
          this._startDfuGetInfo();
        }
        else {
          this.progressCallback(GR5xxxDfu.DFU_CMD_ACK_ERROR, 0);
        }
        break;
      case DfuCmd.GET_FW_INFO_CMD:
        this._handleGetFwInfoCmd(cmdFrame.cmdData);
        break;

      default:
        break;
    }
  }

  _handleProgramStartCmd(cmdData, len) {
    let ack = cmdData[0];
    if (ack == 0x01) {
      console.log("Program start success");
      if(len == 0x01) {//普通模式
        this.progressCallback(GR5xxxDfu.PROGRAM_START_EVENT,0);
        this._programFlashInit();
      } else if(len == 0x04) {
        if(cmdData[1] == 0x03) {//擦除完成
          this.progressCallback(GR5xxxDfu.PROGRAM_START_EVENT,0);
          this._programFlashInit();
        }
      }
    } else if (ack == 0x02) {
      console.error("Program start ack error");
      this.progressCallback(GR5xxxDfu.DFU_CMD_ACK_ERROR, 0);
    }
  }

  _handleGetFwInfoCmd(cmdData) {
    let ack = cmdData[0];
    let pos = 1;
    if (ack == 0x01) {
      this.appFwInfo.copyLoadAddr = HexEndian.fromByte(cmdData, pos, 4, false);
      this.appFwInfo.runPosition = cmdData[5];
      pos += 9;
      this.appFwInfo.deviceSize = HexEndian.fromByte(cmdData, pos, 4, false);
      pos += 8;
      this.appFwInfo.deviceLoadAddr = HexEndian.fromByte(cmdData, pos, 4, false);
      pos += 4;
      this.appFwInfo.deviceRunAddr = HexEndian.fromByte(cmdData, pos, 4, false);
      this.appFwInfo.isVaild = false;
      if(this.appFwInfo.deviceRunAddr != -1 && this.appFwInfo.deviceLoadAddr != -1) {
        this.appFwInfo.isVaild = true;
      }
      console.log("getAppFwinfo",this.appFwInfo.deviceLoadAddr,this.appFwInfo.deviceRunAddr ,this.appFwInfo.isVaild );
      this.startDfuState = DFU_START_GET_INFO_COMPLETE;
      this._startDfuGetInfo();
    } else if (ack == 0x02) {
      console.error("get fw info ack error");
      this.progressCallback(GR5xxxDfu.DFU_CMD_ACK_ERROR, 0);
    }
  }

  _startProgram() {
    if(this.dfuFile.isFw) {
      this.dfuFile.imgInfo.loadAddr = this.startWriteAddr;
      let imginfo = this.dfuFile.getFileImgInfo();
      let writedata = DfuCmd.programStartCmd(imginfo, this.programStartType);
      this.bleConnect.writeDfuData(writedata);
    } else {
      let infoData = new Uint8Array(8);
      HexEndian.toByte(this.startWriteAddr, infoData, 0, 4);
      HexEndian.toByte(this.dfuFile.fileData.length, infoData, 4,8);
      let writedata = DfuCmd.programStartCmd(infoData, this.programStartType);
      this.bleConnect.writeDfuData(writedata);
    }
  }

  _programFlashInit() {
    let fileSize = this.dfuFile.fileData.length;
    if(this.isFastDfu) {
      this.onceSendBytes = this.bleConnect.mtu-3;
    } else {
      this.onceSendBytes = NORMAL_DFU_BLOCK_SIZE;//普通升级一次写1024字节
    }
    this.allSendCount = fileSize / this.onceSendBytes;
    this.allSendCount = Math.trunc(this.allSendCount);
    this.lastSendBytes = this.onceSendBytese;
    this.writedBytes = 0;
    this.sendedCount = 0;
    let remain = fileSize % this.onceSendBytes;
    if(remain != 0) {
      this.allSendCount += 1;
      this.lastSendBytes = remain;
    }
    this.proramAddr = this.startWriteAddr;
    this.startProgramFlash = true;
    console.log("init", fileSize, this.allSendCount, this.onceSendBytes, this.lastSendBytes, this.proramAddr)
   
    if(this.isFastDfu) { //fast dfu
      this.intervalId = setInterval(()=>{
        if(this.sendedCount == this.allSendCount) {
          clearInterval(this.intervalId);
        } else {
          this._programFlash();
        }
      },15);
    } else { // normal dfu
      this._programFlash();
    }
  }

  _programFlash() {
    if(this.sendedCount < (this.allSendCount-1)) {
      let sendFileData = this.dfuFile.getFileData(this.writedBytes, this.onceSendBytes);
      if(this.isFastDfu) {
        this.bleConnect.writeDfuData(sendFileData);
      } else {
        let sendData = DfuCmd.programFlash(this.proramAddr, sendFileData, this.programFlashType);
        this.bleConnect.writeDfuData(sendData);
        this.proramAddr += this.onceSendBytes;
      }
      this.writedBytes += this.onceSendBytes;
      this.sendedCount += 1;
      let updatePre = (this.sendedCount * 100) / this.allSendCount;
      updatePre = Math.trunc(updatePre);
      this.progressCallback(GR5xxxDfu.PROGRAM_FLASH_EVENT, updatePre);
    } else if(this.sendedCount == (this.allSendCount-1)){
      let sendFileData = this.dfuFile.getFileData(this.writedBytes, this.lastSendBytes);
      if(this.isFastDfu) {
        this.bleConnect.writeDfuData(sendFileData);
      } else {
        let sendData = DfuCmd.programFlash(this.proramAddr, sendFileData, this.programFlashType);
        this.bleConnect.writeDfuData(sendData);
        this.proramAddr += this.lastSendBytes;
      }
      this.writedBytes += this.lastSendBytes;
      this.sendedCount += 1;
    }
  }

_programEnd() {
  let sendData = DfuCmd.programEndCmd(this.resetType, this.dfuFile.fileCheckSum);
  this.bleConnect.writeDfuData(sendData);
}

dfuInfoGet() {
  this.startDfuState = DFU_STATE_GET_CHIP_INFO;
  this._startDfuGetInfo();
  this._setTimeOut();
}

dfuSetDfuMode(mode) {
  this.bleConnect.writeDfuData(DfuCmd.dfuModeSet(mode));
}

dfuCheck(writeAddr) {
  if(writeAddr < this.addrOfSCA) {
    return false;
  }
  if(this.dfuFile.encrypted != this.bootInfo.isEncryped) {
    return false;
  }
  let writeSize = this.dfuFile.fileData.length;
  if(this._hasOverlap(writeAddr, writeSize, this.addrOfSCA, 0x2000)) {
    return false;
  }
  if(this._hasOverlap(this.bootInfo.loadAddr, this.bootInfo.binSize, writeAddr, writeSize)) {
    return false;
  }
  if(this.dfuFile.isFw) {
    if ((writeAddr != this.dfuFile.imgInfo.loadAddr) && this.appFwInfo.isVaild) {// double bank model
      if(this._hasOverlap(this.appFwInfo.deviceLoadAddr, this.appFwInfo.deviceSize, writeAddr, writeSize)){
        return false;
      }
      if(this._hasOverlap(writeAddr, writeSize, this.dfuFile.loadAddr, writeSize)){
        return false;
      }
      if(this._hasOverlap(this.dfuFile.loadAddr, writeSize, this.addrOfSCA, 0x2000)){
        return false;
      }
      if(this._hasOverlap(this.dfuFile.loadAddr, writeSize, this.bootInfo.loadAddr, this.bootInfo.binSize)){
        return false;
      }
    }
  } else {
    if(this.appFwInfo.isVaild) {
      if(this._hasOverlap(this.appFwInfo.deviceLoadAddr, this.appFwInfo.deviceSize, writeAddr, writeSize)){
        return false;
      }
    }
  }
  return true;
}

_startDfuGetInfo() {
  switch(this.startDfuState) {
    case DFU_STATE_GET_CHIP_INFO:
      this.bleConnect.writeDfuData(DfuCmd.getInfoCmd());
      break;
    case DFU_START_GET_BOOT_INFO:
      this.bleConnect.writeDfuData(DfuCmd.getSystemConfig(this.addrOfSCA, 24,));
      break;
    case DFU_START_GET_APP_FW_INFO:
      this.bleConnect.writeDfuData(DfuCmd.getDfuFwInfo());
      break;
    case DFU_START_GET_INFO_COMPLETE:
      clearTimeout(this.timer);
      this.progressCallback(GR5xxxDfu.DFU_GET_INFO_COMPLETE, 0);
      break;
      default:break;
  }
}

_setTimeOut() {
  this.timer = setTimeout(()=>{
    this.progressCallback(GR5xxxDfu.DFU_CMD_ACK_TIMEOUT, 0);
  },5000);
}

_hasOverlap(addr1, size1, addr2, size2) {
  // 将整数转换为无符号 32 位整数
  const srcStart = addr1 >>> 0;
  const srcEnd = srcStart + (size1 >>> 0);
  const dstStart = addr2 >>> 0;
  const dstEnd = dstStart + (size2 >>> 0);

  return srcEnd > dstStart && srcStart < dstEnd;
}

}

export { GR5xxxDfu };
