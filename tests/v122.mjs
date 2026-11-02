import assert from "node:assert/strict";
import { chromium, GAME_VERSION } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const open=async()=>{
    const page=await context.newPage();
    page.errors=[];
    page.on("pageerror",error=>page.errors.push(error.message));
    await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
    await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
    await page.waitForFunction(()=>window.__lastWaveV121&&window.__lastWaveAimV117?.ready&&window.__lastWaveUpdates);
    return page;
  };
  const host=await open();

  // Popup: notes exist for this release, appear on entry, and stay closed afterwards.
  assert.ok(await host.evaluate(version=>window.__lastWaveUpdates.UPDATES[version]?.length>0,GAME_VERSION),"release notes missing");
  await host.waitForSelector("#lw122Updates");
  assert.ok((await host.locator("#lw122Updates h2").textContent()).includes(GAME_VERSION));
  await host.click("#lw122UpdatesClose");
  assert.equal(await host.locator("#lw122Updates").count(),0);
  await host.reload({waitUntil:"load"});
  await host.waitForFunction(()=>window.__lastWaveUpdates);
  assert.equal(await host.locator("#lw122Updates").count(),0);
  await host.waitForFunction(()=>window.__lastWaveV121&&window.__lastWaveAimV117?.ready);

  const frames=await host.evaluate(()=>{
    const api=window.__lastWaveV121;
    startRun("normal");
    multiplayer.active=true;multiplayer.isHost=true;state="playing";wave=20;
    enemies.length=0;spawnRemaining=0;
    const seen=new Set();
    for(let i=0;i<300;i++){enemies.length=0;spawnEnemy();if(enemies[0]?.v121Variant)seen.add(enemies[0].v121Variant);}
    enemies.length=0;
    spawnEnemy();enemies[0].v121Variant="healer";enemies[0].x=100;enemies[0].y=100;
    spawnEnemy();enemies[1].v121Golden=true;enemies[1].v121Variant=null;
    const first=JSON.stringify(makeWorldFrame());
    api.runtime.activeContract="tough";api.runtime.event="bloodMoon";api.runtime.bloodMoon=true;
    api.dropCrate(9000,9000);
    api.runtime.team.elites+=1;api.runtime.team.events+=2;api.runtime.team.variants+=3;
    const second=JSON.stringify(makeWorldFrame());
    const beforeMoney=money;
    api.dropCrate(player.x,player.y);update(.016);
    return {first,second,snapshot:JSON.stringify(makeSnapshot()),variants:[...seen].sort(),crateTaken:api.runtime.crate===null&&money>beforeMoney,credited:api.runtime.team.crates};
  });
  assert.deepEqual(frames.variants,["charger","healer","splitter"]);
  assert.equal(frames.crateTaken,true);
  assert.equal(frames.credited,1);

  // Feedback form posts the message and reports the result.
  const feedback=await open();
  let posted=null;
  await feedback.route("**/functions/v1/feedback",route=>{posted=route.request().postDataJSON();route.fulfill({status:200,contentType:"application/json",body:'{"ok":true}'});});
  await feedback.evaluate(()=>{document.getElementById("lw122FeedbackButton").click();});
  await feedback.fill("#lw122FeedbackText","총알이 너무 작아요");
  await feedback.evaluate(()=>document.getElementById("lw122FeedbackSend").click());
  await feedback.waitForFunction(()=>document.getElementById("lw122FeedbackStatus").textContent.includes("보냈습니다"));
  assert.equal(posted.message,"총알이 너무 작아요");
  assert.equal(posted.version,GAME_VERSION);
  await feedback.close();

  const client=await open();
  const result=await client.evaluate(({first,second,snapshot})=>{
    const api=window.__lastWaveV121;
    startRun("normal");
    multiplayer.active=true;multiplayer.isHost=false;state="playing";
    enemies.length=0;
    applyWorldFrame(JSON.parse(first));
    const out={};
    out.variant=enemies.some(enemy=>enemy.v121Variant==="healer");
    out.golden=enemies.some(enemy=>enemy.v121Golden);
    out.statsBefore=api.meta().stats.variants;
    applyWorldFrame(JSON.parse(second));
    out.contract=api.runtime.activeContract;
    out.bloodMoon=api.runtime.bloodMoon;
    out.crate=api.runtime.crate;
    out.statsAfter=api.meta().stats.variants;
    out.events=api.meta().stats.events;
    openShop();
    out.readOnlyContracts=document.querySelectorAll("[data-lw121-contract]").length;
    hideOverlay(ui.shop);
    state="playing";
    const hp=enemies[0]?.hp;
    applyWorldSnapshot(JSON.parse(snapshot));
    out.snapshotTeam=api.runtime.team.crates;
    return out;
  },frames);
  assert.equal(result.variant,true);
  assert.equal(result.golden,true);
  assert.equal(result.contract,"tough");
  assert.equal(result.bloodMoon,true);
  assert.deepEqual([result.crate?.x,result.crate?.y],[9000,9000]);
  assert.equal(result.statsAfter-result.statsBefore,3);
  assert.ok(result.events>=2);
  assert.equal(result.readOnlyContracts,0);
  assert.equal(result.snapshotTeam,1);
  assert.deepEqual([...host.errors,...client.errors],[]);
  console.log("v122 multiplayer sync, single settings menu, update popup passed");
}finally{
  await browser.close();
}
