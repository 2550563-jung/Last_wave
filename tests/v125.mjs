import assert from "node:assert/strict";
import { chromium, GAME_VERSION } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  const open=async(query="",seed={})=>{
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await context.addInitScript(seed=>{localStorage.setItem("lw_seen_update","v999");for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);},seed);
    const page=await context.newPage();
    page.errors=[];
    page.on("pageerror",error=>page.errors.push(error.message));
    await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
    await page.goto(new URL(`../index.html${query}`,import.meta.url).href,{waitUntil:"load"});
    await page.waitForFunction(()=>window.__lastWaveV125&&window.__lastWaveAimV117?.ready);
    return page;
  };
  
  // Quick start sits near the top of the menu and starts a run.
  let page=await open();
  const top=await page.evaluate(()=>document.getElementById("lw125QuickStart").getBoundingClientRect().y);
  assert.ok(top<500,`quick start at ${top}`);
  await page.click("#lw125QuickStart");
  assert.equal(await page.evaluate(()=>state),"playing");

  // First runs are gentle, later ones are not.
  const easy=await page.evaluate(()=>{runRandom=seededRandom(7);wave=1;enemies.length=0;spawnEnemy();const e=enemies[0];const hp=e.maxHp,dmg=e.damage;return{hp,dmg};});
  const normal=await page.evaluate(()=>{save.v125=save.v125||{};const base=getProfileStats;getProfileStats=()=>({...base(),runs:9});returnToMenu();startRun("normal");runRandom=seededRandom(7);wave=1;enemies.length=0;spawnEnemy();const e=enemies[0];getProfileStats=base;return{hp:e.maxHp,dmg:e.damage};});
  assert.ok(easy.dmg<normal.dmg,JSON.stringify({easy,normal}));

  // Zones follow the wave, and hazards become warned marks and then shots.
  const zones=await page.evaluate(async()=>{
    const api=window.__lastWaveV125,out=[];
    for(const w of [1,25,26,51,76,101,300])out.push(api.zoneIndex(w));
    wave=26;enemyBullets.length=0;
    api.spawnHazard("gas");
    const marked=api.marks.length;
    for(let i=0;i<40;i++)update(.05);
    return{out,marked,bullets:enemyBullets.length};
  });
  assert.deepEqual(zones.out,[0,0,1,2,3,4,4]);
  assert.equal(zones.marked,1);
  assert.ok(zones.bullets>0,"hazard fired");

  // Every boss runs its own pattern without errors and rewards the kill.
  const bosses=await page.evaluate(async()=>{
    const out=[];
    for(let index=0;index<10;index++){
      enemies.length=0;enemyBullets.length=0;player.invincible=99;
      wave=10;spawnBoss();
      const boss=enemies.find(e=>e.boss);boss.bossIndex=index;boss.v125Timer=0;
      const hp=player.maxHp,dmg=player.damageMult;
      updateBoss(boss,player,.016,1,0,500);
      for(let i=0;i<30;i++)update(.03);
      killEnemy(boss,player);
      out.push(Boolean(save.v125.trophies[index]));
    }
    return out;
  });
  assert.ok(bosses.every(Boolean),JSON.stringify(bosses));
  await page.evaluate(()=>window.__lastWaveV125.BOSS_PATTERNS.length===10);
  assert.deepEqual(page.errors,[]);

  // Creative runs change rules, stay off the rankings and leave the save alone.
  page=await open();
  const creative=await page.evaluate(async()=>{
    save.credits=1234;persist({cloud:false});
    const before=JSON.stringify(save);
    let submitted=0;const fetchBase=window.fetch;window.fetch=(...a)=>{if(String(a[0]).includes("rankings"))submitted++;return fetchBase(...a);};
    const api=window.__lastWaveV125;
    api.setRules({startWave:20,startMoney:5000,playerHp:300,enemyHp:200,invincible:true,bossEvery:0,adminTrial:true});
    const baseHp=createPlayer("x","x","soldier",false).maxHp;
    api.startCreative();
    const during={wave,money,hp:player.maxHp,baseHp,admin:adminMode,training:window.__lastWaveV92.state.training,bosses:enemies.filter(e=>e.boss).length};
    enemies.length=0;spawnEnemy();during.enemyHp=enemies[0].maxHp;
    save.credits=999999;persist({cloud:false});
    const stored=localStorage.getItem("last_wave_save")||"";
    const skip=rankingSkipMessage();
    await finishRun();
    const ranked=submitted;
    const buttonHidden=document.getElementById("lw124ShareButton").hasAttribute("hidden");
    returnToMenu();
    return{during,skip,ranked,buttonHidden,credits:save.credits,admin:adminMode,active:api.creative.active,same:Object.keys(JSON.parse(before)).every(k=>k==="v125"||JSON.stringify(JSON.parse(before)[k])===JSON.stringify(save[k]))};
  });
  assert.equal(creative.during.wave,20);
  assert.ok(creative.during.money>=5000);
  assert.ok(creative.during.hp>=creative.during.baseHp*2.9,JSON.stringify(creative.during));
  assert.equal(creative.during.admin,true);
  assert.equal(creative.during.training,true);
  assert.equal(creative.during.bosses,0);
  assert.match(creative.skip,/크리에이티브/);
  assert.equal(creative.ranked,0);
  assert.equal(creative.buttonHidden,true);
  assert.equal(creative.credits,1234);
  assert.equal(creative.admin,false);
  assert.equal(creative.active,false);
  assert.equal(creative.same,true);
  assert.deepEqual(page.errors,[]);

  // A challenge link survives a round trip, plays the shared seed, skips ranking.
  page=await open();
  const link=await page.evaluate(()=>{
    gameMode="normal";startRun("normal");
    const url=window.__lastWaveV125.shareUrl({score:4321,wave:7});
    return{url,seed:window.__lastWaveV125.runSeed};
  });
  assert.match(link.url,/[?&]c=/);
  const code=new URL(link.url).searchParams.get("c");
  page=await open(`?c=${code}`);
  await page.waitForSelector("#lw125ChallengeOffer");
  const body=await page.locator(".lw125-link-body").textContent();
  assert.match(body,/4,321/);
  await page.click(".lw125-link-panel [data-go]");
  const played=await page.evaluate(()=>({seed:window.__lastWaveV125.runSeed,active:window.__lastWaveV125.challenge.active,skip:rankingSkipMessage()}));
  assert.equal(played.seed,link.seed);
  assert.equal(played.active,true);
  assert.match(played.skip,/도전/);
  const bad=await page.evaluate(()=>window.__lastWaveV125.decode("!!!"));
  assert.equal(bad,null);

  // Game over offers a next goal and an instant retry.
  const over=await page.evaluate(async()=>{
    window.__lastWaveV125.challenge.active=false;
    returnToMenu();gameMode="normal";startRun("normal");wave=8;score=500;
    await finishRun();
    return{goals:document.querySelectorAll("#lw125Goals li").length,retry:!document.getElementById("lw125Retry").hidden};
  });
  assert.ok(over.goals>0);assert.equal(over.retry,true);
  await page.click("#lw125Retry");
  assert.equal(await page.evaluate(()=>state),"playing");

  // An invite link asks before joining and fills the room code.
  page=await open("?room=abc123");
  assert.match(await page.locator(".lw125-link-body").textContent(),/ABC123/);

  // Admin trial hides buttons that wipe data.
  page=await open();
  const hidden=await page.evaluate(()=>{
    const api=window.__lastWaveV125;api.setRules({adminTrial:true});api.startCreative();openAdminPanel();
    return [...document.querySelectorAll("#adminPanel button")].filter(b=>/초기화|삭제/.test(b.textContent)).every(b=>getComputedStyle(b).display==="none");
  });
  assert.equal(hidden,true);
  console.log("v125 features passed");
}finally{
  await browser.close();
}
