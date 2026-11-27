import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { matchDrivers } from "./driver-match.mjs";
import { planMobileLinux } from "./planner.mjs";

const digest = x => typeof x === "string" && /^[a-f0-9]{64}$/u.test(x);
const record = x => x !== null && typeof x === "object" && !Array.isArray(x);
const pathOk = x => typeof x === "string" && x.length <= 512 && !/[\\\x00-\x1f]/u.test(x) && x.split("/").every(p=>p && p!=="." && p!=="..");
const encode = x => {
 const json=JSON.stringify(x);
 if(typeof json!=="string"||Buffer.byteLength(json)>16*1024*1024)throw new TypeError("Report exceeds storage budget");
 return json;
};
export function buildDeviceReport({profile,tree,catalog,config={},firmware}) {
 const plan=planMobileLinux(profile);
 const matches=matchDrivers(tree,catalog,config);
 if(!record(firmware)||firmware.schema_version!==1||!Array.isArray(firmware.files)||firmware.files.length>20000)throw new TypeError("Invalid firmware inventory");
 const inventory=new Map();
 for(const f of firmware.files){
  if(!record(f)||!pathOk(f.path)||inventory.has(f.path)||!Number.isSafeInteger(f.size)||f.size<0||
    !(f.status==="hashed"&&digest(f.sha256)||f.status==="too_large"&&f.sha256===null))throw new TypeError("Invalid firmware entry");
  inventory.set(f.path,f);
 }
 let count=0;
 for(const node of matches.nodes)for(const candidate of node.candidates)for(const fw of candidate.firmware){
  if(++count>100000)throw new TypeError("Firmware relationship budget exceeded");
  const observed=inventory.get(fw.path);
  fw.status=observed?.status==="hashed"?"inventory_hash_present":observed?"listed_unhashed":"not_in_inventory";
  fw.sha256=observed?.sha256??null;
 }
 const report={schema_version:1,plan,driver_assessment:matches,firmware_inventory_count:inventory.size,
  target_binding:"caller_asserted_not_verified",runtime_status:"not_tested",device_mutation_allowed:false,
  limitations:["Profile, tree, catalog and firmware are supplied by the caller; association with the same physical device is not authenticated.","Inventory presence does not prove authenticity, licensing or compatibility; absence does not prove unavailability."]};
 encode(report);
 return report;
}
export class KnowledgeStore {
 constructor(path) {
  this.db=new DatabaseSync(path);
  try {
   this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;");
   const version=this.db.prepare("PRAGMA user_version").get().user_version;
   if(version===0){
    const existing=this.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get().n;
    if(existing)throw new Error("Refusing nonempty unversioned database");
    this.db.exec(`BEGIN IMMEDIATE;
     CREATE TABLE reports(id TEXT PRIMARY KEY, model TEXT NOT NULL, tree_sha256 TEXT NOT NULL, payload TEXT NOT NULL);
     CREATE INDEX reports_model ON reports(model,id);
     CREATE TABLE runtime_observations(id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id), component TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('pass','fail','inconclusive')), evidence_sha256 TEXT NOT NULL, note TEXT NOT NULL);
     PRAGMA application_id=1380270413; PRAGMA user_version=1; COMMIT;`);
   } else if(version!==1||this.db.prepare("PRAGMA application_id").get().application_id!==1380270413)throw new Error("Unsupported knowledge database");
  }catch(e){this.db.close();throw e;}
 }
 save(input){
  const report=buildDeviceReport(input),payload=encode(report);
  const id=createHash("sha256").update(payload).digest("hex");
  this.db.prepare("INSERT INTO reports VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").run(id,report.plan.model,report.driver_assessment.device_tree_sha256,payload);
  return id;
 }
 get(id){
  if(!digest(id))throw new TypeError("Invalid report ID");
  const row=this.db.prepare("SELECT payload FROM reports WHERE id=?").get(id);
  if(!row)return null;
  if(createHash("sha256").update(row.payload).digest("hex")!==id)throw new Error("Stored report digest mismatch");
  return JSON.parse(row.payload);
 }
 list(model,limit=50){
  if(typeof model!=="string"||model.length>512||!Number.isInteger(limit)||limit<1||limit>100)throw new TypeError("Invalid query");
  return this.db.prepare("SELECT id,model,tree_sha256 FROM reports WHERE model=? ORDER BY id LIMIT ?").all(model,limit);
 }
 recordRuntime(reportId,observation){
  const report=this.get(reportId);
  if(!report||!record(observation)||!report.plan.findings.some(x=>x.component===observation.component)||
   !["pass","fail","inconclusive"].includes(observation.outcome)||!digest(observation.evidence_sha256)||
   typeof observation.note!=="string"||observation.note.length>2048)throw new TypeError("Invalid runtime observation");
  const values=[reportId,observation.component,observation.outcome,observation.evidence_sha256,observation.note];
  const id=createHash("sha256").update(JSON.stringify(values)).digest("hex");
  this.db.prepare("INSERT INTO runtime_observations VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").run(id,...values);
  return id;
 }
 runtime(reportId){
  if(!digest(reportId))throw new TypeError("Invalid report ID");
  return this.db.prepare("SELECT id,component,outcome,evidence_sha256,note FROM runtime_observations WHERE report_id=? ORDER BY id LIMIT 1000").all(reportId);
 }
 close(){this.db.close();}
}
