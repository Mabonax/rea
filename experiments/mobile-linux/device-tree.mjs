import { createHash } from "node:crypto";
const MAX = 32 * 1024 * 1024;
const align = n => Math.ceil(n / 4) * 4;
const hash = b => createHash("sha256").update(b).digest("hex");
const fail = message => { throw new TypeError(message); };
const strings = b => {
  if (!b.length || b[b.length - 1] !== 0) fail("Unterminated string list");
  return new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, -1)).split("\0");
};
export function inspectDeviceTree(b) {
  if (!Buffer.isBuffer(b) || b.length < 40 || b.length > MAX || b.readUInt32BE(0) !== 0xd00dfeed) fail("Invalid FDT input");
  const total = b.readUInt32BE(4), struct = b.readUInt32BE(8), str = b.readUInt32BE(12), reserve = b.readUInt32BE(16);
  const version = b.readUInt32BE(20), compatible = b.readUInt32BE(24), strSize = b.readUInt32BE(32), structSize = b.readUInt32BE(36);
  if (version !== 17 || compatible > 17 || total > b.length || total < 40 || struct % 4 || reserve % 8 ||
      [struct, str, reserve].some(x => x < 40) || struct + structSize > total || str + strSize > total ||
      (struct < str + strSize && str < struct + structSize)) fail("Invalid FDT block layout");
  let reserveEnd = reserve;
  while (reserveEnd + 16 <= total) {
    const empty = b.readBigUInt64BE(reserveEnd) === 0n && b.readBigUInt64BE(reserveEnd + 8) === 0n;
    reserveEnd += 16;
    if (empty) break;
  }
  if (reserveEnd === reserve || reserveEnd > total || b.readBigUInt64BE(reserveEnd - 16) !== 0n || b.readBigUInt64BE(reserveEnd - 8) !== 0n ||
      (reserve < struct + structSize && struct < reserveEnd) || (reserve < str + strSize && str < reserveEnd)) fail("Invalid reservation block");
  const end = struct + structSize, nodes = [], stack = [], paths = new Set();
  let p = struct, finished = false;
  const cstr = (start, stop) => {
    const zero = b.indexOf(0, start);
    if (zero < start || zero >= stop) fail("Unterminated FDT string");
    return [new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(start, zero)), zero + 1];
  };
  while (p + 4 <= end) {
    const token = b.readUInt32BE(p); p += 4;
    if (token === 1) {
      const [name, next] = cstr(p, end); p = align(next);
      if (p > end || stack.length >= 64 || nodes.length >= 20000 || name.includes("/") || (stack.length === 0 ? name !== "" || nodes.length !== 0 : !name)) fail("Invalid FDT node");
      const parent = stack.at(-1)?.path ?? null;
      const path = parent === null ? "/" : (parent === "/" ? "" : parent) + "/" + name;
      if (paths.has(path)) fail("Duplicate FDT node");
      paths.add(path);
      const node = { path, parent, compatible: [], status: null, phandle: null, properties: [], references: [] };
      nodes.push(node); stack.push(node);
    } else if (token === 2) {
      if (!stack.length) fail("Unbalanced FDT node");
      stack.pop();
    } else if (token === 3) {
      if (!stack.length || p + 8 > end) fail("Invalid FDT property");
      const len = b.readUInt32BE(p), off = b.readUInt32BE(p + 4); p += 8;
      if (off >= strSize || p + len > end || align(p + len) > end) fail("Invalid FDT property range");
      const [name] = cstr(str + off, str + strSize);
      const node = stack.at(-1), value = b.subarray(p, p + len);
      p = align(p + len);
      if (node.properties.includes(name) || node.properties.length >= 512) fail("Duplicate or excessive FDT properties");
      node.properties.push(name);
      if (name === "compatible") node.compatible = strings(value);
      if (name === "status") node.status = strings(value)[0];
      if (name === "phandle" || name === "linux,phandle") {
        if (len !== 4) fail("Invalid phandle");
        const id = value.readUInt32BE(0);
        if (!id || id === 0xffffffff || (node.phandle !== null && node.phandle !== id)) fail("Invalid phandle identity");
        node.phandle = id;
      }
      if (name === "interrupt-parent" || name.endsWith("-supply")) {
        if (len === 4) node.references.push({ property: name, phandle: value.readUInt32BE(0) });
      }
    } else if (token === 4) continue;
    else if (token === 9) { if (stack.length || !nodes.length) fail("Unbalanced FDT"); finished = true; break; }
    else fail("Unknown FDT token");
  }
  if (!finished) fail("Missing FDT end token");
  const handles = new Map();
  for (const n of nodes) if (n.phandle !== null) {
    if (handles.has(n.phandle)) fail("Duplicate phandle");
    handles.set(n.phandle, n.path);
  }
  const edges = nodes.flatMap(n => [
    ...(n.parent === null ? [] : [{ from: n.parent, to: n.path, kind: "contains" }]),
    ...n.references.map(ref => ({ from: n.path, to: handles.get(ref.phandle) ?? null, kind: ref.property, phandle: ref.phandle }))
  ]);
  return { sha256: hash(b), version, total_size: total, nodes, edges,
    overlay_markers: nodes.filter(n => /^\/(?:fragment@[^/]+|__fixups__|__local_fixups__)(?:\/|$)/u.test(n.path)).map(n => n.path),
    limitations: ["FDT v17 only; overlay application, binding validation and variable-cell specifiers are not implemented.", "Containment and selected single-phandle references are not a complete hardware dependency graph."] };
}
export function inspectDtbo(b) {
  if (!Buffer.isBuffer(b) || b.length < 32 || b.length > MAX || b.readUInt32BE(0) !== 0xd7b7ab1e) fail("Invalid DT table");
  const total = b.readUInt32BE(4), header = b.readUInt32BE(8), entry = b.readUInt32BE(12), count = b.readUInt32BE(16), offset = b.readUInt32BE(20), version = b.readUInt32BE(28);
  if (version !== 0 || total > b.length || header !== 32 || entry !== 32 || count > 1024 || offset < header || offset + entry * count > total) fail("Unsupported DT table layout");
  const entries = [];
  for (let i = 0; i < count; i++) {
    const p = offset + i * entry, size = b.readUInt32BE(p), start = b.readUInt32BE(p + 4);
    if (!size || start < offset + entry * count || start + size > total) fail("Invalid DT entry range");
    entries.push({ index: i, offset: start, size, id: b.readUInt32BE(p + 8), revision: b.readUInt32BE(p + 12), sha256: hash(b.subarray(start, start + size)) });
  }
  return { sha256: hash(b), version, entries, limitations: ["Table metadata only; compressed entries and overlay application are not interpreted."] };
}
