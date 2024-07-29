class DfuCmd {
  static ACK_SUCCESS = 0x01;
  static ACK_ERROR = 0x02;
  static FRAME_HEADER_L = 0x44;
  static FRAME_HEADER_H = 0x47;

  static GET_INFO_CMD = 0X01;
  static RESET_CMD = 0X02;
  static PROGRAM_START_CMD = 0x23;
  static PROGRAM_FLASH_CMD = 0x24;
  static PROGRAM_END_CMD = 0x25;
  static SYSTEM_CONFIG_CMD = 0x27;
  static CONFIG_EXT_FLASH_CMD = 0x2A;
  static GET_FLASH_INFO_CMD = 0x2B;
  static SET_DFU_MODE_CMD = 0X41;
  static GET_FW_INFO_CMD = 0X42;
  static FAST_DFU_WRITE_FLASH_END_ACK = 0xFF;

  static _protect_isp_send_frame(data, cmd) {
    let checkSum = 0;
    let len = 0;
    if (data !== null && data !== undefined) {
        len = data.length;
    }
    const sendData = new Uint8Array(8 + len);
    checkSum += cmd & 0xff;
    checkSum += (cmd >> 8) & 0xff;
    checkSum += len & 0xff;
    checkSum += (len >> 8) & 0xff;
    sendData[0] = DfuCmd.FRAME_HEADER_L;
    sendData[1] = DfuCmd.FRAME_HEADER_H;
    sendData[2] = cmd;
    sendData[3] = 0x00;
    sendData[4] = len & 0xff;
    sendData[5] = (len >> 8) & 0xff;
    for (let i = 0; i < len; i++) {
        sendData[6 + i] = data[i];
        checkSum += data[i] & 0xff;
    }
    sendData[6 + len] = checkSum & 0xff;
    sendData[7 + len] = (checkSum >> 8) & 0xff;
    return sendData;
  }

  static getInfoCmd() {
    return this._protect_isp_send_frame(null, DfuCmd.GET_INFO_CMD);
  }

  static getDfuFwInfo() {
    return this._protect_isp_send_frame(null, DfuCmd.GET_FW_INFO_CMD);
  }

  static dfuModeSet(mode) {
    let sendContent = new Uint8Array(1);
    sendContent[0] = mode;
    return this._protect_isp_send_frame(sendContent, DfuCmd.SET_DFU_MODE_CMD);
  }

  static programFlash(addr, data, program_type) {
    let len = data.length;
    const sendContent = new Uint8Array(7 + len);
    sendContent[0] = program_type;
    sendContent[1] = addr & 0xff;
    sendContent[2] = (addr >> 8) & 0xff;
    sendContent[3] = (addr >> 16) & 0xff;
    sendContent[4] = (addr >> 24) & 0xff;
    sendContent[5] = len & 0xff;
    sendContent[6] = (len >> 8) & 0xff;
    for (let i = 0; i < len; i++) {
        sendContent[7 + i] = data[i];
    }
    return this._protect_isp_send_frame(sendContent, DfuCmd.PROGRAM_FLASH_CMD);
  }

  static getSystemConfig(addr, readLen) {
    let sendContent = null;
    sendContent = new Uint8Array(7);
    sendContent[0] = 0x00;
    sendContent[1] = addr & 0xff;
    sendContent[2] = (addr >> 8) & 0xff;
    sendContent[3] = (addr >> 16) & 0xff;
    sendContent[4] = (addr >> 24) & 0xff;

    sendContent[5] = readLen & 0xff;
    sendContent[6] = (readLen >> 8) & 0xff;
    return this._protect_isp_send_frame(sendContent, DfuCmd.SYSTEM_CONFIG_CMD);
  }

  static programStartCmd(data, program_type) {
    let sendContent = new Uint8Array(data.length+1);
    sendContent[0] = program_type;
    for(let i=0; i<data.length; i++) {
      sendContent[1+i] = data[i];
    }
    return this._protect_isp_send_frame(sendContent, DfuCmd.PROGRAM_START_CMD);
  }

  static programEndCmd(resetType, checkSum) {
    let sendContent = new Uint8Array(5);
    sendContent[0] = resetType;
    sendContent[1] = checkSum & 0xff;
    sendContent[2] = (checkSum >> 8) & 0xff;
    sendContent[3] = (checkSum >> 16) & 0xff;
    sendContent[4] = (checkSum >> 24) & 0xff;
    return this._protect_isp_send_frame(sendContent, DfuCmd.PROGRAM_END_CMD);
  }
}

export { DfuCmd };