// Exact compatible-string matching against explicit, reviewed source records.
const record = x => x !== null && typeof x === "object" && !Array.isArray(x);
const text = x => typeof x === "string" && x.length > 0 && x.length <= 512 && !/[\x00-\x1f\x7f]/u.test(x);
const digest = x => typeof x === "string" && /^[a-f0-9]{64}$/u.test(x);
const list = (x, max, predicate) => Array.isArray(x) && x.length <= max && x.every(predicate);
const configKey = x => typeof x === "string" && /^CONFIG_[A-Z0-9_]+$/u.test(x);
const sourcePath = x => text(x) && !x.startsWith("/") && !x.includes("\\") && x.split("/").every(s => s && s !== "." && s !== "..");
const revision = x => typeof x === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(x);

export function matchDrivers(tree, catalog, config = {}) {
  if (!record(tree) || !digest(tree.sha256) || !list(tree.nodes, 20000, n => record(n) && text(n.path) && n.path.startsWith("/") && list(n.compatible, 128, text) && (n.status === null || text(n.status)))) throw new TypeError("Invalid device tree report");
  if (!record(catalog) || catalog.schema_version !== 1 || !list(catalog.drivers, 20000, record) || !record(config)) throw new TypeError("Invalid driver catalog or configuration");
  const index = new Map(), ids = new Set(), paths = new Set();
  for (const row of catalog.drivers) {
    if (!text(row.id) || ids.has(row.id) || !["mainline", "vendor", "other"].includes(row.origin) ||
        !revision(row.revision) || !sourcePath(row.path) || !digest(row.source_sha256) ||
        !list(row.compatible, 128, text) || !row.compatible.length ||
        !list(row.config_all, 64, configKey) || !list(row.firmware, 128, sourcePath)) throw new TypeError("Invalid or duplicate driver record");
    ids.add(row.id);
    for (const key of new Set(row.compatible)) {
      const candidates = index.get(key) ?? [];
      if (candidates.length >= 128) throw new TypeError("Excessive candidates per compatible");
      candidates.push(row); index.set(key, candidates);
    }
  }
  let count = 0;
  const nodes = tree.nodes.map(node => {
    if (paths.has(node.path)) throw new TypeError("Duplicate hardware path");
    paths.add(node.path);
    const candidates = new Map();
    for (const key of node.compatible) for (const row of index.get(key) ?? []) {
      if (!candidates.has(row.id)) {
        if (++count > 50000) throw new TypeError("Candidate output budget exceeded");
        candidates.set(row.id, { row, matches: [] });
      }
      const matches = candidates.get(row.id).matches;
      if (!matches.includes(key)) matches.push(key);
    }
    const matches = [...candidates.values()].map(({row, matches}) => {
      const requirements = row.config_all.map(key => {
        const value = Object.hasOwn(config, key) ? config[key] : null;
        if (![null,"y","m","n"].includes(value)) throw new TypeError("Invalid config state: " + key);
        return { key, value };
      });
      return { id: row.id, origin: row.origin, revision: row.revision, path: row.path, source_sha256: row.source_sha256,
        matched_compatible: matches, requirements, config_status: requirements.some(x=>x.value==="n") ? "declared_disabled" : !requirements.length || requirements.some(x=>x.value===null) ? "unknown" : "declared_enabled",
        firmware: row.firmware.map(path=>({path, status:"not_verified"})), runtime_status:"not_tested" };
    });
    return { path:node.path, compatible:node.compatible, status:node.status,
      assessment: node.status !== null && !["okay","ok"].includes(node.status) ? "node_not_enabled" : !node.compatible.length ? "no_compatible_declared" : matches.length ? "candidate_found" : "no_catalog_match", candidates:matches };
  });
  return { schema_version:1, device_tree_sha256:tree.sha256, nodes,
    summary:{ nodes:nodes.length, candidate_nodes:nodes.filter(n=>n.assessment==="candidate_found").length, unmatched_nodes:nodes.filter(n=>n.assessment==="no_catalog_match").length },
    bootability:"not_verified", limitations:["Catalog entries and source hashes are caller-supplied, not authenticated.", "Exact string matches do not establish driver binding or runtime compatibility.", "No catalog match does not mean unsupported; config requirements may be incomplete."] };
}
