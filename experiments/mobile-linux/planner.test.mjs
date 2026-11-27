import test from "node:test";
import assert from "node:assert/strict";
import { components, planMobileLinux } from "./planner.mjs";

const fixture = () => ({ schema_version: 1, platform: "android", model: "Synthetic",
  architecture: "arm64", components: {} });

test("missing components remain unknown and no mutation is authorised", () => {
  const result = planMobileLinux(fixture());
  assert.deepEqual(result.gaps, components);
  assert.equal(result.physical_boot_status, "not_verified");
  assert.equal(result.device_mutation_allowed, false);
});
test("observed facts require evidence", () => {
  const profile = fixture();
  profile.components.kernel = { state: "observed", evidence: [] };
  assert.throws(() => planMobileLinux(profile), TypeError);
});
test("unsupported is retained distinctly", () => {
  const profile = fixture();
  profile.components.modem = { state: "unsupported", evidence: ["synthetic:modem"] };
  assert.equal(planMobileLinux(profile).findings.find(x => x.component === "modem").state, "unsupported");
});
test("all observed still does not prove bootability", () => {
  const profile = fixture();
  for (const component of components) profile.components[component] = { state: "observed", evidence: ["synthetic:" + component] };
  const result = planMobileLinux(profile);
  assert.deepEqual(result.gaps, []);
  assert.equal(result.next_action, "review_source_and_emulator_plan");
  assert.equal(result.physical_boot_status, "not_verified");
});
test("reject unsupported platform and unknown component keys", () => {
  assert.throws(() => planMobileLinux({ ...fixture(), platform: "ios" }), TypeError);
  assert.throws(() => planMobileLinux({ ...fixture(), components: { other: {} } }), TypeError);
});
