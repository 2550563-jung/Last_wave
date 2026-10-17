import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const {chromium}=createRequire(process.execPath)('playwright-core');
const browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files'],executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await page.goto(new URL('../index.html',import.meta.url).href);await page.waitForFunction(()=>window.__lastWaveAimV117?.ready);
 const result=await page.evaluate(()=>{
  const api=window.__lastWaveAimV117,skins=window.__lastWaveSkinsV115;
  for(let direction=0;direction<8;direction++){
   const actor={x:0,y:0,motion:1},angle=direction*Math.PI/4;api.sampleGait(actor,0);let moving;
   for(let frame=1;frame<=60;frame++){actor.x+=Math.cos(angle)*3;actor.y+=Math.sin(angle)*3;moving=api.sampleGait(actor,frame*1000/60);}
   if(moving.amount<.9||moving.phase===0)throw Error('Walking did not start');
   const phase=moving.phase;
   for(let frame=61;frame<=110;frame++)moving=api.sampleGait(actor,frame*1000/60);
   if(moving.amount!==0||moving.phase!==phase)throw Error('Idle keeps walking');
   actor.x+=1000;const teleport=api.sampleGait(actor,1900);if(teleport.amount!==0)throw Error('Teleport starts walking');
   actor.downed=true;actor.x+=3;if(api.sampleGait(actor,1920).amount!==0)throw Error('Downed walking');
  }
  const gallery=document.createElement('canvas');gallery.width=1280;gallery.height=720;const gg=gallery.getContext('2d');gg.fillStyle='#263648';gg.fillRect(0,0,1280,720);
  const make=()=>{const c=document.createElement('canvas');c.width=160;c.height=160;return c;};let poses=0;
  for(const female of [false,true])for(let top=0;top<4;top++)for(let pants=0;pants<3;pants++){
   const style={top,pants,skin:2,hair:0,hairColor:0,accessory:0};
   const idle=make(),zero=make();skins.composeRig(idle.getContext('2d'),style,80,95,1,female);skins.composeRig(zero.getContext('2d'),style,80,95,1,female,{phase:1,amount:0});
   const original=idle.getContext('2d').getImageData(0,0,160,160).data,still=zero.getContext('2d').getImageData(0,0,160,160).data;
   if(original.some((v,i)=>v!==still[i]))throw Error('Idle outfit changed');
   for(let step=0;step<8;step++){
    const c=make(),g=c.getContext('2d'),draw=g.drawImage.bind(g),sizes=[];
    g.drawImage=(...args)=>{const t=g.getTransform();if(Math.abs(t.a*t.d-t.b*t.c-1)>1e-8)throw Error('Leg scaling');sizes.push(args.slice(1));return draw(...args);};
    skins.composeRig(g,style,80,95,1,female,{phase:step*Math.PI/4,amount:1});
    const pixels=g.getImageData(0,0,160,160).data;
    for(let i=0;i<160*55*4;i++)if(pixels[i]!==original[i])throw Error('Upper outfit shifted');
    if(!pixels.some((v,i)=>v!==original[i]))throw Error('Legs are static');
    poses++;
    if(pants===0&&(top===0||top===2)){
     const row=(female?2:0)+(top===2?1:0);gg.save();gg.translate(step*160+80,row*180+140);gg.scale(1.25,1.25);api.renderPose(gg,style,female,0,'rifle',0,{phase:step*Math.PI/4,amount:1});gg.restore();
    }
   }
  }
  return {poses,gallery:gallery.toDataURL(),version:document.getElementById('gameVersion').textContent};
 });
 assert.equal(result.version,'v120');assert.deepEqual(errors,[]);
 fs.writeFileSync(new URL('../../../walking-v120.png',import.meta.url),Buffer.from(result.gallery.split(',')[1],'base64'));console.log('v120 walking/idle/teleport/downed, rigid leg transforms and upper outfit alignment passed',result.poses);
}finally{await browser.close();}
