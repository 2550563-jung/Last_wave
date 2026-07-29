import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "file:///C:/Users/commo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
import { startTestServer } from "./test-server.mjs";

const source=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
assert.match(source,/score \+=\s*getDifficultyAdjustedScore\(\s*enemy\.boss/);
assert.match(source,/score \+=\s*getDifficultyAdjustedScore\(\s*500/);
assert.match(source,/score \+=\s*getDifficultyAdjustedScore\(\s*wave\*/);

const testServer=await startTestServer();
const browser=await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"
});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];

page.on("pageerror",error=>errors.push(String(error.stack||error)));
page.on("console",message=>{
  if(
    message.type()==="error"&&
    !message.text().includes("ERR_NETWORK_ACCESS_DENIED")&&
    !message.text().includes("Failed to load resource")
  ){
    errors.push(message.text());
  }
});
await page.route("**/*",route=>{
  if(route.request().url().startsWith(testServer.baseUrl)){
    return route.continue();
  }else{
    return route.abort();
  }
});

await page.goto(`${testServer.baseUrl}/index.html`,{
  waitUntil:"commit",
  timeout:30000
});
await page.waitForFunction(()=>window.__lastWaveV104?.version===104,{timeout:60000});

const result=await page.evaluate(()=>{
  const difficulties=["survivor","nightmare","apocalypse","extinction"];
  const adjusted={};
  const descriptions={};

  for(const difficulty of difficulties){
    save.selectedDifficultyV82=difficulty;
    v82RenderDifficulty();
    adjusted[difficulty]=window.__lastWaveV104.getDifficultyAdjustedScore(1000);
    descriptions[difficulty]=document.getElementById("v82DifficultyDesc")?.textContent||"";
  }

  const section=document.getElementById("lw98EquipmentSection");
  const body=section?.querySelector(".lw98-equipment-body");
  const button=document.getElementById("lw98EquipmentToggle");
  button?.click();
  const collapsed={
    classSet:section?.classList.contains("collapsed"),
    label:button?.textContent,
    expanded:button?.getAttribute("aria-expanded"),
    bodyDisplay:body?getComputedStyle(body).display:null
  };
  button?.click();
  const reopened={
    classSet:section?.classList.contains("collapsed"),
    label:button?.textContent,
    expanded:button?.getAttribute("aria-expanded"),
    bodyDisplay:body?getComputedStyle(body).display:null
  };

  return{
    version:document.getElementById("gameVersion")?.textContent?.trim(),
    addon:window.__lastWaveV104?.version,
    labels:[...document.querySelectorAll("#v82DifficultySelect option")].map(option=>option.textContent),
    adjusted,
    descriptions,
    collapsed,
    reopened
  };
});

assert.equal(result.version,"v105");
assert.equal(result.addon,104);
assert.deepEqual(result.adjusted,{
  survivor:1000,
  nightmare:1080,
  apocalypse:1200,
  extinction:1350
});
assert.ok(result.labels.at(-1).includes("멸종 (멋진 사람용)"));
assert.ok(result.descriptions.extinction.includes("점수 ×1.35"));
assert.ok(result.descriptions.extinction.includes("전리품 ×1.80"));
assert.deepEqual(result.collapsed,{
  classSet:true,
  label:"방어구 열기",
  expanded:"false",
  bodyDisplay:"none"
});
assert.deepEqual(result.reopened,{
  classSet:false,
  label:"방어구 닫기",
  expanded:"true",
  bodyDisplay:"block"
});
assert.deepEqual(errors,[]);

console.log("v104 browser test passed.",result);
await browser.close();
await testServer.close();
