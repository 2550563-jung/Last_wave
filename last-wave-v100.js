/* Last Wave v100 · 사라진 v1을 대화 기록으로 복원한 기념 체험판 */
(() => {
  "use strict";

  const SAVE_KEY="lastWaveV100V1Experience";
  /* 메인 게임의 초성능 모드보다도 작은 고정 내부 해상도 */
  const W=640,H=360,TAU=Math.PI*2;
  const weapons={
    pistol:{name:"권총",cost:0,damage:22,rate:4,speed:720,pellets:1,spread:.02,color:"#ffe2a1"},
    smg:{name:"기관단총",cost:220,damage:10,rate:12,speed:760,pellets:1,spread:.12,color:"#d8f3ff"},
    shotgun:{name:"산탄총",cost:380,damage:12,rate:1.6,speed:650,pellets:7,spread:.42,color:"#ffd48a"},
    rifle:{name:"돌격소총",cost:620,damage:25,rate:7,speed:850,pellets:1,spread:.045,color:"#b7e8ff"}
  };
  const upgrades={
    hp:{name:"최대 체력",base:120,max:20,desc:"+12"},
    speed:{name:"이동 속도",base:90,max:10,desc:"+4%"},
    damage:{name:"공격력",base:110,max:20,desc:"+9%"},
    rate:{name:"공격 속도",base:130,max:15,desc:"+5%"}
  };
  const enemyTypes={
    walker:{name:"일반 좀비",hp:46,speed:40,damage:8,reward:5,r:15,color:"#71806d"},
    runner:{name:"러너",hp:31,speed:82,damage:7,reward:8,r:12,color:"#a69b62"},
    tank:{name:"탱커",hp:150,speed:25,damage:15,reward:15,r:22,color:"#566b62"},
    spitter:{name:"스피터",hp:78,speed:31,damage:9,reward:22,r:17,color:"#4f9a70",ranged:true}
  };
  let record;
  try{record=JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch{record={};}
  record={bestWave:0,bestScore:0,bestCombo:0,...record};

  const root=document.createElement("div");
  root.id="lw100Experience";
  root.innerHTML=`
    <div class="lw100-topbar">
      <div class="lw100-title">LAST WAVE <small>ORIGINAL v1 EXPERIENCE · v100 ANNIVERSARY</small></div>
      <div id="lw100Records" class="lw100-records"></div>
      <button id="lw100Close" class="btn lw100-close" aria-label="체험 닫기">×</button>
    </div>
    <div class="lw100-stage"><canvas id="lw100Canvas" width="${W}" height="${H}"></canvas></div>
    <section id="lw100Start" class="lw100-start-card">
      <small>복원 체험판</small><h2>LAST WAVE</h2>
      <p>몰려오는 좀비를 처치하고 100웨이브를 돌파하세요. 100웨이브 이후에는 무한 모드가 이어집니다.</p>
      <p><b>WASD / 방향키</b> 이동 · <b>마우스</b> 조준 · <b>왼쪽 버튼</b> 계속 공격<br>재장전은 없습니다. 5웨이브마다 체력이 회복됩니다.</p>
      <button id="lw100StartButton" class="btn primary">v1 체험 시작</button>
    </section>
    <section id="lw100Shop" class="lw100-shop">
      <div class="lw100-shop-head"><div><small>웨이브 사이 상점</small><h2 id="lw100ShopTitle">SHOP</h2></div><strong id="lw100ShopMoney"></strong></div>
      <div id="lw100ShopGrid" class="lw100-shop-grid"></div>
      <button id="lw100NextWave" class="btn primary lw100-next">다음 웨이브</button>
    </section>
    <div class="lw100-mobile">
      <div class="lw100-dpad"><button data-dir="up" class="btn">▲</button><button data-dir="left" class="btn">◀</button><button data-dir="down" class="btn">▼</button><button data-dir="right" class="btn">▶</button></div>
      <button id="lw100Fire" class="btn lw100-fire">공격</button>
    </div>`;
  document.body.append(root);
  const canvas=root.querySelector("#lw100Canvas"),ctx=canvas.getContext("2d");
  const startCard=root.querySelector("#lw100Start"),shop=root.querySelector("#lw100Shop");
  const keys=new Set(),mobileDirs=new Set();
  let open=false,running=false,between=false,last=0,raf=0;
  let wave=0,score=0,money=0,combo=0,comboTimer=0,maxCombo=0,spawnLeft=0,spawnTimer=0;
  let player,enemies=[],bullets=[],enemyBullets=[],texts=[],mouse={x:W/2+120,y:H/2,down:false};

  function persistRecord(){
    record.bestWave=Math.max(record.bestWave,wave);
    record.bestScore=Math.max(record.bestScore,Math.floor(score));
    record.bestCombo=Math.max(record.bestCombo,maxCombo);
    localStorage.setItem(SAVE_KEY,JSON.stringify(record));
    root.querySelector("#lw100Records").textContent=`최고 웨이브 ${record.bestWave} · 최고 점수 ${record.bestScore.toLocaleString()} · 최대 콤보 ${record.bestCombo}`;
  }
  function reset(){
    wave=0;score=0;money=0;combo=0;maxCombo=0;comboTimer=0;enemies=[];bullets=[];enemyBullets=[];texts=[];
    player={x:W/2,y:H/2,r:14,hp:100,maxHp:100,speed:150,armor:0,damageMult:1,rateMult:1,crit:0,income:1,regen:0,
      weapon:"pistol",owned:["pistol"],weaponLevels:{pistol:0},levels:{hp:0,speed:0,damage:0,rate:0},fire:0,hit:0};
    startWave();
  }
  function openExperience(){
    open=true;root.classList.add("show");startCard.style.display="block";shop.classList.remove("show");running=false;persistRecord();
    last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  }
  function closeExperience(){
    if(running||between)persistRecord();
    open=false;running=false;between=false;root.classList.remove("show");keys.clear();mobileDirs.clear();mouse.down=false;cancelAnimationFrame(raf);
  }
  function startWave(){
    wave++;between=false;running=true;shop.classList.remove("show");
    const after100=wave>100;
    const bossWave=wave%10===0||(after100&&wave%5===0);
    spawnLeft=Math.min(36,4+Math.floor(wave*1.25))+(bossWave?Math.min(6,Math.floor(wave/10)):0);
    spawnTimer=.2;
    if(bossWave)spawnBoss();
    texts.push({x:W/2,y:90,text:wave===100?"FINAL WAVE":after100?`INFINITE ${wave}`:`WAVE ${wave}`,color:"#ffffff",life:2,size:27});
  }
  function chooseType(){
    const pool=["walker"];
    if(wave>=5)pool.push("runner","runner");
    if(wave>=11)pool.push("tank");
    if(wave>=20)pool.push("spitter");
    return pool[Math.floor(Math.random()*pool.length)];
  }
  function edgePoint(){
    const side=Math.floor(Math.random()*4);
    return side===0?{x:Math.random()*W,y:-25}:side===1?{x:W+25,y:Math.random()*H}:side===2?{x:Math.random()*W,y:H+25}:{x:-25,y:Math.random()*H};
  }
  function spawnEnemy(type=chooseType(),override={}){
    const base=enemyTypes[type],pos=edgePoint();
    const scale=1+Math.max(0,wave-1)*.065+Math.max(0,wave-100)*.018;
    enemies.push({...base,type,...pos,hp:base.hp*scale,maxHp:base.hp*scale,speed:base.speed*(1+Math.min(.7,wave*.006)),
      damage:base.damage*(1+wave*.025),shoot:1+Math.random()*2,summon:4+Math.random()*3,dead:false,...override});
  }
  function spawnBoss(){
    const number=Math.floor(wave/10),pos=edgePoint();
    const names=["거대 좀비","강화 거대 좀비","단단한 거대 좀비"];
    const final=wave===100;
    const hp=(final?9000:900+wave*95)*(1+Math.max(0,wave-100)*.025);
    enemies.push({type:"boss",name:final?"최종 변이체":names[(number-1)%names.length],...pos,r:final?44:35,hp,maxHp:hp,speed:final?37:30+Math.min(18,wave*.12),
      damage:22+wave*.18,reward:300+wave*8,color:final?"#d94f68":"#8e4f59",boss:true,dead:false});
  }
  function aimAngle(){
    if(matchMedia("(pointer:coarse)").matches&&enemies.length){
      const target=[...enemies].sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
      return Math.atan2(target.y-player.y,target.x-player.x);
    }
    return Math.atan2(mouse.y-player.y,mouse.x-player.x);
  }
  function shoot(){
    const weapon=weapons[player.weapon];if(player.fire>0||bullets.length>=80)return;
    player.fire=1/(weapon.rate*player.rateMult);
    const base=aimAngle();
    for(let i=0;i<weapon.pellets;i++){
      const angle=base+(Math.random()-.5)*weapon.spread;
      bullets.push({x:player.x,y:player.y,vx:Math.cos(angle)*weapon.speed,vy:Math.sin(angle)*weapon.speed,r:player.weapon==="rocket"?6:3,
        damage:weapon.damage*player.damageMult*(1+(player.weaponLevels[player.weapon]||0)*.18),life:weapon.life||1.4,pierce:weapon.pierce||0,blast:weapon.blast||0,color:weapon.color,hit:new Set()});
    }
  }
  function hurt(amount){
    if(player.hit>0)return;
    const dealt=amount*(1-player.armor);player.hp-=dealt;player.hit=.28;combo=0;comboTimer=0;
    texts.push({x:player.x,y:player.y-24,text:`-${Math.round(dealt)}`,color:"#ff7180",life:.8,size:15});
    if(player.hp<=0){player.hp=0;running=false;persistRecord();startCard.style.display="block";startCard.querySelector("h2").textContent="게임 종료";
      startCard.querySelector("p").innerHTML=`${wave}웨이브 · ${Math.floor(score).toLocaleString()}점 · 최대 콤보 ${maxCombo}<br>다시 시작하면 모든 구매가 초기화됩니다.`;
      root.querySelector("#lw100StartButton").textContent="다시 시작";}
  }
  function kill(enemy){
    if(enemy.dead)return;enemy.dead=true;combo++;comboTimer=2.8;maxCombo=Math.max(maxCombo,combo);
    const scoreMult=combo>=25?2:combo>=10?1.5:1;
    const reward=Math.round(enemy.reward);money+=reward;score+=(reward*10+wave*2)*scoreMult;
    texts.push({x:enemy.x,y:enemy.y-18,text:`+${reward}`,color:"#ffd45f",life:.8,size:12});
  }
  function damageEnemy(enemy,amount,critical=false){
    if(enemy.shield)amount*=.58;
    enemy.hp-=amount;texts.push({x:enemy.x+(Math.random()-.5)*12,y:enemy.y-20,text:`${Math.round(amount)}${critical?"!":""}`,color:critical?"#fff17a":"#f4f4f4",life:.55,size:critical?15:11});
    if(enemy.hp<=0)kill(enemy);
  }
  function explode(x,y,r,damage){
    for(const enemy of enemies)if(!enemy.dead&&Math.hypot(enemy.x-x,enemy.y-y)<r)damageEnemy(enemy,damage);
    texts.push({x,y,text:"BOOM",color:"#ffb06b",life:.45,size:18});
  }
  function update(dt){
    if(!running)return;
    player.fire=Math.max(0,player.fire-dt);player.hit=Math.max(0,player.hit-dt);
    let dx=(keys.has("KeyD")||keys.has("ArrowRight")||mobileDirs.has("right")?1:0)-(keys.has("KeyA")||keys.has("ArrowLeft")||mobileDirs.has("left")?1:0);
    let dy=(keys.has("KeyS")||keys.has("ArrowDown")||mobileDirs.has("down")?1:0)-(keys.has("KeyW")||keys.has("ArrowUp")||mobileDirs.has("up")?1:0);
    const len=Math.hypot(dx,dy)||1;player.x=Math.max(player.r,Math.min(W-player.r,player.x+dx/len*player.speed*dt));player.y=Math.max(player.r,Math.min(H-player.r,player.y+dy/len*player.speed*dt));
    if((mouse.down||root.querySelector("#lw100Fire").dataset.down==="1"))shoot();
    if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)combo=0;}
    if(player.regen>0)player.hp=Math.min(player.maxHp,player.hp+player.regen*dt);
    spawnTimer-=dt;
    if(spawnLeft>0&&spawnTimer<=0){spawnEnemy();spawnLeft--;spawnTimer=Math.max(.09,.48-wave*.0025);}
    for(const enemy of enemies){
      if(enemy.dead)continue;
      const ex=player.x-enemy.x,ey=player.y-enemy.y,dist=Math.hypot(ex,ey)||1;
      if(enemy.ranged&&dist<270){enemy.shoot-=dt;if(enemy.shoot<=0&&enemyBullets.length<40){enemy.shoot=1.8;enemyBullets.push({x:enemy.x,y:enemy.y,vx:ex/dist*180,vy:ey/dist*180,r:5,damage:enemy.damage,life:3,color:"#72d58a"});}}
      else{enemy.x+=ex/dist*enemy.speed*dt;enemy.y+=ey/dist*enemy.speed*dt;}
      if(dist<enemy.r+player.r)hurt(enemy.damage);
    }
    for(const bullet of bullets){
      bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;
      for(const enemy of enemies){
        if(enemy.dead||bullet.hit.has(enemy)||Math.hypot(enemy.x-bullet.x,enemy.y-bullet.y)>enemy.r+bullet.r)continue;
        bullet.hit.add(enemy);const critical=Math.random()<player.crit;const damage=bullet.damage*(critical?2:1);
        if(bullet.blast)explode(bullet.x,bullet.y,bullet.blast,damage);else damageEnemy(enemy,damage,critical);
        if(bullet.pierce>0)bullet.pierce--;else bullet.life=0;break;
      }
    }
    for(const shot of enemyBullets){shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;if(Math.hypot(shot.x-player.x,shot.y-player.y)<shot.r+player.r){shot.life=0;hurt(shot.damage);}}
    bullets=bullets.filter(b=>b.life>0&&b.x>-50&&b.x<W+50&&b.y>-50&&b.y<H+50);enemyBullets=enemyBullets.filter(b=>b.life>0);
    enemies=enemies.filter(e=>!e.dead);
    for(const text of texts){text.y-=22*dt;text.life-=dt;}texts=texts.filter(t=>t.life>0).slice(-60);
    if(spawnLeft===0&&enemies.length===0)completeWave();
  }
  function completeWave(){
    running=false;between=true;const bonus=wave*10;money+=bonus;score+=bonus*4;
    let healText="";
    if(wave%5===0){const heal=30+player.levels.regen*5;player.hp=Math.min(player.maxHp,player.hp+heal);healText=` · 체력 +${heal}`;}
    if(wave===100)healText+=" · 무한 모드 해금";
    persistRecord();renderShop();root.querySelector("#lw100ShopTitle").textContent=`WAVE ${wave} 완료${healText}`;shop.classList.add("show");
  }
  function buyWeapon(id){
    const item=weapons[id],owned=player.owned.includes(id);
    if(owned){const level=player.weaponLevels[id]||0,cost=120+level*140;if(money<cost)return;money-=cost;player.weaponLevels[id]=level+1;player.weapon=id;}
    else{if(money<item.cost)return;money-=item.cost;player.owned.push(id);player.weaponLevels[id]=0;player.weapon=id;}
    renderShop();
  }
  function buyUpgrade(id){
    const item=upgrades[id],level=player.levels[id],cost=item.base+level*item.base;if(level>=item.max||money<cost)return;
    money-=cost;player.levels[id]++;
    if(id==="hp"){player.maxHp+=12;player.hp+=12;}if(id==="speed")player.speed*=1.04;if(id==="damage")player.damageMult*=1.09;if(id==="rate")player.rateMult*=1.05;
    if(id==="crit")player.crit+=.03;if(id==="armor")player.armor=Math.min(.45,player.armor+.02);if(id==="income")player.income*=1.08;if(id==="regen")player.regen+=2;
    renderShop();
  }
  function renderShop(){
    root.querySelector("#lw100ShopMoney").textContent=`₩ ${Math.floor(money).toLocaleString()}`;
    const grid=root.querySelector("#lw100ShopGrid");grid.innerHTML="";
    for(const [id,item] of Object.entries(weapons)){
      const owned=player.owned.includes(id),level=player.weaponLevels[id]||0,cost=owned?120+level*140:item.cost;
      grid.insertAdjacentHTML("beforeend",`<article class="lw100-shop-item"><h3>${player.weapon===id?"✓ ":""}${item.name}</h3><p>공격력 ${item.damage} · 속도 ${item.rate}${owned?` · 강화 ${level}`:""}</p><button class="btn" data-weapon="${id}">${owned?`${cost} 강화`:`${cost} 구매`}</button></article>`);
    }
    for(const [id,item] of Object.entries(upgrades)){
      const level=player.levels[id],cost=item.base+level*item.base;
      grid.insertAdjacentHTML("beforeend",`<article class="lw100-shop-item"><h3>${item.name} ${level}/${item.max}</h3><p>${item.desc}</p><button class="btn" data-upgrade="${id}" ${level>=item.max?"disabled":""}>${level>=item.max?"완료":`${cost} 강화`}</button></article>`);
    }
    grid.querySelectorAll("[data-weapon]").forEach(b=>b.onclick=()=>buyWeapon(b.dataset.weapon));
    grid.querySelectorAll("[data-upgrade]").forEach(b=>b.onclick=()=>buyUpgrade(b.dataset.upgrade));
  }
  function bar(x,y,w,value,max,color){
    ctx.fillStyle="#081014";ctx.fillRect(x,y,w,5);ctx.fillStyle=color;ctx.fillRect(x+1,y+1,(w-2)*Math.max(0,value/max),3);
  }
  function draw(){
    ctx.fillStyle="#101a1f";ctx.fillRect(0,0,W,H);
    if(!player){
      ctx.fillStyle="#56717a";ctx.font="bold 18px Arial";ctx.textAlign="center";
      ctx.fillText("v1 prototype",W/2,H/2+110);
      return;
    }
    ctx.fillStyle="#d9eef2";ctx.beginPath();ctx.arc(player.x,player.y,player.r,0,TAU);ctx.fill();
    const angle=aimAngle();ctx.strokeStyle="#e8eff1";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(player.x+Math.cos(angle)*24,player.y+Math.sin(angle)*24);ctx.stroke();
    bar(player.x-22,player.y+20,44,player.hp,player.maxHp,"#5ee58d");
    for(const enemy of enemies){
      ctx.fillStyle=enemy.color;ctx.beginPath();ctx.arc(enemy.x,enemy.y,enemy.r,0,TAU);ctx.fill();
      bar(enemy.x-enemy.r,enemy.y-enemy.r-9,enemy.r*2,enemy.hp,enemy.maxHp,enemy.boss?"#ff5e72":"#e27878");
    }
    for(const bullet of bullets){ctx.fillStyle=bullet.color;ctx.beginPath();ctx.arc(bullet.x,bullet.y,bullet.r,0,TAU);ctx.fill();}
    for(const bullet of enemyBullets){ctx.fillStyle=bullet.color;ctx.beginPath();ctx.arc(bullet.x,bullet.y,bullet.r,0,TAU);ctx.fill();}
    for(const text of texts){ctx.globalAlpha=Math.min(1,text.life*2);ctx.fillStyle=text.color;ctx.font=`bold ${text.size}px Arial`;ctx.textAlign="center";ctx.fillText(text.text,text.x,text.y);}ctx.globalAlpha=1;
    ctx.textAlign="left";ctx.fillStyle="rgba(5,11,15,.86)";ctx.fillRect(10,10,246,80);ctx.fillStyle="#eefaff";ctx.font="bold 17px Arial";ctx.fillText(`WAVE ${wave}${wave>100?" · INFINITE":""}`,22,34);
    ctx.font="12px Arial";ctx.fillStyle="#b4c8ce";ctx.fillText(`돈 ${Math.floor(money)}   점수 ${Math.floor(score)}   콤보 ${combo}`,22,55);ctx.fillText(`${weapons[player?.weapon||"pistol"].name}  HP ${Math.ceil(player?.hp||0)}/${Math.ceil(player?.maxHp||100)}`,22,76);
    const bosses=enemies.filter(e=>e.boss);if(bosses.length){const hp=bosses.reduce((s,b)=>s+b.hp,0),max=bosses.reduce((s,b)=>s+b.maxHp,0);const bx=W*.32,bw=W*.64;
      ctx.fillStyle="rgba(5,8,12,.9)";ctx.fillRect(bx,8,bw,34);ctx.fillStyle="#fff";ctx.font="bold 11px Arial";ctx.textAlign="center";ctx.fillText(bosses.map(b=>b.name).join(" + "),bx+bw/2,21);bar(bx+14,28,bw-28,hp,max,"#ff516a");}
  }
  function loop(time){
    if(!open)return;const dt=Math.min(.035,(time-last)/1000||0);last=time;update(dt);draw();raf=requestAnimationFrame(loop);
  }

  const menu=document.querySelector("#menu .menu-buttons");
  if(menu){const button=document.createElement("button");button.id="lw100ExperienceButton";button.className="btn lw100-menu-button";button.textContent="v1 체험";button.onclick=openExperience;
    const help=document.getElementById("helpButton");help?.insertAdjacentElement("beforebegin",button);}
  root.querySelector("#lw100Close").onclick=closeExperience;
  root.querySelector("#lw100StartButton").onclick=()=>{startCard.style.display="none";reset();};
  root.querySelector("#lw100NextWave").onclick=startWave;
  addEventListener("keydown",event=>{if(!open)return;event.stopImmediatePropagation();event.preventDefault();if(event.code==="Escape"){closeExperience();return;}keys.add(event.code);},true);
  addEventListener("keyup",event=>{if(!open)return;event.stopImmediatePropagation();event.preventDefault();keys.delete(event.code);},true);
  canvas.addEventListener("pointermove",event=>{const rect=canvas.getBoundingClientRect();mouse.x=(event.clientX-rect.left)*W/rect.width;mouse.y=(event.clientY-rect.top)*H/rect.height;});
  canvas.addEventListener("pointerdown",event=>{event.preventDefault();mouse.down=true;});
  addEventListener("pointerup",()=>{mouse.down=false;root.querySelector("#lw100Fire").dataset.down="0";});
  root.querySelectorAll("[data-dir]").forEach(button=>{
    const down=event=>{event.preventDefault();mobileDirs.add(button.dataset.dir);},up=event=>{event.preventDefault();mobileDirs.delete(button.dataset.dir);};
    button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up);
  });
  const fire=root.querySelector("#lw100Fire");fire.addEventListener("pointerdown",event=>{event.preventDefault();fire.dataset.down="1";});fire.addEventListener("pointerup",()=>fire.dataset.down="0");
  persistRecord();
  window.__lastWaveV100={
    version:100,
    open:openExperience,
    close:closeExperience,
    catalog:{
      weapons:Object.keys(weapons),
      upgrades:Object.keys(upgrades),
      enemies:Object.keys(enemyTypes)
    },
    getState:()=>({open,running,between,wave,score,money,enemies:enemies.length,bullets:bullets.length,player})
  };
})();
