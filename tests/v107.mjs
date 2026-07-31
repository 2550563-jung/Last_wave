import assert from "node:assert/strict";
import { chromium } from "file:///C:/Users/commo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
import { startTestServer } from "./test-server.mjs";

const testServer=await startTestServer();
const browser=await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"
});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];

page.on("pageerror",error=>errors.push(String(error.stack||error)));
page.on("console",message=>{
  if(
    message.type()==="error"&&
    !message.text().includes("ERR_NETWORK_ACCESS_DENIED")&&
    !message.text().includes("Failed to load resource")
  ){
    errors.push(message.text());
  }
});
await page.route("**/*",route=>{
  if(route.request().url().startsWith(testServer.baseUrl)){
    return route.continue();
  }
  return route.abort();
});

await page.goto(`${testServer.baseUrl}/index.html`,{
  waitUntil:"commit",
  timeout:30000
});
await page.waitForFunction(()=>window.__lastWaveV107?.version===107,{timeout:60000});

const result=await page.evaluate(()=>{
  const api=window.__lastWaveV107;
  const waveSamples=[1,5,10,20,30,50].map(api.getWaveDifficultyCurve);
  const monotonic=key=>
    waveSamples.every(
      (sample,index)=>
        index===0||
        sample[key]>waveSamples[index-1][key]
    );

  const earlyEnemy={
    maxHp:100,
    hp:100,
    damage:10,
    speed:100
  };
  const lateEnemy={
    maxHp:100,
    hp:100,
    damage:10,
    speed:100
  };
  api.applyWaveDifficulty(earlyEnemy,1);
  api.applyWaveDifficulty(lateEnemy,30);

  state="menu";
  setAuto(true);
  const menuAuto=autoMode;
  state="playing";
  setAuto(true);
  const combatAuto=autoMode;

  multiplayer.active=false;
  const networkControl=getLocalNetworkControl();
  const staleRemote={
    id:"v107-stale-auto",
    local:false,
    control:{
      x:0,
      y:0,
      aimX:1,
      aimY:0,
      firing:false,
      auto:true
    }
  };
  const remoteControl=getPlayerControl(staleRemote);

  return{
    version:document.getElementById("gameVersion")?.textContent?.trim(),
    addon:api.version,
    cloudflareRelease:window.__lastWaveCloudflare?.releaseVersion,
    waveSamples,
    monotonic:{
      hp:monotonic("hp"),
      damage:monotonic("damage"),
      speed:monotonic("speed"),
      count:monotonic("count")
    },
    earlyEnemy,
    lateEnemy,
    menuAuto,
    combatAuto,
    networkAuto:networkControl.auto,
    remoteAuto:remoteControl.auto
  };
});

assert.equal(result.version,"v107");
assert.equal(result.addon,107);
assert.equal(result.cloudflareRelease,107);
assert.deepEqual(result.monotonic,{
  hp:true,
  damage:true,
  speed:true,
  count:true
});
assert.ok(result.waveSamples[0].hp<1);
assert.ok(result.waveSamples[0].damage<1);
assert.ok(result.waveSamples[0].count<1);
assert.ok(result.waveSamples.at(-1).hp>2.5);
assert.ok(result.waveSamples.at(-1).damage>2);
assert.ok(result.waveSamples.at(-1).count>=1.49);
assert.ok(result.earlyEnemy.maxHp<100);
assert.ok(result.earlyEnemy.damage<10);
assert.ok(result.lateEnemy.maxHp>170);
assert.ok(result.lateEnemy.damage>13);
assert.equal(result.menuAuto,true);
assert.equal(result.combatAuto,false);
assert.equal(result.networkAuto,false);
assert.equal(result.remoteAuto,false);
assert.deepEqual(errors,[]);

console.log("v107 difficulty and AUTO test passed.",result);
await browser.close();
await testServer.close();
