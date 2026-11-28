import { readFile, stat } from "node:fs/promises";
import { buildBusybox } from "./busybox-build.mjs";
import { runQemuBoot } from "./qemu-boot.mjs";
try{
 const [mode,flag,...args]=process.argv.slice(2);
 if(flag!=="--execute")throw new Error("Explicit --execute required");
 let result;
 if(mode==="busybox"&&args.length===4){
  const [input,source,archive,outputRoot]=args;
  const s=await stat(input);if(!s.isFile()||s.size>65536)throw new Error("Invalid input JSON");
  result=await buildBusybox(JSON.parse(await readFile(input,"utf8")),{approved:true,source,archive,outputRoot});
 }else if(mode==="qemu"&&args.length===5){
  const [kernel,kernelSha256,initramfs,initramfsSha256,outputRoot]=args;
  result=await runQemuBoot({approved:true,kernel,kernelSha256,initramfs,initramfsSha256,outputRoot});
  if(result.report.status!=="guest_marker_observed")process.exitCode=1;
 }else throw new Error("Usage: virtual-boot-cli.mjs busybox --execute INPUT SOURCE ARCHIVE OUTPUT | qemu --execute IMAGE HASH INITRAMFS HASH OUTPUT");
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e instanceof Error?e.message:"Execution failed");process.exitCode=1;}
