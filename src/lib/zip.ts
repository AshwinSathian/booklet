import { crc32, deflateRawSync } from "node:zlib";

/**
 * A ZIP archive of UTF-8 text files, built in memory. Enough of the format
 * for an export download: deflate, no ZIP64 (so under 4 GB and 65,535
 * files), no directories.
 */
export function zipTextFiles(files: Array<{ name: string; content: string }>, modified = new Date()): Buffer {
  // MS-DOS date and time, which is what the format stores.
  const time = (modified.getHours() << 11) | (modified.getMinutes() << 5) | (modified.getSeconds() >> 1);
  const date = ((modified.getFullYear() - 1980) << 9) | ((modified.getMonth() + 1) << 5) | modified.getDate();

  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const data = Buffer.from(file.content);
    const compressed = deflateRawSync(data);

    // Shared by the local header and the central directory entry:
    // version 2.0, UTF-8 names (flag bit 11), method 8 (deflate).
    const meta = Buffer.alloc(26);
    meta.writeUInt16LE(20, 0);
    meta.writeUInt16LE(0x0800, 2);
    meta.writeUInt16LE(8, 4);
    meta.writeUInt16LE(time, 6);
    meta.writeUInt16LE(date, 8);
    meta.writeUInt32LE(crc32(data), 10);
    meta.writeUInt32LE(compressed.length, 14);
    meta.writeUInt32LE(data.length, 18);
    meta.writeUInt16LE(name.length, 22);

    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), meta, name, compressed]);
    const tail = Buffer.alloc(14); // comment length (2), disk (2), attributes (2 + 4), then the local header's offset (4)
    tail.writeUInt32LE(offset, 10);
    central.push(Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02, 20, 0]), meta, tail, name]));
    parts.push(local);
    offset += local.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}
