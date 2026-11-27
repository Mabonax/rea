import { opendir, open, lstat, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { discoverCompatibleLiterals } from "./source-candidate.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAX_FILE = 2 * 1024 * 1024;
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ENTRIES = 100000;
const MAX_RESULTS = 20000;

// Intended for stable local checkouts, not hostile concurrently modified trees.
async function boundedRead(path, expected, max) {
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const before = await file.stat();
    if (!before.isFile() || before.dev !== expected.dev || before.ino !== expected.ino || before.size > max) throw new Error("File changed or exceeds budget");
    const bytes = Buffer.alloc(before.size + 1);
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await file.read(bytes, used, bytes.length-used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    const after = await file.stat();
    if (used !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error("File changed during read");
    return bytes.subarray(0,used);
  } finally { await file.close(); }
}

async function walk(root, visit) {
  const original = await lstat(root);
  if (!original.isDirectory() || original.isSymbolicLink()) throw new TypeError("Expected a real directory");
  root = await realpath(root);
  const queue = [{ path:root, depth:0 }];
  let visited=0, skipped_links=0, skipped_special=0;
  while(queue.length) {
    const {path,depth}=queue.pop();
    if(depth>64) throw new Error("Directory depth budget exceeded");
    const dir=await opendir(path);
    for await(const entry of dir) {
      if(++visited>MAX_ENTRIES) throw new Error("Directory entry budget exceeded");
      if(entry.name===".git") continue;
      const full=join(path,entry.name);
      const stat=await lstat(full);
      if(stat.isSymbolicLink()){skipped_links++;continue;}
      if(stat.isDirectory()){queue.push({path:full,depth:depth+1});continue;}
      if(!stat.isFile()){skipped_special++;continue;}
      await visit(full,relative(root,full).split(sep).join("/"),stat);
    }
  }
  return {visited,skipped_links,skipped_special};
}

export function discoverBuildHints(source, kind) {
  const hints=[];
  for(const [i,line] of source.split(/\r?\n/u).entries()){
    let match;
    if(kind==="kbuild") {
      match=/^\s*obj-\$\(CONFIG_([A-Z0-9_]+)\)\s*\+=\s*([^#]+)$/u.exec(line);
      if(match) hints.push({line:i+1,symbol:"CONFIG_"+match[1],objects:match[2].trim().split(/\s+/u)});
    } else {
      match=/^\s*(?:menuconfig|config)\s+([A-Z0-9_]+)\s*$/u.exec(line);
      if(match) hints.push({line:i+1,symbol:"CONFIG_"+match[1]});
      else if((match=/^\s*(depends on|select|imply)\s+(.+)$/u.exec(line))) hints.push({line:i+1,directive:match[1],expression:match[2]});
    }
    if(hints.length>4096) throw new Error("Build hint budget exceeded");
  }
  return hints;
}
export async function indexKernelSource(root, revision) {
  if(typeof revision!=="string"||! /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(revision)) throw new TypeError("Expected full caller-supplied Git revision");
  const records=[], skipped=[]; let readBytes=0, skippedCount=0, hintsCount=0;
  const stats=await walk(root,async(full,path,stat)=>{
    if(!/\.(?:c|h)$/u.test(path)&&!/(?:^|\/)(?:Kconfig(?:\.[^/]+)?|Kbuild|Makefile)$/u.test(path))return;
    if(stat.size>MAX_FILE){skippedCount++;if(skipped.length<100)skipped.push(path);return;}
    if(readBytes+stat.size>MAX_BYTES)throw new Error("Source byte budget exceeded; index a smaller subtree");
    const bytes=await boundedRead(full,stat,MAX_FILE);readBytes+=bytes.length;
    let source;try{source=decoder.decode(bytes);}catch{skippedCount++;if(skipped.length<100)skipped.push(path);return;}
    const kind=/\.(?:c|h)$/u.test(path)?"c":/(?:^|\/)Kconfig/u.test(path)?"kconfig":"kbuild";
    const hints=kind==="c"?discoverCompatibleLiterals(source).matches:discoverBuildHints(source,kind);
    hintsCount+=hints.length;
    if(hintsCount>100000)throw new Error("Total hint budget exceeded");
    if(hints.length){if(records.length>=MAX_RESULTS)throw new Error("Source record budget exceeded");records.push({path,kind,sha256:sha(bytes),hints});}
  });
  records.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return {schema_version:1,revision,revision_status:"caller_supplied_not_verified",records,stats:{...stats,read_bytes:readBytes,skipped_count:skippedCount,skipped_examples:skipped},limitations:["Lexical hints only; no preprocessing, Kconfig evaluation, build graph or licence verification.","Paths are relative to the supplied subtree; Git revision and checkout consistency are not authenticated.","Symlinks are skipped; use stable local trees without concurrent modifications."]};
}
export async function inventoryFirmware(root) {
  const files=[];let readBytes=0,oversized=0;
  const stats=await walk(root,async(full,path,stat)=>{
    if(files.length>=MAX_RESULTS)throw new Error("Firmware record budget exceeded");
    if(stat.size>MAX_FILE){oversized++;files.push({path,size:stat.size,sha256:null,status:"too_large"});return;}
    if(readBytes+stat.size>MAX_BYTES)throw new Error("Firmware byte budget exceeded; use smaller subtree");
    const bytes=await boundedRead(full,stat,MAX_FILE);readBytes+=bytes.length;
    files.push({path,size:bytes.length,sha256:sha(bytes),status:"hashed"});
  });
  files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return {schema_version:1,files,stats:{...stats,read_bytes:readBytes,oversized},limitations:["Presence and digest do not prove authenticity, licence or runtime suitability.","Symlinks and files exceeding 2 MiB are not hashed."]};
}
