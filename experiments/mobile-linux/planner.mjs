// Pure, offline planning over caller-supplied observations.
export const components = Object.freeze([
  "kernel", "device_tree", "boot_policy", "recovery", "storage",
  "display", "touch", "usb", "wifi", "bluetooth", "gpu", "audio",
  "power", "modem", "camera",
]);

const states = new Set(["observed", "unsupported", "unknown"]);
const architectures = new Set(["arm64", "arm", "x86_64", "x86", "unknown"]);
const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const nonblank = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 512;

export function planMobileLinux(profile) {
  if (!isRecord(profile) || profile.schema_version !== 1 ||
      profile.platform !== "android" || !nonblank(profile.model) ||
      !architectures.has(profile.architecture) || !isRecord(profile.components)) {
    throw new TypeError("Invalid Android mobile profile v1");
  }
  for (const key of Object.keys(profile.components)) {
    if (!components.includes(key)) throw new TypeError("Unknown component: " + key);
  }
  const findings = components.map((component) => {
    const item = Object.hasOwn(profile.components, component)
      ? profile.components[component] : { state: "unknown", evidence: [] };
    if (!isRecord(item) || !states.has(item.state) || !Array.isArray(item.evidence) ||
        item.evidence.length > 32 || !item.evidence.every(nonblank) ||
        (item.state !== "unknown" && item.evidence.length === 0)) {
      throw new TypeError("Invalid component observation: " + component);
    }
    return { component, state: item.state, evidence: [...item.evidence] };
  });
  const gaps = findings.filter((item) => item.state !== "observed").map((item) => item.component);
  return {
    schema_version: 1, model: profile.model, architecture: profile.architecture,
    findings, gaps,
    next_action: profile.architecture === "unknown" || gaps.length
      ? "collect_and_review_evidence" : "review_source_and_emulator_plan",
    physical_boot_status: "not_verified",
    device_mutation_allowed: false,
    limitations: ["Caller-supplied evidence references are not independently verified.",
      "Observed does not imply Linux compatibility or a working driver."],
  };
}
