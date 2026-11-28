import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {hashFile,kernelCommands,executeKernelBuild} from "./build-executor.mjs";
import {createBuildPlan} from "./build-plan.mjs";
const input=()=>({schema_version:1,target:"qemu-arm64-virt",kernel:{revision:"a".repeat(40),archive_sha256:"b".repeat(64)},busybox:{revision:"c".repeat(40),archive_sha256:"d".repeat(64)},jobs:4,virtio_extras:false});
test("build commands use explicit argv and bounded jobs",()=>{
 const commands=kernelCommands(createBuildPlan(input()),"/src tree","/out","/fragment");
 assert.deepEqual(commands.map(s=>s.name),["defconfig","merge","olddefconfig","compile"]);
 assert.ok(commands[0].args.includes("/src tree"));assert.ok(commands[3].args.includes("-j4"));
});
test("file hash and budget",async t=>{
 const root=await mkdtemp(join(tmpdir(),"rea-build-"));t.after(()=>rm(root,{recursive:true,force:true}));
 const file=join(root,"input");await writeFile(file,"abc");
 assert.equal(await hashFile(file),"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
 await assert.rejects(hashFile(file,2));
});
test("execution is opt-in",async()=>{await assert.rejects(executeKernelBuild(input(),{approved:false}));});
test("archive mismatch refuses before compilation", {skip:process.platform!=="linux"},async t=>{
 const root=await mkdtemp(join(tmpdir(),"rea-build-"));t.after(()=>rm(root,{recursive:true,force:true}));
 const {mkdir}=await import("node:fs/promises");
 const src=join(root,"src"),out=join(root,"out"),archive=join(root,"archive");
 await mkdir(src);await mkdir(out);await writeFile(archive,"abc");
 await assert.rejects(executeKernelBuild(input(),{approved:true,kernelSource:src,kernelArchive:archive,outputRoot:out}),/digest mismatch/);
});
