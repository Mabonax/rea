import { readFile, stat, writeFile, realpath, mkdtemp } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { executeKernelBuild, hashFile } from "./build-executor.mjs";
import { buildBusybox } from "./busybox-build.mjs";
import { createInitramfs } from "./initramfs.mjs";
import { runQemuBoot } from "./qemu-boot.mjs";
try {
 const [flag,input,kernelSource,kernelArchive,busyboxSource,busyboxArchive,outputRoot,...extra]=process.argv.slice(2);
 if(flag!=="--execute"||extra.length||![input,kernelSource,kernelArchive,busyboxSource,busyboxArchive,outputRoot].every(x=>typeof x==="string"&&isAbsolute(x)))throw new Error("Usage: source-boot.mjs --execute INPUT KERNEL_SOURCE KERNEL_ARCHIVE BUSYBOX_SOURCE BUSYBOX_ARCHIVE OUTPUT (absolute paths)");
 const s=await stat(input);if(!s.isFile()||s.size>65536)throw new Error("Expected small regular build input");
 const plan=JSON.parse(await readFile(input,"utf8"));
 const work=await mkdtemp(join(await realpath(outputRoot),"rea-source-boot-"));
 const report={schema_version:1,validation_lane:"source_compilation",status:"running",completed:[],physical_boot_status:"not_verified"};
 const persist=()=>writeFile(join(work,"source-boot-report.json"),JSON.stringify(report,null,2)+"\n",{mode:0o600});
 await persist();
 try{
  const kernel=await executeKernelBuild(plan,{approved:true,kernelSource,kernelArchive,outputRoot:work});
  report.completed.push("kernel_compiled");report.kernel=kernel.manifest;await persist();
  const busybox=await buildBusybox(plan,{approved:true,source:busyboxSource,archive:busyboxArchive,outputRoot:work});
  report.completed.push("busybox_compiled");report.busybox=busybox.manifest;await persist();
  const binary=join(busybox.work,busybox.manifest.binary.path);
  if(await hashFile(binary,32*1024*1024)!==busybox.manifest.binary.sha256)throw new Error("BusyBox artifact digest mismatch");
  const {archive,manifest}=createInitramfs(await readFile(binary));
  if(manifest.busybox.sha256!==busybox.manifest.binary.sha256)throw new Error("BusyBox changed during read");
  const initramfs=join(work,"initramfs.cpio.gz");
  await writeFile(initramfs,archive,{flag:"wx",mode:0o600});
  report.completed.push("initramfs_generated");report.initramfs=manifest;await persist();
  const boot=await runQemuBoot({approved:true,kernel:join(kernel.work,kernel.manifest.artifacts.Image.path),kernelSha256:kernel.manifest.artifacts.Image.sha256,initramfs,initramfsSha256:manifest.archive_sha256,outputRoot:work,timeoutMs:240000});
  report.boot=boot.report;
  report.status=boot.report.status==="guest_marker_observed"?"guest_marker_observed":"boot_not_verified";
  report.completed.push("qemu_attempted");await persist();
  console.log(JSON.stringify({work,report},null,2));
  if(report.status!=="guest_marker_observed")process.exitCode=1;
 }catch(error){report.status="failed";report.failure=error instanceof Error?error.message:"Unknown failure";await persist();throw error;}
}catch(error){console.error(error instanceof Error?error.message:"Source build failed");process.exitCode=1;}
