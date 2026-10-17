import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const {chromium}=createRequire(process.execPath)('playwright-core');
const browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files'],executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await page.goto(new URL('../index.html',import.meta.url).href);
 await page.waitForFunction(()=>window.__lastWaveAimV117?.ready,{timeout:30000});
 const result=await page.evaluate(()=>{
  let count=0,maxReach=0;const api=window.__lastWaveAimV117,ids=Object.keys(WEAPONS),chosen=[];
  for(const id of ids)if(!chosen.some(x=>__lastWaveArtV113.gunIndex(x)===__lastWaveArtV113.gunIndex(id)))chosen.push(id);
  const galleries=[];
  for(const female of [false,true]){
   const canvas=document.createElement('canvas');canvas.width=1120;canvas.height=1800;const g=canvas.getContext('2d');g.fillStyle='#253447';g.fillRect(0,0,1120,1800);
   for(let pants=0;pants<3;pants++)for(let top=0;top<4;top++)for(let dir=0;dir<8;dir++){
    const style={top,pants,skin:2,hair:0,hairColor:0,accessory:0},angle=dir*Math.PI/4;
    for(const id of chosen){const rig=api.buildRig(style,female,angle,id);for(const arm of [rig.near,rig.far]){const reach=Math.hypot(arm.end.x-arm.start.x,arm.end.y-arm.start.y);maxReach=Math.max(maxReach,reach);if(reach>arm.l1+arm.l2)throw Error('Unreachable grip');for(const [a,b,length] of [[arm.start,arm.elbow,arm.l1],[arm.elbow,arm.end,arm.l2]])if(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-length)>.001)throw Error('Arm seam');}count++;}
    g.save();g.translate(dir*140+70,(pants*4+top)*150+129);g.scale(1.05,1.05);api.renderPose(g,style,female,angle,chosen[top%chosen.length]);g.restore();
   }
   galleries.push(canvas.toDataURL());
  }
  return {count,maxReach,galleries,version:document.getElementById('gameVersion').textContent};
 });
 assert.equal(result.version,'v120');assert.deepEqual(errors,[]);
 result.galleries.forEach((uri,i)=>fs.writeFileSync(new URL('../../../aim-gallery-'+i+'.png',import.meta.url),Buffer.from(uri.split(',')[1],'base64')));
 console.log(JSON.stringify({poses:result.count,maxReach:result.maxReach,errors}));
}finally{await browser.close();}
