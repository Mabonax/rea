// Project existing REA ADB observations into the experimental mobile profile.
// Envelope IDs are retained, not cryptographically authenticated by this adapter.
const operations = ["inspect_adb_device", "list_adb_features", "inspect_adb_display"];
const abiMap = new Map([["arm64-v8a", "arm64"], ["armeabi-v7a", "arm"], ["armeabi", "arm"], ["x86_64", "x86_64"], ["x86", "x86"]]);
const featureMap = new Map([
  ["android.hardware.touchscreen", "touch"],
  ["android.hardware.wifi", "wifi"],
  ["android.hardware.bluetooth", "bluetooth"],
  ["android.hardware.bluetooth_le", "bluetooth"],
  ["android.hardware.usb.host", "usb"],
  ["android.hardware.usb.accessory", "usb"],
  ["android.hardware.audio.output", "audio"],
  ["android.hardware.microphone", "audio"],
  ["android.hardware.telephony", "modem"],
  ["android.hardware.camera", "camera"],
  ["android.hardware.camera.any", "camera"],
]);
const record = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const boundedText = (x) => typeof x === "string" && x.length > 0 && x.length <= 512 && !/[\x00-\x1f\x7f]/u.test(x);

export function profileFromAdbEvidence(records) {
  if (!Array.isArray(records) || records.length < 1 || records.length > 3) throw new TypeError("Expected one to three ADB evidence records");
  const byOperation = new Map();
  let serial;
  for (const item of records) {
    if (!record(item) || !operations.includes(item.operation) || byOperation.has(item.operation) ||
        !/^ev_[a-f0-9]{64}$/u.test(item.evidence_id ?? "") || item.confidence !== "observed" ||
        !record(item.normalized_result) || !record(item.parameters)) throw new TypeError("Invalid or duplicate ADB observation");
    const target = item.normalized_result.serial;
    if (!boundedText(target) || item.parameters.serial !== target || (serial !== undefined && serial !== target)) {
      throw new TypeError("Evidence must address one explicit device");
    }
    serial = target;
    byOperation.set(item.operation, item);
  }
  const identity = byOperation.get("inspect_adb_device");
  if (!identity) throw new TypeError("Device identity evidence required");
  const props = identity.normalized_result.properties;
  if (!Array.isArray(props) || props.length > 64) throw new TypeError("Invalid properties");
  const values = new Map();
  for (const item of props) {
    if (!record(item) || !boundedText(item.name) || !boundedText(item.value) || values.has(item.name)) throw new TypeError("Invalid or duplicate property");
    values.set(item.name, item.value);
  }
  const model = values.get("ro.product.model");
  if (!model) throw new TypeError("Device model not reported");
  const primaryAbi = (values.get("ro.product.cpu.abilist") ?? "").split(",")[0].trim();
  // ABI is a userspace declaration, not proof of kernel architecture.
  const architecture = abiMap.get(primaryAbi) ?? "unknown";
  const components = {};
  const mark = (component, id) => {
    const previous = components[component]?.evidence ?? [];
    components[component] = { state: "observed", evidence: [...new Set([...previous, id])] };
  };
  const features = byOperation.get("list_adb_features");
  if (features) {
    const rows = features.normalized_result.features;
    if (!Array.isArray(rows) || rows.length > 4096) throw new TypeError("Invalid feature inventory");
    for (const row of rows) {
      if (!record(row) || !boundedText(row.name)) throw new TypeError("Invalid feature row");
      const component = featureMap.get(row.name);
      if (component) mark(component, features.evidence_id);
    }
  }
  const display = byOperation.get("inspect_adb_display");
  if (display) {
    const size = display.normalized_result.physical_size;
    if (!record(size) || ![size.width, size.height].every(x => Number.isSafeInteger(x) && x > 0)) throw new TypeError("Invalid physical display size");
    mark("display", display.evidence_id);
  }
  return {
    schema_version: 1, platform: "android", model, architecture, components,
    provenance: {
      identity_evidence: identity.evidence_id,
      architecture_basis: "declared_primary_android_userspace_abi",
      evidence_ids: records.map(x => x.evidence_id),
      limitations: ["Evidence IDs are not authenticated by this experimental adapter.",
        "Android feature declarations do not prove Linux driver support.",
        "Missing declarations remain unknown; device serial and raw evidence are not emitted."],
    },
  };
}
