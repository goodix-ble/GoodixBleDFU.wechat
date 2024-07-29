class HexString {
  static HEX_CHAR = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
  static STR_FOR_NULL = "null";

  static toHexString(dat, offset = 0, size = dat.length, byteSeparator = null) {
        // 方法重载
      if (dat instanceof Array) {
          // 如果只提供了一个参数，调用重载方法
          if (arguments.length === 1) {
              return HexString.toHexString(dat, 0, dat.length, null);
          }
      }
      if (dat === null) {
          return HexString.STR_FOR_NULL;
      }

      if (size < 1) {
          return "";
      }

      let byteSeparatorLen = 0;
      if (byteSeparator !== null) {
          byteSeparatorLen = byteSeparator.length;
      }

      let hexString = '';
      for (let i = offset; i < offset + size; i++) {
          let v = dat[i];
          hexString += HexString.HEX_CHAR[(v >> 4) & 0xF] + HexString.HEX_CHAR[v & 0xF];
          if (i < offset + size - 1 && byteSeparatorLen > 0) {
              hexString += byteSeparator;
          }
      }

      return hexString;
  }

  static intToByteString(intValue) {
    // 将整数转换为十六进制字符串
    const hexString = intValue.toString(16).padStart(8, '0');
    // 格式化为字节表示的字符串，每两位十六进制数表示一个字节
    const byteString = hexString.match(/.{1,2}/g).join('');
    // 添加 '0x' 前缀
    return '0x' + byteString.toUpperCase();
}

static uint8ToByteString(intValue) {
   // 将整数值转换为两位的十六进制字符串，并确保是两位长度的
   let byteString = (intValue & 0xFF).toString(16).padStart(2, '0');
   return '0x'+byteString.toUpperCase();
}


}
export { HexString };