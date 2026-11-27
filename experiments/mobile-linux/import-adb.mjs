import { open } from "node:fs/promises";
import { profileFromAdbEvidence } from "./adb-evidence.mjs";
import { planMobileLinux } from "./planner.mjs";

async function readEvidence(path) {
  const limit = 2 * 1024 * 1024;
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error("Expected regular evidence JSON <=2 MiB");
    const buffer = Buffer.alloc(limit + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await file.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > limit) throw new Error("Evidence exceeds 2 MiB");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, used)));
  } finally {
    await file.close();
  }
}

try {
  const paths = process.argv.slice(2);
  if (paths.length < 1 || paths.length > 3) throw new Error("Usage: node import-adb.mjs IDENTITY.json [FEATURES.json] [DISPLAY.json]");
  const records = [];
  for (const path of paths) records.push(await readEvidence(path));
  const profile = profileFromAdbEvidence(records);
  console.log(JSON.stringify({ profile, plan: planMobileLinux(profile) }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Evidence import failed");
  process.exitCode = 1;
}
