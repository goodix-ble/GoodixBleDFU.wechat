class HexEndian {
  static changeEndian(org, size) {
      let val = 0;
      for (let i = 0; i < size; i++) {
          val <<= 8;
          val |= org & 0xff;
          org >>= 8;
      }
      return val;
  }

  static fromByte(dat, pos, size, bigEndian) {
      let val = 0;
      let end = pos + size;
      if (dat && pos >= 0 && size >= 0) {
          if (end > dat.length) {
              end = dat.length;
          }

          if (bigEndian) {
              for (let i = pos; i < end; i++) {
                  val <<= 8;
                  val |= (dat[i] & 0xFF);
              }
          } else {
              for (let i = end - 1; i >= pos; i--) {
                  val <<= 8;
                  val |= (dat[i] & 0xFF);
              }
          }
          return val;
      }
      return 0;
  }

  static toByte(val, out, pos, size, bigEndian) {
      let end = pos + size;
      if (out && pos >= 0 && size >= 0) {
          if (end > out.length) {
              end = out.length;
          }

          if (bigEndian) {
              for (let i = end - 1; i >= pos; i--) {
                  out[i] = val & 0xff;
                  val >>= 8;
              }
          } else {
              for (let i = pos; i < end; i++) {
                  out[i] = val & 0xff;
                  val >>= 8;
              }
          }
      }
      return out;
  }
}
export { HexEndian };