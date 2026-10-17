import assert from "node:assert/strict";
import {createRequire} from "node:module";
const {chromium}=createRequire(process.execPath)("playwright-core");
const browser=await chromium.launch({headless:true,args:["--allow-file-access-from-files"],executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe"});
try{
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
page.on("pageerror",e=>errors.push(e.message));
await page.route("**/*",r=>r.request().url().startsWith("file:")?r.continue():r.abort());
await page.goto(new URL("../index.html",import.meta.url).href,{waitUntil:"load"});
await page.waitForFunction(()=>window.__lastWaveSkinsV115?.ready);
const result=await page.evaluate(()=>{
  const api=window.__lastWaveSkinsV115;
  save.credits=0;const before=JSON.stringify(save.styleV115);
  api.setDraft({hair:3,top:3,pants:2,accessory:2,skin:4,hairColor:5});
  const price=api.price({hair:3,top:3,pants:2,accessory:2,skin:4,hairColor:5});
  const denied=!api.apply()&&save.credits===0&&JSON.stringify(save.styleV115)===before;
  save.credits=10000;const bought=api.apply(),spent=10000-save.credits;
  const owned=save.ownedStyleV115.includes("hair:3")&&save.ownedStyleV115.includes("top:3");
  api.apply();const repeatFree=save.credits===10000-spent;
  const local=JSON.parse(localStorage.getItem(STORE_KEY));
  const persisted=JSON.stringify(local.styleV115)===JSON.stringify(save.styleV115);
  const cloud=cloudProfilePayload(),cloudSaved=cloud.styleV115.hair===3&&cloud.ownedStyleV115.includes("top:3");
  const sanitized=api.sanitize({hair:999,top:"bad",pants:-5,skin:9});
  startRun("normal");const payload=makeMultiplayerLoadoutPayload();
  const outgoing=payload.styleV115.hair===3&&payload.styleV115.top===3;
  const remote=createPlayer("test-remote","soldier",false);
  const incoming=applyMultiplayerLoadout(remote,{...payload,playerId:remote.id,loadoutOwnerId:remote.id,loadoutRevision:999});
  const multiplayerStyle=!!incoming&&remote.styleV115.hair===3;
  api.open();
  const renderSkin=skin=>{
    const canvas=document.createElement("canvas");canvas.width=240;canvas.height=300;
    const g=canvas.getContext("2d");api.compose(g,{hair:0,top:2,pants:0,accessory:0,skin,hairColor:0},120,220,2,false);
    return [...g.getImageData(110,125,20,20).data];
  };
  const light=renderSkin(0),dark=renderSkin(5);
  const clothingColorPreserved=light.every((value,index)=>value===dark[index])&&light.some(value=>value>0);
  return {price,denied,bought,spent,owned,repeatFree,persisted,cloudSaved,sanitized,outgoing,multiplayerStyle,clothingColorPreserved,version:document.getElementById("gameVersion").textContent};
});
assert.equal(result.version,"v120");assert.equal(result.price,5900);assert.equal(result.spent,result.price);
for(const key of ["denied","bought","owned","repeatFree","persisted","cloudSaved","outgoing","multiplayerStyle"])assert.ok(result[key],key);
assert.equal(result.sanitized.hair,0);assert.equal(result.sanitized.skin,2);
assert.ok(result.clothingColorPreserved,"changing skin color must preserve the orange hoodie");
await page.screenshot({path:"../wardrobe-v115.png"});
await page.setViewportSize({width:412,height:915});
await page.screenshot({path:"../wardrobe-mobile-v115.png"});
assert.deepEqual(errors,[]);
console.log("v115 credit purchases, ownership, persistence, cloud payload, multiplayer cosmetics and mobile render passed",result);
}finally{await browser.close();}

