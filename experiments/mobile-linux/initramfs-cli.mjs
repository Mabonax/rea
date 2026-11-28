import { open, realpath, mkdtemp, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createInitramfs } from "./initramfs.mjs";
try {
 const [binary,expected,root,...extra]=process.argv.slice(2);
 if(!binary||!root||extra.length||! /^[a-f0-9]{64}$/u.test(expected??""))throw new Error("Usage: initramfs-cli.mjs BUSYBOX EXPECTED_SHA256 OUTPUT_ROOT");
 const fd=await open(binary,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 let data;
 try{
  const s=await fd.stat();if(!s.isFile()||s.size>32*1024*1024)throw new Error("Expected bounded regular BusyBox file");
  const b=Buffer.alloc(s.size+1);let n=0;
  while(n<b.length){const {bytesRead}=await fd.read(b,n,b.length-n,null);if(!bytesRead)break;n+=bytesRead;}
  if(n!==s.size)throw new Error("File size changed");
  data=b.subarray(0,n);
 }finally{await fd.close();}
 if(createHash("sha256").update(data).digest("hex")!==expected)throw new Error("BusyBox digest mismatch");
 const {archive,manifest}=createInitramfs(data);
 const work=await mkdtemp(join(await realpath(root),"rea-initramfs-"));
 await writeFile(join(work,"initramfs.cpio.gz"),archive,{flag:"wx",mode:0o600});
 await writeFile(join(work,"manifest.json"),JSON.stringify(manifest,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({work,manifest},null,2));
}catch(e){console.error(e instanceof Error?e.message:"Initramfs generation failed");process.exitCode=1;}
