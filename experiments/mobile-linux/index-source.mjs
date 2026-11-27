import { indexKernelSource, inventoryFirmware } from "./source-index.mjs";
try {
  const [mode,root,revision,...extra]=process.argv.slice(2);
  if(!root||extra.length||!(mode==="source"&&revision||mode==="firmware"&&!revision))throw new Error("Usage: node index-source.mjs source ROOT REVISION | firmware ROOT");
  const result=mode==="source"?await indexKernelSource(root,revision):await inventoryFirmware(root);
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error instanceof Error?error.message:"Indexing failed");process.exitCode=1;}
