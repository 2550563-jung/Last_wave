import assert from "node:assert/strict";
import { chromium } from "file:///C:/Users/commo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
import { startTestServer } from "./test-server.mjs";

const testServer=await startTestServer();
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on("pageerror",error=>errors.push(String(error.stack||error)));
page.on("console",message=>{
  if(message.type()==="error"&&!message.text().includes("ERR_NETWORK_ACCESS_DENIED")&&!message.text().includes("Failed to load resource"))errors.push(message.text());
});
await page.route("**/*",route=>route.request().url().startsWith(testServer.baseUrl)?route.continue():route.abort());
await page.goto(`${testServer.baseUrl}/index.html`,{waitUntil:"commit",timeout:30000});
await page.waitForFunction(()=>window.__lastWaveV108?.version===108&&document.getElementById("lw108SeasonPanel"),{timeout:60000});

const result=await page.evaluate(()=>{
  const api=window.__lastWaveV108;
  const waves=[1,10,25,50,100].map(value=>api.buildWavePlan(value,1));
  const parties=[1,2,3,4].map(value=>api.buildWavePlan(30,value));
  return{
    version:document.getElementById("gameVersion")?.textContent?.trim(),
    release:window.__lastWaveCloudflare?.releaseVersion,
    waves,parties,mutations:api.mutations,rewards:api.rewards,
    season:api.seasonKey(new Date("2026-08-03T00:00:00Z")),
    directorUi:Boolean(document.getElementById("lw108DirectorHud")),
    rewardUi:Boolean(document.getElementById("lw108RewardOverlay")),
    seasonUi:Boolean(document.getElementById("lw108SeasonPanel"))
  };
});

assert.equal(result.version,"v109");
assert.equal(result.release,109);
assert.equal(result.season,"2026-S3");
assert.equal(result.directorUi,true);
assert.equal(result.rewardUi,true);
assert.equal(result.seasonUi,true);
assert.ok(result.mutations.length>=4);
assert.ok(result.rewards.length>=5);
for(let index=1;index<result.waves.length;index++){
  assert.ok(result.waves[index].budget>result.waves[index-1].budget);
  assert.ok(result.waves[index].eliteChance>=result.waves[index-1].eliteChance);
}
for(let index=1;index<result.parties.length;index++)assert.ok(result.parties[index].budget>result.parties[index-1].budget);
assert.equal(result.waves.at(-1).bossPhases,3);
assert.deepEqual(errors,[]);

console.log("v108 director and tactical systems test passed.",result);
await browser.close();
await testServer.close();
