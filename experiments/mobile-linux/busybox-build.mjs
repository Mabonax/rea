import { spawn } from "node:child_process";
import { open, mkdtemp, mkdir, realpath, stat, readFile, writeFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { createBuildPlan } from "./build-plan.mjs";
import { hashFile } from "./build-executor.mjs";
import { validateBusybox } from "./initramfs.mjs";
const requiredKeys=["STATIC","ASH","SH_IS_ASH","MOUNT","ECHO","UNAME"];
// BusyBox 1.36.1 tc depends on legacy CBQ definitions removed from newer UAPI headers.
export function staticConfig(text){
 const keys=requiredKeys;
 const map=new Set([...keys,"TC"].map(k=>"CONFIG_"+k));
 const lines=text.split(/\r?\n/u).filter(line=>!map.has(/^(?:# )?(CONFIG_[A-Z0-9_]+)(?:=| is not set)/u.exec(line)?.[1]));
 return lines.join("\n")+"\n"+keys.map(k=>"CONFIG_"+k+"=y").join("\n")+"\n# CONFIG_TC is not set\n";
}
export function validateStaticConfig(text){
 const lines=text.split(/\r?\n/u);
 for(const key of requiredKeys){
  const symbol="CONFIG_"+key;
  const declarations=lines.filter(line=>line.startsWith(symbol+"=")||line==="# "+symbol+" is not set");
  if(declarations.length!==1||declarations[0]!==symbol+"=y")throw new Error("Missing or conflicting effective BusyBox option "+key);
 }
 const tc=lines.filter(line=>line.startsWith("CONFIG_TC=")||line==="# CONFIG_TC is not set");
 if(tc.length!==1||tc[0]!=="# CONFIG_TC is not set")throw new Error("Effective BusyBox configuration must disable TC");
}
export async function buildBusybox(input,options){
 if(process.platform!=="linux"||options?.approved!==true)throw new Error("Linux host and explicit approval required");
 const plan=createBuildPlan(input);
 const {source,archive,outputRoot}=options;
 if(![source,archive,outputRoot].every(x=>typeof x==="string"&&isAbsolute(x)))throw new TypeError("Absolute paths required");
 const src=await realpath(source),root=await realpath(outputRoot);
 if(src===root||src.startsWith(root+"/")||root.startsWith(src+"/"))throw new Error("Independent output directory required");
 if(await hashFile(archive)!==plan.busybox.archive_sha256)throw new Error("BusyBox archive digest mismatch");
 const work=await mkdtemp(join(root,"rea-busybox-")),out=join(work,"out");
 await mkdir(out,{mode:0o700});
 const args=["-C",src,"O="+out,"ARCH=arm64","CROSS_COMPILE=aarch64-linux-gnu-"];
 const env={PATH:"/usr/bin:/bin",HOME:work,LANG:"C",LC_ALL:"C"};
 async function step(name,extra,timeout){
  const log=await open(join(work,name+".log"),"wx",0o600);
  try{await new Promise((resolve,reject)=>{
   const child=spawn("make",[...args,...extra],{cwd:work,env,stdio:["ignore",log.fd,log.fd],detached:true,shell:false});
   let expired=false;const timer=setTimeout(()=>{expired=true;try{process.kill(-child.pid,"SIGKILL");}catch{}},timeout);
   child.once("error",e=>{clearTimeout(timer);reject(e);});
   child.once("close",code=>{clearTimeout(timer);if(expired||code!==0)reject(new Error(name+" failed"));else resolve();});
  });}finally{await log.close();}
 }
 await step("defconfig",["defconfig"],120000);
 const config=join(out,".config");
 if((await stat(config)).size>2*1024*1024)throw new Error("Configuration too large");
 await writeFile(config,staticConfig(await readFile(config,"utf8")));
 // BusyBox supports oldconfig with defaults via its non-interactive silentoldconfig target.
 await step("configure",["silentoldconfig"],120000);
 const effective=await readFile(config,"utf8");
 validateStaticConfig(effective);
 await step("compile",["-j"+plan.jobs,"busybox"],1800000);
 const binary=join(out,"busybox");
 if((await stat(binary)).size>32*1024*1024)throw new Error("BusyBox too large");
 const identity=validateBusybox(await readFile(binary));
 const manifest={schema_version:1,status:"busybox_compiled",revision:plan.busybox.revision,archive_sha256:plan.busybox.archive_sha256,source_binding:"caller_asserted_not_verified",binary:{path:"out/busybox",sha256:identity.sha256},boot_status:"not_tested"};
 await writeFile(join(work,"manifest.json"),JSON.stringify(manifest,null,2)+"\n",{flag:"wx",mode:0o600});
 return {work,manifest};
}
