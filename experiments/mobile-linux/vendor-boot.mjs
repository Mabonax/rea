import { createHash } from "node:crypto";
export function inspectVendorBoot(b) {
  if (!Buffer.isBuffer(b) || b.length < 2112 || b.length > 128 * 1024 * 1024 || b.toString("ascii", 0, 8) !== "VNDRBOOT") throw new TypeError("Invalid vendor boot image");
  const version = b.readUInt32LE(8), page = b.readUInt32LE(12), ramdiskSize = b.readUInt32LE(24), header = b.readUInt32LE(2096), dtbSize = b.readUInt32LE(2100);
  if (![3, 4].includes(version) || header !== (version === 3 ? 2112 : 2128) || b.length < header || page < 512 || page > 65536 || (page & (page - 1))) throw new TypeError("Unsupported vendor boot header");
  const align = n => Math.ceil(n / page) * page;
  const ramdisk = { offset: align(header), size: ramdiskSize };
  const dtb = { offset: ramdisk.offset + align(ramdisk.size), size: dtbSize };
  const table = { offset: dtb.offset + align(dtb.size), size: version === 4 ? b.readUInt32LE(2112) : 0 };
  const bootconfig = { offset: table.offset + align(table.size), size: version === 4 ? b.readUInt32LE(2124) : 0 };
  if (bootconfig.offset + align(bootconfig.size) > b.length) throw new TypeError("Truncated vendor boot image");
  const fragments = [];
  if (version === 4) {
    const count = b.readUInt32LE(2116), size = b.readUInt32LE(2120);
    if (count > 4096 || (count && size !== 108) || count * size !== table.size) throw new TypeError("Invalid ramdisk table");
    for (let i = 0; i < count; i++) {
      const p = table.offset + i * size, length = b.readUInt32LE(p), offset = b.readUInt32LE(p + 4);
      if (offset + length > ramdisk.size) throw new TypeError("Invalid ramdisk fragment");
      fragments.push({ offset: ramdisk.offset + offset, size: length, type: b.readUInt32LE(p + 8) });
    }
  }
  return { sha256: createHash("sha256").update(b).digest("hex"), header_version: version, page_size: page, ramdisk, dtb, table, bootconfig, fragments,
    limitations: ["Layout only; firmware authenticity, compression, AVB and bootability are not verified."] };
}
