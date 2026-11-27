import { createHash } from "node:crypto";
// Conservative discovery of literal C designated initializers, not a C parser.
export function discoverCompatibleLiterals(source) {
  if (typeof source !== "string" || Buffer.byteLength(source)>2*1024*1024 || source.includes("\0")) throw new TypeError("Expected bounded C source");
  const matches = [];
  const pattern = /\.compatible\s*=\s*"([A-Za-z0-9][A-Za-z0-9,._+\-]{0,255})"/gu;
  for (const m of source.matchAll(pattern)) {
    if (matches.length >= 4096) throw new TypeError("Too many source candidates");
    matches.push({ compatible:m[1], utf16_offset:m.index, basis:"unreviewed_text_match" });
  }
  return { source_sha256:createHash("sha256").update(source,"utf8").digest("hex"), matches,
    limitations:["May match comments, strings or inactive preprocessor branches; misses macros and generated tables.", "Review the source and build rules before adding any candidate to the catalog."] };
}
