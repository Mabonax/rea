import { open, constants } from "node:fs/promises";
import { createBuildPlan, checkEffectiveConfig } from "./build-plan.mjs";
async function load(path,limit){
 const f=await open(path,constants.O_RDONLY|(constants.O_NONBLOCK??0));
 try{const s=await f.stat();if(!s.isFile()||s.size>limit)throw new Error("Expected bounded regular input");
 const b=Buffer.alloc(s.size+1);let n=0;
 while(n<b.length){const {bytesRead}=await f.read(b,n,b.length-n,null);if(!bytesRead)break;n+=bytesRead;}
 if(n!==s.size)throw new Error("Input size changed");
 return new TextDecoder("utf-8",{fatal:true}).decode(b.subarray(0,n));
 }finally{await f.close();}
}
try{
 const [mode,path,config,...extra]=process.argv.slice(2);
 if(!path||extra.length||!(mode==="plan"&&!config||mode==="check"&&config))throw new Error("Usage: build-plan-cli.mjs plan INPUT.json | check INPUT.json EFFECTIVE.config");
 const plan=createBuildPlan(JSON.parse(await load(path,65536)));
 const result=mode==="plan"?plan:checkEffectiveConfig(plan,await load(config,8*1024*1024));
 console.log(JSON.stringify(result,null,2));
 if(mode==="check"&&result.status!=="requirements_met")process.exitCode=1;
}catch(e){console.error(e instanceof Error?e.message:"Build planning failed");process.exitCode=1;}
