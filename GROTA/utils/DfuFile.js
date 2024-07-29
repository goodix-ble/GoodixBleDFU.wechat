import {HexString} from './HexString.js';//引入定义的类
import {HexSerializer} from './HexSerializer.js';//引入定义的类
import {HexEndian} from './HexEndian.js';//引入定义的类

class DfuFile{
  constructor()
  {
    this.fileCheckSum = 0;
    this.fileData = [];
    this.encrypted = false;
    this.signed = false;
    this.imgInfoConfig = 0;
    this.commentsByte = new Uint8Array(12);
    this.isFw = true;
    this.imgInfo = {
      pattern:0,
      version:0,
      binSize:0,
      checkSum:0,
      loadAddr:0,
      runAddr:0,
      xqspiXipCmd:0,
      xqspiSpeed:0,
      codeCopyMode:0,
      systemClk:0,
      checkImage:0,
      bootDelay:0,
      isDapBoot:0,
      comments:'',
    };
    this.lastError = "success";
  }

  _protectReadImginfo(data) {
    this.imgInfo.pattern = data.get(2);
    this.imgInfo.version = data.get(2);
    this.imgInfo.binSize = data.get(4);
    this.imgInfo.checkSum = data.get(4);
    this.imgInfo.loadAddr = data.get(4);
    this.imgInfo.runAddr = data.get(4);
    this.imgInfo.xqspiXipCmd = data.get(4);

    let config = data.get(4);
    this.imgInfoConfig = config;
    this.imgInfo.xqspiSpeed = config & 0b1111;
    config >>= 4;
    this.imgInfo.codeCopyMode = config & 0b1;
    config >>= 1;
    this.imgInfo.systemClk = config & 0b111;
    config >>= 3;
    this.imgInfo.checkImage = config & 0b1;
    config >>= 1;
    this.imgInfo.bootDelay = config & 0b1;
    config >>= 1;
    this.imgInfo.isDapBoot = config & 0b1;

    this.imgInfo.comments = data.getCString(12, this.commentsByte);
  }

  load(dat, isFw) {
    this.fileData = new Uint8Array(dat);
    const fileSize = this.fileData.length;
    console.log(fileSize);
    if (fileSize > 0) {
      let checkSum = 0;
      for (let i = 0; i < fileSize; i++) {
        checkSum +=  this.fileData[i];
      }
      this.fileCheckSum = checkSum;
      console.log(HexString.intToByteString(this.fileCheckSum));
      if(!isFw) {//如果不是固件，就直接返回了
        this.isFw = false;
        return true;
      }

      let reader = new HexSerializer();
      reader.setbuffer(dat);
      reader.setPos(fileSize - 48);
      if (reader.get(2) == 0x4744) {
          reader.setPos(fileSize - 48);
      } else {
        reader.setPos(fileSize - 48 - 856);
        if (reader.get(2) == 0x4744) {
            this.encrypted = true;
            this.signed = true;
            // 进一步判断是否加密
            reader.setPos(fileSize - (256 + 520 + 8)); // 定位到reserved区域
            let rsv = reader.get(4);
            if (rsv == 0x4E474953) {
              this.encrypted = false; // 仅加签未加密
            }
            reader.setPos(fileSize - 48 - 856);
        } else {
            this.lastError = "Can't find image information data";
            return false;
        }
    }
    this._protectReadImginfo(reader);
    console.log(this.imgInfo)
    return true;
   } else {
    lastError = "Input size is zero";
   }
   return false;
  }

  getFileImgInfo() {
    let imgInfoBytes = new Uint8Array(40);
    let pos = 0;
    HexEndian.toByte(this.imgInfo.pattern, imgInfoBytes, pos, 2, false);
    pos+=2;
    HexEndian.toByte(this.imgInfo.version, imgInfoBytes, pos, 2, false);
    pos+=2;
    HexEndian.toByte(this.imgInfo.binSize, imgInfoBytes, pos, 4, false);
    pos+=4;
    HexEndian.toByte(this.imgInfo.checkSum, imgInfoBytes, pos, 4, false);
    pos+=4;
    HexEndian.toByte(this.imgInfo.loadAddr, imgInfoBytes, pos, 4, false);
    pos+=4;
    HexEndian.toByte(this.imgInfo.runAddr, imgInfoBytes, pos, 4, false);
    pos+=4;
    HexEndian.toByte(this.imgInfo.xqspiXipCmd, imgInfoBytes, pos, 4, false);
    pos+=4;
    HexEndian.toByte(this.imgInfoConfig, imgInfoBytes, pos, 4, false);
    pos+=4;
    for(let i=0; i<12; i++) {
      imgInfoBytes[pos+i] = this.commentsByte[i];
    }
    return imgInfoBytes;
  }

  getFileData(start, size) {
    return this.fileData.slice(start, start + size);
  }
  
}
export { DfuFile };