import { spawn } from "node:child_process";
import { open, mkdtemp, realpath, writeFile, copyFile, chmod, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join, isAbsolute } from "node:path";
import { hashFile } from "./build-executor.mjs";
const marker="REA_MOBILE_BOOT_OK";
const digest=x=>typeof x==="string"&&/^[a-f0-9]{64}$/u.test(x);
export function qemuArguments(kernel,initramfs){
 return ["-machine","virt","-cpu","cortex-a57","-m","512M","-smp","2","-accel","tcg","-display","none","-serial","stdio","-monitor","none","-nic","none","-no-reboot","-kernel",kernel,"-initrd",initramfs,"-append","console=ttyAMA0 rdinit=/init panic=1"];
}
export function classifyConsole(text){
 const lines=text.split(/\r?\n/u);
 if(lines.some(line=>/Kernel panic - not syncing:/u.test(line)))return "kernel_panic";
 if(lines.slice(0,-1).some(line=>line===marker))return "marker_observed";
 return "marker_missing";
}
export async function runQemuBoot(options){
 if(process.platform!=="linux")throw new Error("Linux host required");
 if(options?.approved!==true)throw new Error("Explicit execution approval required");
 const {kernel,initramfs,outputRoot,kernelSha256,initramfsSha256}=options;
 const timeoutMs=options.timeoutMs??120000;
 if(![kernel,initramfs,outputRoot].every(x=>typeof x==="string"&&isAbsolute(x))||!digest(kernelSha256)||!digest(initramfsSha256)||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw new TypeError("Invalid boot inputs");
 const root=await realpath(outputRoot);
 const work=await mkdtemp(join(root,"rea-qemu-"));
 const k=join(work,"Image"),i=join(work,"initramfs.cpio.gz");
 for(const [source,target,expected,limit] of [[kernel,k,kernelSha256,128*1024*1024],[initramfs,i,initramfsSha256,64*1024*1024]]){
  if(await hashFile(source,limit)!==expected)throw new Error("Input digest mismatch");
  await copyFile(source,target,constants.COPYFILE_EXCL);
  await chmod(target,0o400);
  if(await hashFile(target,limit)!==expected)throw new Error("Copied artifact digest mismatch");
 }
 const log=await open(join(work,"serial.log"),"wx",0o600);
 let output="",bytes=0,reason="exited",exitCode=null;
 const limit=4*1024*1024;
 try{
  await new Promise((resolve,reject)=>{
   const child=spawn("qemu-system-aarch64",qemuArguments(k,i),{cwd:work,env:{PATH:"/usr/bin:/bin",HOME:work,LANG:"C"},stdio:["ignore","pipe","pipe"],detached:true,shell:false});
   let stopping=false;
   const stop=r=>{if(stopping)return;stopping=true;reason=r;try{process.kill(-child.pid,"SIGKILL");}catch{}};
   const timer=setTimeout(()=>stop("timeout"),timeoutMs);
   const consume=(chunk,serial)=>{
    if(stopping)return;
    bytes+=chunk.length;
    if(bytes>limit){stop("output_limit");return;}
     // Capture bounded output in memory; persist after process termination.
    if(serial){output+=chunk.toString("utf8");const result=classifyConsole(output);
      if(result==="kernel_panic")stop("kernel_panic");
      else if(result==="marker_observed")stop("marker_observed");
    }
   };
   child.stdout.on("data",c=>consume(c,true));
   child.stderr.on("data",c=>consume(c,false));
   child.once("error",e=>{clearTimeout(timer);reject(e);});
   child.once("close",code=>{clearTimeout(timer);exitCode=code;resolve();});
  });
 }finally{await log.writeFile(output);await log.close();}
 const report={schema_version:1,target:"qemu-arm64-virt",kernel_sha256:kernelSha256,initramfs_sha256:initramfsSha256,
  status:reason==="marker_observed"?"guest_marker_observed":"boot_not_verified",termination:reason,exit_code:exitCode,
  serial_sha256:await hashFile(join(work,"serial.log"),limit),physical_boot_status:"not_verified",
  limitations:["Serial marker is guest-supplied; does not independently attest guest identity or hardware functionality.","QEMU execution is not a host security sandbox."]};
 await writeFile(join(work,"boot-report.json"),JSON.stringify(report,null,2)+"\n",{flag:"wx",mode:0o600});
 return {work,report};
}
