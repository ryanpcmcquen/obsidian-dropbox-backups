var global$1 = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
var inited = false;
function init() {
  inited = true;
  var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }
  revLookup["-".charCodeAt(0)] = 62;
  revLookup["_".charCodeAt(0)] = 63;
}
function toByteArray(b642) {
  if (!inited) {
    init();
  }
  var i, j, l, tmp, placeHolders, arr;
  var len = b642.length;
  if (len % 4 > 0) {
    throw new Error("Invalid string. Length must be a multiple of 4");
  }
  placeHolders = b642[len - 2] === "=" ? 2 : b642[len - 1] === "=" ? 1 : 0;
  arr = new Arr(len * 3 / 4 - placeHolders);
  l = placeHolders > 0 ? len - 4 : len;
  var L = 0;
  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = revLookup[b642.charCodeAt(i)] << 18 | revLookup[b642.charCodeAt(i + 1)] << 12 | revLookup[b642.charCodeAt(i + 2)] << 6 | revLookup[b642.charCodeAt(i + 3)];
    arr[L++] = tmp >> 16 & 255;
    arr[L++] = tmp >> 8 & 255;
    arr[L++] = tmp & 255;
  }
  if (placeHolders === 2) {
    tmp = revLookup[b642.charCodeAt(i)] << 2 | revLookup[b642.charCodeAt(i + 1)] >> 4;
    arr[L++] = tmp & 255;
  } else if (placeHolders === 1) {
    tmp = revLookup[b642.charCodeAt(i)] << 10 | revLookup[b642.charCodeAt(i + 1)] << 4 | revLookup[b642.charCodeAt(i + 2)] >> 2;
    arr[L++] = tmp >> 8 & 255;
    arr[L++] = tmp & 255;
  }
  return arr;
}
function tripletToBase64(num) {
  return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
}
function encodeChunk(uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + uint8[i + 2];
    output.push(tripletToBase64(tmp));
  }
  return output.join("");
}
function fromByteArray(uint8) {
  if (!inited) {
    init();
  }
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3;
  var output = "";
  var parts = [];
  var maxChunkLength = 16383;
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
  }
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    output += lookup[tmp >> 2];
    output += lookup[tmp << 4 & 63];
    output += "==";
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    output += lookup[tmp >> 10];
    output += lookup[tmp >> 4 & 63];
    output += lookup[tmp << 2 & 63];
    output += "=";
  }
  parts.push(output);
  return parts.join("");
}
function read(buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? nBytes - 1 : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];
  i += d;
  e = s & (1 << -nBits) - 1;
  s >>= -nBits;
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
  }
  m = e & (1 << -nBits) - 1;
  e >>= -nBits;
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
  }
  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : (s ? -1 : 1) * Infinity;
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
}
function write(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
  var i = isLE ? 0 : nBytes - 1;
  var d = isLE ? 1 : -1;
  var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
  value = Math.abs(value);
  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }
    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }
  for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
  }
  e = e << mLen | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
  }
  buffer[offset + i - d] |= s * 128;
}
var toString = {}.toString;
var isArray = Array.isArray || function(arr) {
  return toString.call(arr) == "[object Array]";
};
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
var INSPECT_MAX_BYTES = 50;
Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== void 0 ? global$1.TYPED_ARRAY_SUPPORT : true;
function kMaxLength() {
  return Buffer.TYPED_ARRAY_SUPPORT ? 2147483647 : 1073741823;
}
function createBuffer(that, length) {
  if (kMaxLength() < length) {
    throw new RangeError("Invalid typed array length");
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    that = new Uint8Array(length);
    that.__proto__ = Buffer.prototype;
  } else {
    if (that === null) {
      that = new Buffer(length);
    }
    that.length = length;
  }
  return that;
}
function Buffer(arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length);
  }
  if (typeof arg === "number") {
    if (typeof encodingOrOffset === "string") {
      throw new Error("If encoding is specified then the first argument must be a string");
    }
    return allocUnsafe(this, arg);
  }
  return from(this, arg, encodingOrOffset, length);
}
Buffer.poolSize = 8192;
Buffer._augment = function(arr) {
  arr.__proto__ = Buffer.prototype;
  return arr;
};
function from(that, value, encodingOrOffset, length) {
  if (typeof value === "number") {
    throw new TypeError('"value" argument must not be a number');
  }
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length);
  }
  if (typeof value === "string") {
    return fromString(that, value, encodingOrOffset);
  }
  return fromObject(that, value);
}
Buffer.from = function(value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length);
};
if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype;
  Buffer.__proto__ = Uint8Array;
}
function assertSize(size) {
  if (typeof size !== "number") {
    throw new TypeError('"size" argument must be a number');
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative');
  }
}
function alloc(that, size, fill2, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(that, size);
  }
  if (fill2 !== void 0) {
    return typeof encoding === "string" ? createBuffer(that, size).fill(fill2, encoding) : createBuffer(that, size).fill(fill2);
  }
  return createBuffer(that, size);
}
Buffer.alloc = function(size, fill2, encoding) {
  return alloc(null, size, fill2, encoding);
};
function allocUnsafe(that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }
  return that;
}
Buffer.allocUnsafe = function(size) {
  return allocUnsafe(null, size);
};
Buffer.allocUnsafeSlow = function(size) {
  return allocUnsafe(null, size);
};
function fromString(that, string, encoding) {
  if (typeof encoding !== "string" || encoding === "") {
    encoding = "utf8";
  }
  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding');
  }
  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);
  var actual = that.write(string, encoding);
  if (actual !== length) {
    that = that.slice(0, actual);
  }
  return that;
}
function fromArrayLike(that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }
  return that;
}
function fromArrayBuffer(that, array, byteOffset, length) {
  array.byteLength;
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError("'offset' is out of bounds");
  }
  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError("'length' is out of bounds");
  }
  if (byteOffset === void 0 && length === void 0) {
    array = new Uint8Array(array);
  } else if (length === void 0) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    that = array;
    that.__proto__ = Buffer.prototype;
  } else {
    that = fromArrayLike(that, array);
  }
  return that;
}
function fromObject(that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);
    if (that.length === 0) {
      return that;
    }
    obj.copy(that, 0, 0, len);
    return that;
  }
  if (obj) {
    if (typeof ArrayBuffer !== "undefined" && obj.buffer instanceof ArrayBuffer || "length" in obj) {
      if (typeof obj.length !== "number" || isnan(obj.length)) {
        return createBuffer(that, 0);
      }
      return fromArrayLike(that, obj);
    }
    if (obj.type === "Buffer" && isArray(obj.data)) {
      return fromArrayLike(that, obj.data);
    }
  }
  throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");
}
function checked(length) {
  if (length >= kMaxLength()) {
    throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + kMaxLength().toString(16) + " bytes");
  }
  return length | 0;
}
Buffer.isBuffer = isBuffer;
function internalIsBuffer(b) {
  return !!(b != null && b._isBuffer);
}
Buffer.compare = function compare(a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError("Arguments must be Buffers");
  }
  if (a === b)
    return 0;
  var x = a.length;
  var y = b.length;
  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }
  if (x < y)
    return -1;
  if (y < x)
    return 1;
  return 0;
};
Buffer.isEncoding = function isEncoding(encoding) {
  switch (String(encoding).toLowerCase()) {
    case "hex":
    case "utf8":
    case "utf-8":
    case "ascii":
    case "latin1":
    case "binary":
    case "base64":
    case "ucs2":
    case "ucs-2":
    case "utf16le":
    case "utf-16le":
      return true;
    default:
      return false;
  }
};
Buffer.concat = function concat(list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers');
  }
  if (list.length === 0) {
    return Buffer.alloc(0);
  }
  var i;
  if (length === void 0) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }
  var buffer = Buffer.allocUnsafe(length);
  var pos = 0;
  for (i = 0; i < list.length; ++i) {
    var buf = list[i];
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers');
    }
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer;
};
function byteLength(string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length;
  }
  if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength;
  }
  if (typeof string !== "string") {
    string = "" + string;
  }
  var len = string.length;
  if (len === 0)
    return 0;
  var loweredCase = false;
  for (; ; ) {
    switch (encoding) {
      case "ascii":
      case "latin1":
      case "binary":
        return len;
      case "utf8":
      case "utf-8":
      case void 0:
        return utf8ToBytes(string).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return len * 2;
      case "hex":
        return len >>> 1;
      case "base64":
        return base64ToBytes(string).length;
      default:
        if (loweredCase)
          return utf8ToBytes(string).length;
        encoding = ("" + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.byteLength = byteLength;
function slowToString(encoding, start, end) {
  var loweredCase = false;
  if (start === void 0 || start < 0) {
    start = 0;
  }
  if (start > this.length) {
    return "";
  }
  if (end === void 0 || end > this.length) {
    end = this.length;
  }
  if (end <= 0) {
    return "";
  }
  end >>>= 0;
  start >>>= 0;
  if (end <= start) {
    return "";
  }
  if (!encoding)
    encoding = "utf8";
  while (true) {
    switch (encoding) {
      case "hex":
        return hexSlice(this, start, end);
      case "utf8":
      case "utf-8":
        return utf8Slice(this, start, end);
      case "ascii":
        return asciiSlice(this, start, end);
      case "latin1":
      case "binary":
        return latin1Slice(this, start, end);
      case "base64":
        return base64Slice(this, start, end);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return utf16leSlice(this, start, end);
      default:
        if (loweredCase)
          throw new TypeError("Unknown encoding: " + encoding);
        encoding = (encoding + "").toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.prototype._isBuffer = true;
function swap(b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}
Buffer.prototype.swap16 = function swap16() {
  var len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 16-bits");
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this;
};
Buffer.prototype.swap32 = function swap32() {
  var len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 32-bits");
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this;
};
Buffer.prototype.swap64 = function swap64() {
  var len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 64-bits");
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this;
};
Buffer.prototype.toString = function toString2() {
  var length = this.length | 0;
  if (length === 0)
    return "";
  if (arguments.length === 0)
    return utf8Slice(this, 0, length);
  return slowToString.apply(this, arguments);
};
Buffer.prototype.equals = function equals(b) {
  if (!internalIsBuffer(b))
    throw new TypeError("Argument must be a Buffer");
  if (this === b)
    return true;
  return Buffer.compare(this, b) === 0;
};
Buffer.prototype.inspect = function inspect() {
  var str = "";
  var max = INSPECT_MAX_BYTES;
  if (this.length > 0) {
    str = this.toString("hex", 0, max).match(/.{2}/g).join(" ");
    if (this.length > max)
      str += " ... ";
  }
  return "<Buffer " + str + ">";
};
Buffer.prototype.compare = function compare2(target, start, end, thisStart, thisEnd) {
  if (!internalIsBuffer(target)) {
    throw new TypeError("Argument must be a Buffer");
  }
  if (start === void 0) {
    start = 0;
  }
  if (end === void 0) {
    end = target ? target.length : 0;
  }
  if (thisStart === void 0) {
    thisStart = 0;
  }
  if (thisEnd === void 0) {
    thisEnd = this.length;
  }
  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError("out of range index");
  }
  if (thisStart >= thisEnd && start >= end) {
    return 0;
  }
  if (thisStart >= thisEnd) {
    return -1;
  }
  if (start >= end) {
    return 1;
  }
  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;
  if (this === target)
    return 0;
  var x = thisEnd - thisStart;
  var y = end - start;
  var len = Math.min(x, y);
  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end);
  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break;
    }
  }
  if (x < y)
    return -1;
  if (y < x)
    return 1;
  return 0;
};
function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  if (buffer.length === 0)
    return -1;
  if (typeof byteOffset === "string") {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 2147483647) {
    byteOffset = 2147483647;
  } else if (byteOffset < -2147483648) {
    byteOffset = -2147483648;
  }
  byteOffset = +byteOffset;
  if (isNaN(byteOffset)) {
    byteOffset = dir ? 0 : buffer.length - 1;
  }
  if (byteOffset < 0)
    byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir)
      return -1;
    else
      byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir)
      byteOffset = 0;
    else
      return -1;
  }
  if (typeof val === "string") {
    val = Buffer.from(val, encoding);
  }
  if (internalIsBuffer(val)) {
    if (val.length === 0) {
      return -1;
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
  } else if (typeof val === "number") {
    val = val & 255;
    if (Buffer.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf === "function") {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
  }
  throw new TypeError("val must be string, number or Buffer");
}
function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val.length;
  if (encoding !== void 0) {
    encoding = String(encoding).toLowerCase();
    if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
      if (arr.length < 2 || val.length < 2) {
        return -1;
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }
  function read2(buf, i2) {
    if (indexSize === 1) {
      return buf[i2];
    } else {
      return buf.readUInt16BE(i2 * indexSize);
    }
  }
  var i;
  if (dir) {
    var foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read2(arr, i) === read2(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1)
          foundIndex = i;
        if (i - foundIndex + 1 === valLength)
          return foundIndex * indexSize;
      } else {
        if (foundIndex !== -1)
          i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength)
      byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      var found = true;
      for (var j = 0; j < valLength; j++) {
        if (read2(arr, i + j) !== read2(val, j)) {
          found = false;
          break;
        }
      }
      if (found)
        return i;
    }
  }
  return -1;
}
Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1;
};
Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
};
Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
};
function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }
  var strLen = string.length;
  if (strLen % 2 !== 0)
    throw new TypeError("Invalid hex string");
  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed))
      return i;
    buf[offset + i] = parsed;
  }
  return i;
}
function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
}
function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length);
}
function latin1Write(buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length);
}
function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length);
}
function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
}
Buffer.prototype.write = function write2(string, offset, length, encoding) {
  if (offset === void 0) {
    encoding = "utf8";
    length = this.length;
    offset = 0;
  } else if (length === void 0 && typeof offset === "string") {
    encoding = offset;
    length = this.length;
    offset = 0;
  } else if (isFinite(offset)) {
    offset = offset | 0;
    if (isFinite(length)) {
      length = length | 0;
      if (encoding === void 0)
        encoding = "utf8";
    } else {
      encoding = length;
      length = void 0;
    }
  } else {
    throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
  }
  var remaining = this.length - offset;
  if (length === void 0 || length > remaining)
    length = remaining;
  if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
    throw new RangeError("Attempt to write outside buffer bounds");
  }
  if (!encoding)
    encoding = "utf8";
  var loweredCase = false;
  for (; ; ) {
    switch (encoding) {
      case "hex":
        return hexWrite(this, string, offset, length);
      case "utf8":
      case "utf-8":
        return utf8Write(this, string, offset, length);
      case "ascii":
        return asciiWrite(this, string, offset, length);
      case "latin1":
      case "binary":
        return latin1Write(this, string, offset, length);
      case "base64":
        return base64Write(this, string, offset, length);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return ucs2Write(this, string, offset, length);
      default:
        if (loweredCase)
          throw new TypeError("Unknown encoding: " + encoding);
        encoding = ("" + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};
Buffer.prototype.toJSON = function toJSON() {
  return {
    type: "Buffer",
    data: Array.prototype.slice.call(this._arr || this, 0)
  };
};
function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf);
  } else {
    return fromByteArray(buf.slice(start, end));
  }
}
function utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end);
  var res = [];
  var i = start;
  while (i < end) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 128) {
            codePoint = firstByte;
          }
          break;
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 192) === 128) {
            tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
            if (tempCodePoint > 127) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
            if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
            if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
              codePoint = tempCodePoint;
            }
          }
      }
    }
    if (codePoint === null) {
      codePoint = 65533;
      bytesPerSequence = 1;
    } else if (codePoint > 65535) {
      codePoint -= 65536;
      res.push(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    res.push(codePoint);
    i += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}
var MAX_ARGUMENTS_LENGTH = 4096;
function decodeCodePointsArray(codePoints) {
  var len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints);
  }
  var res = "";
  var i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
  }
  return res;
}
function asciiSlice(buf, start, end) {
  var ret = "";
  end = Math.min(buf.length, end);
  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 127);
  }
  return ret;
}
function latin1Slice(buf, start, end) {
  var ret = "";
  end = Math.min(buf.length, end);
  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret;
}
function hexSlice(buf, start, end) {
  var len = buf.length;
  if (!start || start < 0)
    start = 0;
  if (!end || end < 0 || end > len)
    end = len;
  var out = "";
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i]);
  }
  return out;
}
function utf16leSlice(buf, start, end) {
  var bytes = buf.slice(start, end);
  var res = "";
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res;
}
Buffer.prototype.slice = function slice(start, end) {
  var len = this.length;
  start = ~~start;
  end = end === void 0 ? len : ~~end;
  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0;
  } else if (start > len) {
    start = len;
  }
  if (end < 0) {
    end += len;
    if (end < 0)
      end = 0;
  } else if (end > len) {
    end = len;
  }
  if (end < start)
    end = start;
  var newBuf;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end);
    newBuf.__proto__ = Buffer.prototype;
  } else {
    var sliceLen = end - start;
    newBuf = new Buffer(sliceLen, void 0);
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }
  return newBuf;
};
function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0)
    throw new RangeError("offset is not uint");
  if (offset + ext > length)
    throw new RangeError("Trying to access beyond buffer length");
}
Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert)
    checkOffset(offset, byteLength2, this.length);
  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength2 && (mul *= 256)) {
    val += this[offset + i] * mul;
  }
  return val;
};
Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert) {
    checkOffset(offset, byteLength2, this.length);
  }
  var val = this[offset + --byteLength2];
  var mul = 1;
  while (byteLength2 > 0 && (mul *= 256)) {
    val += this[offset + --byteLength2] * mul;
  }
  return val;
};
Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length);
  return this[offset];
};
Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length);
  return this[offset] | this[offset + 1] << 8;
};
Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length);
  return this[offset] << 8 | this[offset + 1];
};
Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
};
Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
};
Buffer.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert)
    checkOffset(offset, byteLength2, this.length);
  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength2 && (mul *= 256)) {
    val += this[offset + i] * mul;
  }
  mul *= 128;
  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength2);
  return val;
};
Buffer.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert)
    checkOffset(offset, byteLength2, this.length);
  var i = byteLength2;
  var mul = 1;
  var val = this[offset + --i];
  while (i > 0 && (mul *= 256)) {
    val += this[offset + --i] * mul;
  }
  mul *= 128;
  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength2);
  return val;
};
Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length);
  if (!(this[offset] & 128))
    return this[offset];
  return (255 - this[offset] + 1) * -1;
};
Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length);
  var val = this[offset] | this[offset + 1] << 8;
  return val & 32768 ? val | 4294901760 : val;
};
Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length);
  var val = this[offset + 1] | this[offset] << 8;
  return val & 32768 ? val | 4294901760 : val;
};
Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
};
Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
};
Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4);
};
Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4);
};
Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8);
};
Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8);
};
function checkInt(buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf))
    throw new TypeError('"buffer" argument must be a Buffer instance');
  if (value > max || value < min)
    throw new RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length)
    throw new RangeError("Index out of range");
}
Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength2) - 1;
    checkInt(this, value, offset, byteLength2, maxBytes, 0);
  }
  var mul = 1;
  var i = 0;
  this[offset] = value & 255;
  while (++i < byteLength2 && (mul *= 256)) {
    this[offset + i] = value / mul & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength2) - 1;
    checkInt(this, value, offset, byteLength2, maxBytes, 0);
  }
  var i = byteLength2 - 1;
  var mul = 1;
  this[offset + i] = value & 255;
  while (--i >= 0 && (mul *= 256)) {
    this[offset + i] = value / mul & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 1, 255, 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT)
    value = Math.floor(value);
  this[offset] = value & 255;
  return offset + 1;
};
function objectWriteUInt16(buf, value, offset, littleEndian) {
  if (value < 0)
    value = 65535 + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & 255 << 8 * (littleEndian ? i : 1 - i)) >>> (littleEndian ? i : 1 - i) * 8;
  }
}
Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 2, 65535, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 255;
    this[offset + 1] = value >>> 8;
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2;
};
Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 2, 65535, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8;
    this[offset + 1] = value & 255;
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2;
};
function objectWriteUInt32(buf, value, offset, littleEndian) {
  if (value < 0)
    value = 4294967295 + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = value >>> (littleEndian ? i : 3 - i) * 8 & 255;
  }
}
Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 4, 4294967295, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = value >>> 24;
    this[offset + 2] = value >>> 16;
    this[offset + 1] = value >>> 8;
    this[offset] = value & 255;
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4;
};
Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 4, 4294967295, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 255;
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4;
};
Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength2 - 1);
    checkInt(this, value, offset, byteLength2, limit - 1, -limit);
  }
  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 255;
  while (++i < byteLength2 && (mul *= 256)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = (value / mul >> 0) - sub & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength2 - 1);
    checkInt(this, value, offset, byteLength2, limit - 1, -limit);
  }
  var i = byteLength2 - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 255;
  while (--i >= 0 && (mul *= 256)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = (value / mul >> 0) - sub & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 1, 127, -128);
  if (!Buffer.TYPED_ARRAY_SUPPORT)
    value = Math.floor(value);
  if (value < 0)
    value = 255 + value + 1;
  this[offset] = value & 255;
  return offset + 1;
};
Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 2, 32767, -32768);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 255;
    this[offset + 1] = value >>> 8;
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2;
};
Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 2, 32767, -32768);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8;
    this[offset + 1] = value & 255;
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2;
};
Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 4, 2147483647, -2147483648);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 255;
    this[offset + 1] = value >>> 8;
    this[offset + 2] = value >>> 16;
    this[offset + 3] = value >>> 24;
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4;
};
Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 4, 2147483647, -2147483648);
  if (value < 0)
    value = 4294967295 + value + 1;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 255;
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4;
};
function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length)
    throw new RangeError("Index out of range");
  if (offset < 0)
    throw new RangeError("Index out of range");
}
function writeFloat(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4;
}
Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert);
};
Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert);
};
function writeDouble(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8;
}
Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert);
};
Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert);
};
Buffer.prototype.copy = function copy(target, targetStart, start, end) {
  if (!start)
    start = 0;
  if (!end && end !== 0)
    end = this.length;
  if (targetStart >= target.length)
    targetStart = target.length;
  if (!targetStart)
    targetStart = 0;
  if (end > 0 && end < start)
    end = start;
  if (end === start)
    return 0;
  if (target.length === 0 || this.length === 0)
    return 0;
  if (targetStart < 0) {
    throw new RangeError("targetStart out of bounds");
  }
  if (start < 0 || start >= this.length)
    throw new RangeError("sourceStart out of bounds");
  if (end < 0)
    throw new RangeError("sourceEnd out of bounds");
  if (end > this.length)
    end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }
  var len = end - start;
  var i;
  if (this === target && start < targetStart && targetStart < end) {
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1e3 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(target, this.subarray(start, start + len), targetStart);
  }
  return len;
};
Buffer.prototype.fill = function fill(val, start, end, encoding) {
  if (typeof val === "string") {
    if (typeof start === "string") {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === "string") {
      encoding = end;
      end = this.length;
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0);
      if (code < 256) {
        val = code;
      }
    }
    if (encoding !== void 0 && typeof encoding !== "string") {
      throw new TypeError("encoding must be a string");
    }
    if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
      throw new TypeError("Unknown encoding: " + encoding);
    }
  } else if (typeof val === "number") {
    val = val & 255;
  }
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError("Out of range index");
  }
  if (end <= start) {
    return this;
  }
  start = start >>> 0;
  end = end === void 0 ? this.length : end >>> 0;
  if (!val)
    val = 0;
  var i;
  if (typeof val === "number") {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    var bytes = internalIsBuffer(val) ? val : utf8ToBytes(new Buffer(val, encoding).toString());
    var len = bytes.length;
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }
  return this;
};
var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;
function base64clean(str) {
  str = stringtrim(str).replace(INVALID_BASE64_RE, "");
  if (str.length < 2)
    return "";
  while (str.length % 4 !== 0) {
    str = str + "=";
  }
  return str;
}
function stringtrim(str) {
  if (str.trim)
    return str.trim();
  return str.replace(/^\s+|\s+$/g, "");
}
function toHex(n) {
  if (n < 16)
    return "0" + n.toString(16);
  return n.toString(16);
}
function utf8ToBytes(string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];
  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);
    if (codePoint > 55295 && codePoint < 57344) {
      if (!leadSurrogate) {
        if (codePoint > 56319) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          continue;
        } else if (i + 1 === length) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          continue;
        }
        leadSurrogate = codePoint;
        continue;
      }
      if (codePoint < 56320) {
        if ((units -= 3) > -1)
          bytes.push(239, 191, 189);
        leadSurrogate = codePoint;
        continue;
      }
      codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
    } else if (leadSurrogate) {
      if ((units -= 3) > -1)
        bytes.push(239, 191, 189);
    }
    leadSurrogate = null;
    if (codePoint < 128) {
      if ((units -= 1) < 0)
        break;
      bytes.push(codePoint);
    } else if (codePoint < 2048) {
      if ((units -= 2) < 0)
        break;
      bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128);
    } else if (codePoint < 65536) {
      if ((units -= 3) < 0)
        break;
      bytes.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else if (codePoint < 1114112) {
      if ((units -= 4) < 0)
        break;
      bytes.push(codePoint >> 18 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else {
      throw new Error("Invalid code point");
    }
  }
  return bytes;
}
function asciiToBytes(str) {
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    byteArray.push(str.charCodeAt(i) & 255);
  }
  return byteArray;
}
function utf16leToBytes(str, units) {
  var c, hi, lo;
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0)
      break;
    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }
  return byteArray;
}
function base64ToBytes(str) {
  return toByteArray(base64clean(str));
}
function blitBuffer(src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length)
      break;
    dst[i + offset] = src[i];
  }
  return i;
}
function isnan(val) {
  return val !== val;
}
function isBuffer(obj) {
  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj));
}
function isFastBuffer(obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj);
}
function isSlowBuffer(obj) {
  return typeof obj.readFloatLE === "function" && typeof obj.slice === "function" && isFastBuffer(obj.slice(0, 0));
}
var RPC = "rpc";
var UPLOAD = "upload";
var DOWNLOAD = "download";
var APP_AUTH = "app";
var USER_AUTH = "user";
var TEAM_AUTH = "team";
var NO_AUTH = "noauth";
var DEFAULT_API_DOMAIN = "dropboxapi.com";
var DEFAULT_DOMAIN = "dropbox.com";
var TEST_DOMAIN_MAPPINGS = {
  api: "api",
  notify: "bolt",
  content: "api-content"
};
var routes = {};
routes.accountSetProfilePhoto = function(arg) {
  return this.request("account/set_profile_photo", arg, "user", "api", "rpc");
};
routes.authTokenFromOauth1 = function(arg) {
  return this.request("auth/token/from_oauth1", arg, "app", "api", "rpc");
};
routes.authTokenRevoke = function() {
  return this.request("auth/token/revoke", null, "user", "api", "rpc");
};
routes.checkApp = function(arg) {
  return this.request("check/app", arg, "app", "api", "rpc");
};
routes.checkUser = function(arg) {
  return this.request("check/user", arg, "user", "api", "rpc");
};
routes.contactsDeleteManualContacts = function() {
  return this.request("contacts/delete_manual_contacts", null, "user", "api", "rpc");
};
routes.contactsDeleteManualContactsBatch = function(arg) {
  return this.request("contacts/delete_manual_contacts_batch", arg, "user", "api", "rpc");
};
routes.filePropertiesPropertiesAdd = function(arg) {
  return this.request("file_properties/properties/add", arg, "user", "api", "rpc");
};
routes.filePropertiesPropertiesOverwrite = function(arg) {
  return this.request("file_properties/properties/overwrite", arg, "user", "api", "rpc");
};
routes.filePropertiesPropertiesRemove = function(arg) {
  return this.request("file_properties/properties/remove", arg, "user", "api", "rpc");
};
routes.filePropertiesPropertiesSearch = function(arg) {
  return this.request("file_properties/properties/search", arg, "user", "api", "rpc");
};
routes.filePropertiesPropertiesSearchContinue = function(arg) {
  return this.request("file_properties/properties/search/continue", arg, "user", "api", "rpc");
};
routes.filePropertiesPropertiesUpdate = function(arg) {
  return this.request("file_properties/properties/update", arg, "user", "api", "rpc");
};
routes.filePropertiesTemplatesAddForTeam = function(arg) {
  return this.request("file_properties/templates/add_for_team", arg, "team", "api", "rpc");
};
routes.filePropertiesTemplatesAddForUser = function(arg) {
  return this.request("file_properties/templates/add_for_user", arg, "user", "api", "rpc");
};
routes.filePropertiesTemplatesGetForTeam = function(arg) {
  return this.request("file_properties/templates/get_for_team", arg, "team", "api", "rpc");
};
routes.filePropertiesTemplatesGetForUser = function(arg) {
  return this.request("file_properties/templates/get_for_user", arg, "user", "api", "rpc");
};
routes.filePropertiesTemplatesListForTeam = function() {
  return this.request("file_properties/templates/list_for_team", null, "team", "api", "rpc");
};
routes.filePropertiesTemplatesListForUser = function() {
  return this.request("file_properties/templates/list_for_user", null, "user", "api", "rpc");
};
routes.filePropertiesTemplatesRemoveForTeam = function(arg) {
  return this.request("file_properties/templates/remove_for_team", arg, "team", "api", "rpc");
};
routes.filePropertiesTemplatesRemoveForUser = function(arg) {
  return this.request("file_properties/templates/remove_for_user", arg, "user", "api", "rpc");
};
routes.filePropertiesTemplatesUpdateForTeam = function(arg) {
  return this.request("file_properties/templates/update_for_team", arg, "team", "api", "rpc");
};
routes.filePropertiesTemplatesUpdateForUser = function(arg) {
  return this.request("file_properties/templates/update_for_user", arg, "user", "api", "rpc");
};
routes.fileRequestsCount = function() {
  return this.request("file_requests/count", null, "user", "api", "rpc");
};
routes.fileRequestsCreate = function(arg) {
  return this.request("file_requests/create", arg, "user", "api", "rpc");
};
routes.fileRequestsDelete = function(arg) {
  return this.request("file_requests/delete", arg, "user", "api", "rpc");
};
routes.fileRequestsDeleteAllClosed = function() {
  return this.request("file_requests/delete_all_closed", null, "user", "api", "rpc");
};
routes.fileRequestsGet = function(arg) {
  return this.request("file_requests/get", arg, "user", "api", "rpc");
};
routes.fileRequestsListV2 = function(arg) {
  return this.request("file_requests/list_v2", arg, "user", "api", "rpc");
};
routes.fileRequestsList = function() {
  return this.request("file_requests/list", null, "user", "api", "rpc");
};
routes.fileRequestsListContinue = function(arg) {
  return this.request("file_requests/list/continue", arg, "user", "api", "rpc");
};
routes.fileRequestsUpdate = function(arg) {
  return this.request("file_requests/update", arg, "user", "api", "rpc");
};
routes.filesAlphaGetMetadata = function(arg) {
  return this.request("files/alpha/get_metadata", arg, "user", "api", "rpc");
};
routes.filesAlphaUpload = function(arg) {
  return this.request("files/alpha/upload", arg, "user", "content", "upload");
};
routes.filesCopyV2 = function(arg) {
  return this.request("files/copy_v2", arg, "user", "api", "rpc");
};
routes.filesCopy = function(arg) {
  return this.request("files/copy", arg, "user", "api", "rpc");
};
routes.filesCopyBatchV2 = function(arg) {
  return this.request("files/copy_batch_v2", arg, "user", "api", "rpc");
};
routes.filesCopyBatch = function(arg) {
  return this.request("files/copy_batch", arg, "user", "api", "rpc");
};
routes.filesCopyBatchCheckV2 = function(arg) {
  return this.request("files/copy_batch/check_v2", arg, "user", "api", "rpc");
};
routes.filesCopyBatchCheck = function(arg) {
  return this.request("files/copy_batch/check", arg, "user", "api", "rpc");
};
routes.filesCopyReferenceGet = function(arg) {
  return this.request("files/copy_reference/get", arg, "user", "api", "rpc");
};
routes.filesCopyReferenceSave = function(arg) {
  return this.request("files/copy_reference/save", arg, "user", "api", "rpc");
};
routes.filesCreateFolderV2 = function(arg) {
  return this.request("files/create_folder_v2", arg, "user", "api", "rpc");
};
routes.filesCreateFolder = function(arg) {
  return this.request("files/create_folder", arg, "user", "api", "rpc");
};
routes.filesCreateFolderBatch = function(arg) {
  return this.request("files/create_folder_batch", arg, "user", "api", "rpc");
};
routes.filesCreateFolderBatchCheck = function(arg) {
  return this.request("files/create_folder_batch/check", arg, "user", "api", "rpc");
};
routes.filesDeleteV2 = function(arg) {
  return this.request("files/delete_v2", arg, "user", "api", "rpc");
};
routes.filesDelete = function(arg) {
  return this.request("files/delete", arg, "user", "api", "rpc");
};
routes.filesDeleteBatch = function(arg) {
  return this.request("files/delete_batch", arg, "user", "api", "rpc");
};
routes.filesDeleteBatchCheck = function(arg) {
  return this.request("files/delete_batch/check", arg, "user", "api", "rpc");
};
routes.filesDownload = function(arg) {
  return this.request("files/download", arg, "user", "content", "download");
};
routes.filesDownloadZip = function(arg) {
  return this.request("files/download_zip", arg, "user", "content", "download");
};
routes.filesExport = function(arg) {
  return this.request("files/export", arg, "user", "content", "download");
};
routes.filesGetFileLockBatch = function(arg) {
  return this.request("files/get_file_lock_batch", arg, "user", "api", "rpc");
};
routes.filesGetMetadata = function(arg) {
  return this.request("files/get_metadata", arg, "user", "api", "rpc");
};
routes.filesGetPreview = function(arg) {
  return this.request("files/get_preview", arg, "user", "content", "download");
};
routes.filesGetTemporaryLink = function(arg) {
  return this.request("files/get_temporary_link", arg, "user", "api", "rpc");
};
routes.filesGetTemporaryUploadLink = function(arg) {
  return this.request("files/get_temporary_upload_link", arg, "user", "api", "rpc");
};
routes.filesGetThumbnail = function(arg) {
  return this.request("files/get_thumbnail", arg, "user", "content", "download");
};
routes.filesGetThumbnailV2 = function(arg) {
  return this.request("files/get_thumbnail_v2", arg, "app, user", "content", "download");
};
routes.filesGetThumbnailBatch = function(arg) {
  return this.request("files/get_thumbnail_batch", arg, "user", "content", "rpc");
};
routes.filesListFolder = function(arg) {
  return this.request("files/list_folder", arg, "user", "api", "rpc");
};
routes.filesListFolderContinue = function(arg) {
  return this.request("files/list_folder/continue", arg, "user", "api", "rpc");
};
routes.filesListFolderGetLatestCursor = function(arg) {
  return this.request("files/list_folder/get_latest_cursor", arg, "user", "api", "rpc");
};
routes.filesListFolderLongpoll = function(arg) {
  return this.request("files/list_folder/longpoll", arg, "noauth", "notify", "rpc");
};
routes.filesListRevisions = function(arg) {
  return this.request("files/list_revisions", arg, "user", "api", "rpc");
};
routes.filesLockFileBatch = function(arg) {
  return this.request("files/lock_file_batch", arg, "user", "api", "rpc");
};
routes.filesMoveV2 = function(arg) {
  return this.request("files/move_v2", arg, "user", "api", "rpc");
};
routes.filesMove = function(arg) {
  return this.request("files/move", arg, "user", "api", "rpc");
};
routes.filesMoveBatchV2 = function(arg) {
  return this.request("files/move_batch_v2", arg, "user", "api", "rpc");
};
routes.filesMoveBatch = function(arg) {
  return this.request("files/move_batch", arg, "user", "api", "rpc");
};
routes.filesMoveBatchCheckV2 = function(arg) {
  return this.request("files/move_batch/check_v2", arg, "user", "api", "rpc");
};
routes.filesMoveBatchCheck = function(arg) {
  return this.request("files/move_batch/check", arg, "user", "api", "rpc");
};
routes.filesPaperCreate = function(arg) {
  return this.request("files/paper/create", arg, "user", "api", "upload");
};
routes.filesPaperUpdate = function(arg) {
  return this.request("files/paper/update", arg, "user", "api", "upload");
};
routes.filesPermanentlyDelete = function(arg) {
  return this.request("files/permanently_delete", arg, "user", "api", "rpc");
};
routes.filesPropertiesAdd = function(arg) {
  return this.request("files/properties/add", arg, "user", "api", "rpc");
};
routes.filesPropertiesOverwrite = function(arg) {
  return this.request("files/properties/overwrite", arg, "user", "api", "rpc");
};
routes.filesPropertiesRemove = function(arg) {
  return this.request("files/properties/remove", arg, "user", "api", "rpc");
};
routes.filesPropertiesTemplateGet = function(arg) {
  return this.request("files/properties/template/get", arg, "user", "api", "rpc");
};
routes.filesPropertiesTemplateList = function() {
  return this.request("files/properties/template/list", null, "user", "api", "rpc");
};
routes.filesPropertiesUpdate = function(arg) {
  return this.request("files/properties/update", arg, "user", "api", "rpc");
};
routes.filesRestore = function(arg) {
  return this.request("files/restore", arg, "user", "api", "rpc");
};
routes.filesSaveUrl = function(arg) {
  return this.request("files/save_url", arg, "user", "api", "rpc");
};
routes.filesSaveUrlCheckJobStatus = function(arg) {
  return this.request("files/save_url/check_job_status", arg, "user", "api", "rpc");
};
routes.filesSearch = function(arg) {
  return this.request("files/search", arg, "user", "api", "rpc");
};
routes.filesSearchV2 = function(arg) {
  return this.request("files/search_v2", arg, "user", "api", "rpc");
};
routes.filesSearchContinueV2 = function(arg) {
  return this.request("files/search/continue_v2", arg, "user", "api", "rpc");
};
routes.filesUnlockFileBatch = function(arg) {
  return this.request("files/unlock_file_batch", arg, "user", "api", "rpc");
};
routes.filesUpload = function(arg) {
  return this.request("files/upload", arg, "user", "content", "upload");
};
routes.filesUploadSessionAppendV2 = function(arg) {
  return this.request("files/upload_session/append_v2", arg, "user", "content", "upload");
};
routes.filesUploadSessionAppend = function(arg) {
  return this.request("files/upload_session/append", arg, "user", "content", "upload");
};
routes.filesUploadSessionFinish = function(arg) {
  return this.request("files/upload_session/finish", arg, "user", "content", "upload");
};
routes.filesUploadSessionFinishBatch = function(arg) {
  return this.request("files/upload_session/finish_batch", arg, "user", "api", "rpc");
};
routes.filesUploadSessionFinishBatchCheck = function(arg) {
  return this.request("files/upload_session/finish_batch/check", arg, "user", "api", "rpc");
};
routes.filesUploadSessionStart = function(arg) {
  return this.request("files/upload_session/start", arg, "user", "content", "upload");
};
routes.paperDocsArchive = function(arg) {
  return this.request("paper/docs/archive", arg, "user", "api", "rpc");
};
routes.paperDocsCreate = function(arg) {
  return this.request("paper/docs/create", arg, "user", "api", "upload");
};
routes.paperDocsDownload = function(arg) {
  return this.request("paper/docs/download", arg, "user", "api", "download");
};
routes.paperDocsFolderUsersList = function(arg) {
  return this.request("paper/docs/folder_users/list", arg, "user", "api", "rpc");
};
routes.paperDocsFolderUsersListContinue = function(arg) {
  return this.request("paper/docs/folder_users/list/continue", arg, "user", "api", "rpc");
};
routes.paperDocsGetFolderInfo = function(arg) {
  return this.request("paper/docs/get_folder_info", arg, "user", "api", "rpc");
};
routes.paperDocsList = function(arg) {
  return this.request("paper/docs/list", arg, "user", "api", "rpc");
};
routes.paperDocsListContinue = function(arg) {
  return this.request("paper/docs/list/continue", arg, "user", "api", "rpc");
};
routes.paperDocsPermanentlyDelete = function(arg) {
  return this.request("paper/docs/permanently_delete", arg, "user", "api", "rpc");
};
routes.paperDocsSharingPolicyGet = function(arg) {
  return this.request("paper/docs/sharing_policy/get", arg, "user", "api", "rpc");
};
routes.paperDocsSharingPolicySet = function(arg) {
  return this.request("paper/docs/sharing_policy/set", arg, "user", "api", "rpc");
};
routes.paperDocsUpdate = function(arg) {
  return this.request("paper/docs/update", arg, "user", "api", "upload");
};
routes.paperDocsUsersAdd = function(arg) {
  return this.request("paper/docs/users/add", arg, "user", "api", "rpc");
};
routes.paperDocsUsersList = function(arg) {
  return this.request("paper/docs/users/list", arg, "user", "api", "rpc");
};
routes.paperDocsUsersListContinue = function(arg) {
  return this.request("paper/docs/users/list/continue", arg, "user", "api", "rpc");
};
routes.paperDocsUsersRemove = function(arg) {
  return this.request("paper/docs/users/remove", arg, "user", "api", "rpc");
};
routes.paperFoldersCreate = function(arg) {
  return this.request("paper/folders/create", arg, "user", "api", "rpc");
};
routes.sharingAddFileMember = function(arg) {
  return this.request("sharing/add_file_member", arg, "user", "api", "rpc");
};
routes.sharingAddFolderMember = function(arg) {
  return this.request("sharing/add_folder_member", arg, "user", "api", "rpc");
};
routes.sharingChangeFileMemberAccess = function(arg) {
  return this.request("sharing/change_file_member_access", arg, "user", "api", "rpc");
};
routes.sharingCheckJobStatus = function(arg) {
  return this.request("sharing/check_job_status", arg, "user", "api", "rpc");
};
routes.sharingCheckRemoveMemberJobStatus = function(arg) {
  return this.request("sharing/check_remove_member_job_status", arg, "user", "api", "rpc");
};
routes.sharingCheckShareJobStatus = function(arg) {
  return this.request("sharing/check_share_job_status", arg, "user", "api", "rpc");
};
routes.sharingCreateSharedLink = function(arg) {
  return this.request("sharing/create_shared_link", arg, "user", "api", "rpc");
};
routes.sharingCreateSharedLinkWithSettings = function(arg) {
  return this.request("sharing/create_shared_link_with_settings", arg, "user", "api", "rpc");
};
routes.sharingGetFileMetadata = function(arg) {
  return this.request("sharing/get_file_metadata", arg, "user", "api", "rpc");
};
routes.sharingGetFileMetadataBatch = function(arg) {
  return this.request("sharing/get_file_metadata/batch", arg, "user", "api", "rpc");
};
routes.sharingGetFolderMetadata = function(arg) {
  return this.request("sharing/get_folder_metadata", arg, "user", "api", "rpc");
};
routes.sharingGetSharedLinkFile = function(arg) {
  return this.request("sharing/get_shared_link_file", arg, "user", "content", "download");
};
routes.sharingGetSharedLinkMetadata = function(arg) {
  return this.request("sharing/get_shared_link_metadata", arg, "user", "api", "rpc");
};
routes.sharingGetSharedLinks = function(arg) {
  return this.request("sharing/get_shared_links", arg, "user", "api", "rpc");
};
routes.sharingListFileMembers = function(arg) {
  return this.request("sharing/list_file_members", arg, "user", "api", "rpc");
};
routes.sharingListFileMembersBatch = function(arg) {
  return this.request("sharing/list_file_members/batch", arg, "user", "api", "rpc");
};
routes.sharingListFileMembersContinue = function(arg) {
  return this.request("sharing/list_file_members/continue", arg, "user", "api", "rpc");
};
routes.sharingListFolderMembers = function(arg) {
  return this.request("sharing/list_folder_members", arg, "user", "api", "rpc");
};
routes.sharingListFolderMembersContinue = function(arg) {
  return this.request("sharing/list_folder_members/continue", arg, "user", "api", "rpc");
};
routes.sharingListFolders = function(arg) {
  return this.request("sharing/list_folders", arg, "user", "api", "rpc");
};
routes.sharingListFoldersContinue = function(arg) {
  return this.request("sharing/list_folders/continue", arg, "user", "api", "rpc");
};
routes.sharingListMountableFolders = function(arg) {
  return this.request("sharing/list_mountable_folders", arg, "user", "api", "rpc");
};
routes.sharingListMountableFoldersContinue = function(arg) {
  return this.request("sharing/list_mountable_folders/continue", arg, "user", "api", "rpc");
};
routes.sharingListReceivedFiles = function(arg) {
  return this.request("sharing/list_received_files", arg, "user", "api", "rpc");
};
routes.sharingListReceivedFilesContinue = function(arg) {
  return this.request("sharing/list_received_files/continue", arg, "user", "api", "rpc");
};
routes.sharingListSharedLinks = function(arg) {
  return this.request("sharing/list_shared_links", arg, "user", "api", "rpc");
};
routes.sharingModifySharedLinkSettings = function(arg) {
  return this.request("sharing/modify_shared_link_settings", arg, "user", "api", "rpc");
};
routes.sharingMountFolder = function(arg) {
  return this.request("sharing/mount_folder", arg, "user", "api", "rpc");
};
routes.sharingRelinquishFileMembership = function(arg) {
  return this.request("sharing/relinquish_file_membership", arg, "user", "api", "rpc");
};
routes.sharingRelinquishFolderMembership = function(arg) {
  return this.request("sharing/relinquish_folder_membership", arg, "user", "api", "rpc");
};
routes.sharingRemoveFileMember = function(arg) {
  return this.request("sharing/remove_file_member", arg, "user", "api", "rpc");
};
routes.sharingRemoveFileMember2 = function(arg) {
  return this.request("sharing/remove_file_member_2", arg, "user", "api", "rpc");
};
routes.sharingRemoveFolderMember = function(arg) {
  return this.request("sharing/remove_folder_member", arg, "user", "api", "rpc");
};
routes.sharingRevokeSharedLink = function(arg) {
  return this.request("sharing/revoke_shared_link", arg, "user", "api", "rpc");
};
routes.sharingSetAccessInheritance = function(arg) {
  return this.request("sharing/set_access_inheritance", arg, "user", "api", "rpc");
};
routes.sharingShareFolder = function(arg) {
  return this.request("sharing/share_folder", arg, "user", "api", "rpc");
};
routes.sharingTransferFolder = function(arg) {
  return this.request("sharing/transfer_folder", arg, "user", "api", "rpc");
};
routes.sharingUnmountFolder = function(arg) {
  return this.request("sharing/unmount_folder", arg, "user", "api", "rpc");
};
routes.sharingUnshareFile = function(arg) {
  return this.request("sharing/unshare_file", arg, "user", "api", "rpc");
};
routes.sharingUnshareFolder = function(arg) {
  return this.request("sharing/unshare_folder", arg, "user", "api", "rpc");
};
routes.sharingUpdateFileMember = function(arg) {
  return this.request("sharing/update_file_member", arg, "user", "api", "rpc");
};
routes.sharingUpdateFolderMember = function(arg) {
  return this.request("sharing/update_folder_member", arg, "user", "api", "rpc");
};
routes.sharingUpdateFolderPolicy = function(arg) {
  return this.request("sharing/update_folder_policy", arg, "user", "api", "rpc");
};
routes.teamDevicesListMemberDevices = function(arg) {
  return this.request("team/devices/list_member_devices", arg, "team", "api", "rpc");
};
routes.teamDevicesListMembersDevices = function(arg) {
  return this.request("team/devices/list_members_devices", arg, "team", "api", "rpc");
};
routes.teamDevicesListTeamDevices = function(arg) {
  return this.request("team/devices/list_team_devices", arg, "team", "api", "rpc");
};
routes.teamDevicesRevokeDeviceSession = function(arg) {
  return this.request("team/devices/revoke_device_session", arg, "team", "api", "rpc");
};
routes.teamDevicesRevokeDeviceSessionBatch = function(arg) {
  return this.request("team/devices/revoke_device_session_batch", arg, "team", "api", "rpc");
};
routes.teamFeaturesGetValues = function(arg) {
  return this.request("team/features/get_values", arg, "team", "api", "rpc");
};
routes.teamGetInfo = function() {
  return this.request("team/get_info", null, "team", "api", "rpc");
};
routes.teamGroupsCreate = function(arg) {
  return this.request("team/groups/create", arg, "team", "api", "rpc");
};
routes.teamGroupsDelete = function(arg) {
  return this.request("team/groups/delete", arg, "team", "api", "rpc");
};
routes.teamGroupsGetInfo = function(arg) {
  return this.request("team/groups/get_info", arg, "team", "api", "rpc");
};
routes.teamGroupsJobStatusGet = function(arg) {
  return this.request("team/groups/job_status/get", arg, "team", "api", "rpc");
};
routes.teamGroupsList = function(arg) {
  return this.request("team/groups/list", arg, "team", "api", "rpc");
};
routes.teamGroupsListContinue = function(arg) {
  return this.request("team/groups/list/continue", arg, "team", "api", "rpc");
};
routes.teamGroupsMembersAdd = function(arg) {
  return this.request("team/groups/members/add", arg, "team", "api", "rpc");
};
routes.teamGroupsMembersList = function(arg) {
  return this.request("team/groups/members/list", arg, "team", "api", "rpc");
};
routes.teamGroupsMembersListContinue = function(arg) {
  return this.request("team/groups/members/list/continue", arg, "team", "api", "rpc");
};
routes.teamGroupsMembersRemove = function(arg) {
  return this.request("team/groups/members/remove", arg, "team", "api", "rpc");
};
routes.teamGroupsMembersSetAccessType = function(arg) {
  return this.request("team/groups/members/set_access_type", arg, "team", "api", "rpc");
};
routes.teamGroupsUpdate = function(arg) {
  return this.request("team/groups/update", arg, "team", "api", "rpc");
};
routes.teamLegalHoldsCreatePolicy = function(arg) {
  return this.request("team/legal_holds/create_policy", arg, "team", "api", "rpc");
};
routes.teamLegalHoldsGetPolicy = function(arg) {
  return this.request("team/legal_holds/get_policy", arg, "team", "api", "rpc");
};
routes.teamLegalHoldsListHeldRevisions = function(arg) {
  return this.request("team/legal_holds/list_held_revisions", arg, "team", "api", "rpc");
};
routes.teamLegalHoldsListHeldRevisionsContinue = function(arg) {
  return this.request("team/legal_holds/list_held_revisions_continue", arg, "team", "api", "rpc");
};
routes.teamLegalHoldsListPolicies = function(arg) {
  return this.request("team/legal_holds/list_policies", arg, "team", "api", "rpc");
};
routes.teamLegalHoldsReleasePolicy = function(arg) {
  return this.request("team/legal_holds/release_policy", arg, "team", "api", "rpc");
};
routes.teamLegalHoldsUpdatePolicy = function(arg) {
  return this.request("team/legal_holds/update_policy", arg, "team", "api", "rpc");
};
routes.teamLinkedAppsListMemberLinkedApps = function(arg) {
  return this.request("team/linked_apps/list_member_linked_apps", arg, "team", "api", "rpc");
};
routes.teamLinkedAppsListMembersLinkedApps = function(arg) {
  return this.request("team/linked_apps/list_members_linked_apps", arg, "team", "api", "rpc");
};
routes.teamLinkedAppsListTeamLinkedApps = function(arg) {
  return this.request("team/linked_apps/list_team_linked_apps", arg, "team", "api", "rpc");
};
routes.teamLinkedAppsRevokeLinkedApp = function(arg) {
  return this.request("team/linked_apps/revoke_linked_app", arg, "team", "api", "rpc");
};
routes.teamLinkedAppsRevokeLinkedAppBatch = function(arg) {
  return this.request("team/linked_apps/revoke_linked_app_batch", arg, "team", "api", "rpc");
};
routes.teamMemberSpaceLimitsExcludedUsersAdd = function(arg) {
  return this.request("team/member_space_limits/excluded_users/add", arg, "team", "api", "rpc");
};
routes.teamMemberSpaceLimitsExcludedUsersList = function(arg) {
  return this.request("team/member_space_limits/excluded_users/list", arg, "team", "api", "rpc");
};
routes.teamMemberSpaceLimitsExcludedUsersListContinue = function(arg) {
  return this.request("team/member_space_limits/excluded_users/list/continue", arg, "team", "api", "rpc");
};
routes.teamMemberSpaceLimitsExcludedUsersRemove = function(arg) {
  return this.request("team/member_space_limits/excluded_users/remove", arg, "team", "api", "rpc");
};
routes.teamMemberSpaceLimitsGetCustomQuota = function(arg) {
  return this.request("team/member_space_limits/get_custom_quota", arg, "team", "api", "rpc");
};
routes.teamMemberSpaceLimitsRemoveCustomQuota = function(arg) {
  return this.request("team/member_space_limits/remove_custom_quota", arg, "team", "api", "rpc");
};
routes.teamMemberSpaceLimitsSetCustomQuota = function(arg) {
  return this.request("team/member_space_limits/set_custom_quota", arg, "team", "api", "rpc");
};
routes.teamMembersAddV2 = function(arg) {
  return this.request("team/members/add_v2", arg, "team", "api", "rpc");
};
routes.teamMembersAdd = function(arg) {
  return this.request("team/members/add", arg, "team", "api", "rpc");
};
routes.teamMembersAddJobStatusGetV2 = function(arg) {
  return this.request("team/members/add/job_status/get_v2", arg, "team", "api", "rpc");
};
routes.teamMembersAddJobStatusGet = function(arg) {
  return this.request("team/members/add/job_status/get", arg, "team", "api", "rpc");
};
routes.teamMembersDeleteProfilePhotoV2 = function(arg) {
  return this.request("team/members/delete_profile_photo_v2", arg, "team", "api", "rpc");
};
routes.teamMembersDeleteProfilePhoto = function(arg) {
  return this.request("team/members/delete_profile_photo", arg, "team", "api", "rpc");
};
routes.teamMembersGetAvailableTeamMemberRoles = function() {
  return this.request("team/members/get_available_team_member_roles", null, "team", "api", "rpc");
};
routes.teamMembersGetInfoV2 = function(arg) {
  return this.request("team/members/get_info_v2", arg, "team", "api", "rpc");
};
routes.teamMembersGetInfo = function(arg) {
  return this.request("team/members/get_info", arg, "team", "api", "rpc");
};
routes.teamMembersListV2 = function(arg) {
  return this.request("team/members/list_v2", arg, "team", "api", "rpc");
};
routes.teamMembersList = function(arg) {
  return this.request("team/members/list", arg, "team", "api", "rpc");
};
routes.teamMembersListContinueV2 = function(arg) {
  return this.request("team/members/list/continue_v2", arg, "team", "api", "rpc");
};
routes.teamMembersListContinue = function(arg) {
  return this.request("team/members/list/continue", arg, "team", "api", "rpc");
};
routes.teamMembersMoveFormerMemberFiles = function(arg) {
  return this.request("team/members/move_former_member_files", arg, "team", "api", "rpc");
};
routes.teamMembersMoveFormerMemberFilesJobStatusCheck = function(arg) {
  return this.request("team/members/move_former_member_files/job_status/check", arg, "team", "api", "rpc");
};
routes.teamMembersRecover = function(arg) {
  return this.request("team/members/recover", arg, "team", "api", "rpc");
};
routes.teamMembersRemove = function(arg) {
  return this.request("team/members/remove", arg, "team", "api", "rpc");
};
routes.teamMembersRemoveJobStatusGet = function(arg) {
  return this.request("team/members/remove/job_status/get", arg, "team", "api", "rpc");
};
routes.teamMembersSecondaryEmailsAdd = function(arg) {
  return this.request("team/members/secondary_emails/add", arg, "team", "api", "rpc");
};
routes.teamMembersSecondaryEmailsDelete = function(arg) {
  return this.request("team/members/secondary_emails/delete", arg, "team", "api", "rpc");
};
routes.teamMembersSecondaryEmailsResendVerificationEmails = function(arg) {
  return this.request("team/members/secondary_emails/resend_verification_emails", arg, "team", "api", "rpc");
};
routes.teamMembersSendWelcomeEmail = function(arg) {
  return this.request("team/members/send_welcome_email", arg, "team", "api", "rpc");
};
routes.teamMembersSetAdminPermissionsV2 = function(arg) {
  return this.request("team/members/set_admin_permissions_v2", arg, "team", "api", "rpc");
};
routes.teamMembersSetAdminPermissions = function(arg) {
  return this.request("team/members/set_admin_permissions", arg, "team", "api", "rpc");
};
routes.teamMembersSetProfileV2 = function(arg) {
  return this.request("team/members/set_profile_v2", arg, "team", "api", "rpc");
};
routes.teamMembersSetProfile = function(arg) {
  return this.request("team/members/set_profile", arg, "team", "api", "rpc");
};
routes.teamMembersSetProfilePhotoV2 = function(arg) {
  return this.request("team/members/set_profile_photo_v2", arg, "team", "api", "rpc");
};
routes.teamMembersSetProfilePhoto = function(arg) {
  return this.request("team/members/set_profile_photo", arg, "team", "api", "rpc");
};
routes.teamMembersSuspend = function(arg) {
  return this.request("team/members/suspend", arg, "team", "api", "rpc");
};
routes.teamMembersUnsuspend = function(arg) {
  return this.request("team/members/unsuspend", arg, "team", "api", "rpc");
};
routes.teamNamespacesList = function(arg) {
  return this.request("team/namespaces/list", arg, "team", "api", "rpc");
};
routes.teamNamespacesListContinue = function(arg) {
  return this.request("team/namespaces/list/continue", arg, "team", "api", "rpc");
};
routes.teamPropertiesTemplateAdd = function(arg) {
  return this.request("team/properties/template/add", arg, "team", "api", "rpc");
};
routes.teamPropertiesTemplateGet = function(arg) {
  return this.request("team/properties/template/get", arg, "team", "api", "rpc");
};
routes.teamPropertiesTemplateList = function() {
  return this.request("team/properties/template/list", null, "team", "api", "rpc");
};
routes.teamPropertiesTemplateUpdate = function(arg) {
  return this.request("team/properties/template/update", arg, "team", "api", "rpc");
};
routes.teamReportsGetActivity = function(arg) {
  return this.request("team/reports/get_activity", arg, "team", "api", "rpc");
};
routes.teamReportsGetDevices = function(arg) {
  return this.request("team/reports/get_devices", arg, "team", "api", "rpc");
};
routes.teamReportsGetMembership = function(arg) {
  return this.request("team/reports/get_membership", arg, "team", "api", "rpc");
};
routes.teamReportsGetStorage = function(arg) {
  return this.request("team/reports/get_storage", arg, "team", "api", "rpc");
};
routes.teamTeamFolderActivate = function(arg) {
  return this.request("team/team_folder/activate", arg, "team", "api", "rpc");
};
routes.teamTeamFolderArchive = function(arg) {
  return this.request("team/team_folder/archive", arg, "team", "api", "rpc");
};
routes.teamTeamFolderArchiveCheck = function(arg) {
  return this.request("team/team_folder/archive/check", arg, "team", "api", "rpc");
};
routes.teamTeamFolderCreate = function(arg) {
  return this.request("team/team_folder/create", arg, "team", "api", "rpc");
};
routes.teamTeamFolderGetInfo = function(arg) {
  return this.request("team/team_folder/get_info", arg, "team", "api", "rpc");
};
routes.teamTeamFolderList = function(arg) {
  return this.request("team/team_folder/list", arg, "team", "api", "rpc");
};
routes.teamTeamFolderListContinue = function(arg) {
  return this.request("team/team_folder/list/continue", arg, "team", "api", "rpc");
};
routes.teamTeamFolderPermanentlyDelete = function(arg) {
  return this.request("team/team_folder/permanently_delete", arg, "team", "api", "rpc");
};
routes.teamTeamFolderRename = function(arg) {
  return this.request("team/team_folder/rename", arg, "team", "api", "rpc");
};
routes.teamTeamFolderUpdateSyncSettings = function(arg) {
  return this.request("team/team_folder/update_sync_settings", arg, "team", "api", "rpc");
};
routes.teamTokenGetAuthenticatedAdmin = function() {
  return this.request("team/token/get_authenticated_admin", null, "team", "api", "rpc");
};
routes.teamLogGetEvents = function(arg) {
  return this.request("team_log/get_events", arg, "team", "api", "rpc");
};
routes.teamLogGetEventsContinue = function(arg) {
  return this.request("team_log/get_events/continue", arg, "team", "api", "rpc");
};
routes.usersFeaturesGetValues = function(arg) {
  return this.request("users/features/get_values", arg, "user", "api", "rpc");
};
routes.usersGetAccount = function(arg) {
  return this.request("users/get_account", arg, "user", "api", "rpc");
};
routes.usersGetAccountBatch = function(arg) {
  return this.request("users/get_account_batch", arg, "user", "api", "rpc");
};
routes.usersGetCurrentAccount = function() {
  return this.request("users/get_current_account", null, "user", "api", "rpc");
};
routes.usersGetSpaceUsage = function() {
  return this.request("users/get_space_usage", null, "user", "api", "rpc");
};
function getSafeUnicode(c) {
  var unicode = "000".concat(c.charCodeAt(0).toString(16)).slice(-4);
  return "\\u".concat(unicode);
}
var baseApiUrl = function baseApiUrl2(subdomain) {
  var domain = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : DEFAULT_API_DOMAIN;
  var domainDelimiter = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : ".";
  if (domain !== DEFAULT_API_DOMAIN && TEST_DOMAIN_MAPPINGS[subdomain] !== void 0) {
    subdomain = TEST_DOMAIN_MAPPINGS[subdomain];
    domainDelimiter = "-";
  }
  return "https://".concat(subdomain).concat(domainDelimiter).concat(domain, "/2/");
};
var OAuth2AuthorizationUrl = function OAuth2AuthorizationUrl2() {
  var domain = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : DEFAULT_DOMAIN;
  if (domain !== DEFAULT_DOMAIN) {
    domain = "meta-".concat(domain);
  }
  return "https://".concat(domain, "/oauth2/authorize");
};
var OAuth2TokenUrl = function OAuth2TokenUrl2() {
  var domain = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : DEFAULT_API_DOMAIN;
  var domainDelimiter = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : ".";
  var subdomain = "api";
  if (domain !== DEFAULT_API_DOMAIN) {
    subdomain = TEST_DOMAIN_MAPPINGS[subdomain];
    domainDelimiter = "-";
  }
  return "https://".concat(subdomain).concat(domainDelimiter).concat(domain, "/oauth2/token");
};
function httpHeaderSafeJson(args) {
  return JSON.stringify(args).replace(/[\u007f-\uffff]/g, getSafeUnicode);
}
function getTokenExpiresAtDate(expiresIn) {
  return new Date(Date.now() + expiresIn * 1e3);
}
function isWindowOrWorker() {
  return typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope || typeof module === "undefined" || typeof window !== "undefined";
}
function isBrowserEnv() {
  return typeof window !== "undefined";
}
function createBrowserSafeString(toBeConverted) {
  var convertedString = toBeConverted.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return convertedString;
}
function _typeof(obj) {
  "@babel/helpers - typeof";
  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function _typeof2(obj2) {
      return typeof obj2;
    };
  } else {
    _typeof = function _typeof2(obj2) {
      return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
    };
  }
  return _typeof(obj);
}
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {constructor: {value: subClass, writable: true, configurable: true}});
  if (superClass)
    _setPrototypeOf(subClass, superClass);
}
function _createSuper(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _possibleConstructorReturn(self2, call) {
  if (call && (_typeof(call) === "object" || typeof call === "function")) {
    return call;
  }
  return _assertThisInitialized(self2);
}
function _assertThisInitialized(self2) {
  if (self2 === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return self2;
}
function _wrapNativeSuper(Class) {
  var _cache = typeof Map === "function" ? new Map() : void 0;
  _wrapNativeSuper = function _wrapNativeSuper2(Class2) {
    if (Class2 === null || !_isNativeFunction(Class2))
      return Class2;
    if (typeof Class2 !== "function") {
      throw new TypeError("Super expression must either be null or a function");
    }
    if (typeof _cache !== "undefined") {
      if (_cache.has(Class2))
        return _cache.get(Class2);
      _cache.set(Class2, Wrapper);
    }
    function Wrapper() {
      return _construct(Class2, arguments, _getPrototypeOf(this).constructor);
    }
    Wrapper.prototype = Object.create(Class2.prototype, {constructor: {value: Wrapper, enumerable: false, writable: true, configurable: true}});
    return _setPrototypeOf(Wrapper, Class2);
  };
  return _wrapNativeSuper(Class);
}
function _construct(Parent, args, Class) {
  if (_isNativeReflectConstruct()) {
    _construct = Reflect.construct;
  } else {
    _construct = function _construct2(Parent2, args2, Class2) {
      var a = [null];
      a.push.apply(a, args2);
      var Constructor = Function.bind.apply(Parent2, a);
      var instance = new Constructor();
      if (Class2)
        _setPrototypeOf(instance, Class2.prototype);
      return instance;
    };
  }
  return _construct.apply(null, arguments);
}
function _isNativeReflectConstruct() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Date.prototype.toString.call(Reflect.construct(Date, [], function() {
    }));
    return true;
  } catch (e) {
    return false;
  }
}
function _isNativeFunction(fn) {
  return Function.toString.call(fn).indexOf("[native code]") !== -1;
}
function _setPrototypeOf(o, p) {
  _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf2(o2, p2) {
    o2.__proto__ = p2;
    return o2;
  };
  return _setPrototypeOf(o, p);
}
function _getPrototypeOf(o) {
  _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf2(o2) {
    return o2.__proto__ || Object.getPrototypeOf(o2);
  };
  return _getPrototypeOf(o);
}
var DropboxResponseError = /* @__PURE__ */ function(_Error) {
  _inherits(DropboxResponseError2, _Error);
  var _super = _createSuper(DropboxResponseError2);
  function DropboxResponseError2(status, headers, error) {
    var _this;
    _classCallCheck(this, DropboxResponseError2);
    _this = _super.call(this, "Response failed with a ".concat(status, " code"));
    _this.name = "DropboxResponseError";
    _this.status = status;
    _this.headers = headers;
    _this.error = error;
    return _this;
  }
  return DropboxResponseError2;
}(/* @__PURE__ */ _wrapNativeSuper(Error));
function _classCallCheck$1(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
var DropboxResponse = function DropboxResponse2(status, headers, result) {
  _classCallCheck$1(this, DropboxResponse2);
  this.status = status;
  this.headers = headers;
  this.result = result;
};
function throwAsError(res) {
  return res.text().then(function(data) {
    var errorObject;
    try {
      errorObject = JSON.parse(data);
    } catch (error) {
      errorObject = data;
    }
    throw new DropboxResponseError(res.status, res.headers, errorObject);
  });
}
function parseResponse(res) {
  if (!res.ok) {
    return throwAsError(res);
  }
  return res.text().then(function(data) {
    var responseObject;
    try {
      responseObject = JSON.parse(data);
    } catch (error) {
      responseObject = data;
    }
    return new DropboxResponse(res.status, res.headers, responseObject);
  });
}
function parseDownloadResponse(res) {
  if (!res.ok) {
    return throwAsError(res);
  }
  return new Promise(function(resolve) {
    if (isWindowOrWorker()) {
      res.blob().then(function(data) {
        return resolve(data);
      });
    } else {
      res.buffer().then(function(data) {
        return resolve(data);
      });
    }
  }).then(function(data) {
    var result = JSON.parse(res.headers.get("dropbox-api-result"));
    if (isWindowOrWorker()) {
      result.fileBlob = data;
    } else {
      result.fileBinary = data;
    }
    return new DropboxResponse(res.status, res.headers, result);
  });
}
function _classCallCheck$2(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor)
      descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}
function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps)
    _defineProperties(Constructor.prototype, protoProps);
  if (staticProps)
    _defineProperties(Constructor, staticProps);
  return Constructor;
}
var fetch;
if (isBrowserEnv()) {
  fetch = window.fetch.bind(window);
} else {
  fetch = require("node-fetch");
}
var crypto;
if (isBrowserEnv()) {
  crypto = window.crypto || window.msCrypto;
} else {
  crypto = require("crypto");
}
var Encoder;
if (typeof TextEncoder === "undefined") {
  Encoder = require("util").TextEncoder;
} else {
  Encoder = TextEncoder;
}
var TokenExpirationBuffer = 300 * 1e3;
var PKCELength = 128;
var TokenAccessTypes = ["legacy", "offline", "online"];
var GrantTypes = ["code", "token"];
var IncludeGrantedScopes = ["none", "user", "team"];
var DropboxAuth = /* @__PURE__ */ function() {
  function DropboxAuth2(options) {
    _classCallCheck$2(this, DropboxAuth2);
    options = options || {};
    this.fetch = options.fetch || fetch;
    this.accessToken = options.accessToken;
    this.accessTokenExpiresAt = options.accessTokenExpiresAt;
    this.refreshToken = options.refreshToken;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.domain = options.domain;
    this.domainDelimiter = options.domainDelimiter;
  }
  _createClass(DropboxAuth2, [{
    key: "setAccessToken",
    value: function setAccessToken(accessToken) {
      this.accessToken = accessToken;
    }
  }, {
    key: "getAccessToken",
    value: function getAccessToken() {
      return this.accessToken;
    }
  }, {
    key: "setClientId",
    value: function setClientId(clientId) {
      this.clientId = clientId;
    }
  }, {
    key: "getClientId",
    value: function getClientId() {
      return this.clientId;
    }
  }, {
    key: "setClientSecret",
    value: function setClientSecret(clientSecret) {
      this.clientSecret = clientSecret;
    }
  }, {
    key: "getClientSecret",
    value: function getClientSecret() {
      return this.clientSecret;
    }
  }, {
    key: "getRefreshToken",
    value: function getRefreshToken() {
      return this.refreshToken;
    }
  }, {
    key: "setRefreshToken",
    value: function setRefreshToken(refreshToken) {
      this.refreshToken = refreshToken;
    }
  }, {
    key: "getAccessTokenExpiresAt",
    value: function getAccessTokenExpiresAt() {
      return this.accessTokenExpiresAt;
    }
  }, {
    key: "setAccessTokenExpiresAt",
    value: function setAccessTokenExpiresAt(accessTokenExpiresAt) {
      this.accessTokenExpiresAt = accessTokenExpiresAt;
    }
  }, {
    key: "setCodeVerifier",
    value: function setCodeVerifier(codeVerifier) {
      this.codeVerifier = codeVerifier;
    }
  }, {
    key: "getCodeVerifier",
    value: function getCodeVerifier() {
      return this.codeVerifier;
    }
  }, {
    key: "generateCodeChallenge",
    value: function generateCodeChallenge() {
      var _this = this;
      var encoder = new Encoder();
      var codeData = encoder.encode(this.codeVerifier);
      var codeChallenge;
      if (isBrowserEnv()) {
        return crypto.subtle.digest("SHA-256", codeData).then(function(digestedHash2) {
          var base64String = btoa(String.fromCharCode.apply(null, new Uint8Array(digestedHash2)));
          codeChallenge = createBrowserSafeString(base64String).substr(0, 128);
          _this.codeChallenge = codeChallenge;
        });
      }
      var digestedHash = crypto.createHash("sha256").update(codeData).digest();
      codeChallenge = createBrowserSafeString(digestedHash);
      this.codeChallenge = codeChallenge;
      return Promise.resolve();
    }
  }, {
    key: "generatePKCECodes",
    value: function generatePKCECodes() {
      var codeVerifier;
      if (isBrowserEnv()) {
        var array = new Uint8Array(PKCELength);
        var randomValueArray = crypto.getRandomValues(array);
        var base64String = btoa(randomValueArray);
        codeVerifier = createBrowserSafeString(base64String).substr(0, 128);
      } else {
        var randomBytes = crypto.randomBytes(PKCELength);
        codeVerifier = createBrowserSafeString(randomBytes).substr(0, 128);
      }
      this.codeVerifier = codeVerifier;
      return this.generateCodeChallenge();
    }
  }, {
    key: "getAuthenticationUrl",
    value: function getAuthenticationUrl(redirectUri, state) {
      var _this2 = this;
      var authType = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "token";
      var tokenAccessType = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : null;
      var scope = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : null;
      var includeGrantedScopes = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : "none";
      var usePKCE = arguments.length > 6 && arguments[6] !== void 0 ? arguments[6] : false;
      var clientId = this.getClientId();
      var baseUrl = OAuth2AuthorizationUrl(this.domain);
      if (!clientId) {
        throw new Error("A client id is required. You can set the client id using .setClientId().");
      }
      if (authType !== "code" && !redirectUri) {
        throw new Error("A redirect uri is required.");
      }
      if (!GrantTypes.includes(authType)) {
        throw new Error("Authorization type must be code or token");
      }
      if (tokenAccessType && !TokenAccessTypes.includes(tokenAccessType)) {
        throw new Error("Token Access Type must be legacy, offline, or online");
      }
      if (scope && !(scope instanceof Array)) {
        throw new Error("Scope must be an array of strings");
      }
      if (!IncludeGrantedScopes.includes(includeGrantedScopes)) {
        throw new Error("includeGrantedScopes must be none, user, or team");
      }
      var authUrl;
      if (authType === "code") {
        authUrl = "".concat(baseUrl, "?response_type=code&client_id=").concat(clientId);
      } else {
        authUrl = "".concat(baseUrl, "?response_type=token&client_id=").concat(clientId);
      }
      if (redirectUri) {
        authUrl += "&redirect_uri=".concat(redirectUri);
      }
      if (state) {
        authUrl += "&state=".concat(state);
      }
      if (tokenAccessType) {
        authUrl += "&token_access_type=".concat(tokenAccessType);
      }
      if (scope) {
        authUrl += "&scope=".concat(scope.join(" "));
      }
      if (includeGrantedScopes !== "none") {
        authUrl += "&include_granted_scopes=".concat(includeGrantedScopes);
      }
      if (usePKCE) {
        return this.generatePKCECodes().then(function() {
          authUrl += "&code_challenge_method=S256";
          authUrl += "&code_challenge=".concat(_this2.codeChallenge);
          return authUrl;
        });
      }
      return Promise.resolve(authUrl);
    }
  }, {
    key: "getAccessTokenFromCode",
    value: function getAccessTokenFromCode(redirectUri, code) {
      var clientId = this.getClientId();
      var clientSecret = this.getClientSecret();
      if (!clientId) {
        throw new Error("A client id is required. You can set the client id using .setClientId().");
      }
      var path = OAuth2TokenUrl(this.domain, this.domainDelimiter);
      path += "?grant_type=authorization_code";
      path += "&code=".concat(code);
      path += "&client_id=".concat(clientId);
      if (clientSecret) {
        path += "&client_secret=".concat(clientSecret);
      } else {
        if (!this.codeVerifier) {
          throw new Error("You must use PKCE when generating the authorization URL to not include a client secret");
        }
        path += "&code_verifier=".concat(this.codeVerifier);
      }
      if (redirectUri) {
        path += "&redirect_uri=".concat(redirectUri);
      }
      var fetchOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      };
      return this.fetch(path, fetchOptions).then(function(res) {
        return parseResponse(res);
      });
    }
  }, {
    key: "checkAndRefreshAccessToken",
    value: function checkAndRefreshAccessToken() {
      var canRefresh = this.getRefreshToken() && this.getClientId();
      var needsRefresh = !this.getAccessTokenExpiresAt() || new Date(Date.now() + TokenExpirationBuffer) >= this.getAccessTokenExpiresAt();
      var needsToken = !this.getAccessToken();
      if ((needsRefresh || needsToken) && canRefresh) {
        return this.refreshAccessToken();
      }
      return Promise.resolve();
    }
  }, {
    key: "refreshAccessToken",
    value: function refreshAccessToken() {
      var _this3 = this;
      var scope = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : null;
      var refreshUrl = OAuth2TokenUrl(this.domain, this.domainDelimiter);
      var clientId = this.getClientId();
      var clientSecret = this.getClientSecret();
      if (!clientId) {
        throw new Error("A client id is required. You can set the client id using .setClientId().");
      }
      if (scope && !(scope instanceof Array)) {
        throw new Error("Scope must be an array of strings");
      }
      var headers = {};
      headers["Content-Type"] = "application/json";
      refreshUrl += "?grant_type=refresh_token&refresh_token=".concat(this.getRefreshToken());
      refreshUrl += "&client_id=".concat(clientId);
      if (clientSecret) {
        refreshUrl += "&client_secret=".concat(clientSecret);
      }
      if (scope) {
        refreshUrl += "&scope=".concat(scope.join(" "));
      }
      var fetchOptions = {
        method: "POST"
      };
      fetchOptions.headers = headers;
      return this.fetch(refreshUrl, fetchOptions).then(function(res) {
        return parseResponse(res);
      }).then(function(res) {
        _this3.setAccessToken(res.result.access_token);
        _this3.setAccessTokenExpiresAt(getTokenExpiresAtDate(res.result.expires_in));
      });
    }
  }]);
  return DropboxAuth2;
}();
function _classCallCheck$3(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function _defineProperties$1(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor)
      descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}
function _createClass$1(Constructor, protoProps, staticProps) {
  if (protoProps)
    _defineProperties$1(Constructor.prototype, protoProps);
  if (staticProps)
    _defineProperties$1(Constructor, staticProps);
  return Constructor;
}
var fetch$1;
if (typeof window !== "undefined") {
  fetch$1 = window.fetch.bind(window);
} else {
  fetch$1 = require("node-fetch");
}
var b64 = typeof btoa === "undefined" ? function(str) {
  return Buffer.from(str).toString("base64");
} : btoa;
var Dropbox = /* @__PURE__ */ function() {
  function Dropbox2(options) {
    _classCallCheck$3(this, Dropbox2);
    options = options || {};
    if (options.auth) {
      this.auth = options.auth;
    } else {
      this.auth = new DropboxAuth(options);
    }
    this.fetch = options.fetch || fetch$1;
    this.selectUser = options.selectUser;
    this.selectAdmin = options.selectAdmin;
    this.pathRoot = options.pathRoot;
    this.domain = options.domain;
    this.domainDelimiter = options.domainDelimiter;
    Object.assign(this, routes);
  }
  _createClass$1(Dropbox2, [{
    key: "request",
    value: function request(path, args, auth, host, style) {
      if (auth.split(",").length > 1) {
        var authTypes = auth.replace(" ", "").split(",");
        if (authTypes.includes(USER_AUTH) && this.auth.getAccessToken()) {
          auth = USER_AUTH;
        } else if (authTypes.includes(TEAM_AUTH) && this.auth.getAccessToken()) {
          auth = TEAM_AUTH;
        } else if (authTypes.includes(APP_AUTH)) {
          auth = APP_AUTH;
        }
      }
      switch (style) {
        case RPC:
          return this.rpcRequest(path, args, auth, host);
        case DOWNLOAD:
          return this.downloadRequest(path, args, auth, host);
        case UPLOAD:
          return this.uploadRequest(path, args, auth, host);
        default:
          throw new Error("Invalid request style: ".concat(style));
      }
    }
  }, {
    key: "rpcRequest",
    value: function rpcRequest(path, body, auth, host) {
      var _this = this;
      return this.auth.checkAndRefreshAccessToken().then(function() {
        var fetchOptions = {
          method: "POST",
          body: body ? JSON.stringify(body) : null,
          headers: {}
        };
        if (body) {
          fetchOptions.headers["Content-Type"] = "application/json";
        }
        var authHeader;
        switch (auth) {
          case APP_AUTH:
            if (!_this.auth.clientId || !_this.auth.clientSecret) {
              throw new Error("A client id and secret is required for this function");
            }
            authHeader = b64("".concat(_this.auth.clientId, ":").concat(_this.auth.clientSecret));
            fetchOptions.headers.Authorization = "Basic ".concat(authHeader);
            break;
          case TEAM_AUTH:
          case USER_AUTH:
            fetchOptions.headers.Authorization = "Bearer ".concat(_this.auth.getAccessToken());
            break;
          case NO_AUTH:
            break;
          default:
            throw new Error("Unhandled auth type: ".concat(auth));
        }
        _this.setCommonHeaders(fetchOptions);
        return fetchOptions;
      }).then(function(fetchOptions) {
        return _this.fetch(baseApiUrl(host, _this.domain, _this.domainDelimiter) + path, fetchOptions);
      }).then(function(res) {
        return parseResponse(res);
      });
    }
  }, {
    key: "downloadRequest",
    value: function downloadRequest(path, args, auth, host) {
      var _this2 = this;
      return this.auth.checkAndRefreshAccessToken().then(function() {
        if (auth !== USER_AUTH) {
          throw new Error("Unexpected auth type: ".concat(auth));
        }
        var fetchOptions = {
          method: "POST",
          headers: {
            Authorization: "Bearer ".concat(_this2.auth.getAccessToken()),
            "Dropbox-API-Arg": httpHeaderSafeJson(args)
          }
        };
        _this2.setCommonHeaders(fetchOptions);
        return fetchOptions;
      }).then(function(fetchOptions) {
        return _this2.fetch(baseApiUrl(host, _this2.domain, _this2.domainDelimiter) + path, fetchOptions);
      }).then(function(res) {
        return parseDownloadResponse(res);
      });
    }
  }, {
    key: "uploadRequest",
    value: function uploadRequest(path, args, auth, host) {
      var _this3 = this;
      return this.auth.checkAndRefreshAccessToken().then(function() {
        if (auth !== USER_AUTH) {
          throw new Error("Unexpected auth type: ".concat(auth));
        }
        var contents = args.contents;
        delete args.contents;
        var fetchOptions = {
          body: contents,
          method: "POST",
          headers: {
            Authorization: "Bearer ".concat(_this3.auth.getAccessToken()),
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": httpHeaderSafeJson(args)
          }
        };
        _this3.setCommonHeaders(fetchOptions);
        return fetchOptions;
      }).then(function(fetchOptions) {
        return _this3.fetch(baseApiUrl(host, _this3.domain, _this3.domainDelimiter) + path, fetchOptions);
      }).then(function(res) {
        return parseResponse(res);
      });
    }
  }, {
    key: "setCommonHeaders",
    value: function setCommonHeaders(options) {
      if (this.selectUser) {
        options.headers["Dropbox-API-Select-User"] = this.selectUser;
      }
      if (this.selectAdmin) {
        options.headers["Dropbox-API-Select-Admin"] = this.selectAdmin;
      }
      if (this.pathRoot) {
        options.headers["Dropbox-API-Path-Root"] = this.pathRoot;
      }
    }
  }]);
  return Dropbox2;
}();
export {Dropbox, DropboxAuth};
export default null;
