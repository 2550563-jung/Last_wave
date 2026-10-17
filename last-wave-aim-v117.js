/* v120: proportioned fixed arms, reachable grips and distance-driven walking. */
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
 function solveIK(start,target,l1=15.5,l2=15.5){
  const dx=target.x-start.x,dy=target.y-start.y,distance=Math.hypot(dx,dy);
  const ux=distance>1e-8?dx/distance:1,uy=distance>1e-8?dy/distance:0;
  // Unreachable input must never lengthen either bone, even for future poses.
  if(distance<1e-8&&l1===l2)return {start,elbow:{x:start.x,y:start.y+l1},end:{...start},l1,l2};
  const d=Math.max(Math.abs(l1-l2)+1e-8,Math.min(l1+l2-.001,distance));
  const end={x:start.x+ux*d,y:start.y+uy*d};
  const a=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-a*a));
  return {start,elbow:{x:start.x+ux*a-uy*h,y:start.y+uy*a+ux*h},end,l1,l2};
 }
 function buildRig(style,female,angle,id,recoil=0){
  const anchors=skins.rigLandmarks(style,female),gun=art.weaponImage(id),index=art.gunIndex(id);
  if(!anchors||!gun)return null;
  const facing=Math.cos(angle)<0?-1:1,screen=Math.atan2(Math.sin(angle)*WORLD_Y_SCALE,Math.cos(angle)*facing);
  let w=[30,49,57,50,44,50,46,46][index]||46,h=w*gun.height/gun.width;if(h>26){w*=26/h;h=26;}
  const primary={x:.4,y:.7},support={x:.67,y:.49},tip={x:.99,y:.28};
  const rotation=screen-Math.atan2((tip.y-primary.y)*h,(tip.x-primary.x)*w);
  recoil=Math.max(0,Math.min(1,Number(recoil)||0));
  const l1=female?14.5:15.5,l2=l1,reach=l1+l2-.4;
  const grip={x:anchors.centerX+8+Math.cos(screen)*(8-recoil*1.5),y:anchors.shoulderY+11+Math.sin(screen)*(7-recoil*1.5)};
  const handOffset=rotate(-4.1,.25,rotation),supportOffset=rotate((support.x-primary.x)*w,(support.y-primary.y)*h,rotation);
  const sockets=[anchors.near,anchors.far],offsets=[handOffset,{x:handOffset.x+supportOffset.x,y:handOffset.y+supportOffset.y}];
  // Move the complete weapon, preserving barrel angle and hand contacts.
  // Each disk constrains the same grip point by one shoulder's fixed reach.
  for(let pass=0;pass<32;pass++)for(let i=0;i<2;i++){
   const center={x:sockets[i].x-offsets[i].x,y:sockets[i].y-offsets[i].y};
   const dx=grip.x-center.x,dy=grip.y-center.y,d=Math.hypot(dx,dy);
   if(d>reach){grip.x=center.x+dx*reach/d;grip.y=center.y+dy*reach/d;}
  }
  const point=p=>{const v=rotate((p.x-primary.x)*w,(p.y-primary.y)*h,rotation);return{x:grip.x+v.x,y:grip.y+v.y};};
  const contacts=[grip,point(support)],wrists=contacts.map(p=>{const v=rotate(-4.1,.25,rotation);return{x:p.x+v.x,y:p.y+v.y};});
  return {anchors,facing,rotation,w,h,gun,grip,contacts,wrists,muzzle:point(tip),near:solveIK(anchors.near,wrists[0],l1,l2),far:solveIK(anchors.far,wrists[1],l1,l2),style:skins.sanitize(style),female};
 }
 function segment(g,img,a,b,width,length){g.save();g.translate(a.x,a.y);g.rotate(Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2);g.drawImage(img,-width/2,-.6,width,length+1.2);g.restore();}
 function arm(g,rig,bones){const top=rig.style.top,width=rig.female?6.5:7.5;segment(g,parts[top],bones.start,bones.elbow,width,bones.l1);segment(g,parts[4+top],bones.elbow,bones.end,width*.82,bones.l2);}
 const walkers=new WeakMap();
 function sampleGait(owner,now=performance.now()){
  let gait=walkers.get(owner);
  if(!gait){gait={x:owner.x,y:owner.y,time:now,phase:0,amount:0};walkers.set(owner,gait);return {phase:0,amount:0};}
  const dt=Math.max(0,Math.min(.1,(now-gait.time)/1000)),distance=Math.hypot(owner.x-gait.x,owner.y-gait.y);
  const moving=dt>0&&distance>.001&&distance<80&&!owner.downed&&!owner.dead;
  const target=moving?Math.min(1,distance/(dt*150)):0;
  gait.amount+=(target-gait.amount)*(1-Math.exp(-dt*16));
  if(moving)gait.phase=(gait.phase+Math.min(distance*.13,dt*22))%(Math.PI*2);
  if(owner.downed||owner.dead||gait.amount<.001)gait.amount=0;
  gait.x=owner.x;gait.y=owner.y;gait.time=now;
  return {phase:gait.phase,amount:gait.amount};
 }
 function renderPose(g,style,female,angle,id,recoil=0,gait=null){
  if(!ready())return null;const rig=buildRig(style,female,angle,id,recoil);if(!rig)return null;
  g.save();g.scale(rig.facing,1);arm(g,rig,rig.far);skins.composeRig(g,style,0,0,1,female,gait);arm(g,rig,rig.near);
  g.save();g.translate(rig.grip.x,rig.grip.y);g.rotate(rig.rotation);g.drawImage(rig.gun,-rig.w*.4,-rig.h*.7,rig.w,rig.h);g.restore();
  rig.contacts.forEach((p,i)=>{const hand=skins.tintRigPart(parts[8+i],'aim-hand:'+i,rig.style.skin);g.save();g.translate(p.x,p.y);g.rotate(rig.rotation);g.drawImage(hand,-5.04,-2.5,7,5);g.restore();});
  g.restore();return rig;
 }
 skins.drawCharacter=function(owner){
  if(!ready())return old(owner);if(window.__lastWaveGraphicsV116?.style==='classic'||!owner||owner.dead)return false;
  const p=project(owner.x,owner.y),gait=sampleGait(owner),bob=-Math.abs(Math.sin(gait.phase*2))*gait.amount*.7;
  ctx.save();ctx.translate(p.x,p.y+bob);if(owner.downed)ctx.rotate(Math.PI/2);
  const rig=renderPose(ctx,owner.local?save.styleV115:owner.styleV115,owner.gender==='female',owner.angle||0,getWeaponId(owner),Math.min(1,(owner.muzzleTimer||0)/.055),gait);
  ctx.restore();if(rig&&owner.muzzleTimer>0&&!owner.downed)art.sprite(1,15,p.x+rig.muzzle.x*rig.facing,p.y+bob+rig.muzzle.y,13,9,false,Math.atan2(Math.sin(owner.angle||0)*WORLD_Y_SCALE,Math.cos(owner.angle||0)));
  drawPet(owner);return true;
 };
 const oldMuzzle=createMuzzleEffect;createMuzzleEffect=function(...args){if(!ready()||window.__lastWaveGraphicsV116?.style==='classic')return oldMuzzle(...args);};
 const offsets=new WeakMap();function bulletOffset(b){
  if(!ready()||!WEAPONS[b.weaponId])return null;if(offsets.has(b))return offsets.get(b);
  const owner=players.get(b.ownerId);if(!owner)return null;const angle=Math.atan2(b.vy,b.vx),rig=buildRig(owner.local?save.styleV115:owner.styleV115,owner.gender==='female',angle,b.weaponId);
  if(!rig)return null;const offset={x:rig.muzzle.x*rig.facing-Math.cos(angle)*25,y:rig.muzzle.y-Math.sin(angle)*25*WORLD_Y_SCALE};offsets.set(b,offset);return offset;
 }
 window.__lastWaveAimV117={get ready(){return ready();},buildRig,solveIK,renderPose,bulletOffset,sampleGait};
})();
