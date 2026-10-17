import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.execPath)('playwright-core');
const browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files'],executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage(),errors=[],requested=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const url=r.request().url();requested.push(url);return url.startsWith('file:')?r.continue():r.abort();});
 await page.goto(new URL('../index.html',import.meta.url).href);
 await page.waitForFunction(()=>window.__lastWaveAimV117?.ready);
 for(const name of ['last-wave-v113.js','last-wave-v115.js','last-wave-art-v113.js','last-wave-aim-v117.js'])assert.ok(requested.some(url=>url.endsWith('/'+name+'?v=120')),'stale URL '+name);
 assert.equal(await page.locator('#gameVersion').textContent(),'v120');
 // Reproduce the exact old addon overwrite after page scripts, before the
 // authoritative footer. No external network or browser-cache clearing needed.
 await page.route('**/last-wave-aim-v117.js?v=120',r=>r.fulfill({contentType:'application/javascript',body:'document.getElementById("gameVersion").textContent="v117";'}));
 await page.reload();
 assert.equal(await page.locator('#gameVersion').textContent(),'v120');
 assert.equal(await page.evaluate(()=>window.__lastWaveCloudflare.releaseVersion),120);
 assert.deepEqual(errors,[]);console.log('v120 fresh dependency URLs and stale-addon overwrite regression passed');
}finally{await browser.close();}
