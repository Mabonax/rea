import { z } from "zod";
import { parseEvidence } from "../../domain/evidence.js";
import type { Evidence } from "../../domain/evidence.js";
import type { AdbDeviceAnalysisService } from "./AdbDeviceAnalysisService.js";
import type { ExecutionOptions } from "../AnalysisProvider.js";

const operations = [
  "inspect_adb_device",
  "list_adb_features",
  "inspect_adb_display",
] as const;

const serialSchema = z.string().min(1).max(256).regex(/^[^\x00\s"']+$/u);
const boundedText = z.string().min(1).max(512);
const propertySchema = z.object({ name: boundedText, value: boundedText });
const identitySchema = z.object({
  serial: serialSchema,
  properties: z.array(propertySchema).max(64),
});
const featuresSchema = z.object({
  serial: serialSchema,
  features: z.array(z.object({ name: boundedText })).max(4096),
});
const displaySchema = z.object({
  serial: serialSchema,
  physical_size: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});

/** Validate the native semantic evidence identifier, not device attestation. */
export function validateMobileEvidence(input: readonly unknown[]) {
  if (input.length < 1 || input.length > 3)
    throw new TypeError("Expected one to three ADB observations");
  const records = new Map<string, Evidence>();
  let serial: string | undefined;
  for (const candidate of input) {
    const evidence = parseEvidence(candidate);
    const operation = evidence.operation;
    if (
      !operations.some((allowed) => allowed === operation) ||
      evidence.provider.id !== "adb" ||
      evidence.confidence !== "observed" ||
      records.has(operation)
    )
      throw new TypeError("Unexpected or duplicate ADB observation");
    const schema =
      operation === "inspect_adb_device"
        ? identitySchema
        : operation === "list_adb_features"
          ? featuresSchema
          : displaySchema;
    const result = schema.parse(evidence.normalized_result);
    if (
      evidence.parameters.serial !== result.serial ||
      (serial !== undefined && serial !== result.serial)
    )
      throw new TypeError("Observations must address one explicit device");
    serial = result.serial;
    records.set(operation, evidence);
  }
  const identity = records.get("inspect_adb_device");
  if (identity === undefined) throw new TypeError("Missing device identity");
  const properties = identitySchema.parse(identity.normalized_result).properties;
  const names = new Set<string>();
  for (const property of properties) {
    if (names.has(property.name)) throw new TypeError("Duplicate property");
    names.add(property.name);
  }
  const model = properties.find((p) => p.name === "ro.product.model")?.value;
  if (model === undefined) throw new TypeError("Missing model declaration");
  const abi = properties.find((p) => p.name === "ro.product.cpu.abilist")?.value;
  const featureEvidence = records.get("list_adb_features");
  const displayEvidence = records.get("inspect_adb_display");
  return {
    schema_version: 1,
    model,
    declared_abis: abi?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    features: featureEvidence === undefined
      ? []
      : featuresSchema.parse(featureEvidence.normalized_result).features.map((f) => f.name),
    display: displayEvidence === undefined
      ? null
      : displaySchema.parse(displayEvidence.normalized_result).physical_size,
    evidence_ids: [...records.values()].map((item) => item.evidence_id),
    integrity: "semantic_identifier_validated",
    hardware_attestation: "not_performed",
    runtime_status: "not_tested",
    device_mutation_allowed: false,
  } as const;
}

/** Read-only orchestration; the caller owns the service and its lifecycle. */
export async function collectMobileEvidence(
  service: Pick<AdbDeviceAnalysisService, "execute">,
  serial: string,
  options?: ExecutionOptions,
) {
  const selected = serialSchema.parse(serial);
  const records: Evidence[] = [];
  for (const operation of operations) {
    if (options?.signal?.aborted) throw options.signal.reason ?? new Error("Cancelled");
    const result = await service.execute(operation, { serial: selected }, options);
    if (!result.ok) return result;
    records.push(result.value);
  }
  if (options?.signal?.aborted) throw options.signal.reason ?? new Error("Cancelled");
  return { ok: true as const, value: validateMobileEvidence(records) };
}
