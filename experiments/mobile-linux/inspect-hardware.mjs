import { open, constants } from "node:fs";
import { promisify } from "node:util";
import { read, fstat, close } from "node:fs";
import { inspectDeviceTree, inspectDtbo } from "./device-tree.mjs";
import { inspectVendorBoot } from "./vendor-boot.mjs";
const modes = new Map([["dtb",inspectDeviceTree],["dtbo",inspectDtbo],["vendor-boot",inspectVendorBoot]]);
let fd;
try {
  const [, , mode, path] = process.argv;
  if (process.argv.length !== 4 || !modes.has(mode)) throw new Error("Usage: node inspect-hardware.mjs dtb|dtbo|vendor-boot FILE");
  fd = await promisify(open)(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  const stat = await promisify(fstat)(fd);
  const limit = (mode === "vendor-boot" ? 128 : 32) * 1024 * 1024;
  if (!stat.isFile() || stat.size > limit) throw new Error("Expected bounded regular file");
  const b = Buffer.alloc(stat.size + 1);
  let used = 0;
  while (used < b.length) {
    const { bytesRead } = await promisify(read)(fd,b,used,b.length-used,null);
    if (!bytesRead) break;
    used += bytesRead;
  }
  if (used !== stat.size) throw new Error("File size changed during read");
  console.log(JSON.stringify(modes.get(mode)(b.subarray(0,used)),null,2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Inspection failed"); process.exitCode=1;
} finally { if (fd !== undefined) await promisify(close)(fd); }
