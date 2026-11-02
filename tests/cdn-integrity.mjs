import assert from "node:assert/strict";
import { chromium } from "./browser.mjs";
import { startTestServer } from "./test-server.mjs";

// Needs network access: a wrong integrity hash silently removes all online features.
const testServer=await startTestServer();
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto(`${testServer.baseUrl}/index.html`,{waitUntil:"load"});
  assert.equal(await page.evaluate(()=>typeof window.supabase?.createClient),"function");
  console.log("supabase-js integrity passed");
}finally{
  await browser.close();
  await testServer.close();
}
