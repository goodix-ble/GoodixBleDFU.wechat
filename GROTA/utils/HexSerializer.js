import {HexEndian} from './HexEndian.js';//引入定义的类
class HexSerializer {
  constructor() {
      this.buffer = [];
      this.absPos = 0; // 相对于 buffer 的绝对位置
      this.rangeStart = 0;
      this.rangeEnd = 0;
      this.bigEndian = false; // 默认为小端序
      this.readonly = false; // 仅用于读取数据
  }

  setbuffer(dat){
    this.buffer = new Uint8Array(dat);;
    this.absPos = 0;
    this.rangeStart = 0;
    this.rangeEnd = this.buffer.length;
  }

  setPos(pos) {
      this.absPos = this.rangeStart + pos;
      if (this.absPos < this.rangeStart) this.absPos = this.rangeStart;
      if (this.absPos > this.rangeEnd) this.absPos = this.rangeEnd;
  }

  get(size, bigEndian = this.bigEndian) {
      if (this.absPos + size > this.rangeEnd) return 0;
      let val = HexEndian.fromByte(this.buffer, this.absPos, size, bigEndian);
      this.absPos += size;
      return val;
  }

  getCString(size, outByte) {
    if (this.absPos + size > this.rangeEnd) size = this.rangeEnd - this.absPos;
    let actualSize = size;
    for (let i = 0; i < size; i++) {
        let b = this.buffer[this.absPos + i];
        outByte[i] = b;
        if (b === 0 || b === 0xFF) {
            actualSize = i;
            break;
        }
    }
    let s = "";
    for (let i = 0; i < actualSize; i++) {
        s += String.fromCharCode(this.buffer[this.absPos + i]);
    }
    this.absPos += size;
    return s;
}

}

export { HexSerializer };