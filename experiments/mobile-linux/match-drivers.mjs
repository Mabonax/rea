import { open, constants } from "node:fs/promises";
import { matchDrivers } from "./driver-match.mjs";
async function load(path) {
 const f=await open(path,constants.O_RDONLY | (constants.O_NONBLOCK??0));
 try {
  const s=await f.stat(), max=16*1024*1024;
  if(!s.isFile()||s.size>max) throw new Error("Expected regular JSON <=16 MiB");
  const b=Buffer.alloc(s.size+1);let used=0;
  while(used<b.length){const {bytesRead}=await f.read(b,used,b.length-used,null);if(!bytesRead)break;used+=bytesRead;}
  if(used!==s.size)throw new Error("File size changed during read");
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(b.subarray(0,used)));
 }finally{await f.close();}
}
try{
 const [tree,catalog,config]=process.argv.slice(2);
 if(!tree||!catalog||process.argv.length>5)throw new Error("Usage: node match-drivers.mjs TREE.json CATALOG.json [CONFIG.json]");
 const configuration=config?await load(config):{};
 console.log(JSON.stringify(matchDrivers(await load(tree),await load(catalog),configuration),null,2));
}catch(e){console.error(e instanceof Error?e.message:"Driver matching failed");process.exitCode=1;}
