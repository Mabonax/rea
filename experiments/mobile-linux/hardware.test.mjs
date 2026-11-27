import test from "node:test";
import assert from "node:assert/strict";
import { inspectDeviceTree, inspectDtbo } from "./device-tree.mjs";
import { inspectVendorBoot } from "./vendor-boot.mjs";
const word = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const fdt = () => {
  const s = Buffer.concat([word(1), Buffer.alloc(4), word(3), word(4), word(0), Buffer.from("abc\0"), word(2), word(9)]);
  const names = Buffer.from("compatible\0"), b = Buffer.alloc(56 + s.length + names.length);
  [0xd00dfeed, b.length, 56, 56 + s.length, 40, 17, 16, 0, names.length, s.length].forEach((v,i) => b.writeUInt32BE(v,i*4));
  s.copy(b,56); names.copy(b,56+s.length); return b;
};
test("FDT root compatibility", () => assert.deepEqual(inspectDeviceTree(fdt()).nodes[0].compatible, ["abc"]));
test("reject truncated FDT and unknown token", () => {
  const b = fdt(); assert.throws(() => inspectDeviceTree(b.subarray(0, 55)));
  b.writeUInt32BE(99,56); assert.throws(() => inspectDeviceTree(b));
});
test("DT table entry ranges", () => {
  const payload = fdt(), b = Buffer.alloc(64+payload.length);
  [0xd7b7ab1e,b.length,32,32,1,32,4096,0,payload.length,64,1,2].forEach((v,i)=>b.writeUInt32BE(v,i*4));
  payload.copy(b,64); assert.equal(inspectDtbo(b).entries[0].id,1);
  b.writeUInt32BE(12,36); assert.throws(()=>inspectDtbo(b));
});
test("vendor boot v3 and v4 layout", () => {
  for (const version of [3,4]) {
    const b=Buffer.alloc(12288); b.write("VNDRBOOT");
    b.writeUInt32LE(version,8); b.writeUInt32LE(4096,12); b.writeUInt32LE(10,24);
    b.writeUInt32LE(version===3?2112:2128,2096); b.writeUInt32LE(20,2100);
    assert.equal(inspectVendorBoot(b).dtb.offset,8192);
    assert.throws(()=>inspectVendorBoot(b.subarray(0,8192)));
  }
});
