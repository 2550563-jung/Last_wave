import assert from "node:assert/strict";
import { chromium } from "file:///C:/Users/commo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
import { startTestServer } from "./test-server.mjs";

const testServer=await startTestServer();
const browser=await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"
});
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.setDefaultTimeout(30000);
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
  }else{
    return route.abort();
  }
});

await page.goto(`${testServer.baseUrl}/index.html`,{
  waitUntil:"commit",
  timeout:30000
});
await page.waitForFunction(()=>window.__lastWaveV105?.version===105,{timeout:60000});

const result=await page.evaluate(async()=>{
  const api=window.__lastWaveV105;
  const original={
    state,
    currentBoss,
    timeOfDay,
    player,
    volume:save.bgmVolume
  };
  const selectedThemes={};

  state="menu";
  selectedThemes.menu=api.getTheme();
  state="waveComplete";
  selectedThemes.shop=api.getTheme();
  state="playing";
  currentBoss={dead:false};
  selectedThemes.boss=api.getTheme();
  currentBoss=null;
  player={hp:100,maxHp:100};
  player.hp=20;
  player.maxHp=100;
  selectedThemes.danger=api.getTheme();
  player.hp=100;
  timeOfDay="dawn";
  selectedThemes.dawn=api.getTheme();
  timeOfDay="noon";
  selectedThemes.day=api.getTheme();
  timeOfDay="evening";
  selectedThemes.evening=api.getTheme();
  timeOfDay="night";
  selectedThemes.night=api.getTheme();

  const generated=[];
  const originalTone=audioTone;
  const originalNoise=audioNoise;
  const originalContext=audioSystem.ctx;
  const originalUnlocked=audioSystem.unlocked;
  save.bgmVolume=.37;
  audioTone=options=>generated.push({kind:"tone",...options});
  audioNoise=options=>generated.push({kind:"noise",...options});
  audioSystem.ctx={};
  audioSystem.unlocked=true;
  startBgm();
  await new Promise(resolve=>setTimeout(resolve,260));
  const arrangement=api.getArrangement();
  const volumePreserved=save.bgmVolume;
  clearInterval(audioSystem.bgmTimer);
  audioSystem.bgmTimer=null;
  audioTone=originalTone;
  audioNoise=originalNoise;
  audioSystem.ctx=originalContext;
  audioSystem.unlocked=originalUnlocked;

  state=original.state;
  currentBoss=original.currentBoss;
  timeOfDay=original.timeOfDay;
  player=original.player;
  save.bgmVolume=original.volume;

  return{
    version:document.getElementById("gameVersion")?.textContent?.trim(),
    addon:api.version,
    themeNames:Object.keys(api.themes),
    variantCounts:Object.fromEntries(
      Object.entries(api.themes).map(([theme,tracks])=>[theme,tracks.length])
    ),
    uniqueTracks:new Set(Object.values(api.themes).flat()).size,
    selectedThemes,
    arrangement,
    volumePreserved,
    generatedKinds:[...new Set(generated.map(entry=>entry.kind))],
    generatedCount:generated.length
  };
});

assert.equal(result.version,"v106");
assert.equal(result.addon,105);
assert.deepEqual(result.themeNames,[
  "menu",
  "shop",
  "dawn",
  "day",
  "evening",
  "night",
  "danger",
  "boss"
]);
assert.ok(Object.values(result.variantCounts).every(count=>count===3));
assert.equal(result.uniqueTracks,24);
assert.deepEqual(result.selectedThemes,{
  menu:"menu",
  shop:"shop",
  boss:"boss",
  danger:"danger",
  dawn:"dawn",
  day:"day",
  evening:"evening",
  night:"night"
});
assert.equal(result.arrangement.theme,"night");
assert.equal(result.arrangement.count,3);
assert.equal(result.volumePreserved,.37);
assert.ok(result.generatedCount>=3);
assert.ok(result.generatedKinds.includes("tone"));
assert.deepEqual(errors,[]);

console.log("v105 music variation test passed.",result);
await browser.close();
await testServer.close();
