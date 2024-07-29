import { DfuCmd } from "./DfuCmd"
import { HexString } from "./HexString"

const DFU_CMD_PARSE_LOG_ENABLE = 0;

class DfuCmdParse {
  static RECEIVE_CMD_MSG = 0x01;
  static RECEIVE_CMD_CHECK_ERROR_MSG = 0x02;
  static RECEIVE_MAX_LEN = 2048;
  static TAG = "DfuCmdParse";

  constructor() {
      this.state = 0;
      this.cmdType = 0;
      this.cmdLen = 0;
      this.cmdData = [];
      this.cmdCheckSum = 0;
      this.receiveDataCount = 0;
      this.mHandler = null;
  }

  setHandler(handler) {
    this.mHandler = handler;
  }

  receiveParse(dat) {
    const data = new Uint8Array(dat);
      for (let i = 0; i < data.length; i++) {
          switch (this.state) {
              case 0: {
                  if (data[i] === DfuCmd.FRAME_HEADER_L) {
                      this._dfuCmdParseLog("FRAME_HEADER_L");
                      this.state = 1;
                  }
                  break;
              }

              case 1: {
                  if (data[i] === DfuCmd.FRAME_HEADER_H) {
                      this._dfuCmdParseLog("FRAME_HEADER_H");
                      this.state = 2;
                  } else if (data[i] === DfuCmd.FRAME_HEADER_L) {
                      this.state = 1;
                  } else {
                      this.state = 0;
                  }
                  break;
              }

              case 2: {
                  this._dfuCmdParseLog("cmd_type_l");
                  this.cmdType = data[i] & 0xff;
                  this.state = 3;
                  break;
              }

              case 3: {
                  this._dfuCmdParseLog("cmd_type_H");
                  this.cmdType |= (data[i] << 8) & 0xffff;
                  this.state = 4;
                  break;
              }

              case 4: {
                  this._dfuCmdParseLog("cmd_len_L");
                  this.cmdLen = data[i] & 0xff;
                  this.state = 5;
                  break;
              }

              case 5: {
                  this._dfuCmdParseLog("cmd_len_H");
                  this.cmdLen |= (data[i] << 8) & 0xffff;
                  if (this.cmdLen === 0) {
                      this.state = 7;
                  } else if (this.cmdLen >= DfuCmdParse.RECEIVE_MAX_LEN) {
                      this.state = 0;
                  } else {
                      this.receiveDataCount = 0;
                      this.cmdData = new Uint8Array(this.cmdLen);
                      this.state = 6;
                  }
                  break;
              }

              case 6: {
                  this.cmdData[this.receiveDataCount] = data[i];
                  if (++this.receiveDataCount === this.cmdLen) {
                      this.state = 7;
                  }
                  break;
              }

              case 7: {
                  this._dfuCmdParseLog("cmd_check_sum_l:" + i);
                  this.cmdCheckSum = data[i] & 0xff;
                  this.state = 8;
                  break;
              }

              case 8: {
                  this.cmdCheckSum |= (data[i] << 8) & 0xffff;
                  this.state = 0;
                  this._dfuCmdParseLog("start cmd_process");
                  this._cmdProcess();
                  return;
              }

              default: {
                  this.state = 0;
                  break;
              }
          }
      }
  }

  _cmdProcess() {
      let checkSum = 0;
      checkSum += this.cmdType & 0xff;
      checkSum += (this.cmdType >> 8) & 0xff;
      checkSum += this.cmdLen & 0xff;
      checkSum += (this.cmdLen >> 8) & 0xff;
      for (let i = 0; i < this.cmdData.length; i++) {
          checkSum += this.cmdData[i] & 0xff;
          checkSum &= 0xffff;
      }
      this._dfuCmdParseLog("check:" + checkSum + " " + this.cmdCheckSum + "len: " + this.cmdLen + "data:" + HexString.toHexString(this.cmdData));

      if ((checkSum & 0xffff) === this.cmdCheckSum) {
          const cmdFrame = {
              cmdType: this.cmdType,
              cmdLen: this.cmdLen,
              cmdData: this.cmdData,
              cmdCheckSum: this.cmdCheckSum
          };
          this._dfuCmdParseLog("send message:",cmdFrame);
          this.mHandler(DfuCmdParse.RECEIVE_CMD_MSG, cmdFrame);
          
      } else {
        this._dfuCmdParseLog("send error message:");
          this.mHandler(DfuCmdParse.RECEIVE_CMD_CHECK_ERROR_MSG, null);
      }
  }

  _dfuCmdParseLog(...args) {
    if(DFU_CMD_PARSE_LOG_ENABLE) {
      console.log(args);
    }
  }
}
export { DfuCmdParse };