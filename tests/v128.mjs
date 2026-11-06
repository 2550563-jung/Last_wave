import assert from "node:assert/strict";
import { chromium } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  // The drawing keeps the screen's shape, so nothing is stretched.
  for(const [width,height,mobile] of [[390,844,true],[360,640,true],[412,915,true],[844,390,true],[768,1024,true],[1280,800,false],[2560,1080,false]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
    await context.addInitScript(()=>localStorage.setItem("lw_seen_update","v999"));
    const page=await context.newPage();
    await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
    await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
    await page.waitForFunction(()=>window.__lastWaveV125);
    const size=await page.evaluate(()=>{
      gameMode="normal";startRun("normal");
      const rect=canvas.getBoundingClientRect();
      const from=screenToWorld(rect.width/2,rect.height/2),right=screenToWorld(rect.width/2+100,rect.height/2),down=screenToWorld(rect.width/2,rect.height/2+100);
      return{view:WIDTH/HEIGHT,buffer:canvas.width/canvas.height,screen:rect.width/rect.height,area:WIDTH*HEIGHT,
        x:right.x-from.x,y:(down.y-from.y)*WORLD_Y_SCALE};
    });
    const label=`${width}x${height}`;
    assert.ok(Math.abs(size.buffer/size.screen-1)<.01,`${label} buffer ${JSON.stringify(size)}`);
    assert.ok(Math.abs(size.x/size.y-1)<.02,`${label} pointer ${JSON.stringify(size)}`);
    assert.ok(size.area<=1.4e6,`${label} area ${size.area}`);
    await context.close();
  }
  // The shop closes by itself, but never over an open choice, and guests wait for the host.
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.addInitScript(()=>localStorage.setItem("lw_seen_update","v999"));
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
  await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
  await page.waitForFunction(()=>window.__lastWaveV125);
  const shown=()=>page.evaluate(()=>getComputedStyle(ui.shop).display!=="none");
  const api="window.__lastWaveV125";
  await page.evaluate(()=>{gameMode="normal";startRun("normal");player.invincible=999;state="waveComplete";openShop();});
  assert.equal(await page.evaluate(`${api}.shopLeft`),20);
  assert.match(await page.locator("#nextWaveButton").innerText(),/\(20\)/);
  await page.waitForTimeout(1300);
  const left=await page.evaluate(`${api}.shopLeft`);
  assert.ok(left<19.5&&left>17,`counted down to ${left}`);
  // Covered by another window: the clock holds.
  await page.evaluate(`document.getElementById("adminLogin").classList.add("show");showOverlay(ui.adminLogin);${api}.setShopLeft(.3)`);
  await page.waitForTimeout(800);
  assert.equal(await shown(),true,"held while covered");
  await page.evaluate(()=>hideOverlay(ui.adminLogin));
  await page.waitForTimeout(800);
  assert.equal(await shown(),false,"closed at zero");
  assert.equal(await page.evaluate(()=>state),"playing");
  const waveAfter=await page.evaluate(()=>wave);
  // A guest keeps waiting for the host.
  await page.evaluate(`multiplayer.active=true;multiplayer.isHost=false;state="waveComplete";openShop();${api}.setShopLeft(.2)`);
  await page.waitForTimeout(800);
  assert.equal(await shown(),true,"guest waits");
  assert.equal(await page.evaluate(()=>wave),waveAfter);
  await page.evaluate(()=>{multiplayer.active=false;hideOverlay(ui.shop);});
  // Pressing the button early leaves no timer behind.
  await page.evaluate(`state="waveComplete";openShop();document.getElementById("nextWaveButton").click();`);
  const running=await page.evaluate(()=>wave);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>wave),running);
  assert.deepEqual(errors,[]);
  console.log("v128 screen shape passed");
}finally{
  await browser.close();
}
