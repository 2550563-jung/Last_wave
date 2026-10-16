/* Illustrated sprite renderer. Images are decoded and chroma-keyed once, never per frame. */
(() => {
  "use strict";
  const sheets=[[],[]],ready=[false,false];
  const STYLE_KEY="lastWaveGraphicsStyleV116";
  let artStyle="comic";
  try{if(localStorage.getItem(STYLE_KEY)==="classic")artStyle="classic";}catch{}
  const isComic=()=>artStyle==="comic";
  function syncStyleUi(){
    document.body.classList.toggle("lw116-classic",!isComic());
    document.body.classList.toggle("lw116-comic",isComic());
    document.body.classList.toggle("lw113-art-ready",isComic()&&ready.some(Boolean));
    document.querySelectorAll("[data-lw116-style]").forEach(button=>{
      const selected=button.dataset.lw116Style===artStyle;
      button.setAttribute("aria-pressed",String(selected));button.classList.toggle("selected",selected);
    });
  }
  function setStyle(value){
    if(value!=="classic"&&value!=="comic")return false;
    artStyle=value;try{localStorage.setItem(STYLE_KEY,value);}catch{}
    syncStyleUi();if(isComic())decorate();return true;
  }
  function installStyleControl(parent,id){
    if(!parent||document.getElementById(id))return;
    const group=document.createElement("fieldset");group.id=id;group.className="lw116-style-control";
    const legend=document.createElement("legend");legend.textContent="그래픽 표현";group.append(legend);
    for(const [value,label]of [["classic","기존 도형"],["comic","만화풍 이미지"]]){
      const button=document.createElement("button");button.type="button";button.className="btn";
      button.dataset.lw116Style=value;button.textContent=label;button.onclick=()=>setStyle(value);group.append(button);
    }
    const help=document.createElement("small");help.textContent="언제든 전환 · 이 기기에 선택 저장 · 외형 스킨은 만화풍에서 표시";group.append(help);
    parent.append(group);
  }
  const menuButtons=document.querySelector("#menu .menu-buttons");
  if(menuButtons){
    const container=document.createElement("div");container.className="lw116-menu-style";menuButtons.before(container);
    installStyleControl(container,"lw116MenuStyle");
  }
  installStyleControl(document.querySelector("#lw111SettingsOverlay .lw111-settings-grid"),"lw116SettingsStyle");
  installStyleControl(document.querySelector("#pauseMenu .pause-settings-grid"),"lw116PauseStyle");
  window.__lastWaveGraphicsV116={get style(){return artStyle;},setStyle,storageKey:STYLE_KEY};
  syncStyleUi();
  const urls=["./assets/comic-atlas-v113.webp","./assets/comic-items-v113.webp"];
  const thumb=new Map();
  function loadSheet(index){
    const image=new Image();
    image.onload=()=>{
      const xs=[0,.25,.5,.75,1],ys=index===0?[0,.24,.485,.74,1]:[0,.24,.44,.69,1];
      for(let row=0;row<4;row++)for(let col=0;col<4;col++){
        const c=document.createElement("canvas"),x=Math.round(xs[col]*image.width)+4,y=Math.round(ys[row]*image.height)+4;
        c.width=Math.round((xs[col+1]-xs[col])*image.width)-8;c.height=Math.round((ys[row+1]-ys[row])*image.height)-8;
        const g=c.getContext("2d",{willReadFrequently:true});g.drawImage(image,x,y,c.width,c.height,0,0,c.width,c.height);
        if(index!==0||row!==3||col!==3){
          const data=g.getImageData(0,0,c.width,c.height),d=data.data;
          for(let i=0;i<d.length;i+=4){
            const r=d[i],green=d[i+1],b=d[i+2];
            if(r>135&&b>110&&green<115&&r+b>green*3.4)d[i+3]=0;
          }
          g.putImageData(data,0,0);
        }
        sheets[index].push(c);
      }
      ready[index]=true;syncStyleUi();
      decorate();window.__lastWaveArtV113.ready=ready.every(Boolean);
    };
    image.onerror=()=>{window.__lastWaveArtV113.error="이미지를 불러오지 못했습니다.";};
    image.src=urls[index];
  }
  function sprite(sheet,index,x,y,width,height=width,flip=false,angle=0,alpha=1){
    const image=sheets[sheet][index];if(!image)return;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);if(flip)ctx.scale(-1,1);
    ctx.globalAlpha=alpha;ctx.drawImage(image,-width/2,-height/2,width,height);ctx.restore();
  }
  function gunIndex(id){
    const w=WEAPONS[id]||{};
    if(id==="pistol"||id==="revolver"||id==="machinePistol")return 0;
    if(/shotgun|Barrel|Cycler|flechette/i.test(id))return 1;
    if(/sniper|rail|gauss|Lance|Piercer|harpoon/i.test(id))return 2;
    if(w.blast>0)return 3;
    if(w.chain>0||/plasma|vortex/i.test(id))return 4;
    if(w.rate>=12)return 5;
    if(/crossbow/i.test(id))return 7;
    return 6;
  }
  function imageUrl(sheet,index){
    const key=sheet+":"+index;if(!thumb.has(key)&&sheets[sheet][index])thumb.set(key,sheets[sheet][index].toDataURL("image/png"));
    return thumb.get(key);
  }
  function decorate(){
    if(!isComic())return;
    for(const el of document.querySelectorAll(".lw113-weapon-art")){
      const id=el.closest("[data-weapon-id]")?.dataset.weaponId;
      const url=ready[1]?imageUrl(1,gunIndex(id)):ready[0]?imageUrl(0,12):null;
      if(url)el.style.backgroundImage='url("'+url+'")';
    }
    const crate=imageUrl(1,12);
    if(crate)for(const el of document.querySelectorAll(".lw113-draw-art"))el.style.backgroundImage='url("'+crate+'")';
    for(const el of document.querySelectorAll("#petGrid .card,#meleeGrid .card,#fusionGrid .card,.lw98-armor-card,#jobGrid .card")){
      if(el.querySelector(".lw113-item-thumb"))continue;
      const image=document.createElement("img");image.className="lw113-item-thumb";image.alt="";image.loading="lazy";
      let url=el.closest("#meleeGrid")?imageUrl(1,14):el.closest("#petGrid")?imageUrl(0,13):el.matches(".lw98-armor-card")?imageUrl(1,13):el.closest("#jobGrid")?imageUrl(0,0):imageUrl(0,12);
      if(url){image.src=url;el.prepend(image);}
    }
  }
  const oldRender=renderWeapons;renderWeapons=function(...args){const r=oldRender(...args);decorate();return r;};
  for(const name of ["renderPets","renderMelee","renderFusions","renderJobs"]){
    // These are global classic-script bindings; assignment through window retains their existing behavior.
    const original=window[name];
    if(typeof original==="function")window[name]=function(...args){const r=original(...args);decorate();return r;};
  }
  const oldCity=drawCity;
  drawCity=function(){
    if(!isComic()||!ready[0])return oldCity();
    const tile=sheets[0][15],size=420,ox=-((camera.x%size)+size)%size,oy=-(((camera.y*WORLD_Y_SCALE)%size)+size)%size;
    for(let x=ox-size;x<WIDTH+size;x+=size)for(let y=oy-size;y<HEIGHT+size;y+=size)ctx.drawImage(tile,x,y,size,size);
  };
  const oldBackdrop=v63DrawDynamicBackdrop;
  v63DrawDynamicBackdrop=function(){if(!isComic()||!ready[0])return oldBackdrop();};
  const oldPlayer=drawPlayer;
  drawPlayer=function(owner){
    if(!isComic()||!ready[0])return oldPlayer(owner);if(!owner||owner.dead)return;
    if(window.__lastWaveSkinsV115?.drawCharacter(owner))return;
    const p=project(owner.x,owner.y),flip=Math.cos(owner.angle||0)<0;
    const bob=Math.sin(performance.now()*.012)*(owner.motion||0)*2;
    sprite(0,owner.gender==="female"||owner.job==="medic"?1:0,p.x,p.y-18+bob,74,86,flip,owner.downed?Math.PI/2:0,owner.invincible>0?.72:1);
    const id=getWeaponId(owner),a=owner.angle||0;
    sprite(ready[1]?1:0,ready[1]?gunIndex(id):12,p.x+Math.cos(a)*17,p.y-13+Math.sin(a)*10,56,32,false,a);
    if(owner.meleeFlash>0&&ready[1])sprite(1,14,p.x+Math.cos(a)*32,p.y-12+Math.sin(a)*20,76,76,false,a);
    drawPet(owner);
  };
  const oldEnemy=drawEnemy;
  drawEnemy=function(enemy){
    if(!isComic()||!ready[0])return oldEnemy(enemy);if(!enemy||enemy.dead)return;
    const p=project(enemy.x,enemy.y);
    const boss=[4,9,5,11,8,10,9,10,7,8][Math.max(0,enemy.bossIndex||0)%10];
    const cell=enemy.boss?boss:({runner:3,charger:3,tank:4,spitter:5,bomber:6}[enemy.type]??2);
    const size=enemy.boss?Math.max(125,enemy.radius*2.1):Math.max(58,enemy.radius*3.2);
    const bob=Math.sin(performance.now()*.007+(enemy.gait||0))*2;
    sprite(0,cell,p.x,p.y-size*.24+bob,size,size,player&&enemy.x>player.x,0,enemy.hitFlash>0?.62:1);
    if(enemy.elite||enemy.boss){
      ctx.save();ctx.fillStyle="#152430";ctx.fillRect(p.x-size*.3,p.y-size*.79,size*.6,4);
      ctx.fillStyle=enemy.boss?"#ff776a":"#ffdc73";ctx.fillRect(p.x-size*.3,p.y-size*.79,size*.6*Math.max(0,enemy.hp/enemy.maxHp),4);ctx.restore();
    }
  };
  const oldPet=drawSinglePet;
  drawSinglePet=function(owner){
    if(!isComic()||!ready[0])return oldPet(owner);if(!owner||owner.dead||!owner.petId)return;
    const p=project(owner.petX,owner.petY,18),id=owner.petId;
    const map={hound:8,raven:9,cat:10,gecko:11};
    const cell=map[id],bob=Math.sin(performance.now()*.004)*3;
    sprite(cell!==undefined&&ready[1]?1:0,cell!==undefined&&ready[1]?cell:13,p.x,p.y+bob,44,44);
  };
  const oldBullets=drawBullets;
  drawBullets=function(){
    if(!isComic()||!ready[0])return oldBullets();
    for(const [list,hostile]of [[bullets,false],[enemyBullets,true]])for(const b of list){
      const p=project(b.x,b.y),angle=Math.atan2(b.vy*WORLD_Y_SCALE,b.vx);
      sprite(ready[1]?1:0,ready[1]?15:14,p.x,p.y,hostile?17:14,hostile?17:10,false,angle);
    }
  };
  const oldParticles=drawParticles;
  drawParticles=function(){
    if(!isComic()||!ready[0])return oldParticles();
    for(const p of particles){
      if(["smoke","blood","debris"].includes(p.type))continue;
      const pos=project(p.x,p.y),alpha=clamp(p.life/p.maxLife,0,1);
      const large=["explosion","fireball","shockwave","burnAura","slash","slashWave"].includes(p.type);
      const size=large?Math.min(260,(p.radius||p.range||35)*(1.4-alpha*.4)):Math.max(8,(p.size||6)*2);
      sprite(0,14,pos.x,pos.y,size,size,false,p.angle||p.rotation||0,alpha*.85);
    }
    for(const text of floatingTexts){
      const p=project(text.x,text.y,45),alpha=clamp(text.life/text.maxLife,0,1);
      ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=text.color;ctx.font="bold "+text.size+"px sans-serif";ctx.textAlign="center";ctx.fillText(text.text,p.x,p.y-(1-alpha)*25);ctx.restore();
    }
  };
  const oldSupplies=v56DrawSupplies;
  v56DrawSupplies=function(){
    if(!isComic()||!ready[1])return oldSupplies();if(!v56SystemsEnabled())return;
    for(const s of v56State.supplies){const p=project(s.x,s.y);sprite(1,12,p.x,p.y,48,48,false,0,clamp(s.life/3,0,1));}
  };
  window.__lastWaveArtV113={ready:false,decorate,sprite,gunIndex};
  loadSheet(0);loadSheet(1);
})();

