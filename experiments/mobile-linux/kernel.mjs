// Offline parsers: declarations are not proof of driver compatibility.
import { createHash } from "node:crypto";
const limit = 8 * 1024 * 1024;
function textInput(value) {
  if (typeof value !== "string" || Buffer.byteLength(value) > limit || value.includes("\0")) throw new TypeError("Invalid bounded text input");
  return value;
}
export function parseKernelConfig(value) {
  const options = new Map();
  let ignored = 0;
  for (const line of textInput(value).split(/\r?\n/u)) {
    const set = /^(CONFIG_[A-Za-z0-9_]+)=(.+)$/u.exec(line);
    const unset = /^# (CONFIG_[A-Za-z0-9_]+) is not set$/u.exec(line);
    if (!set && !unset) {
      if (line.trim() && !line.startsWith("#")) ignored++;
      continue;
    }
    const key = (set ?? unset)[1];
    const setting = set ? set[2] : "n";
    if (options.has(key) && options.get(key) !== setting) throw new TypeError("Conflicting kernel option: " + key);
    options.set(key, setting);
  }
  const selected = ["CONFIG_ARM64", "CONFIG_ARM", "CONFIG_X86_64", "CONFIG_MODULES",
    "CONFIG_OF", "CONFIG_DRM", "CONFIG_INPUT", "CONFIG_USB", "CONFIG_WLAN",
    "CONFIG_BT", "CONFIG_SOUND", "CONFIG_MEDIA_SUPPORT", "CONFIG_POWER_SUPPLY",
    "CONFIG_ANDROID_BINDER_IPC", "CONFIG_NAMESPACES", "CONFIG_DEVTMPFS"];
  return { option_count: options.size, ignored_lines: ignored,
    capabilities: Object.fromEntries(selected.map(key => [key, options.get(key) ?? null])),
    limitations: ["Configuration is supplied offline; running kernel identity is not verified."] };
}
export function parseKernelModules(value) {
  const modules = [];
  const seen = new Set();
  let unparsed_lines = 0;
  for (const line of textInput(value).split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const match = /^([A-Za-z0-9_]+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(Live|Loading|Unloading)(?:\s+\S+)?(?:\s+.*)?$/u.exec(line.trim());
    if (!match) { unparsed_lines++; continue; }
    const [, name, size, refs, deps, state] = match;
    if (seen.has(name)) throw new TypeError("Duplicate module: " + name);
    if (![Number(size), Number(refs)].every(Number.isSafeInteger)) throw new TypeError("Module number out of range");
    const dependencies = deps === "-" ? [] : deps.split(",").filter(Boolean);
    if (!dependencies.every(x => /^[A-Za-z0-9_]+$/u.test(x))) throw new TypeError("Invalid module dependency");
    seen.add(name);
    modules.push({ name, size_bytes: Number(size), reference_count: Number(refs), used_by: dependencies, state });
  }
  return { modules, unparsed_lines, limitations: ["Built-in and unloaded drivers are not represented.", "Used-by relationships are not a complete dependency graph."] };
}
export function parseKernelRelease(value) {
  const release = textInput(value).trim();
  if (!/^[0-9]+\.[0-9]+(?:\.[0-9]+)?[A-Za-z0-9._+~-]*$/u.test(release) || release.length > 256) throw new TypeError("Expected uname -r release");
  return { release, android_tag: /(?:^|-)android([0-9]+)(?:-|$)/u.exec(release)?.[1] ?? null,
    gki_status: "not_verified" };
}
export function inspectBootImage(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44 || bytes.length > 128 * 1024 * 1024) throw new TypeError("Expected bounded boot image buffer");
  if (bytes.toString("ascii", 0, 8) !== "ANDROID!") throw new TypeError("Not an Android boot image");
  const version = bytes.readUInt32LE(40);
  if (version !== 3 && version !== 4) throw new TypeError("Only Android boot header v3/v4 supported");
  const headerSize = bytes.readUInt32LE(20);
  const expected = version === 3 ? 1580 : 1584;
  if (headerSize !== expected || bytes.length < 4096) throw new TypeError("Invalid boot header size");
  const kernel = bytes.readUInt32LE(8), ramdisk = bytes.readUInt32LE(12);
  const align = n => Math.ceil(n / 4096) * 4096;
  const kernelOffset = 4096, ramdiskOffset = kernelOffset + align(kernel);
  const signatureSize = version === 4 ? bytes.readUInt32LE(1580) : 0;
  const signatureOffset = ramdiskOffset + align(ramdisk);
  if (ramdiskOffset > bytes.length || signatureOffset > bytes.length || signatureOffset + align(signatureSize) > bytes.length) throw new TypeError("Truncated boot payload");
  return { header_version: version, sha256: createHash("sha256").update(bytes).digest("hex"),
    kernel: { offset: kernelOffset, size: kernel }, ramdisk: { offset: ramdiskOffset, size: ramdisk },
    signature: { offset: signatureOffset, size: signatureSize }, verification: "not_performed",
    limitations: ["Header layout only; no AVB, signature, payload or bootability validation."] };
}
