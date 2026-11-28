import { readFile, stat } from "node:fs/promises";
import { executeKernelBuild } from "./build-executor.mjs";
try{
 const [flag,input,source,archive,output,...extra]=process.argv.slice(2);
 if(flag!=="--execute"||!input||!source||!archive||!output||extra.length)throw new Error("Usage: build-executor-cli.mjs --execute INPUT.json SOURCE_DIR SOURCE_ARCHIVE OUTPUT_ROOT");
 if(!(await stat(input)).isFile()||(await stat(input)).size>65536)throw new Error("Expected small regular input JSON");
 const result=await executeKernelBuild(JSON.parse(await readFile(input,"utf8")),{approved:true,kernelSource:source,kernelArchive:archive,outputRoot:output});
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e instanceof Error?e.message:"Build failed");process.exitCode=1;}
