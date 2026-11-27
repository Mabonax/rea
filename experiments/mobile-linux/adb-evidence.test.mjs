import test from "node:test";
import assert from "node:assert/strict";
import { profileFromAdbEvidence } from "./adb-evidence.mjs";
import { planMobileLinux } from "./planner.mjs";

const obs = (operation, data, digit = "a", serial = "private-test-serial") => ({
  operation, evidence_id: "ev_" + digit.repeat(64), confidence: "observed",
  parameters: { serial }, normalized_result: { serial, ...data },
});
const identity = () => obs("inspect_adb_device", { properties: [
  { name: "ro.product.model", value: "Synthetic device" },
  { name: "ro.product.cpu.abilist", value: "arm64-v8a,armeabi-v7a" },
] });
const features = () => obs("list_adb_features", { features: [
  { name: "android.hardware.wifi", version: null },
  { name: "android.hardware.bluetooth", version: null },
  { name: "android.hardware.bluetooth_le", version: null },
] }, "b");
const display = () => obs("inspect_adb_display", { physical_size: { width: 1080, height: 1920 } }, "c");

test("maps declarations and preserves provenance without device serial", () => {
  const result = profileFromAdbEvidence([identity(), features(), display()]);
  assert.equal(result.architecture, "arm64");
  assert.equal(result.components.wifi.state, "observed");
  assert.equal(result.components.bluetooth.evidence.length, 1);
  assert.equal(result.components.display.state, "observed");
  assert.equal(planMobileLinux(result).physical_boot_status, "not_verified");
  assert.ok(planMobileLinux(result).gaps.includes("kernel"));
  assert.ok(!JSON.stringify(result).includes("private-test-serial"));
});
test("missing features are unknown, not unsupported", () => {
  const result = planMobileLinux(profileFromAdbEvidence([identity()]));
  assert.equal(result.findings.find(x => x.component === "wifi").state, "unknown");
});
test("reject mixed devices and operation duplication", () => {
  const other = features();
  other.normalized_result.serial = "other";
  assert.throws(() => profileFromAdbEvidence([identity(), other]));
  assert.throws(() => profileFromAdbEvidence([identity(), identity()]));
});
test("reject mutation evidence and absent identity", () => {
  assert.throws(() => profileFromAdbEvidence([identity(), obs("push_adb_file", {})]));
  assert.throws(() => profileFromAdbEvidence([features()]));
});
test("unknown ABI is not guessed; malformed display is rejected", () => {
  const item = identity();
  item.normalized_result.properties[1].value = "riscv64";
  assert.equal(profileFromAdbEvidence([item]).architecture, "unknown");
  const bad = display();
  bad.normalized_result.physical_size.width = -1;
  assert.throws(() => profileFromAdbEvidence([identity(), bad]));
});
