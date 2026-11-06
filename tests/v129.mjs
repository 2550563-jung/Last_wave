import assert from "node:assert/strict";
import { chromium, GAME_VERSION } from "./browser.mjs";

const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"]});
const open=async(viewport,mobile=false)=>{
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(()=>localStorage.setItem("lw_seen_update","v999"));
  const page=await context.newPage();
  page.errors=[];
  page.on("pageerror",error=>page.errors.push(error.message));
  await page.route("**/*",route=>route.request().url().startsWith("file:")?route.continue():route.abort());
  await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
  await page.waitForFunction(()=>window.__lastWaveV129&&window.__lastWaveV125);
  return page;
};
const settle=page=>page.waitForTimeout(350);
try{
  assert.equal(GAME_VERSION,"v129");
  let page=await open({width:1280,height:800});
  const hudShown=()=>page.evaluate(()=>getComputedStyle(document.getElementById("stats")).visibility!=="hidden");
  const unload=()=>page.evaluate(()=>{const e=new Event("beforeunload",{cancelable:true});dispatchEvent(e);return e.defaultPrevented;});

  // Menu: calm, and leaving is free.
  await settle(page);
  assert.equal(await page.evaluate(()=>window.__lastWaveV129.calm),true);
  assert.equal(await unload(),false);

  // Fighting: HUD visible, closing asks.
  await page.click("#lw125QuickStart");
  await page.evaluate(()=>{player.invincible=999;});
  await settle(page);
  assert.equal(await hudShown(),true);
  assert.equal(await unload(),true);

  // Pause hides the HUD, resume brings it back.
  await page.keyboard.press("Escape");
  await settle(page);
  assert.equal(await page.evaluate(()=>paused),true);
  assert.equal(await hudShown(),false);
  // Escape again resumes rather than leaving.
  await page.keyboard.press("Escape");
  await settle(page);
  assert.equal(await page.evaluate(()=>paused),false);
  assert.equal(await hudShown(),true);

  // Back in a fight opens pause; Back on pause resumes; the run never ends.
  await page.evaluate(()=>dispatchEvent(new PopStateEvent("popstate",{state:null})));
  await settle(page);
  assert.equal(await page.evaluate(()=>({paused,state})).then(s=>s.paused&&s.state==="playing"),true);
  await page.evaluate(()=>dispatchEvent(new PopStateEvent("popstate",{state:null})));
  await settle(page);
  assert.deepEqual(await page.evaluate(()=>({paused,state})),{paused:false,state:"playing"});

  // Shop: HUD hidden, Back and Escape do not end the run.
  await page.evaluate(()=>{state="waveComplete";openShop();});
  await settle(page);
  assert.equal(await hudShown(),false);
  await page.evaluate(()=>dispatchEvent(new PopStateEvent("popstate",{state:null})));
  await page.keyboard.press("Escape");
  await settle(page);
  assert.equal(await page.evaluate(()=>state),"waveComplete");
  assert.equal(await page.evaluate(()=>getComputedStyle(ui.shop).display!=="none"),true);
  assert.equal(await unload(),true);
  await page.click("#nextWaveButton");
  await settle(page);
  assert.equal(await hudShown(),true);

  // Only the pause menu's quit button ends the run.
  await page.keyboard.press("Escape");
  await page.click("#quitButton");
  await settle(page);
  assert.equal(await page.evaluate(()=>state),"menu");
  assert.equal(await unload(),false);
  assert.deepEqual(page.errors,[]);

  // Game over screen is calm and needs no confirmation.
  await page.click("#lw125QuickStart");
  await page.evaluate(async()=>{await finishRun();});
  await settle(page);
  assert.equal(await page.evaluate(()=>window.__lastWaveV129.calm),true);
  assert.equal(await unload(),false);

  // No two combat panels overlap and nothing leaves the screen, at many sizes.
  for(const [width,height,mobile] of [[320,568,1],[390,844,1],[568,320,1],[844,390,1],[768,1024,1],[1024,600,0],[1920,1080,0],[3440,1440,0]]){
    page=await open({width,height},Boolean(mobile));
    await page.click("#lw125QuickStart");
    const issues=await page.evaluate(async()=>{
      player.invincible=999;wave=30;spawnBoss();
      await new Promise(resolve=>setTimeout(resolve,700));
      const ids=["stats","weaponHud","bossHud","missionHud","dangerHud","networkHud","effects","timeHud","lw97SkillDock","v56EventHud",
        "lw108DirectorHud","lw108ComboHud","message","lw121Hint","lw125Tip","moveStick","aimStick","ultimateButton","dashButton","meleeButton","pauseButton"];
      const boxes=ids.map(id=>[id,document.getElementById(id)]).filter(([,el])=>{
        if(!el)return false;const s=getComputedStyle(el);
        if(s.display==="none"||s.visibility==="hidden"||+s.opacity<.05)return false;
        for(let p=el.parentElement;p;p=p.parentElement){const ps=getComputedStyle(p);if(ps.display==="none"||ps.visibility==="hidden")return false;}
        const r=el.getBoundingClientRect();return r.width>2&&r.height>2;
      }).map(([id,el])=>[id,el.getBoundingClientRect()]);
      const out=[];
      for(const [id,r] of boxes)if(r.left<-1||r.top<-1||r.right>innerWidth+1||r.bottom>innerHeight+1)out.push(`off ${id}`);
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i][1],b=boxes[j][1];
        if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4)out.push(`${boxes[i][0]}/${boxes[j][0]}`);
      }
      return out;
    });
    assert.deepEqual(issues,[],`${width}x${height}`);
    assert.deepEqual(page.errors,[]);
    await page.context().close();
  }
  console.log("v129 calm screens, layout and exit guard passed");
}finally{
  await browser.close();
}
