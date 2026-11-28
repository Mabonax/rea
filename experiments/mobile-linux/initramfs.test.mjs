import test from "node:test";
import assert from "node:assert/strict";
import {gunzipSync} from "node:zlib";
import {createInitramfs,validateBusybox} from "./initramfs.mjs";
function elf(){
 const b=Buffer.alloc(256);b.set([127,69,76,70,2,1,1]);
 b.writeUInt16LE(2,16);b.writeUInt16LE(183,18);b.writeUInt32LE(1,20);b.writeBigUInt64LE(0x400080n,24);b.writeBigUInt64LE(64n,32);
 b.writeUInt16LE(64,52);b.writeUInt16LE(56,54);b.writeUInt16LE(1,56);
 b.writeUInt32LE(1,64);b.writeUInt32LE(5,68);b.writeBigUInt64LE(0x400000n,80);b.writeBigUInt64LE(256n,96);b.writeBigUInt64LE(256n,104);
 return b;
}
test("validates ARM64 ELF layout without claiming BusyBox identity",()=>{
 assert.equal(validateBusybox(elf()).identity,"caller_supplied_not_verified");
 const b=elf();b.writeUInt16LE(62,18);assert.throws(()=>validateBusybox(b));
});
test("rejects dynamic interpreter and bad entry",()=>{
 const b=elf();b.writeUInt32LE(3,64);assert.throws(()=>validateBusybox(b));
 const c=elf();c.writeBigUInt64LE(0n,24);assert.throws(()=>validateBusybox(c));
});
test("deterministic newc archive and boot marker",()=>{
 const a=createInitramfs(elf()),b=createInitramfs(elf());
 assert.deepEqual(a.archive,b.archive);
 const raw=gunzipSync(a.archive);
 assert.equal(raw.toString("ascii",0,6),"070701");
 assert.ok(raw.includes(Buffer.from("REA_MOBILE_BOOT_OK")));
 assert.ok(raw.includes(Buffer.from("TRAILER!!!")));
 assert.equal(a.manifest.boot_status,"not_tested");
});
test("archive headers and alignment can be walked",()=>{
 const {archive}=createInitramfs(elf()),raw=gunzipSync(archive);let p=0;const names=[];
 while(p<raw.length){
  assert.equal(raw.toString("ascii",p,p+6),"070701");
  const fields=Array.from({length:13},(_,i)=>parseInt(raw.toString("ascii",p+6+i*8,p+14+i*8),16));
  const n=fields[11],size=fields[6];const name=raw.toString("utf8",p+110,p+110+n-1);
  names.push(name);p=Math.ceil((p+110+n)/4)*4;p=Math.ceil((p+size)/4)*4;
  if(name==="TRAILER!!!")break;
 }
 assert.equal(p,raw.length);assert.ok(names.includes("dev/console"));assert.ok(names.includes("init"));
});
