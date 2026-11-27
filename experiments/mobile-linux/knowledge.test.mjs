import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeStore,buildDeviceReport } from "./knowledge.mjs";
const fixture=()=>({
 profile:{schema_version:1,platform:"android",model:"Synthetic",architecture:"arm64",components:{}},
 tree:{sha256:"a".repeat(64),nodes:[{path:"/test",compatible:["example,chip"],status:null}]},
 catalog:{schema_version:1,drivers:[{id:"test",origin:"other",revision:"b".repeat(40),path:"drivers/test.c",source_sha256:"c".repeat(64),compatible:["example,chip"],config_all:[],firmware:["test/fw.bin","test/missing.bin"]}]},
 firmware:{schema_version:1,files:[{path:"test/fw.bin",size:3,sha256:"d".repeat(64),status:"hashed"}]}
});
test("joins firmware inventory without attesting runtime",()=>{
 const r=buildDeviceReport(fixture()),f=r.driver_assessment.nodes[0].candidates[0].firmware;
 assert.equal(f[0].status,"inventory_hash_present");
 assert.equal(f[1].status,"not_in_inventory");
 assert.equal(r.runtime_status,"not_tested");
});
test("reject duplicate inventory entries",()=>{
 const f=fixture();f.firmware.files.push(f.firmware.files[0]);assert.throws(()=>buildDeviceReport(f));
});
test("stores idempotent immutable report and separate runtime claim",t=>{
 const db=new KnowledgeStore(":memory:");t.after(()=>db.close());
 const id=db.save(fixture());assert.equal(db.save(fixture()),id);
 assert.equal(db.list("Synthetic").length,1);
 const obs={component:"display",outcome:"pass",evidence_sha256:"e".repeat(64),note:"Synthetic claim"};
 assert.equal(db.recordRuntime(id,obs),db.recordRuntime(id,obs));
 assert.equal(db.runtime(id).length,1);
 assert.equal(db.get(id).runtime_status,"not_tested");
 assert.throws(()=>db.recordRuntime(id,{...obs,component:"other"}));
});
