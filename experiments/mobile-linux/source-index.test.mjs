import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,writeFile,mkdir,symlink,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { indexKernelSource,inventoryFirmware,discoverBuildHints } from "./source-index.mjs";
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),"rea-mobile-"));
 t.after(()=>rm(root,{recursive:true,force:true}));return root;
}
test("indexes literal matches and build hints with file digests",async t=>{
 const root=await fixture(t);
 await mkdir(join(root,"drivers"));
 await writeFile(join(root,"drivers","chip.c"),'.compatible = "example,chip"');
 await writeFile(join(root,"drivers","Makefile"),"obj-$(CONFIG_CHIP) += chip.o\n");
 await writeFile(join(root,"drivers","Kconfig"),"config CHIP\n depends on I2C\n");
 const r=await indexKernelSource(root,"a".repeat(40));
 assert.equal(r.records.length,3);
 assert.equal(r.records.find(x=>x.kind==="c").hints[0].compatible,"example,chip");
 assert.equal(r.records.find(x=>x.kind==="kbuild").hints[0].symbol,"CONFIG_CHIP");
 assert.equal(r.revision_status,"caller_supplied_not_verified");
});
test("firmware inventory hashes files and skips symlinks",async t=>{
 const root=await fixture(t);
 await writeFile(join(root,"fw.bin"),Buffer.from("abc"));
 await symlink("fw.bin",join(root,"alias.bin"));
 const r=await inventoryFirmware(root);
 assert.equal(r.stats.skipped_links,1);
 assert.equal(r.files[0].sha256,"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("oversized firmware remains visible without digest",async t=>{
 const root=await fixture(t);
 await writeFile(join(root,"large.bin"),Buffer.alloc(2*1024*1024+1));
 const r=await inventoryFirmware(root);
 assert.equal(r.files[0].status,"too_large");assert.equal(r.files[0].sha256,null);
});
test("invalid revision rejected",async t=>{
 const root=await fixture(t);await assert.rejects(indexKernelSource(root,"main"),TypeError);
});
test("Kconfig directives remain literal hints",()=>{
 assert.deepEqual(discoverBuildHints("config TEST\n depends on USB && I2C\n","kconfig"),[{line:1,symbol:"CONFIG_TEST"},{line:2,directive:"depends on",expression:"USB && I2C"}]);
});
