import assert from "node:assert/strict";
import { chromium } from "./browser.mjs";

// Clicking the weekly challenge must open a server-verified run.
const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
  await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
  await page.waitForFunction(()=>window.__lastWaveAimV117?.ready&&document.getElementById("lw92WeeklyStart"));
  const calls=await page.evaluate(async()=>{
    const calls=[];
    const client={rpc:async name=>{calls.push(name);return {data:"run-id",error:null};}};
    sbClient=client;
    document.getElementById("lw92WeeklyStart").click();
    await new Promise(resolve=>setTimeout(resolve,200));
    return calls;
  });
  assert.ok(calls.includes("lw_begin_verified_run_v1"),JSON.stringify(calls));
  console.log("Weekly challenge verified-run start passed");
}finally{
  await browser.close();
}
