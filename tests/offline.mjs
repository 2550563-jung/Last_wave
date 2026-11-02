import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, GAME_VERSION } from "./browser.mjs";
import { startTestServer } from "./test-server.mjs";

const testServer=await startTestServer();
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  // index.html registers the worker on https only, and 127.0.0.1 is plain http.
  await page.goto(`${testServer.baseUrl}/index.html`,{waitUntil:"load"});
  await page.evaluate(async()=>{await navigator.serviceWorker.register("./sw.js");await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>window.__lastWaveAimV117?.ready);

  await context.setOffline(true);
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>window.__lastWaveAimV117?.ready,{timeout:30000});
  assert.equal(await page.locator("#gameVersion").textContent(),GAME_VERSION);
  const syntax=errors.filter(message=>message.includes("SyntaxError"));
  assert.deepEqual(syntax,[]);
  assert.ok((await fs.readFile(new URL("../index.html",import.meta.url),"utf8")).includes('register("./sw.js")'));
  console.log("Offline restart passed");
}finally{
  await browser.close();
  await testServer.close();
}
