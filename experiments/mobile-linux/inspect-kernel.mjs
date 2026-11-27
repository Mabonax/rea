import { open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseKernelConfig, parseKernelModules, parseKernelRelease, inspectBootImage } from "./kernel.mjs";
const modes = new Map([["config", parseKernelConfig], ["modules", parseKernelModules], ["release", parseKernelRelease], ["boot", inspectBootImage]]);
try {
  const [, , mode, path] = process.argv;
  if (process.argv.length !== 4 || !modes.has(mode)) throw new Error("Usage: node inspect-kernel.mjs config|modules|release|boot FILE");
  const limit = (mode === "boot" ? 128 : 8) * 1024 * 1024;
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error("Expected bounded regular file");
    const buffer = Buffer.alloc(stat.size + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await file.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used !== stat.size) throw new Error("File size changed during read");
    const bytes = buffer.subarray(0, used);
    const result = modes.get(mode)(mode === "boot" ? bytes : new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    console.log(JSON.stringify({ mode, sha256: createHash("sha256").update(bytes).digest("hex"), result }, null, 2));
  } finally { await file.close(); }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Inspection failed");
  process.exitCode = 1;
}
