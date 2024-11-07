import { V003WebUSB } from "./webusb_new.js";

const MAX_FLASH_SECTORS = 262144;

const SECTOR_SIZE = 64

const FEATURE_ID = 0xAA;

const FLASH_CTLR = 0x40022010;
const FLASH_ADDR = 0x40022014;
const FLASH_STATR = 0x4002200C;
const CR_STRT_Set = 0x00000040;
const CR_PAGE_ER = 0x00020000;
const FLASH_CTLR_PG = 0x0001;     // Programming
const FLASH_CTLR_PER = 0x0002;    // Page Erase 1KByte
const FLASH_CTLR_MER = 0x0004;    // Mass Erase
const FLASH_CTLR_OPTPG = 0x0010;  // Option Byte Programming
const FLASH_CTLR_OPTER = 0x0020;  // Option Byte Erase
const FLASH_CTLR_STRT = 0x0040;   // Start
const FLASH_CTLR_LOCK = 0x0080;   // Lock
const FLASH_CTLR_OPTWRE = 0x0200;   // Option Bytes Write Enable
const FLASH_CTLR_ERRIE = 0x0400;  // Error Interrupt Enable
const FLASH_CTLR_EOPIE = 0x1000;  // End of operation interrupt enable

const DEBUG_FLASHER = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const byte_wise_read_blob = new Uint8Array([ // No alignment restrictions.
	0x23, 0xa0, 0x05, 0x00, 0x13, 0x07, 0x45, 0x03, 0x0c, 0x43, 0x50, 0x43,
	0x2e, 0x96, 0x21, 0x07, 0x94, 0x21, 0x14, 0xa3, 0x85, 0x05, 0x05, 0x07,
	0xe3, 0xcc, 0xc5, 0xfe, 0x93, 0x06, 0xf0, 0xff, 0x14, 0xc1, 0x82, 0x80,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const half_wise_read_blob = new Uint8Array([  // size and address must be aligned by 2.
	0x23, 0xa0, 0x05, 0x00, 0x13, 0x07, 0x45, 0x03, 0x0c, 0x43, 0x50, 0x43,
	0x2e, 0x96, 0x21, 0x07, 0x96, 0x21, 0x16, 0xa3, 0x89, 0x05, 0x09, 0x07,
	0xe3, 0xcc, 0xc5, 0xfe, 0x93, 0x06, 0xf0, 0xff, 0x14, 0xc1, 0x82, 0x80,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const word_wise_read_blob = new Uint8Array([ // size and address must be aligned by 4.
	0x23, 0xa0, 0x05, 0x00, 0x13, 0x07, 0x45, 0x03, 0x0c, 0x43, 0x50, 0x43,
	0x2e, 0x96, 0x21, 0x07, 0x94, 0x41, 0x14, 0xc3, 0x91, 0x05, 0x11, 0x07,
	0xe3, 0xcc, 0xc5, 0xfe, 0x93, 0x06, 0xf0, 0xff, 0x14, 0xc1, 0x82, 0x80,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const word_wise_write_blob = new Uint8Array([ // size and address must be aligned by 4.
	0x23, 0xa0, 0x05, 0x00, 0x13, 0x07, 0x45, 0x03, 0x0c, 0x43, 0x50, 0x43,
	0x2e, 0x96, 0x21, 0x07, 0x14, 0x43, 0x94, 0xc1, 0x91, 0x05, 0x11, 0x07,
	0xe3, 0xcc, 0xc5, 0xfe, 0x93, 0x06, 0xf0, 0xff, 0x14, 0xc1, 0x82, 0x80, // NOTE: No readback!
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
/*
	0x23, 0xa0, 0x05, 0x00, 0x13, 0x07, 0x45, 0x03, 0x0c, 0x43, 0x50, 0x43,
	0x2e, 0x96, 0x21, 0x07, 0x14, 0x43, 0x94, 0xc1, 0x94, 0x41, 0x14, 0xc3, // With readback.
	0x91, 0x05, 0x11, 0x07, 0xe3, 0xca, 0xc5, 0xfe, 0x93, 0x06, 0xf0, 0xff,
	0x14, 0xc1, 0x82, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 */
]);

const write64_flash = new Uint8Array([ // size and address must be aligned by 4.
  0x13, 0x07, 0x45, 0x03, 0x0c, 0x43, 0x13, 0x86, 0x05, 0x04, 0x5c, 0x43,
  0x8c, 0xc7, 0x14, 0x47, 0x94, 0xc1, 0xb7, 0x06, 0x05, 0x00, 0xd4, 0xc3,
  0x94, 0x41, 0x91, 0x05, 0x11, 0x07, 0xe3, 0xc8, 0xc5, 0xfe, 0xc1, 0x66,
  0x93, 0x86, 0x06, 0x04, 0xd4, 0xc3, 0xfd, 0x56, 0x14, 0xc1, 0x82, 0x80
]);

const half_wise_write_blob = new Uint8Array([ // size and address must be aligne0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00d by 2
	0x23, 0xa0, 0x05, 0x00, 0x13, 0x07, 0x45, 0x03, 0x0c, 0x43, 0x50, 0x43,
	0x2e, 0x96, 0x21, 0x07, 0x16, 0x23, 0x96, 0xa1, 0x96, 0x21, 0x16, 0xa3,
	0x89, 0x05, 0x09, 0x07, 0xe3, 0xca, 0xc5, 0xfe, 0x93, 0x06, 0xf0, 0xff,
	0x14, 0xc1, 0x82, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const byte_wise_write_blob = new Uint8Array([ // no division requirements.
	0x23, 0xa0, 0x05, 0x00, 0x13, 0x07, 0x45, 0x03, 0x0c, 0x43, 0x50, 0x43,
	0x2e, 0x96, 0x21, 0x07, 0x14, 0x23, 0x94, 0xa1, 0x94, 0x21, 0x14, 0xa3,
	0x85, 0x05, 0x05, 0x07, 0xe3, 0xca, 0xc5, 0xfe, 0x93, 0x06, 0xf0, 0xff,
	0x14, 0xc1, 0x82, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

// Just set the countdown to 0 to avoid any issues.
//   li a3, 0; sw a3, 0(a1); li a3, -1; sw a3, 0(a0); ret;
const halt_wait_blob = new Uint8Array([
	0x81, 0x46, 0x94, 0xc1, 0xfd, 0x56, 0x14, 0xc1, 0x82, 0x80 ]);

// Set the countdown to -1 to cause main system to execute.
//   li a3, -1; sw a3, 0(a1); li a3, -1; sw a3, 0(a0); ret;
//static const unsigned char run_app_blob[] = {
//	0xfd, 0x56, 0x94, 0xc1, 0xfd, 0x56, 0x14, 0xc1, 0x82, 0x80 };
//
// Alternatively, we do it ourselves.
const run_app_blob = new Uint8Array([
	0x37, 0x07, 0x67, 0x45, 0xb7, 0x27, 0x02, 0x40, 0x13, 0x07, 0x37, 0x12,
	0x98, 0xd7, 0x37, 0x97, 0xef, 0xcd, 0x13, 0x07, 0xb7, 0x9a, 0x98, 0xd7,
	0x23, 0xa6, 0x07, 0x00, 0x13, 0x07, 0x00, 0x08, 0x98, 0xcb, 0xb7, 0xf7,
	0x00, 0xe0, 0x37, 0x07, 0x00, 0x80, 0x23, 0xa8, 0xe7, 0xd0, 0x82, 0x80,
]);

function flasherError(msg) {
  console.error(`[Flasher][Error]: ${msg}`);
}

function convertToArray(b) {
  if (b instanceof Uint8Array) return b;
  if ((b instanceof Uint16Array) || (b instanceof Uint32Array)) return new Uint8Array(b.buffer);
  if (typeof(b) == 'number') return new Uint8Array(new BigUint64Array([BigInt(b)]).buffer);
  return -1;
}

function arrayToNumber(array) {
  return (array[3] << 24 | array[2] << 16 | array[1] << 8 | array[0]) >>> 0;
}

function arrayToHexString(array, x) {
  let string = new String();
  if (x == true) string += "0x";
  for (let i = array.length; i > 0 ; i--) {
    if (array[i-1] == 0) string += "00";
    else string += array[i-1].toString(16).toUpperCase();
  }
  return string;
}

function compareArrays(arr1, arr2) {
  let i = arr1.length;
  while (i--) {
    if (arr1[i] !== arr2[i]) return i+1;
  }
  return 0
}

function checkZeros(block) {
  let i = block.length;
  while (i--) {
    if (block[i] != 0) return block[i];
  }
  return 0;
}

export class Flasher {
  // {beginCB, writeCB, readCB,}
  constructor(usb, callbacks) {
    this.usb = usb;
    this.commandplace;
    this.prepping_for_erase;
    this.callbacks = callbacks;
    this.busy = false;
  };

  async begin() {
    if (this.usb == null) {
      return -1;
    } else {
      if (this.usb.connected == false) {
        let r = await this.usb.connect();
        if (r) return r;
      }
    }
    // this.commandbuffer = new Uint8Array(128).fill(0);
    // this.respbuffer = new Uint8Array(128).fill(0);
    this.busy = false;
    this.flash_unlocked = false;
    this.flash_sector_status = new Array(MAX_FLASH_SECTORS).fill(0);
    if (this.callbacks.beginCB) beginCB();
    return 0;
  }

  static IsAddressFlash(addy) { return ( addy & 0xff000000 ) == 0x08000000 || ( addy & 0x1FFFF000 ) == 0x1FFFF000; }

  ResetOp() {
    this.commandbuffer = new Uint8Array(128).fill(0);
    this.respbuffer = new Uint8Array(128).fill(0);
    this.commandplace = 3;
  }

  WriteOp4(opsend) {
    opsend = convertToArray(opsend);
    let place = this.commandplace;
    let newend = place + 4;
    if (newend < this.commandbuffer.length) {
      this.commandbuffer.set(new Uint8Array(opsend.buffer), place);
    }
    this.commandplace = newend;
  }


  WriteOpArb(data, len) {
    let place = this.commandplace;
    let newend = place + len;
    if(newend < this.commandbuffer.length) {
      this.commandbuffer.set(new Uint8Array(data.buffer), place);
    }
    this.commandplace = newend;
  }

  async CommitOp(verify, onlySend) {
    let retries = 0;
    let r;

    let magic_go = new Uint32Array([0x1234abcd]);
    this.commandbuffer.set(new Uint8Array(magic_go.buffer), 123);

    if (DEBUG_FLASHER == 1) {
      let i = 0; 
      let string = "";
      console.log("Commit TX: ", this.commandbuffer.length, " bytes");
      for ( i = 0; i < this.commandbuffer.length ; i++ ) {
        string += `0x${this.commandbuffer[i].toString(16)} `;
        if ((i & 0xf) == 0xf) {
          console.log(string);
          string = "";
        }
        
      }
      if ((i & 0xf) != 0xf) console.log("\n");
    }
    for (let n = 0; n <= 11; n++) {
      
      r = this.usb.send(FEATURE_ID, this.commandbuffer).then(() => {
        this.usb.sendErrorCnt = 0;
      });
      
      if (!r) {
        flasherError("Issue with hid_send_feature_report. Retrying");
        if(n > 10) return r;
        continue;
      }
      if (DEBUG_FLASHER == 1) {
        console.log("hid_send_feature_report = %d", r);
      }
      // await r;
      if (n > 0) console.log(n);
      break;
    }
    
    if (onlySend == true) return 0;

    // if(this.prepping_for_erase) {
    //   await sleep(4);
    // }

    let timeout = 0;
    do
    {
      r = this.usb.receive(FEATURE_ID);

      let respData;
      if (!r) {
        flasherError("error creating receiveReport");
        if (retries++ > 10) return r;
        continue;
      } else {
        try {
          respData = await r;
          this.usb.receiveErrorCnt = 0;
          this.respbuffer = new Uint8Array(respData.buffer);
        } catch (e) {
          if (timeout++ > 20) {
            flasherError("Timed out waiting for stub to complete");
            return -99;
          } else {
            continue;
          }
          // console.log(e);
        }
      }
      
      if (DEBUG_FLASHER == 1) {
        let i; 
        let string = "";
        // console.log(this.respbuffer);
        console.log("Commit RX: %d bytes", respData.buffer.byteLength);
        for (i = 0; i < this.respbuffer.length; i++) {
          string += `0x${this.respbuffer[i].toString(16)} `;
          if ((i & 0xf) == 0xf) {
            console.log(string)
            string = "";
          };
        }
        if ((i & 0xf) != 0xf) console.log("\n");
      }

      if (this.respbuffer[1] == 0xff) {
        if (verify == true) {
          let res = compareArrays(this.commandbuffer.subarray(3, 119), this.respbuffer.subarray(4, 120));
          if (res > 0) {
            flasherError("Buffers don't match at pos: ", res);
            return -1;
          }
        }
        break;
      }

      if (timeout++ > 20) {
        flasherError("Timed out waiting for stub to complete");
        return -99;
      }
    } while(1);
    return 0;
  }

  // Does not handle erasing
  async WriteBinaryBlob(address_to_write_to, write_size, blob) {

    blob = convertToArray(blob);

    let blob_pos = 0;
    let is_flash = Flasher.IsAddressFlash(address_to_write_to);

    if ((address_to_write_to & 0x1) && write_size > 0) {
      // Need to do byte-wise writing in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(byte_wise_write_blob, byte_wise_write_blob.length);
      this.WriteOp4(address_to_write_to); // Base address to write.
      this.WriteOp4(1); // write 1 bytes.
      this.commandbuffer.set(blob.subarray(blob_pos, blob_pos+1), 59);
      if (await this.CommitOp()) return -5;
      if (is_flash && (this.respbuffer[60] != blob.subarray(blob_pos, blob_pos+1)[0])) {
        flasherError("Write Binary Blob: %d bytes to %08x", write_size, address_to_write_to);
        return -6;
      }
      blob_pos++;
      write_size --;
      address_to_write_to++;
    }

    if ((address_to_write_to & 0x2) && write_size > 1) {
      // Need to do byte-wise writing in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(half_wise_write_blob, half_wise_write_blob.length);
      this.WriteOp4(address_to_write_to); // Base address to write.
      this.WriteOp4(2); // write 2 bytes.
      this.commandbuffer.set(blob.subarray(blob_pos, blob_pos+2), 59);
      if (await this.CommitOp()) return -5;
      if (is_flash && (this.respbuffer.subarray(60, 62) != blob.subarray(blob_pos, blob_pos+2))) {
        flasherError("Error: Write Binary Blob: %d bytes to %08x", write_size, address_to_write_to);
        return -6;
      }
      blob_pos += 2;
      write_size -= 2;
      address_to_write_to+=2;
    }

    while (write_size > 3) {
      let to_write_this_time = write_size & (~3);
      if(to_write_this_time > 64) to_write_this_time = 64;
      // Need to do byte-wise writing in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(word_wise_write_blob, word_wise_write_blob.length);
      this.WriteOp4(address_to_write_to); // Base address to write.
      this.WriteOp4(to_write_this_time); // write 4 bytes.
      this.commandbuffer.set(blob.subarray(blob_pos, blob_pos+to_write_this_time), 59);
      if (await this.CommitOp()) return -5;
      if (is_flash && (this.respbuffer.subarray(60, 60+to_write_this_time) != blob.subarray(blob_pos, blob_pos+to_write_this_time))) {
        flasherError("Error: Write Binary Blob: %d bytes to %08x", write_size, address_to_write_to);
        return -6;
      }
      blob_pos += to_write_this_time;
      write_size -= to_write_this_time;
      address_to_write_to += to_write_this_time;
    }

    if (write_size > 1) {
      // Need to do byte-wise writing in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(half_wise_write_blob, half_wise_write_blob.length);
      this.WriteOp4(address_to_write_to); // Base address to write.
      this.WriteOp4(2); // write 2 bytes.
      this.commandbuffer.set(blob.subarray(blob_pos, blob_pos+2), 59);
      if (await this.CommitOp()) return -5;
      if (is_flash && (this.respbuffer.subarray(60, 62) != blob.subarray(blob_pos, blob_pos+2))) {
        flasherError("Error: Write Binary Blob: %d bytes to %08x", write_size, address_to_write_to);
        return -6;
      }
      blob_pos += 2;
      write_size -= 2;
      address_to_write_to += 2;
    }

    if (write_size) {
      // Need to do byte-wise writing in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(byte_wise_write_blob, byte_wise_write_blob.length);
      this.WriteOp4(address_to_write_to); // Base address to write.
      this.WriteOp4(1); // write 1 byte.
      this.commandbuffer.set(blob.subarray(blob_pos, blob_pos+1), 59);
      if (await this.CommitOp()) return -5;
      if (is_flash && (this.respbuffer[60] != blob.subarray(blob_pos, blob_pos+1)[0])) {
        flasherError("Error: Write Binary Blob: %d bytes to 0x%s", write_size, address_to_write_to.toString(16).padStart(8, 0).toUpperCase());
        return -6;
      }
      blob_pos += 1;
      write_size -= 1;
      address_to_write_to += 1;
    }

    this.prepping_for_erase = 0;
    return 0;
    
  }

  async ReadBinaryBlob(address_to_read_from, read_size, blob, cb) {
    let fullSize = read_size
    let blob_pos = 0;

    if (DEBUG_FLASHER == 1) {
      console.log("Read Binary Blob: %d bytes from 0x%s", read_size, address_to_read_from.toString(16).padStart(8, 0).toUpperCase());
    }

    if ((address_to_read_from & 0x1 ) && read_size > 0) {
      // Need to do byte-wise reading in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(byte_wise_read_blob, byte_wise_read_blob.length);
      this.WriteOp4(address_to_read_from); // Base address to read.
      this.WriteOp4(1); // Read 1 bytes.
      if (await this.CommitOp(false, false)) return -5;
      blob.subarray(this.respbuffer.subarray(60, 61), blob_pos);
      blob_pos++;
      read_size--;
      address_to_read_from++;
    }

    if ((address_to_read_from & 0x2) && read_size > 1) {
      // Need to do byte-wise reading in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(half_wise_read_blob, half_wise_read_blob.length);
      this.WriteOp4(address_to_read_from); // Base address to read.
      this.WriteOp4(2); // Read 2 bytes.
      if (await this.CommitOp(false, false)) return -5;
      blob.set(this.respbuffer.subarray(60, 62), blob_pos);
      blob_pos += 2;
      read_size -= 2;
      address_to_read_from += 2;
    }

    while(read_size > 3) {
      let to_read_this_time = read_size & (~3);
      if (to_read_this_time > 64) to_read_this_time = 64;
      // Need to do byte-wise reading in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(word_wise_read_blob, word_wise_read_blob.length);
      this.WriteOp4(address_to_read_from); // Base address to read.
      this.WriteOp4(to_read_this_time); // Read 4 bytes.
      // this.CommitOp(false, false);
      // if (cb) cb(blob_pos, fullSize);
      if (await this.CommitOp(false, false)) return -5;
      blob.set(this.respbuffer.subarray(60, 60+to_read_this_time), blob_pos);
      blob_pos += to_read_this_time;
      read_size -= to_read_this_time;
      address_to_read_from += to_read_this_time;
      if (cb) cb(blob_pos, fullSize);
    }

    if (read_size > 1) {
      // Need to do byte-wise reading in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(half_wise_read_blob, half_wise_read_blob.length);
      this.WriteOp4(address_to_read_from); // Base address to read.
      this.WriteOp4(2); // Read 2 bytes.
      if (await this.CommitOp(false, false)) return -5;
      blob.set(this.respbuffer.subarray(60, 62), blob_pos);
      blob_pos += 2;
      read_size -= 2;
      address_to_read_from += 2;
      if (cb) cb(blob_pos, fullSize);
    }

    if (read_size) {
      // Need to do byte-wise reading in front to line up with word alignment.
      this.ResetOp();
      this.WriteOpArb(byte_wise_read_blob, byte_wise_read_blob.length);
      this.WriteOp4(address_to_read_from); // Base address to read.
      this.WriteOp4(1); // Read 1 byte.
      if (await this.CommitOp(false, false)) return -5;
      blob.set(this.respbuffer.subarray(60, 61), blob_pos);
      blob_pos += 1;
      read_size -= 1;
      address_to_read_from += 1;
      if (cb) cb(blob_pos, fullSize);
    }
    return 0;
  }

  async Boot() {
    console.log("Booting");
    this.ResetOp();
    this.WriteOpArb(run_app_blob, run_app_blob.length);
    if (await this.CommitOp(false, true)) return -5;
    this.usb.disconnect();
    return 0;
  }

  async SetupInterface() {
    console.log("Halting Boot Countdown");
    this.ResetOp();
    this.WriteOpArb(halt_wait_blob, halt_wait_blob.length);
    if (await this.CommitOp(false, false)) return -5;
    return 0;
  }

  // MUST be 4-byte-aligned.
  async WriteWord(address_to_write, data) {
    return this.WriteBinaryBlob(address_to_write, 4, data);
  }

  async ReadWord(address_to_read, data) {
    return this.ReadBinaryBlob(address_to_read, 4, data);
  }

  async BlockWrite64(address_to_write, data) {
    let rw;
    data = convertToArray(data);
    if (Flasher.IsAddressFlash(address_to_write)) {
      if (!this.flash_unlocked) {
        if ((rw = await this.UnlockFlash())) return rw;
        await this.WriteWord(0x40022010, 0x00010000);
      }

      if (!this.IsMemoryErased(address_to_write)) {
        if(await this.Erase(address_to_write, 64, 0)) {
          flasherError("Failed to erase sector at %08x", address_to_write);
          return -9;
        }
        await this.WriteWord(0x40022010, 0x00010000); // (intptr_t)&FLASH->CTLR = 0x40022010
      }
      await this.WriteWord(0x40022010, 0x00010000 | 0x00080000); // (intptr_t)&FLASH->CTLR = 0x40022010
      this.ResetOp();
      this.WriteOpArb(write64_flash, write64_flash.length);
      this.WriteOp4(address_to_write); // Base address to write. @52
      this.WriteOp4(0x4002200c); // FLASH STATR base address. @ 56
      this.commandbuffer.set(data, 59);
      this.PrepForLongOp();  // Give the programmer a headsup this next operation could take a while.
      if ((rw = await this.CommitOp(true, false))) return rw;
    } else {
      return this.WriteBinaryBlob(address_to_write, 64, data);
    }
    return 0;
  }

  async WriteHalfWord(address_to_write, data) {
    return this.WriteBinaryBlob(address_to_write, 2, data);
  }

  async ReadHalfWord(address_to_read, data) {
    return this.ReadBinaryBlob(address_to_read, 2, data);
  }

  async WriteByte(address_to_write, data) {
    return this.WriteBinaryBlob(address_to_write, 1, data);
  }

  async ReadByte(address_to_read, data) {
    return this.ReadBinaryBlob(address_to_read, 1, data);
  }

  PrepForLongOp() {
    this.prepping_for_erase = 1;
    return 0;
  }

  async Write(address_to_write, size, data, backup, erase, skipZero, cb) {
    if (this.usb.connected == false) {
      if (await this.begin()) return "Couldn't connect";
    }
    
    let callback = cb;
    if (!cb && this.callbacks.writeCB) callback = this.callbacks.writeCB;

    data = convertToArray(data);
    let rw;
    console.time('Write time');
    // console.log("Started measuring time");
  
    // We can't write into flash when mapped to 0x00000000
    if (address_to_write < 0x01000000) address_to_write |= 0x08000000;
  
    let is_flash = Flasher.IsAddressFlash(address_to_write);
  
    if (size == 0) return 0;
  
    if (is_flash && !this.flash_unlocked) {
      console.log("Unlocking flash");
      if (rw = await this.UnlockFlash()) {
        console.log(rw);
        return rw
      };
    }
  
    if ((address_to_write > 0x1ffff7c0) && (address_to_write < 0x20000000)) {
  
      let base = address_to_write & 0xffffffc0;
      let block = new Uint8Array(64);
  
      if (base != ((address_to_write + blob_size - 1) & 0xffffffc0)) {
        flasherError("You cannot write across a 64-byte boundary when writing to option bytes");
        return -9;
      }
  
      this.ReadBinaryBlob(base, 64, block);
  
      let offset = address_to_write - base;
      block.set(data, offset)
      // block.subarray(offset, 64) = data;
  
      let temp = new Uint8Array(4);
      await this.ReadWord(0x4002200c, temp);
      if(arrayToNumber(temp) & 0x8000) {
        await this.WriteWord(0x40022004, 0x45670123); // KEYR
        await this.WriteWord(0x40022004, 0xCDEF89AB);
        await this.WriteWord(0x40022008, 0x45670123); // OBWRE
        await this.WriteWord(0x40022008, 0xCDEF89AB);
        await this.WriteWord(0x40022028, 0x45670123); //(FLASH_BOOT_MODEKEYP)
        await this.WriteWord(0x40022028, 0xCDEF89AB); //(FLASH_BOOT_MODEKEYP)
        await this.ReadWord(0x40022010, temp);
        await this.ReadWord(0x4002200c, temp);
      }
  
      await this.ReadWord(0x4002200c, temp);
      if (arrayToNumber(temp) & 0x8000) {
        flasherError("Critical memory zone is still locked out");
        return -10;
      }
  
      await this.ReadWord(0x40022010, temp);
      if (!(arrayToNumber(temp) & (1<<9))) { // Check OBWRE
        flasherError("Option Byte Unlock Failed");
        return -10;
      }
  
      // Perform erase.
      await this.WriteWord(0x40022010, FLASH_CTLR_OPTER | FLASH_CTLR_OPTWRE);
      await this.WriteWord(0x40022010, FLASH_CTLR_OPTER | FLASH_CTLR_OPTWRE | FLASH_CTLR_STRT);
  
      await this.ReadWord(0x4002200c, temp);
      if (arrayToNumber(temp) & 0x10) {
        flasherError("WRPTRERR is set.  Write failed");
        return -9;
      }
  
      for (let i = 0; i < 8; i++) {
        await this.WriteWord(0x40022010, FLASH_CTLR_OPTPG | FLASH_CTLR_OPTWRE);
        await this.WriteWord(0x40022010, FLASH_CTLR_OPTPG | FLASH_CTLR_STRT | FLASH_CTLR_OPTWRE);
        await this.WriteHalfWord(i*2+base, block[i*2+0] | (block[i*2+1]<<8));
  
        await this.ReadWord(0x4002200c, temp);
        if (arrayToNumber(temp) & 0x10) {
          flasherError("WRPTRERR is set.  Write failed");
          return -9;
        }
      }
      await this.WriteWord(0x40022010, 0);
  
      return 0;
    }

    // Regardless of sector size, allow block write to do its thing if it can.
    // if (is_flash && (address_to_write & 0x3f) == 0 && (size & 0x3f) == 0) {
    let readBuffer = new Uint8Array(16384);
    if (is_flash) {
      
      if (backup || !erase) {
        console.log("Reading out flash");
        await this.ReadBinaryBlob(0x08000000, 16384, readBuffer);
      }
      if (!erase) {
        let newData = new Uint8Array(readBuffer.buffer);
        newData.set(data, address_to_write - 0x08000000);
        data = new Uint8Array(newData.buffer);
        address_to_write = 0x08000000;
      }
      
      if (erase && !backup && ((address_to_write & 0x3f) != 0 || (size & 0x3f) != 0)) {
        console.log("Doing padding");
        if ((address_to_write & 0x3f) != 0) {
          let offset = (address_to_write - ((address_to_write / SECTOR_SIZE) * SECTOR_SIZE));
          let newData = new Uint8Array(size + (SECTOR_SIZE - offset)).fill(0);
          newData.set(data, (SECTOR_SIZE - offset)-1);
          data = new Uint8Array(newData);
          address_to_write = Math.round(address_to_write / SECTOR_SIZE);
          size = size + (SECTOR_SIZE - offset);
        }
        if (((address_to_write + size) & 0x3f) !=0) {
          size = Math.ceil(size / SECTOR_SIZE) * SECTOR_SIZE;
          let newData = new Uint8Array(size).fill(0);
          newData.set(data, 0);
          data = new Uint8Array(newData);
        }
      }
      await this.Erase(0, 0, 1);

      console.log("Writing to flash");
      await this.WriteWord(0x40022010, 0x00010000); // (intptr_t)&FLASH->CTLR = 0x40022010
      await this.WriteWord(0x40022010, 0x00010000 | 0x00080000); // (intptr_t)&FLASH->CTLR = 0x40022010
      for (let i = 0; i < size; i+= 64) {
        if (skipZero) {
          if (checkZeros(data.subarray(i, i+64)) == 0) {
            console.log("Zero block skipped at: ", i);
            continue;
          }
        }
        
        console.log(i);
        let r = await this.BlockWrite64(address_to_write + i, data.subarray(i, i+64));
        if (r == -1) {
          for (let n = 0; n < 10; n++) {
            r = await this.BlockWrite64(address_to_write + i, data.subarray(i, i+64));
            if (r == 0) break;
          }
        }
        if (callback) callback(i, size); 
        if (r != 0) {
          flasherError("Error writing block at memory %08x / Error: %d", address_to_write, r);
          return r;
        }
      }
      console.log("Ended writing to flash");
      console.timeEnd('Write time');
    } else {
  
      let tempblock = new Uint8Array(SECTOR_SIZE);
      
      let sblock =  address_to_write / SECTOR_SIZE;
      let eblock = (address_to_write + size + (SECTOR_SIZE-1) ) / SECTOR_SIZE;
      let b;
      let rsofar = 0;
    
      for (b = sblock; b < eblock; b++) {
        console.log("Writing the harder way");
        let offset_in_block = address_to_write - (b * SECTOR_SIZE);
        if (offset_in_block < 0) offset_in_block = 0;
        let end_o_plus_one_in_block = (address_to_write + size) - (b*SECTOR_SIZE);
        if (end_o_plus_one_in_block > SECTOR_SIZE) end_o_plus_one_in_block = SECTOR_SIZE;
        let	base = b * SECTOR_SIZE;
    
        if (offset_in_block == 0 && end_o_plus_one_in_block == SECTOR_SIZE) {
          console.log("Writing until end of block");
          let r;
          r = await this.BlockWrite64(base + i*64, data.subarray(rsofar+i*64));
          rsofar += 64;
          if(r) {
            flasherError("Error writing block at memory %08x (error = %d)", base, r);
            return r;
          }
        } else {
          flasherError("Writing after end of block");
          //Ok, we have to do something wacky.
          if (is_flash) {
            await this.ReadBinaryBlob(base, SECTOR_SIZE, tempblock);
    
            // Permute tempblock
            let tocopy = end_o_plus_one_in_block - offset_in_block;
            tempblock.set(data.subarray(rsofar, rsofar + tocopy), offset_in_block);
            rsofar += tocopy;
    
            let r = await this.BlockWrite64(base, tempblock);
            if (r) return r;
          } else {
            // Accessing RAM.  Be careful to only do the needed operations.
            for (let j = 0; j < SECTOR_SIZE; j++) {
              let taddy = j*4;
              if (offset_in_block <= taddy && end_o_plus_one_in_block >= taddy + 4) {
                await this.WriteWord(taddy + base, data.subarray(rsofar));
                rsofar += 4;
              } else if ((offset_in_block & 1) || (end_o_plus_one_in_block & 1)) {
                // Bytes only.
                for (let j = 0; j < 4; j++) {
                  if (taddy >= offset_in_block && taddy < end_o_plus_one_in_block) {
                    await this.WriteByte(taddy + base, data.subarray(rsofar));
                    rsofar ++;
                  }
                  taddy++;
                }
              } else {
                // Half-words
                for (let j = 0; j < 4; j+=2) {
                  if (taddy >= offset_in_block && taddy < end_o_plus_one_in_block) {
                    await this.WriteHalfWord(taddy + base, data.subarray(rsofar));
                    rsofar +=2;
                  }
                  taddy+=2;
                }
              }
            }
          }
        }
      }
    }
    if (backup) return readBuffer;
    return 0;
  }

  async Read(address, size, cb) {
    if (this.busy) return;
    let callback = cb;
    if (!cb && this.callbacks.readCB) callback = this.callbacks.readCB;
    this.busy = true;

    return new Promise(async (resolve, reject) => {
      if (this.usb.connected == false) {
        if (await this.begin()) reject("Couldn't connect");
      }
      console.time('Read Time');
      let array = new Uint8Array(size);
      let ret = await this.ReadBinaryBlob(address, size, array, callback);
      console.timeEnd('Read Time');
      this.busy = false;
      if (ret) {
        reject(ret);
      } else {
        // console.log(array);
        resolve(array);
      }  
    });
  }

  async UnlockFlash() {
    let ret = 0;
    let rw = new Uint8Array(4);
    ret = await this.ReadWord(0x40022010, rw);  // FLASH->CTLR = 0x40022010
    
    if (arrayToNumber(rw) & 0x8080) {
      ret += await this.WriteWord(0x40022004, 0x45670123); // FLASH->KEYR = 0x40022004
      ret += await this.WriteWord(0x40022004, 0xCDEF89AB);
      ret += await this.WriteWord(0x40022008, 0x45670123); // OBKEYR = 0x40022008  // For user word unlocking
      ret += await this.WriteWord(0x40022008, 0xCDEF89AB);
      ret += await this.WriteWord(0x40022024, 0x45670123); // MODEKEYR = 0x40022024
      ret += await this.WriteWord(0x40022024, 0xCDEF89AB);

      ret += await this.ReadWord(0x40022010, rw); // FLASH->CTLR = 0x40022010
      
      if (ret) {
        flasherError("Error unlocking flash, got code %d from underlying system", ret);
        return ret;
      }

      rw = new Uint32Array(rw.buffer);

      if (arrayToNumber(rw) & 0x8080) {
        flasherError("Flash is not unlocked (CTLR = %08x)", rw);
        return -9;
      }
    }

    this.flash_unlocked = 1;
    return 0;
  }
  
  async Erase(address, length, type, cb) {
    let rw;
    if (cb) cb(1);

    if(!this.flash_unlocked) {
      if ((rw = await this.UnlockFlash())) return rw;
    }

    if (type == 1) {
        console.log("Whole-chip erase");
        if (cb) cb(10);

        if (await this.WriteWord(FLASH_CTLR, 0)) {
          flasherError("Flash operation error");
          return -93;
        }
        if (cb) cb(20);
        if (await this.WriteWord(FLASH_CTLR, FLASH_CTLR_MER)) {
          flasherError("Flash operation error");
          return -93;
        }
        if (cb) cb(30);
        this.PrepForLongOp();  // Give the programmer a headsup this next operation could take a while.
        if (await this.WriteWord(FLASH_CTLR, CR_STRT_Set|FLASH_CTLR_MER)) {
          flasherError("Flash operation error");
          return -93;
        }
        if (cb) cb(100);
        this.flash_sector_status.fill(1);
        console.log("Chip has been erased");

    } else {
        // 16.4.7, Step 3: Check the BSY bit of the FLASH_STATR register to confirm that there are no other programming operations in progress.
        // skip (we make sure at the end)
        let chunk_to_erase = address;
        while (chunk_to_erase < address + length) {
          if ((chunk_to_erase & 0xff000000) == 0x08000000) {
            let sector = (chunk_to_erase & 0x00ffffff) / 64;
            if (sector < MAX_FLASH_SECTORS) {
              this.flash_sector_status[sector] = 1;
            }
          }
    
          // Step 4:  set PAGE_ER of FLASH_CTLR(0x40022010)
          if (await this.WriteWord(FLASH_CTLR, CR_PAGE_ER)) {
            flasherError("Flash operation error");
            return -93;
          } // Actually FTER
          // Step 5: Write the first address of the fast erase page to the FLASH_ADDR register.
          if (await this.WriteWord(FLASH_ADDR, chunk_to_erase)) {
            flasherError("Flash operation error");
            return -93;
          }
          // Step 6: Set the STAT bit of FLASH_CTLR register to '1' to initiate a fast page erase (64 bytes) action.
          this.PrepForLongOp();  // Give the programmer a headsup this next operation could take a while.
          if (await this.WriteWord(FLASH_CTLR, (CR_STRT_Set | CR_PAGE_ER))) {
            flasherError("Flash operation error");
            return -93;
          }
          chunk_to_erase += this.sector_size;
        }
      }
    
      return 0;
  }

  IsMemoryErased(address) {
    if ((address & 0xff000000) != 0x08000000) return 0;
    let sector = (address & 0xffffff) / 64;
    if(sector >= MAX_FLASH_SECTORS)
      return 0;
    else
      return this.flash_sector_status[sector];
  }

  async getChipInfo() {
    return new Promise((resolve, reject) => {
      let infoBuffers = {};
      let buf = new Uint8Array(4)
      let promises = new Array;
      promises[0] = this.ReadWord(0x1FFFF800, buf).then((ret) => {
        if (ret) reject(ret);
        else infoBuffers.user = arrayToNumber(buf);
      });
      promises[1] = this.ReadWord(0x1FFFF804, buf).then((ret) => {
        if (ret) reject(ret);
        else infoBuffers.data = arrayToNumber(buf);
      });
      promises[2] = this.ReadWord(0x1FFFF808, buf).then((ret) => {
        if (ret) reject(ret);
        else infoBuffers.wrpr1 = arrayToNumber(buf);
      });
      promises[3] = this.ReadWord(0x1FFFF80c, buf).then((ret) => {
        if (ret) reject(ret);
        else infoBuffers.wrpr2 = arrayToNumber(buf);
      });
      promises[4] = this.ReadWord(0x1FFFF7E0, buf).then((ret) => {
        if (ret) reject(ret);
        else infoBuffers.flash = arrayToNumber(buf);
      });
      promises[5] = this.ReadWord(0x1FFFF7E8, buf).then((ret) => {
        if (ret) reject(ret);
        else infoBuffers.uuid1 = arrayToNumber(buf);
      });
      promises[6] = this.ReadWord(0x1FFFF7EC, buf).then((ret) => {
        if (ret) reject(ret);
        else infoBuffers.uuid2 = arrayToNumber(buf);
      });
      promises[7] = this.ReadWord(0x1FFFF7F0, buf).then((ret) => {
        if (ret) reject(ret);
        else infoBuffers.uuid3 = arrayToNumber(buf);
      });
      Promise.all(promises).then(() => {
        resolve(infoBuffers);
      });
    })
    let infoBuffers = {};
    let ret = 0;  
    ret += await this.ReadWord(0x1FFFF800, infoBuffers.user);
    // console.log("USER/RDPR: %04x/%04x", infoBuffers[0]>>>16, infoBuffers[0]&0xFFFF);
    ret += await this.ReadWord(0x1FFFF804, infoBuffers.data);
    // console.log("DATA1/DATA0: %04x/%04x", infoBuffers[1]>>>16, infoBuffers[1]&0xFFFF);
    ret += await this.ReadWord(0x1FFFF808, infoBuffers.wrpr1);
    // console.log("WRPR1/WRPR0: %04x/%04x", infoBuffers[2]>>>16, infoBuffers[2]&0xFFFF);
    ret += await this.ReadWord(0x1FFFF80c, infoBuffers.wrpr2);
    // console.log("WRPR3/WRPR2: %04x/%04x", infoBuffers[3]>>>16, infoBuffers[3]&0xFFFF);
    ret += await this.ReadWord(0x1FFFF7E0, infoBuffers.flash);
    // console.log("Flash Size: %d kB", (infoBuffers[4]&0xffff));
    ret += await this.ReadWord(0x1FFFF7E8, infoBuffers.uuid1);
    // console.log("R32_ESIG_UNIID1: ", infoBuffers[5].toString(16));
    ret += await this.ReadWord(0x1FFFF7EC, infoBuffers.uuid2);
    // console.log("R32_ESIG_UNIID2: ", infoBuffers[6].toString(16));
    ret += await this.ReadWord(0x1FFFF7F0, infoBuffers.uuid3);
    // console.log("R32_ESIG_UNIID3: ", infoBuffers[7].toString(16));
    if (ret) {
      error("Failed to read chip info: ", ret);
    }
    infoBuffers.uuid3[0] = 0;
    return infoBuffers;
  }
  
};