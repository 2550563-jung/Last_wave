import assert from "node:assert/strict";
import { chromium, GAME_VERSION } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  const open=async(seed={})=>{
    const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true});
    await context.addInitScript(seed=>{for(const [k,v] of Object.entries(seed))if(localStorage.getItem(k)===null)localStorage.setItem(k,v);},seed);
    const page=await context.newPage();
    page.events=[];page.errors=[];
    page.on("pageerror",error=>page.errors.push(error.message));
    await page.route("**/*",route=>{
      const request=route.request(),url=request.url();
      if(url.startsWith("file:"))return route.continue();
      if(url.includes("/functions/v1/")){
        const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
        if(request.method()==="OPTIONS")return route.fulfill({status:204,headers});
        if(url.endsWith("/analytics"))page.events.push(request.postDataJSON());
        return route.fulfill({status:200,contentType:"application/json",headers,body:'{"ok":true,"rankings":[]}'});
      }
      return route.abort();
    });
    await page.goto(new URL("../index.html?ref=TestPost",import.meta.url).href,{waitUntil:"load"});
    await page.waitForFunction(()=>window.__lastWaveShare&&window.__lastWaveUpdates);
    return page;
  };

  // Popup merges every unseen release into one, newest first.
  const previous="v"+(Number(GAME_VERSION.slice(1))-2);
  const behind=await open({lw_seen_update:previous});
  await behind.waitForSelector("#lw122Updates");
  assert.equal(await behind.locator("#lw122Updates").count(),1);
  const headings=await behind.locator("#lw122Updates .lw124-update-version").allTextContents();
  assert.deepEqual(headings,[GAME_VERSION,"v"+(Number(GAME_VERSION.slice(1))-1)]);
  assert.equal(await behind.locator("#lw122Updates ul").count(),2);
  await behind.click("#lw122UpdatesClose");
  assert.deepEqual(await behind.evaluate(()=>window.__lastWaveUpdates.pendingVersions(localStorage.getItem("lw_seen_update"))),[]);
  await behind.context().close();

  // New players see one list without version headings; one version behind too.
  const fresh=await open({lw_analytics_force:"1"});
  await fresh.waitForSelector("#lw122Updates");
  assert.equal(await fresh.locator("#lw122Updates .lw124-update-version").count(),0);
  await fresh.click("#lw122UpdatesClose");

  // Statistics: anonymous visit with its source, once per day.
  await fresh.waitForTimeout(100);
  const visit=fresh.events.find(event=>event.event==="visit");
  assert.ok(visit,"visit not recorded");
  assert.equal(visit.source,"testpost");
  assert.equal(visit.firstVisit,true);
  assert.equal(visit.nickname,undefined);
  await fresh.reload({waitUntil:"load"});
  await fresh.waitForFunction(()=>window.__lastWaveShare);
  await fresh.waitForTimeout(100);
  assert.equal(fresh.events.filter(event=>event.event==="visit").length,1);

  // A run produces start and end events; the end screen offers share and feedback.
  await fresh.evaluate(()=>{startRun("normal");});
  await fresh.waitForTimeout(100);
  assert.ok(fresh.events.some(event=>event.event==="run_start"&&event.mode==="normal"));
  await fresh.evaluate(()=>{score=12345;wave=7;return finishRun();});
  await fresh.waitForSelector("#gameOver #lw124ShareButton",{state:"visible"});
  assert.ok(fresh.events.some(event=>event.event==="run_end"&&event.wave===7));
  assert.match(await fresh.locator("#lw124FeedbackAsk").textContent(),/처음 해 본 소감/);

  const card=await fresh.evaluate(async()=>{
    const canvas=await window.__lastWaveShare.drawCard(window.__lastWaveShare.runSummary());
    return[canvas.width,canvas.height,window.__lastWaveShare.runSummary().wave];
  });
  assert.deepEqual(card,[1200,630,7]);

  // Desktop browsers save the image, since they cannot attach a file to a share sheet.
  await fresh.evaluate(()=>{delete navigator.canShare;Object.defineProperty(navigator,"canShare",{value:()=>false,configurable:true});});
  const download=fresh.waitForEvent("download");
  await fresh.click("#lw124ShareButton");
  assert.match((await download).suggestedFilename(),/^last-wave-wave-7\.png$/);
  await fresh.waitForFunction(()=>document.getElementById("lw124ShareStatus").textContent.includes("이미지를 저장"));
  await fresh.waitForTimeout(200);
  assert.ok(fresh.events.some(event=>event.event==="share"));

  // Feedback opens above the end screen and is reachable.
  await fresh.click("#lw124FeedbackButton");
  await fresh.waitForSelector("#lw122FeedbackText",{state:"visible"});
  assert.match(await fresh.locator("#lw122FeedbackIntro").textContent(),/처음 해 본 소감/);
  await fresh.fill("#lw122FeedbackText","재미있어요");
  await fresh.click("#lw122FeedbackSend");
  await fresh.waitForFunction(()=>document.getElementById("lw122FeedbackStatus").textContent.includes("보냈습니다"));
  await fresh.waitForTimeout(200);
  assert.ok(fresh.events.some(event=>event.event==="feedback"));
  assert.deepEqual(fresh.errors,[]);
  console.log("v124 statistics, share, merged popup OK");
}finally{
  await browser.close();
}
