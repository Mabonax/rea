import { expect, it } from "vitest";
import { createEvidence } from "../../domain/evidence.js";
import { collectMobileEvidence, validateMobileEvidence } from "./MobileEvidence.js";
import { ok } from "../../domain/result.js";

const provider = { id: "adb", name: "Android Debug Bridge", version: null };
const serial = "synthetic-private";
const identity = () => createEvidence(undefined, provider, {
  operation: "inspect_adb_device",
  parameters: { serial },
  result: { serial, properties: [
    { name: "ro.product.model", value: "Synthetic" },
    { name: "ro.product.cpu.abilist", value: "arm64-v8a" },
  ] },
  confidence: "observed",
});
it("validates native evidence and omits explicit serial", () => {
  const report = validateMobileEvidence([identity()]);
  expect(report.integrity).toBe("semantic_identifier_validated");
  expect(report.declared_abis).toEqual(["arm64-v8a"]);
  expect(report.hardware_attestation).toBe("not_performed");
  expect(JSON.stringify(report)).not.toContain(serial);
});
it("rejects a changed normalized payload and duplicate evidence", () => {
  const original = identity();
  expect(() => validateMobileEvidence([{ ...original, normalized_result: {} }])).toThrow();
  expect(() => validateMobileEvidence([original, original])).toThrow();
});
it("calls only the three read-only operations", async () => {
  const calls: string[] = [];
  const report = await collectMobileEvidence({
    async execute(operation) {
      calls.push(operation);
      if (operation === "inspect_adb_device") return ok(identity());
      return ok(createEvidence(undefined, provider, {
        operation,
        parameters: { serial },
        result: operation === "list_adb_features"
          ? { serial, features: [{ name: "android.hardware.wifi" }] }
          : { serial, physical_size: { width: 720, height: 1520 } },
        confidence: "observed",
      }));
    },
  }, serial);
  expect(calls).toEqual(["inspect_adb_device", "list_adb_features", "inspect_adb_display"]);
  expect(report.ok).toBe(true);
});

it("projects a planner-compatible profile without guessing missing hardware", () => {
  const report = validateMobileEvidence([identity()]);
  expect(report.profile).toMatchObject({
    schema_version: 1, platform: "android", architecture: "arm64", components: {},
  });
});
it("rejects invalid serial and cancelled collection before provider calls", async () => {
  const service = { async execute(): Promise<never> { throw new Error("Unexpected call"); } };
  expect(await collectMobileEvidence(service, "")).toMatchObject({ok:false,error:{_tag:"AnalysisInputError"}});
  const controller = new AbortController();
  controller.abort();
  expect(await collectMobileEvidence(service, serial, {signal:controller.signal})).toMatchObject({ok:false,error:{_tag:"AnalysisCancelledError"}});
});
