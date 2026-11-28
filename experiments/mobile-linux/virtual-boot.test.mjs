import test from "node:test";
import assert from "node:assert/strict";
import {qemuArguments,classifyConsole,runQemuBoot} from "./qemu-boot.mjs";
import {staticConfig,validateStaticConfig,buildBusybox} from "./busybox-build.mjs";
test("QEMU uses TCG and no networking or monitor",()=>{
 const a=qemuArguments("/kernel","/initrd");
 for(const [k,v] of [["-accel","tcg"],["-nic","none"],["-monitor","none"]])assert.equal(a[a.indexOf(k)+1],v);
});
test("marker requires complete exact line and panic takes precedence",()=>{
 assert.equal(classifyConsole("REA_MOBILE_BOOT_OK"),"marker_missing");
 assert.equal(classifyConsole("prefix REA_MOBILE_BOOT_OK\n"),"marker_missing");
 assert.equal(classifyConsole("REA_MOBILE_BOOT_OK\r\n"),"marker_observed");
 assert.equal(classifyConsole("REA_MOBILE_BOOT_OK\nKernel panic - not syncing: test\n"),"kernel_panic");
});
test("BusyBox configuration explicitly replaces required symbols",()=>{
 const c=staticConfig("# CONFIG_STATIC is not set\nCONFIG_ECHO=n\nCONFIG_OTHER=y\n");
 assert.ok(c.includes("CONFIG_STATIC=y"));assert.ok(!c.includes("CONFIG_ECHO=n"));assert.ok(c.includes("CONFIG_OTHER=y"));
});
test("execution requires approval",async()=>{
 await assert.rejects(runQemuBoot({approved:false}));await assert.rejects(buildBusybox({}, {approved:false}));
});

test("legacy tc is disabled while static linking and init applets remain enabled",()=>{
 for(const tc of ["CONFIG_TC=y","CONFIG_TC=n","# CONFIG_TC is not set",""]){
  const c=staticConfig(tc+"\nCONFIG_OTHER=y\n");
  assert.equal(c.split(/\r?\n/u).filter(line=>line.includes("CONFIG_TC")).length,1);
  assert.ok(c.includes("# CONFIG_TC is not set"));
  assert.ok(c.includes("CONFIG_OTHER=y"));
  validateStaticConfig(c);
  assert.throws(()=>validateStaticConfig(c.replace("# CONFIG_TC is not set","CONFIG_TC=y")),/disable TC/);
  assert.throws(()=>validateStaticConfig(c.replace("CONFIG_STATIC=y","CONFIG_STATIC=n")),/STATIC/);
  assert.throws(()=>validateStaticConfig(c+"CONFIG_TC=y\n"),/disable TC/);
 }
});
