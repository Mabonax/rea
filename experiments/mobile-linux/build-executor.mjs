import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, constants } from "node:fs";
import { open, mkdir, mkdtemp, realpath, stat, writeFile, readFile } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { createBuildPlan, checkEffectiveConfig } from "./build-plan.mjs";

export async function hashFile(path, max=2*1024*1024*1024) {
 const fd=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try {
  const before=await fd.stat();
  if(!before.isFile()||before.size>max)throw new Error("Invalid artifact size or type");
  const h=createHash("sha256");let count=0;
  for await(const chunk of createReadStream(path,{fd:fd.fd,autoClose:false})){
   count+=chunk.length;if(count>max)throw new Error("Artifact budget exceeded");h.update(chunk);
  }
  const after=await fd.stat();
  if(count!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw new Error("Artifact changed during hashing");
  return h.digest("hex");
 }finally{await fd.close();}
}
export function kernelCommands(plan,source,output,fragment){
 const envArgs=["ARCH=arm64","CROSS_COMPILE=aarch64-linux-gnu-","O="+output];
 return [
  {name:"defconfig",command:"make",args:["-C",source,...envArgs,"defconfig"]},
  {name:"merge",command:"bash",args:[join(source,"scripts/kconfig/merge_config.sh"),"-m","-O",output,join(output,".config"),fragment]},
  {name:"olddefconfig",command:"make",args:["-C",source,...envArgs,"olddefconfig"]},
  {name:"compile",command:"make",args:["-C",source,...envArgs,"-j"+plan.jobs,"Image"]},
 ];
}
// Linux host only. Trusted source trees and host tools are required. This is
// output isolation, not a security sandbox for untrusted Makefiles.
async function runStep(step,dir,env,timeoutMs){
 const log=await open(join(dir,step.name+".log"),"wx",0o600);
 try{
  await new Promise((resolvePromise,reject)=>{
   const child=spawn(step.command,step.args,{cwd:dir,env,stdio:["ignore",log.fd,log.fd],detached:true,shell:false});
   let timedOut=false;
   const timer=setTimeout(()=>{
    timedOut=true;try{process.kill(-child.pid,"SIGKILL");}catch{}
   },timeoutMs);
   child.once("error",e=>{clearTimeout(timer);reject(e);});
   child.once("close",(code,signal)=>{
    clearTimeout(timer);
    if(timedOut||code!==0)reject(new Error(step.name+" failed: "+(timedOut?"timeout":signal??code)));
    else resolvePromise();
   });
  });
 }finally{await log.close();}
}
export async function executeKernelBuild(input,options){
 if(process.platform!=="linux")throw new Error("Linux host required");
 if(options?.approved!==true)throw new Error("Explicit execution approval required");
 const plan=createBuildPlan(input);
 if(!isAbsolute(options.kernelSource)||!isAbsolute(options.kernelArchive)||!isAbsolute(options.outputRoot))throw new Error("Absolute local paths required");
 const source=await realpath(options.kernelSource);
 const root=await realpath(options.outputRoot);
 if(!(await stat(source)).isDirectory()||!(await stat(root)).isDirectory())throw new Error("Expected source and output directories");
 if(root===source||root.startsWith(source+"/")||source.startsWith(root+"/"))throw new Error("Use independent source and output trees");
 if(await hashFile(options.kernelArchive)!==plan.kernel.archive_sha256)throw new Error("Kernel archive digest mismatch");
 // Archive bytes and the extracted source directory are separate inputs;
 // this executor does not claim cryptographic binding between them.
 const work=await mkdtemp(join(root,"rea-kernel-"));
 const output=join(work,"out"), fragment=join(work,"required.config");
 await mkdir(output,{mode:0o700});await writeFile(fragment,plan.fragment,{flag:"wx",mode:0o600});
 const env={PATH:"/usr/bin:/bin",HOME:work,LANG:"C",LC_ALL:"C",KBUILD_BUILD_USER:"rea",KBUILD_BUILD_HOST:"local"};
 const steps=kernelCommands(plan,source,output,fragment);
 const manifest={schema_version:1,target:plan.target,kernel_revision:plan.kernel.revision,
  archive_sha256:plan.kernel.archive_sha256,source_binding:"caller_asserted_not_verified",
  fragment_sha256:plan.fragment_sha256,status:"running",completed:[],artifacts:{},bootability:"not_verified"};
 const persist=()=>writeFile(join(work,"manifest.json"),JSON.stringify(manifest,null,2)+"\n",{mode:0o600});
 await persist();
 try {
  for(const step of [{name:"compiler",command:"aarch64-linux-gnu-gcc",args:["--version"]},{name:"make",command:"make",args:["--version"]},...steps]){
   if(step.name==="compile"){
    const configPath=join(output,".config");
    if((await stat(configPath)).size>8*1024*1024)throw new Error("Effective configuration too large");
    const effective=checkEffectiveConfig(plan,await readFile(configPath,"utf8"));
    manifest.effective_configuration=effective;
    if(effective.status!=="requirements_met")throw new Error("Effective configuration requirements unmet");
   }
   await runStep(step,work,env,step.name==="compile"?60*60*1000:120000);
   manifest.completed.push(step.name);await persist();
  }
  const image=join(output,"arch/arm64/boot/Image");
  if((await stat(image)).size===0)throw new Error("Empty kernel image");
  manifest.artifacts.Image={path:"out/arch/arm64/boot/Image",sha256:await hashFile(image)};
  manifest.artifacts.config={path:"out/.config",sha256:await hashFile(join(output,".config"),8*1024*1024)};
  manifest.status="kernel_compiled";await persist();return {work,manifest};
 }catch(error){
  manifest.status="failed";manifest.failure=error instanceof Error?error.message:"Build failed";
  await persist();throw new Error("Build failed; inspect "+work,{cause:error});
 }
}
