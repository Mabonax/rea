import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const MAX=32*1024*1024;
export function validateBusybox(b){
 if(!Buffer.isBuffer(b)||b.length<64||b.length>MAX||b.subarray(0,4).toString("hex")!=="7f454c46"||b[4]!==2||b[5]!==1||b[6]!==1||b.readUInt16LE(18)!==183||![2,3].includes(b.readUInt16LE(16))||b.readUInt32LE(20)!==1)throw new TypeError("Expected ARM64 little-endian ELF executable");
 const off=b.readBigUInt64LE(32),entry=b.readBigUInt64LE(24),size=b.readUInt16LE(54),count=b.readUInt16LE(56);
 if(b.readUInt16LE(52)!==64||off<64n||off>BigInt(b.length)||size!==56||!count||count>1024||off+BigInt(size*count)>BigInt(b.length))throw new TypeError("Invalid ELF program headers");
 let executable=false;
 for(let i=0;i<count;i++){
  const p=Number(off)+i*size,type=b.readUInt32LE(p);
  if(type===3)throw new TypeError("Dynamic interpreter is not supported");
  if(type!==1)continue;
  const flags=b.readUInt32LE(p+4),start=b.readBigUInt64LE(p+8),address=b.readBigUInt64LE(p+16),fileSize=b.readBigUInt64LE(p+32),memSize=b.readBigUInt64LE(p+40);
  if(start+fileSize>BigInt(b.length)||fileSize>memSize)throw new TypeError("Invalid ELF load segment");
  if((flags&1)&&entry>=address&&entry<address+fileSize)executable=true;
 }
 if(!executable)throw new TypeError("ELF entry is not in executable file-backed segment");
 return {architecture:"arm64",interpreter:"absent",sha256:createHash("sha256").update(b).digest("hex"),identity:"caller_supplied_not_verified"};
}
const init=Buffer.from(`#!/bin/busybox sh
export PATH=/bin:/sbin
/bin/busybox mount -t devtmpfs devtmpfs /dev || exit 1
/bin/busybox mount -t proc proc /proc || exit 1
/bin/busybox mount -t sysfs sysfs /sys || exit 1
/bin/busybox mount -t tmpfs tmpfs /tmp || exit 1
/bin/busybox echo "VMT Mobile Linux"
[ "$(/bin/busybox uname -m)" = aarch64 ] || exit 1
/bin/busybox echo REA_MOBILE_BOOT_OK
exec /bin/busybox sh
`);
const hex=n=>n.toString(16).padStart(8,"0");
const pad=n=>Buffer.alloc((4-n%4)%4);
function entry(name,mode,data,ino,major=0,minor=0){
 const path=Buffer.from(name+"\0");
 const header=Buffer.from("070701"+[ino,mode,0,0,1,0,data.length,0,0,major,minor,path.length,0].map(hex).join(""));
 return Buffer.concat([header,path,pad(header.length+path.length),data,pad(data.length)]);
}
export function createInitramfs(busybox){
 const identity=validateBusybox(busybox);
 const entries=[];
 const add=(name,mode,data=Buffer.alloc(0),major=0,minor=0)=>entries.push({name,mode,data,major,minor});
 for(const name of ["bin","sbin","dev","proc","sys","tmp","etc","root"])add(name,name==="tmp"?0o41777:0o40755);
 add("dev/console",0o20600,Buffer.alloc(0),5,1);
 add("dev/null",0o20666,Buffer.alloc(0),1,3);
 add("bin/busybox",0o100755,busybox);
 add("bin/sh",0o120777,Buffer.from("busybox"));
 add("init",0o100755,init);
 add("etc/os-release",0o100644,Buffer.from('NAME="VMT Mobile Linux"\nID=vmt-mobile\nVERSION_ID=0.1\n'));
 const chunks=entries.map((e,i)=>entry(e.name,e.mode,e.data,i+1,e.major,e.minor));
 chunks.push(entry("TRAILER!!!",0,Buffer.alloc(0),entries.length+1));
 const raw=Buffer.concat(chunks),archive=gzipSync(raw,{level:9});
 return {archive,manifest:{schema_version:1,target:"qemu-arm64-virt",busybox:identity,
  entries:entries.map(e=>({path:e.name,mode:e.mode,size:e.data.length,sha256:createHash("sha256").update(e.data).digest("hex")})),
  archive_sha256:createHash("sha256").update(archive).digest("hex"),archive_size:archive.length,boot_status:"not_tested",device_mutation_allowed:false}};
}
