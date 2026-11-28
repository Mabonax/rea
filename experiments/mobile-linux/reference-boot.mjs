// Reference package boot only; no claim of source compilation.
import { readdir, readFile, writeFile, stat, mkdtemp, realpath } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createInitramfs } from "./initramfs.mjs";
import { runQemuBoot } from "./qemu-boot.mjs";
import { hashFile } from "./build-executor.mjs";
import { gunzipSync } from "node:zlib";

try {
 const [packageRoot,outputRoot,...extra]=process.argv.slice(2);
 if(!packageRoot||!outputRoot||extra.length)throw new Error("Usage: reference-boot.mjs EXTRACTED_PACKAGES OUTPUT_ROOT");
 const root=await realpath(packageRoot),output=await realpath(outputRoot);
 const images=(await readdir(join(root,"boot"))).filter(n=>/^vmlinuz-[A-Za-z0-9.+~-]+-arm64$/u.test(n));
 if(images.length!==1)throw new Error("Expected exactly one reference ARM64 kernel");
 const source=join(root,"boot",images[0]),busybox=join(root,"bin/busybox");
 const work=await mkdtemp(join(output,"reference-"));
 if((await stat(busybox)).size>32*1024*1024||(await stat(source)).size>128*1024*1024)throw new Error("Reference artifact exceeds budget");
 const binary=await readFile(busybox), image=await readFile(source);
 const kernel=image[0]===0x1f&&image[1]===0x8b?gunzipSync(image,{maxOutputLength:128*1024*1024}):image;
 if(kernel.length<64||kernel.readUInt32LE(56)!==0x644d5241)throw new Error("Reference kernel is not a raw or gzip ARM64 Image");
 const {archive,manifest}=createInitramfs(binary);
 const k=join(work,"Image"),i=join(work,"initramfs.cpio.gz");
 await writeFile(k,kernel,{flag:"wx",mode:0o600});
 await writeFile(i,archive,{flag:"wx",mode:0o600});
 await writeFile(join(work,"initramfs-manifest.json"),JSON.stringify(manifest,null,2));
 const result=await runQemuBoot({approved:true,kernel:k,initramfs:i,kernelSha256:await hashFile(k),initramfsSha256:await hashFile(i),outputRoot:work,timeoutMs:240000});
 const report={schema_version:1,validation_lane:"distribution_reference_kernel",source_compilation:"not_performed",package_kernel:images[0],package_kernel_sha256:createHash("sha256").update(image).digest("hex"),boot:result.report};
 await writeFile(join(work,"reference-report.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify(report,null,2));
 if(result.report.status!=="guest_marker_observed")process.exitCode=1;
}catch(e){console.error(e instanceof Error?e.message:"Reference boot failed");process.exitCode=1;}
