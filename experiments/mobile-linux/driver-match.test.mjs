import test from "node:test";
import assert from "node:assert/strict";
import { matchDrivers } from "./driver-match.mjs";
import { discoverCompatibleLiterals } from "./source-candidate.mjs";
const tree=()=>({sha256:"a".repeat(64),nodes:[{path:"/soc/test",compatible:["example,chip","example,fallback"],status:null}]});
const catalog=()=>({schema_version:1,drivers:[{id:"example",origin:"mainline",revision:"b".repeat(40),path:"drivers/example.c",source_sha256:"c".repeat(64),compatible:["example,chip","example,fallback"],config_all:["CONFIG_EXAMPLE"],firmware:["example/fw.bin"]}]});
test("exact matches deduplicate driver and retain compatible evidence",()=>{
 const r=matchDrivers(tree(),catalog(),{CONFIG_EXAMPLE:"m"});
 assert.equal(r.nodes[0].candidates.length,1);
 assert.equal(r.nodes[0].candidates[0].matched_compatible.length,2);
 assert.equal(r.nodes[0].candidates[0].config_status,"declared_enabled");
 assert.equal(r.nodes[0].candidates[0].firmware[0].status,"not_verified");
 assert.equal(r.bootability,"not_verified");
});
test("missing and disabled config differ",()=>{
 assert.equal(matchDrivers(tree(),catalog()).nodes[0].candidates[0].config_status,"unknown");
 assert.equal(matchDrivers(tree(),catalog(),{CONFIG_EXAMPLE:"n"}).nodes[0].candidates[0].config_status,"declared_disabled");
});
test("no match is not unsupported",()=>{
 const t=tree();t.nodes[0].compatible=["other,chip"];
 assert.equal(matchDrivers(t,catalog()).nodes[0].assessment,"no_catalog_match");
});
test("disabled node is separate",()=>{
 const t=tree();t.nodes[0].status="disabled";
 assert.equal(matchDrivers(t,catalog()).nodes[0].assessment,"node_not_enabled");
});
test("reject malformed provenance and duplicates",()=>{
 const c=catalog();c.drivers[0].path="../driver.c";
 assert.throws(()=>matchDrivers(tree(),c));
 const d=catalog();d.drivers.push(d.drivers[0]);
 assert.throws(()=>matchDrivers(tree(),d));
});
test("source discovery stays unreviewed",()=>{
 const r=discoverCompatibleLiterals('/* .compatible = "example,chip" */');
 assert.equal(r.matches[0].basis,"unreviewed_text_match");
 assert.match(r.source_sha256,/^[a-f0-9]{64}$/u);
});
