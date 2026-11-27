import test from "node:test";
import assert from "node:assert/strict";
import { parseKernelConfig, parseKernelModules, parseKernelRelease, inspectBootImage } from "./kernel.mjs";

test("config distinguishes disabled from missing", () => {
  const result = parseKernelConfig("CONFIG_ARM64=y\n# CONFIG_MODULES is not set\n");
  assert.equal(result.capabilities.CONFIG_ARM64, "y");
  assert.equal(result.capabilities.CONFIG_MODULES, "n");
  assert.equal(result.capabilities.CONFIG_DRM, null);
  assert.throws(() => parseKernelConfig("CONFIG_ARM64=y\nCONFIG_ARM64=n"));
});
test("modules retain used-by names and unparsed count", () => {
  const result = parseKernelModules("foo 4096 2 bar,baz, Live 0x00000000\ninvalid\n");
  assert.deepEqual(result.modules[0].used_by, ["bar", "baz"]);
  assert.equal(result.unparsed_lines, 1);
  assert.throws(() => parseKernelModules("foo 1 0 - Live\nfoo 1 0 - Live"));
});
test("release does not attest GKI", () => {
  assert.equal(parseKernelRelease("6.1.84-android14-11").android_tag, "14");
  assert.equal(parseKernelRelease("6.1.84").gki_status, "not_verified");
  assert.throws(() => parseKernelRelease("Linux something"));
});
function image(version = 4) {
  const b = Buffer.alloc(16384);
  b.write("ANDROID!");
  b.writeUInt32LE(10, 8); b.writeUInt32LE(20, 12);
  b.writeUInt32LE(version === 4 ? 1584 : 1580, 20);
  b.writeUInt32LE(version, 40);
  if (version === 4) b.writeUInt32LE(32, 1580);
  return b;
}
test("boot v3 and v4 offsets and digest", () => {
  for (const version of [3, 4]) {
    const result = inspectBootImage(image(version));
    assert.equal(result.kernel.offset, 4096);
    assert.equal(result.ramdisk.offset, 8192);
    assert.equal(result.signature.size, version === 4 ? 32 : 0);
    assert.match(result.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(result.verification, "not_performed");
  }
});
test("reject invalid and truncated boot layouts", () => {
  assert.throws(() => inspectBootImage(Buffer.alloc(4096)));
  assert.throws(() => inspectBootImage(image().subarray(0, 8192)));
  const b = image(); b.writeUInt32LE(2, 40);
  assert.throws(() => inspectBootImage(b));
});
