import { open } from "node:fs/promises";
import { planMobileLinux } from "./planner.mjs";

const limit = 64 * 1024;
try {
  if (process.argv.length !== 3) throw new Error("Usage: node plan.mjs PROFILE.json");
  const file = await open(process.argv[2], "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error("Expected regular JSON file <=64 KiB");
    const bytes = Buffer.alloc(limit + 1);
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await file.read(bytes, used, bytes.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > limit) throw new Error("Profile exceeds 64 KiB");
    const profile = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, used)));
    console.log(JSON.stringify(planMobileLinux(profile), null, 2));
  } finally {
    await file.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Planning failed");
  process.exitCode = 1;
}
