import assert from "node:assert/strict";
import { chromium, GAME_VERSION } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  const requests=[];
  await page.route("**/*",route=>{
    const request=route.request(),url=request.url();
    if(url.startsWith("file:"))return route.continue();
    if(url.includes("/functions/v1/")){
      if(request.method()==="OPTIONS")return route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"}});
      requests.push({method:request.method(),url,body:request.postDataJSON?.()});
      return route.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify({ok:true,rankings:[]})});
    }
    return route.abort();
  });
  await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
  await page.waitForFunction(()=>window.__lastWaveV121&&window.__lastWaveUpdates);
  assert.equal(GAME_VERSION,"v123");

  const today=await page.evaluate(()=>v56KstDateKey());
  const clock=await page.evaluate(()=>[
    v56KstDateKey(new Date("2026-11-03T14:59:00Z")),
    v56KstDateKey(new Date("2026-11-03T15:00:00Z"))
  ]);
  assert.deepEqual(clock,["2026-11-03","2026-11-04"],"daily board must roll over at Korean midnight");

  // Daily board reads today's date from the daily function and says which day it shows.
  await page.evaluate(()=>loadRankings("daily"));
  const daily=requests.find(item=>item.method==="GET"&&item.url.includes("mode=daily"));
  assert.ok(daily.url.includes("/functions/v1/daily-rankings?"),daily.url);
  assert.ok(daily.url.includes(`dailyDate=${today}`),daily.url);
  assert.ok((await page.locator("#dailyRankingDate").textContent()).includes(today));
  assert.match(await page.locator("#rankingList").textContent(),/오늘은 아직 기록이 없습니다/);

  // The normal board is unchanged.
  await page.evaluate(()=>loadRankings("normal"));
  const normal=requests.find(item=>item.method==="GET"&&item.url.includes("mode=normal"));
  assert.ok(normal.url.includes("/functions/v1/rankings?"),normal.url);
  assert.equal(await page.locator("#dailyRankingDate").count(),0);

  // Submissions go to the board of their own mode.
  const submit=mode=>page.evaluate(async mode=>{
    localStorage.clear();
    save.nickname="테스터";
    gameMode=mode;score=500;wave=3;
    startRun(mode);state="gameover";score=500;wave=3;
    return await submitRanking();
  },mode);
  requests.length=0;
  await submit("daily");
  const post=requests.find(item=>item.method==="POST");
  assert.ok(post,"daily run was not submitted");
  assert.ok(post.url.endsWith("/functions/v1/daily-rankings"),post.url);
  assert.equal(post.body.dailyDate,today);
  assert.equal(post.body.mode,"daily");
  console.log("v123 daily ranking OK");
}finally{
  await browser.close();
}
