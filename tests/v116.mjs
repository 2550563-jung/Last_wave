import assert from "node:assert/strict";
import {createRequire} from "node:module";
const {chromium}=createRequire(process.execPath)("playwright-core");
const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"],executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe"});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",r=>r.request().url().startsWith("file:")?r.continue():r.abort());
 await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
 await page.waitForFunction(()=>window.__lastWaveSkinsV115?.ready&&window.__lastWaveArtV113?.ready);
 assert.equal(await page.evaluate(()=>window.__lastWaveGraphicsV116.style),"comic");
 await page.locator('#lw116MenuStyle [data-lw116-style="classic"]').click();
 assert.equal(await page.locator('#lw116SettingsStyle [data-lw116-style="classic"]').getAttribute("aria-pressed"),"true");
 await page.reload({waitUntil:"load"});
 await page.waitForFunction(()=>window.__lastWaveSkinsV115?.ready&&window.__lastWaveArtV113?.ready);
 assert.equal(await page.evaluate(()=>window.__lastWaveGraphicsV116.style),"classic");
 assert.ok(await page.locator("body").evaluate(el=>el.classList.contains("lw116-classic")&&!el.classList.contains("lw113-art-ready")));
 await page.locator("#lw111SettingsButton").click();
 await page.locator('#lw116SettingsStyle [data-lw116-style="comic"]').click();
 assert.equal(await page.locator('#lw116MenuStyle [data-lw116-style="comic"]').getAttribute("aria-pressed"),"true");
 await page.locator("#lw111SettingsClose").click();
 const result=await page.evaluate(()=>{
   startRun("normal");state="waveComplete";
   spawnEnemy();const enemy=enemies.find(e=>!e.dead);
   const saved={hp:player.hp,damage:getWeaponStats(player,"pistol").damage,credits:save.credits};
   const original=ctx.drawImage.bind(ctx);
   function count(style){
     window.__lastWaveGraphicsV116.setStyle(style);
     let calls=0;ctx.drawImage=(...args)=>{calls++;return original(...args);};
     try{drawCity();drawPlayer(player);if(enemy)drawEnemy(enemy);drawBullets();drawParticles();}
     finally{ctx.drawImage=original;}
     return calls;
   }
   const comic=count("comic"),classic=count("classic");
   const unchanged=player.hp===saved.hp&&getWeaponStats(player,"pistol").damage===saved.damage&&save.credits===saved.credits;
   const rejected=window.__lastWaveGraphicsV116.setStyle("invalid")===false&&window.__lastWaveGraphicsV116.style==="classic";
   window.__lastWaveGraphicsV116.setStyle("comic");
   return {comic,classic,unchanged,rejected,version:document.getElementById("gameVersion").textContent};
 });
 assert.ok(result.comic>0);assert.equal(result.classic,0);
 assert.ok(result.unchanged);assert.ok(result.rejected);assert.equal(result.version,"v120");
 await page.evaluate(()=>{state="playing";paused=false;togglePause();});
 await page.locator('#lw116PauseStyle [data-lw116-style="classic"]').click();
 assert.equal(await page.locator('#lw116MenuStyle [data-lw116-style="classic"]').getAttribute("aria-pressed"),"true");
 await page.locator("#resumeButton").click();
 assert.equal(await page.evaluate(()=>paused),false);
 await page.setViewportSize({width:412,height:915});
 await page.evaluate(()=>{returnToMenu();window.__lastWaveGraphicsV116.setStyle("classic");});
 await page.locator('#lw116MenuStyle [data-lw116-style="comic"]').click();
 assert.equal(await page.evaluate(()=>window.__lastWaveGraphicsV116.style),"comic");
 assert.deepEqual(errors,[]);
 console.log("v116 main/settings switches, saved preference, both renderers, mobile control and unchanged gameplay passed",result);
}finally{await browser.close();}

