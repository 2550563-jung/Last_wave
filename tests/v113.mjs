import assert from "node:assert/strict";
import {createRequire} from "node:module";
const {chromium}=createRequire(process.execPath)("playwright-core");
import {startTestServer} from "./test-server.mjs";
const server=await startTestServer(),browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"],executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe"});
try{
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
page.on("pageerror",e=>errors.push(e.message));
await page.route("**/*",r=>r.request().url().startsWith("file:")?r.continue():r.abort());
await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
await page.waitForFunction(()=>window.__lastWaveV113);
const result=await page.evaluate(()=>{
  const api=window.__lastWaveV113;
  startRun("normal");state="waveComplete";money=200000;renderWeapons();renderFusions();
  const normal=Object.entries(WEAPONS).filter(([,w])=>!w.admin&&!w.replica&&!w.fusion);
  const fusion=FUSIONS.map(r=>[r.id,WEAPONS[r.id]]);
  const checks=[];
  for(const rows of [normal,fusion]){
    let previous=-Infinity;
    for(const[id,w]of rows){
      const d=api.combatDps(api.baseOwner(),id);
      if(d+1e-7<previous)throw new Error("nonmonotonic DPS "+id);
      previous=d;checks.push({id,cost:api.totalCost(id),dps:d});
    }
  }
  const pool=api.odds();let previous=Infinity;
  for(const e of pool){if(e.probability>previous+1e-12)throw new Error("odds not descending");previous=e.probability;}
  const sum=pool.reduce((n,x)=>n+x.probability,0);
  const before=money,count=player.weaponSlots.length;
  const success=api.drawGun(),winner=getWeaponId();
  const draw={success,spent:before-money,count:player.weaponSlots.length-count,valid:pool.some(x=>x.id===winner),excluded:!api.odds().some(x=>x.id===winner)};
  money=0;const slots=player.weaponSlots.length;api.drawGun();const denied=player.weaponSlots.length===slots&&money===0;
  let direct=0;
  player.buffs.crit=-.05;player.buffs.damage=0;player.buffs.rate=0;player.damageMult=1;
  player.weaponSlots=["smg"];player.activeSlot=0;player.weaponColors.smg="power";player.fireTimer=0;
  bullets.length=0;fireWeapon(player,1,0);
  const stats=getWeaponStats(player,"smg");
  direct=bullets.reduce((n,b)=>n+b.damage,0)/player.fireTimer;
  const expected=api.combatDps(player,"smg");
  const badge=[...document.querySelectorAll("#weaponGrid>.card")].map(e=>e.dataset.weaponId);
  const firstFusion=badge.findIndex(id=>WEAPONS[id].fusion);
  const fusionLast=firstFusion<0||badge.slice(firstFusion).every(id=>WEAPONS[id].fusion);
  money=5000;state="waveComplete";const spend=spendSharedRunMoney;
  let approve,requests=0;const countBefore=player.weaponSlots.length;
  spendSharedRunMoney=(cost,key,yes)=>{requests++;approve=yes;return true;};
  api.drawGun();api.drawGun();
  const waiting=player.weaponSlots.length===countBefore&&requests===1;
  money-=900;approve();spendSharedRunMoney=spend;
  const multiplayerDraw=waiting&&player.weaponSlots.length===countBefore+1&&money===4100;
  return {version:document.getElementById("gameVersion").textContent,checks,sum,draw,denied,direct,expected,fusionLast,multiplayerDraw};
});
assert.equal(result.version,"v115.1");assert.ok(Math.abs(result.sum-1)<1e-10);
assert.deepEqual(result.draw,{success:true,spent:900,count:1,valid:true,excluded:true});
assert.ok(result.denied);assert.ok(result.fusionLast);assert.ok(Math.abs(result.direct-result.expected)<1e-8);
assert.ok(result.multiplayerDraw);
console.log(JSON.stringify(result,null,2));
await page.waitForFunction(()=>window.__lastWaveArtV113?.ready,{timeout:10000});
await page.evaluate(()=>{state="playing";enemies.length=0;for(let i=0;i<7;i++)spawnEnemy();draw();});
await page.screenshot({path:"../preview-v113.png"});
assert.deepEqual(errors,[]);
console.log("v113 balance, draw, real projectile DPS and illustrated renderer passed");
}finally{await browser.close();await server.close();}

