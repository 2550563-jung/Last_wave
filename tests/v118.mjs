import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.execPath)('playwright-core');
const browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files'],executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await page.goto(new URL('../index.html',import.meta.url).href);
 await page.waitForFunction(()=>window.__lastWaveAimV117?.ready);
 const result=await page.evaluate(()=>{
  const api=window.__lastWaveAimV117;let poses=0,maxGap=0,maxLength=0,maxGripStep=0;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function check(arm){for(const [a,b,len] of [[arm.start,arm.elbow,arm.l1],[arm.elbow,arm.end,arm.l2]])if(Math.abs(distance(a,b)-len)>1e-6)throw Error('Bone stretched');maxLength=Math.max(maxLength,arm.l1+arm.l2);}
  for(const target of [{x:0,y:0},{x:999,y:999},{x:-999,y:0},{x:.01,y:0}])check(api.solveIK({x:0,y:0},target));
  for(const female of [false,true])for(let pants=0;pants<3;pants++)for(let top=0;top<4;top++)for(const id of Object.keys(WEAPONS))for(const recoil of [0,.5,1]){
   let previous=null;
   for(let deg=0;deg<360;deg+=5){
    const rig=api.buildRig({top,pants,skin:2},female,deg*Math.PI/180,id,recoil);
    for(const [i,arm] of [rig.near,rig.far].entries()){check(arm);const gap=distance(arm.end,rig.wrists[i]);maxGap=Math.max(maxGap,gap);if(gap>.001)throw Error('Hand disconnected '+JSON.stringify({female,pants,top,id,deg,gap}));}
    if(previous&&previous.facing===rig.facing){const step=distance(previous.grip,rig.grip);maxGripStep=Math.max(maxGripStep,step);if(step>3)throw Error('Grip jumps');}previous=rig;poses++;
   }
  }
  return {poses,maxGap,maxLength,maxGripStep,version:document.getElementById('gameVersion').textContent};
 });
 assert.equal(result.version,'v118');assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser.close();}
