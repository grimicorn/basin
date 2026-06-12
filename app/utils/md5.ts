/**
 * Pure-JS MD5 implementation — used only to generate Gravatar URLs.
 * MD5 is not suitable for cryptographic security, but Gravatar requires it.
 *
 * Based on the reference algorithm by Paul Johnston (pajhome.org.uk/crypt/md5).
 */

function safeAdd(x: number, y: number): number {
  const lower = (x & 0xffff) + (y & 0xffff);
  const upper = (x >> 16) + (y >> 16) + (lower >> 16);
  return (upper << 16) | (lower & 0xffff);
}

function bitRotateLeft(num: number, count: number): number {
  return (num << count) | (num >>> (32 - count));
}

function md5cmn(
  q: number,
  a: number,
  b: number,
  x: number,
  shift: number,
  i: number,
): number {
  return safeAdd(
    bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, i)), shift),
    b,
  );
}

function md5ff(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  shift: number,
  i: number,
): number {
  return md5cmn((b & c) | (~b & d), a, b, x, shift, i);
}

function md5gg(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  shift: number,
  i: number,
): number {
  return md5cmn((b & d) | (c & ~d), a, b, x, shift, i);
}

function md5hh(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  shift: number,
  i: number,
): number {
  return md5cmn(b ^ c ^ d, a, b, x, shift, i);
}

function md5ii(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  shift: number,
  i: number,
): number {
  return md5cmn(c ^ (b | ~d), a, b, x, shift, i);
}

function stringToUint8Array(input: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(input);
}

function uint8ArrayToWords(bytes: Uint8Array): number[] {
  const words: number[] = new Array(Math.ceil(bytes.length / 4)).fill(0);
  for (let index = 0; index < bytes.length; index++) {
    words[index >> 2] |= bytes[index] << ((index % 4) * 8);
  }
  return words;
}

function padWords(words: number[], bytesLength: number): number[] {
  const padded = [...words];
  const byteIndex = bytesLength;
  const wordIndex = byteIndex >> 2;
  padded[wordIndex] |= 0x80 << ((byteIndex % 4) * 8);
  padded[14 + ((((bytesLength + 8) >> 6) + 1) * 16 - 16)] = bytesLength * 8;
  return padded;
}

function processChunk(
  chunk: number[],
  stateA: number,
  stateB: number,
  stateC: number,
  stateD: number,
): [number, number, number, number] {
  let a = stateA;
  let b = stateB;
  let c = stateC;
  let d = stateD;

  /* Round 1 */
  a = md5ff(a, b, c, d, chunk[0], 7, -680876936);
  d = md5ff(d, a, b, c, chunk[1], 12, -389564586);
  c = md5ff(c, d, a, b, chunk[2], 17, 606105819);
  b = md5ff(b, c, d, a, chunk[3], 22, -1044525330);
  a = md5ff(a, b, c, d, chunk[4], 7, -176418897);
  d = md5ff(d, a, b, c, chunk[5], 12, 1200080426);
  c = md5ff(c, d, a, b, chunk[6], 17, -1473231341);
  b = md5ff(b, c, d, a, chunk[7], 22, -45705983);
  a = md5ff(a, b, c, d, chunk[8], 7, 1770035416);
  d = md5ff(d, a, b, c, chunk[9], 12, -1958414417);
  c = md5ff(c, d, a, b, chunk[10], 17, -42063);
  b = md5ff(b, c, d, a, chunk[11], 22, -1990404162);
  a = md5ff(a, b, c, d, chunk[12], 7, 1804603682);
  d = md5ff(d, a, b, c, chunk[13], 12, -40341101);
  c = md5ff(c, d, a, b, chunk[14], 17, -1502002290);
  b = md5ff(b, c, d, a, chunk[15], 22, 1236535329);

  /* Round 2 */
  a = md5gg(a, b, c, d, chunk[1], 5, -165796510);
  d = md5gg(d, a, b, c, chunk[6], 9, -1069501632);
  c = md5gg(c, d, a, b, chunk[11], 14, 643717713);
  b = md5gg(b, c, d, a, chunk[0], 20, -373897302);
  a = md5gg(a, b, c, d, chunk[5], 5, -701558691);
  d = md5gg(d, a, b, c, chunk[10], 9, 38016083);
  c = md5gg(c, d, a, b, chunk[15], 14, -660478335);
  b = md5gg(b, c, d, a, chunk[4], 20, -405537848);
  a = md5gg(a, b, c, d, chunk[9], 5, 568446438);
  d = md5gg(d, a, b, c, chunk[14], 9, -1019803690);
  c = md5gg(c, d, a, b, chunk[3], 14, -187363961);
  b = md5gg(b, c, d, a, chunk[8], 20, 1163531501);
  a = md5gg(a, b, c, d, chunk[13], 5, -1444681467);
  d = md5gg(d, a, b, c, chunk[2], 9, -51403784);
  c = md5gg(c, d, a, b, chunk[7], 14, 1735328473);
  b = md5gg(b, c, d, a, chunk[12], 20, -1926607734);

  /* Round 3 */
  a = md5hh(a, b, c, d, chunk[5], 4, -378558);
  d = md5hh(d, a, b, c, chunk[8], 11, -2022574463);
  c = md5hh(c, d, a, b, chunk[11], 16, 1839030562);
  b = md5hh(b, c, d, a, chunk[14], 23, -35309556);
  a = md5hh(a, b, c, d, chunk[1], 4, -1530992060);
  d = md5hh(d, a, b, c, chunk[4], 11, 1272893353);
  c = md5hh(c, d, a, b, chunk[7], 16, -155497632);
  b = md5hh(b, c, d, a, chunk[10], 23, -1094730640);
  a = md5hh(a, b, c, d, chunk[13], 4, 681279174);
  d = md5hh(d, a, b, c, chunk[0], 11, -358537222);
  c = md5hh(c, d, a, b, chunk[3], 16, -722521979);
  b = md5hh(b, c, d, a, chunk[6], 23, 76029189);
  a = md5hh(a, b, c, d, chunk[9], 4, -640364487);
  d = md5hh(d, a, b, c, chunk[12], 11, -421815835);
  c = md5hh(c, d, a, b, chunk[15], 16, 530742520);
  b = md5hh(b, c, d, a, chunk[2], 23, -995338651);

  /* Round 4 */
  a = md5ii(a, b, c, d, chunk[0], 6, -198630844);
  d = md5ii(d, a, b, c, chunk[7], 10, 1126891415);
  c = md5ii(c, d, a, b, chunk[14], 15, -1416354905);
  b = md5ii(b, c, d, a, chunk[5], 21, -57434055);
  a = md5ii(a, b, c, d, chunk[12], 6, 1700485571);
  d = md5ii(d, a, b, c, chunk[3], 10, -1894986606);
  c = md5ii(c, d, a, b, chunk[10], 15, -1051523);
  b = md5ii(b, c, d, a, chunk[1], 21, -2054922799);
  a = md5ii(a, b, c, d, chunk[8], 6, 1873313359);
  d = md5ii(d, a, b, c, chunk[15], 10, -30611744);
  c = md5ii(c, d, a, b, chunk[6], 15, -1560198380);
  b = md5ii(b, c, d, a, chunk[13], 21, 1309151649);
  a = md5ii(a, b, c, d, chunk[4], 6, -145523070);
  d = md5ii(d, a, b, c, chunk[11], 10, -1120210379);
  c = md5ii(c, d, a, b, chunk[2], 15, 718787259);
  b = md5ii(b, c, d, a, chunk[9], 21, -343485551);

  return [
    safeAdd(a, stateA),
    safeAdd(b, stateB),
    safeAdd(c, stateC),
    safeAdd(d, stateD),
  ];
}

function wordsToHex(words: number[]): string {
  const hexChars = "0123456789abcdef";
  let result = "";
  for (const word of words) {
    for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
      const byte = (word >> (byteIndex * 8)) & 0xff;
      result += hexChars[(byte >> 4) & 0x0f] + hexChars[byte & 0x0f];
    }
  }
  return result;
}

/**
 * Compute the MD5 hash of a UTF-8 string and return it as a lowercase hex string.
 */
export function md5(input: string): string {
  const bytes = stringToUint8Array(input);
  const words = padWords(uint8ArrayToWords(bytes), bytes.length);

  let stateA = 1732584193;
  let stateB = -271733879;
  let stateC = -1732584194;
  let stateD = 271733878;

  for (let index = 0; index < words.length; index += 16) {
    const chunk = words.slice(index, index + 16);
    [stateA, stateB, stateC, stateD] = processChunk(
      chunk,
      stateA,
      stateB,
      stateC,
      stateD,
    );
  }

  return wordsToHex([stateA, stateB, stateC, stateD]);
}
