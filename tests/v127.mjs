import assert from "node:assert/strict";
import { chromium } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
try{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.addInitScript(()=>localStorage.setItem("lw_seen_update","v999"));
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
  await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
  await page.waitForFunction(()=>window.__lastWaveV125&&window.__lastWaveAimV117?.ready);
  const visible=selector=>page.locator(selector).isVisible();

  // Real clicks: the trial never shows the password form, and survives closing the panel.
  await page.evaluate(()=>{const api=window.__lastWaveV125;api.setRules({adminTrial:true,invincible:true});api.startCreative();});
  await page.waitForTimeout(200);
  assert.equal(await visible("#adminFloatingButton"),true);
  await page.click("#adminFloatingButton",{force:true});
  assert.equal(await visible("#adminPanel"),true,"panel opens");
  assert.equal(await visible("#adminLogin"),false,"no password form");
  await page.click("#adminPanelCloseButton");
  assert.equal(await visible("#adminPanel"),false);
  assert.equal(await page.evaluate(()=>adminMode),true);
  assert.equal(await visible("#adminFloatingButton"),true);
  await page.click("#adminFloatingButton",{force:true});
  assert.equal(await visible("#adminPanel"),true,"panel reopens");
  assert.equal(await visible("#adminLogin"),false);
  await page.click("#adminPanelCloseButton");

  // Leaving the run ends the trial and clears run-only HUD.
  await page.evaluate(()=>{returnToMenu();});
  assert.equal(await page.evaluate(()=>adminMode),false);
  assert.equal(await page.evaluate(()=>document.body.classList.contains("lw125-over")),true);
  assert.equal(await visible("#lw121Hint"),false);
  assert.equal(await visible("#lw108DirectorHud"),false);

  // A normal run still needs the password.
  await page.click("#lw125QuickStart");
  assert.equal(await page.evaluate(()=>document.body.classList.contains("lw125-over")),false);
  await page.evaluate(()=>{unlockAdminAccessForCurrentAccount?.();updateAdminButton();document.getElementById("adminFloatingButton").click();});
  assert.equal(await visible("#adminLogin"),true,"password form in a normal run");
  assert.equal(await visible("#adminPanel"),false);
  assert.deepEqual(errors,[]);
  console.log("v127 admin trial passed");
}finally{
  await browser.close();
}
