import assert from "node:assert/strict";
import { chromium, GAME_VERSION } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
  await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
  await page.waitForFunction(()=>window.__lastWaveV121&&window.__lastWaveAimV117?.ready);
  assert.equal(await page.locator("#gameVersion").textContent(),GAME_VERSION);

  const result=await page.evaluate(()=>{
    const api=window.__lastWaveV121,out={};
    startRun("normal");
    state="playing";
    const seen=new Set();
    wave=12;
    for(let i=0;i<300;i++){
      enemies.length=0;
      spawnEnemy();
      if(enemies[0]?.v121Variant)seen.add(enemies[0].v121Variant);
    }
    out.variants=[...seen].sort();

    wave=2;enemies.length=0;
    let early=0;
    for(let i=0;i<200;i++){enemies.length=0;spawnEnemy();if(enemies[0]?.v121Variant)early++;}
    out.early=early;

    wave=12;enemies.length=0;spawnEnemy();
    const parent=enemies[0];parent.v121Variant="splitter";
    killEnemy(parent,player);
    out.split=enemies.filter(e=>e.v121Splitling&&!e.dead).length;

    enemies.length=0;spawnEnemy();
    const hurt=enemies[0];hurt.hp=hurt.maxHp/2;hurt.x=500;hurt.y=500;
    spawnEnemy();
    const healer=enemies[1];healer.x=510;healer.y=510;healer.v121Variant="healer";healer.v121Timer=0;
    const hp=hurt.hp;updateEnemy(healer,.016);
    out.healed=hurt.hp>hp;

    enemies.length=0;spawnEnemy();
    const dash=enemies[0];dash.v121Variant="charger";dash.v121Timer=0;dash.v121BaseSpeed=dash.speed;
    const speed=dash.speed;updateEnemy(dash,.016);
    out.charged=dash.speed>speed;

    enemies.length=0;spawnEnemy();
    const before=money;api.dropCrate(player.x,player.y);
    update(.016);
    out.crate=money>before&&api.runtime.crate===null;
    api.dropCrate(player.x+5000,player.y);update(.016);
    out.farCrate=api.runtime.crate!==null;api.runtime.crate=null;

    money=0;wave=20;enemies.length=0;spawnRemaining=0;state="playing";
    api.runtime.activeContract="deadly";
    completeWave();
    const paid=money;
    money=0;wave=20;state="playing";api.runtime.activeContract="none";
    completeWave();
    out.contractBonus=paid-money;
    out.contractCount=api.meta().stats.contracts;

    state="playing";api.runtime.contract="tough";wave=7;enemies.length=0;
    startWave();
    out.contractApplied=api.runtime.activeContract==="tough"&&api.runtime.contract==="none";
    // Bypass random variants and mutations: effects apply to any new enemy.
    const savedRandom=runRandom,savedElite=eliteWave;
    runRandom=()=>.99;eliteWave=false;
    enemies.length=0;api.runtime.activeContract="tough";spawnEnemy();
    const toughHp=enemies[0].maxHp/(enemies[0].v108MutationIds?NaN:1);
    enemies.length=0;api.runtime.activeContract="none";spawnEnemy();
    const plainHp=enemies[0].maxHp/(enemies[0].v108MutationIds?NaN:1);
    out.hpRatio=toughHp/plainHp;
    runRandom=savedRandom;eliteWave=savedElite;

    const d=api.daily();d.progress={};d.claimed=[];
    const mission=api.missionsFor(d.date)[0];
    const credits=Number(save.credits)||0;
    api.advance(mission.id,mission.target);
    out.missionPaid=(Number(save.credits)||0)-credits===mission.reward;
    api.advance(mission.id,mission.target);
    out.missionOnce=(Number(save.credits)||0)-credits===mission.reward;
    out.sameDay=JSON.stringify(api.missionsFor("2026-11-02").map(m=>m.id))===JSON.stringify(api.missionsFor("2026-11-02").map(m=>m.id));
    out.kst=api.dateKey(Date.UTC(2026,0,1,15,0,0));

    return out;
  });
  assert.deepEqual(result.variants,["charger","healer","splitter"]);
  assert.equal(result.early,0);
  assert.equal(result.split,2);
  assert.equal(result.healed,true);
  assert.equal(result.charged,true);
  assert.equal(result.crate,true);
  assert.equal(result.farCrate,true);
  assert.equal(result.contractBonus,120+20*30);
  assert.ok(result.contractCount>=1);
  assert.equal(result.contractApplied,true);
  assert.ok(Math.abs(result.hpRatio-1.3)<.2,String(result.hpRatio));
  assert.equal(result.missionPaid,true);
  assert.equal(result.missionOnce,true);
  assert.equal(result.sameDay,true);
  assert.equal(result.kst,"2026-01-02");

  await page.evaluate(()=>{for(const id of ["shop","lw108RewardOverlay"])document.getElementById(id)?.classList.remove("show");state="menu";hideOverlay(ui.shop);showOverlay(ui.menu);});
  await page.evaluate(()=>document.getElementById("lw121CenterButton").click());
  await page.waitForSelector("#lw121Center .lw121-card");
  assert.equal(await page.locator("#lw121Missions .lw121-card").count(),3);
  assert.equal(await page.locator("#lw111SettingsOverlay [data-lw121-setting]").count(),2);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll("#menu button")].filter(button=>button.textContent.includes("설정")&&!button.textContent.includes("닉네임")).length),1);
  await page.evaluate(()=>document.getElementById("lw121Close").click());

  await page.evaluate(()=>{openShop();});
  assert.equal(await page.locator("[data-lw121-contract]").count(),4);
  await page.evaluate(()=>hideOverlay(ui.shop));
  assert.deepEqual(errors,[]);
  console.log("v121 variants, events, contracts, missions, settings passed");
}finally{
  await browser.close();
}
