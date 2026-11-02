import { spawnSync } from "node:child_process";
import fs from "node:fs";

// The multiplayer tests need a running Worker (see cloudflare-multiplayer/README.md).
const multiplayer=process.env.LW_CLOUDFLARE_TEST_URL;
const skip=new Set(["browser.mjs","check-scripts.mjs","run.mjs","test-server.mjs"]);
const dir=new URL("./",import.meta.url);
const tests=fs.readdirSync(dir).filter(name=>
  name.endsWith(".mjs")&&!skip.has(name)&&(multiplayer?name.startsWith("cloudflare-"):!name.startsWith("cloudflare-"))
).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));

const failed=[];
for(const test of tests){
  const {status}=spawnSync(process.execPath,[new URL(test,dir).pathname.replace(/^\/([A-Za-z]:)/,"$1")],{stdio:"inherit"});
  console.log(`${status===0?"PASS":"FAIL"} ${test}`);
  if(status!==0)failed.push(test);
}
console.log(`${tests.length-failed.length}/${tests.length} passed`);
if(failed.length)process.exit(1);
