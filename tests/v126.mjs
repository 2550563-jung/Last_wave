import assert from "node:assert/strict";
import { chromium, GAME_VERSION } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  assert.equal(GAME_VERSION,"v126");
  const open=async(locale,query="")=>{
    const context=await browser.newContext({viewport:{width:1280,height:800},locale});
    await context.addInitScript(()=>localStorage.setItem("lw_seen_update","v999"));
    const page=await context.newPage();
    page.errors=[];
    page.on("pageerror",error=>page.errors.push(error.message));
    await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
    await page.goto(new URL(`../index.html${query}`,import.meta.url).href,{waitUntil:"load"});
    await page.waitForFunction(()=>window.__lastWaveV125&&window.__lastWaveLang);
    return page;
  };
  // Korean browsers keep Korean.
  let page=await open("ko-KR");
  assert.equal(await page.evaluate(()=>window.__lastWaveLang.lang),"ko");
  assert.match(await page.locator("#lw125QuickStart").textContent(),/바로 시작/);
  assert.equal(await page.locator("#lw126Lang").textContent(),"English");

  // Other browsers start in English, and play works.
  page=await open("en-US");
  assert.equal(await page.evaluate(()=>window.__lastWaveLang.lang),"en");
  assert.match(await page.locator("#lw125QuickStart").textContent(),/Play now/);
  assert.equal(await page.locator("#lw126Lang").textContent(),"한국어");
  const leftovers=await page.evaluate(async()=>{
    const {translate}=window.__lastWaveLang;
    const check={
      numbers:translate("최대 체력 +8% · 이동 속도 +3%"),
      template:translate("웨이브 12"),
      job:translate("군인"),
      unknown:translate("이건 사전에 없는 문장"),
    };
    gameMode="normal";startRun("normal");
    await new Promise(resolve=>setTimeout(resolve,300));
    const hud=[...document.querySelectorAll("#hud, .hud, #topHud")].map(e=>e.innerText).join(" ");
    return{check,hud};
  });
  assert.equal(leftovers.check.numbers,"Max HP +8% · Move speed +3%");
  assert.equal(leftovers.check.template,"Wave 12");
  assert.equal(leftovers.check.job,"Soldier");
  assert.equal(leftovers.check.unknown,"이건 사전에 없는 문장");
  assert.deepEqual(page.errors,[]);

  // A query choice wins over the browser and sticks.
  page=await open("ko-KR","?lang=en");
  assert.match(await page.locator("#lw125QuickStart").textContent(),/Play now/);
  console.log("v126 language passed");
}finally{
  await browser.close();
}
