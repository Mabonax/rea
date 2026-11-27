import { open,constants } from "node:fs/promises";
import { KnowledgeStore } from "./knowledge.mjs";
async function load(path){
 const f=await open(path,constants.O_RDONLY|(constants.O_NONBLOCK??0));
 try{
  const s=await f.stat();if(!s.isFile()||s.size>16*1024*1024)throw new Error("Expected bounded JSON file");
  const b=Buffer.alloc(s.size+1);let n=0;
  while(n<b.length){const {bytesRead}=await f.read(b,n,b.length-n,null);if(!bytesRead)break;n+=bytesRead;}
  if(n!==s.size)throw new Error("File size changed");
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(b.subarray(0,n)));
 }finally{await f.close();}
}
let store;
try{
 const [mode,db,arg,extra,...rest]=process.argv.slice(2);
 if(!db||!arg||rest.length||!["save","get","list","runtime","record-runtime"].includes(mode)||(mode==="record-runtime"?!extra:extra!==undefined))throw new Error("Usage: knowledge-cli.mjs save|get|list|runtime DB ARG | record-runtime DB ID OBSERVATION.json");
 store=new KnowledgeStore(db);
 const result=mode==="save"?{id:store.save(await load(arg))}:mode==="get"?store.get(arg):mode==="list"?store.list(arg):mode==="runtime"?store.runtime(arg):{id:store.recordRuntime(arg,await load(extra))};
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e instanceof Error?e.message:"Knowledge operation failed");process.exitCode=1;}
finally{store?.close();}
