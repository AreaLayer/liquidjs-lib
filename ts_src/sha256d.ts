// SHA-256 (+ HMAC and PBKDF2) for JavaScript.
//
// Written in 2014-2016 by Dmitry Chestnykh.
// Public domain, no warranty.
//
// Functions (accept and return Uint8Arrays):
//
//   sha256(message) -> hash
//   sha256.hmac(key, message) -> mac
//   sha256.pbkdf2(password, salt, rounds, dkLen) -> dk
//
//  Classes:
//
//   new sha256.Hash()
//   new sha256.HMAC(key)
//
export const digestLength: number = 32;
export const blockSize: number = 64;

// SHA-256 constants
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function hashBlocks(
  w: Int32Array,
  v: Int32Array,
  p: Uint8Array,
  pos: number,
  len: number,
): number {
  let a: number;
  let b: number;
  let c: number;
  let d: number;
  let e: number;
  let f: number;
  let g: number;
  let h: number;
  let u: number;
  let i: number;
  let j: number;
  let t1: number;
  let t2: number;
  while (len >= 64) {
    a = v[0];
    b = v[1];
    c = v[2];
    d = v[3];
    e = v[4];
    f = v[5];
    g = v[6];
    h = v[7];

    for (i = 0; i < 16; i++) {
      j = pos + i * 4;
      w[i] =
        ((p[j] & 0xff) << 24) |
        ((p[j + 1] & 0xff) << 16) |
        ((p[j + 2] & 0xff) << 8) |
        (p[j + 3] & 0xff);
    }

    for (i = 16; i < 64; i++) {
      u = w[i - 2];
      t1 =
        ((u >>> 17) | (u << (32 - 17))) ^
        ((u >>> 19) | (u << (32 - 19))) ^
        (u >>> 10);

      u = w[i - 15];
      t2 =
        ((u >>> 7) | (u << (32 - 7))) ^
        ((u >>> 18) | (u << (32 - 18))) ^
        (u >>> 3);

      w[i] = ((t1 + w[i - 7]) | 0) + ((t2 + w[i - 16]) | 0);
    }

    for (i = 0; i < 64; i++) {
      t1 =
        ((((((e >>> 6) | (e << (32 - 6))) ^
          ((e >>> 11) | (e << (32 - 11))) ^
          ((e >>> 25) | (e << (32 - 25)))) +
          ((e & f) ^ (~e & g))) |
          0) +
          ((h + ((K[i] + w[i]) | 0)) | 0)) |
        0;

      t2 =
        ((((a >>> 2) | (a << (32 - 2))) ^
          ((a >>> 13) | (a << (32 - 13))) ^
          ((a >>> 22) | (a << (32 - 22)))) +
          ((a & b) ^ (a & c) ^ (b & c))) |
        0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }

    v[0] += a;
    v[1] += b;
    v[2] += c;
    v[3] += d;
    v[4] += e;
    v[5] += f;
    v[6] += g;
    v[7] += h;

    pos += 64;
    len -= 64;
  }
  return pos;
}

// Hash implements SHA256 hash algorithm.
export class Hash {
  digestLength: number = digestLength;
  blockSize: number = blockSize;

  finished: boolean = false; // indicates whether the hash was finalized

  // Note: Int32Array is used instead of Uint32Array for performance reasons.
  state: Int32Array = new Int32Array(8); // hash state
  private temp: Int32Array = new Int32Array(64); // temporary state
  private buffer: Uint8Array = new Uint8Array(128); // buffer for data to hash
  private bufferLength: number = 0; // number of bytes in buffer
  private bytesHashed: number = 0; // number of total bytes hashed

  constructor() {
    this.reset();
  }

  // Resets hash state making it possible
  // to re-use this instance to hash other data.
  reset(): this {
    this.state[0] = 0x6a09e667;
    this.state[1] = 0xbb67ae85;
    this.state[2] = 0x3c6ef372;
    this.state[3] = 0xa54ff53a;
    this.state[4] = 0x510e527f;
    this.state[5] = 0x9b05688c;
    this.state[6] = 0x1f83d9ab;
    this.state[7] = 0x5be0cd19;
    this.bufferLength = 0;
    this.bytesHashed = 0;
    this.finished = false;
    return this;
  }

  // Cleans internal buffers and re-initializes hash state.
  clean(): void {
    for (let i = 0; i < this.buffer.length; i++) {
      this.buffer[i] = 0;
    }
    for (let i = 0; i < this.temp.length; i++) {
      this.temp[i] = 0;
    }
    this.reset();
  }

  // Updates hash state with the given data.
  //
  // Optionally, length of the data can be specified to hash
  // fewer bytes than data.length.
  //
  // Throws error when trying to update already finalized hash:
  // instance must be reset to use it again.
  update(data: Uint8Array, dataLength: number = data.length): this {
    if (this.finished) {
      throw new Error("SHA256: can't update because hash was finished.");
    }
    let dataPos = 0;
    this.bytesHashed += dataLength;
    if (this.bufferLength > 0) {
      while (this.bufferLength < 64 && dataLength > 0) {
        this.buffer[this.bufferLength++] = data[dataPos++];
        dataLength--;
      }
      if (this.bufferLength === 64) {
        hashBlocks(this.temp, this.state, this.buffer, 0, 64);
        this.bufferLength = 0;
      }
    }
    if (dataLength >= 64) {
      dataPos = hashBlocks(this.temp, this.state, data, dataPos, dataLength);
      dataLength %= 64;
    }
    while (dataLength > 0) {
      this.buffer[this.bufferLength++] = data[dataPos++];
      dataLength--;
    }
    return this;
  }

  // Finalizes hash state and puts hash into out.
  //
  // If hash was already finalized, puts the same value.
  finish(out: Uint8Array): this {
    if (!this.finished) {
      const bytesHashed = this.bytesHashed;
      const left = this.bufferLength;
      const bitLenHi = (bytesHashed / 0x20000000) | 0;
      const bitLenLo = bytesHashed << 3;
      const padLength = bytesHashed % 64 < 56 ? 64 : 128;

      this.buffer[left] = 0x80;
      for (let i = left + 1; i < padLength - 8; i++) {
        this.buffer[i] = 0;
      }
      this.buffer[padLength - 8] = (bitLenHi >>> 24) & 0xff;
      this.buffer[padLength - 7] = (bitLenHi >>> 16) & 0xff;
      this.buffer[padLength - 6] = (bitLenHi >>> 8) & 0xff;
      this.buffer[padLength - 5] = (bitLenHi >>> 0) & 0xff;
      this.buffer[padLength - 4] = (bitLenLo >>> 24) & 0xff;
      this.buffer[padLength - 3] = (bitLenLo >>> 16) & 0xff;
      this.buffer[padLength - 2] = (bitLenLo >>> 8) & 0xff;
      this.buffer[padLength - 1] = (bitLenLo >>> 0) & 0xff;

      hashBlocks(this.temp, this.state, this.buffer, 0, padLength);

      this.finished = true;
    }

    for (let i = 0; i < 8; i++) {
      out[i * 4 + 0] = (this.state[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (this.state[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (this.state[i] >>> 8) & 0xff;
      out[i * 4 + 3] = (this.state[i] >>> 0) & 0xff;
    }

    return this;
  }

  // Returns the final hash digest.
  digest(): Uint8Array {
    const out = new Uint8Array(this.digestLength);
    this.finish(out);
    return out;
  }

  // Internal function for use in HMAC for optimization.
  _saveState(out: Uint32Array): void {
    for (let i = 0; i < this.state.length; i++) {
      out[i] = this.state[i];
    }
  }

  // Internal function for use in HMAC for optimization.
  _restoreState(from: Uint32Array, bytesHashed: number): void {
    for (let i = 0; i < this.state.length; i++) {
      this.state[i] = from[i];
    }
    this.bytesHashed = bytesHashed;
    this.finished = false;
    this.bufferLength = 0;
  }
}

// Returns SHA256 hash of data.
export function hash(data: Uint8Array): Uint8Array {
  const h = new Hash().update(data);
  const digest = h.digest();
  h.clean();
  return digest;
}

export function sha256Midstate(data: Buffer): Buffer {
  let d = data;
  if (data.length > blockSize) {
    d = data.slice(0, blockSize);
  }

  const h = new Hash();
  h.reset();
  h.update(Uint8Array.from(d));

  const midstate: Buffer = Buffer.alloc(digestLength);

  for (let i = 0; i < 8; i++) {
    midstate[i * 4 + 0] = (h.state[i] >>> 24) & 0xff;
    midstate[i * 4 + 1] = (h.state[i] >>> 16) & 0xff;
    midstate[i * 4 + 2] = (h.state[i] >>> 8) & 0xff;
    midstate[i * 4 + 3] = (h.state[i] >>> 0) & 0xff;
  }

  return midstate;
}
