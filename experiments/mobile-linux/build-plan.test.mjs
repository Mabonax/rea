import test from "node:test";
import assert from "node:assert/strict";
import {createBuildPlan,checkEffectiveConfig} from "./build-plan.mjs";
const input=()=>({schema_version:1,target:"qemu-arm64-virt",kernel:{revision:"a".repeat(40),archive_sha256:"b".repeat(64)},busybox:{revision:"c".repeat(40),archive_sha256:"d".repeat(64)},jobs:4,virtio_extras:false});
test("deterministic fragment and no physical mutation",()=>{
 const a=createBuildPlan(input()),b=createBuildPlan(input());
 assert.equal(a.fragment_sha256,b.fragment_sha256);assert.equal(a.configuration.CONFIG_ARM64,"y");
 assert.equal(a.device_mutation_allowed,false);assert.equal(a.build_status,"not_executed");
});
test("reject physical targets and unpinned revisions",()=>{
 assert.throws(()=>createBuildPlan({...input(),target:"physical-phone"}));
 const i=input();i.kernel.revision="main";assert.throws(()=>createBuildPlan(i));
});
test("effective configuration must contain built-in boot requirements",()=>{
 const p=createBuildPlan(input());assert.equal(checkEffectiveConfig(p,p.fragment).status,"requirements_met");
 const r=checkEffectiveConfig(p,p.fragment.replace("CONFIG_DEVTMPFS=y","CONFIG_DEVTMPFS=m"));
 assert.deepEqual(r.mismatches,[{key:"CONFIG_DEVTMPFS",expected:"y",actual:"m"}]);
});
test("missing symbols and conflicts are not silently accepted",()=>{
 const p=createBuildPlan(input());assert.equal(checkEffectiveConfig(p,"").status,"requirements_unmet");
 assert.throws(()=>checkEffectiveConfig(p,"CONFIG_ARM64=y\nCONFIG_ARM64=n"));
});
test("optional virtio capabilities remain explicit",()=>{
 assert.equal(createBuildPlan(input()).configuration.CONFIG_VIRTIO_NET,undefined);
 assert.equal(createBuildPlan({...input(),virtio_extras:true}).configuration.CONFIG_VIRTIO_NET,"y");
});
