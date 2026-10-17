/* v117: image sleeves, fixed shoulder sockets and shared hand/weapon anchors. */
(()=>{
 const skins=window.__lastWaveSkinsV115,art=window.__lastWaveArtV113,old=skins.drawCharacter,parts=[];
 const ready=()=>parts.length===12&&skins.ready&&skins.rigReady&&art.ready;
 const image=new Image();image.onload=()=>{
  const rows=[0,.418,.76,1];
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
   const c=document.createElement('canvas');c.width=Math.floor(image.width/4)-8;c.height=Math.floor(image.height*(rows[row+1]-rows[row]))-8;
   const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,image.width*col/4+4,image.height*rows[row]+4,c.width,c.height,0,0,c.width,c.height);
   const data=g.getImageData(0,0,c.width,c.height),d=data.data;let l=c.width,t=c.height,r=0,b=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(d[i]>130&&d[i+2]>110&&d[i+1]<120&&d[i]+d[i+2]>d[i+1]*3.4)d[i+3]=0;if(d[i+3]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}
   g.putImageData(data,0,0);const trimmed=document.createElement('canvas');trimmed.width=Math.max(1,r-l+1);trimmed.height=Math.max(1,b-t+1);trimmed.getContext('2d').drawImage(c,l,t,trimmed.width,trimmed.height,0,0,trimmed.width,trimmed.height);parts.push(trimmed);
  }
 };image.src='./assets/aim-arms-v117.webp';
 const rotate=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
 function solveIK(start,end,l1=21,l2=21){
  const dx=end.x-start.x,dy=end.y-start.y,d=Math.max(.001,Math.hypot(dx,dy)),a=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-a*a));
  return {start,elbow:{x:start.x+dx/d*a-dy/d*h,y:start.y+dy/d*a+dx/d*h},end};
 }
 function buildRig(style,female,angle,id,recoil=0){
  const anchors=skins.rigLandmarks(style,female),gun=art.weaponImage(id),index=art.gunIndex(id);
  if(!anchors||!gun)return null;
  const facing=Math.cos(angle)<0?-1:1,screen=Math.atan2(Math.sin(angle)*WORLD_Y_SCALE,Math.cos(angle)*facing);
  let w=[30,49,57,50,44,50,46,46][index]||46,h=w*gun.height/gun.width;if(h>26){w*=26/h;h=26;}
  const primary={x:.4,y:.7},support={x:.67,y:.49},tip={x:.99,y:.28};
  const rotation=screen-Math.atan2((tip.y-primary.y)*h,(tip.x-primary.x)*w);
  const grip={x:anchors.centerX+5+Math.cos(screen)*(5-recoil*2),y:anchors.shoulderY+10+Math.sin(screen)*(6-recoil*2)};
  const point=p=>{const v=rotate((p.x-primary.x)*w,(p.y-primary.y)*h,rotation);return{x:grip.x+v.x,y:grip.y+v.y};};
  const contacts=[grip,point(support)],wrists=contacts.map(p=>{const v=rotate(-4.1,.25,rotation);return{x:p.x+v.x,y:p.y+v.y};});
  return {anchors,facing,rotation,w,h,gun,grip,contacts,wrists,muzzle:point(tip),near:solveIK(anchors.near,wrists[0]),far:solveIK(anchors.far,wrists[1]),style:skins.sanitize(style),female};
 }
 function segment(g,img,a,b,width){const len=Math.hypot(b.x-a.x,b.y-a.y);g.save();g.translate(a.x,a.y);g.rotate(Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2);g.drawImage(img,-width/2,-1,width,len+2);g.restore();}
 function arm(g,rig,bones){const top=rig.style.top,width=rig.female?6.5:7.5;segment(g,parts[top],bones.start,bones.elbow,width);segment(g,parts[4+top],bones.elbow,bones.end,width*.82);}
 function renderPose(g,style,female,angle,id,recoil=0){
  if(!ready())return null;const rig=buildRig(style,female,angle,id,recoil);if(!rig)return null;
  g.save();g.scale(rig.facing,1);arm(g,rig,rig.far);skins.composeRig(g,style,0,0,1,female);arm(g,rig,rig.near);
  g.save();g.translate(rig.grip.x,rig.grip.y);g.rotate(rig.rotation);g.drawImage(rig.gun,-rig.w*.4,-rig.h*.7,rig.w,rig.h);g.restore();
  rig.contacts.forEach((p,i)=>{const hand=skins.tintRigPart(parts[8+i],'aim-hand:'+i,rig.style.skin);g.save();g.translate(p.x,p.y);g.rotate(rig.rotation);g.drawImage(hand,-5.04,-2.5,7,5);g.restore();});
  g.restore();return rig;
 }
 skins.drawCharacter=function(owner){
  if(!ready())return old(owner);if(window.__lastWaveGraphicsV116?.style==='classic'||!owner||owner.dead)return false;
  const p=project(owner.x,owner.y),bob=Math.sin(performance.now()*.012)*(owner.motion||0)*1.4;
  ctx.save();ctx.translate(p.x,p.y+bob);if(owner.downed)ctx.rotate(Math.PI/2);
  const rig=renderPose(ctx,owner.local?save.styleV115:owner.styleV115,owner.gender==='female',owner.angle||0,getWeaponId(owner),Math.min(1,(owner.muzzleTimer||0)/.055));
  ctx.restore();if(rig&&owner.muzzleTimer>0&&!owner.downed)art.sprite(1,15,p.x+rig.muzzle.x*rig.facing,p.y+bob+rig.muzzle.y,13,9,false,Math.atan2(Math.sin(owner.angle||0)*WORLD_Y_SCALE,Math.cos(owner.angle||0)));
  drawPet(owner);return true;
 };
 const oldMuzzle=createMuzzleEffect;createMuzzleEffect=function(...args){if(!ready()||window.__lastWaveGraphicsV116?.style==='classic')return oldMuzzle(...args);};
 const offsets=new WeakMap();function bulletOffset(b){
  if(!ready()||!WEAPONS[b.weaponId])return null;if(offsets.has(b))return offsets.get(b);
  const owner=players.get(b.ownerId);if(!owner)return null;const angle=Math.atan2(b.vy,b.vx),rig=buildRig(owner.local?save.styleV115:owner.styleV115,owner.gender==='female',angle,b.weaponId);
  if(!rig)return null;const offset={x:rig.muzzle.x*rig.facing-Math.cos(angle)*25,y:rig.muzzle.y-Math.sin(angle)*25*WORLD_Y_SCALE};offsets.set(b,offset);return offset;
 }
 window.__lastWaveAimV117={get ready(){return ready();},buildRig,solveIK,renderPose,bulletOffset};
})();
