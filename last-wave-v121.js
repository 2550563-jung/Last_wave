/* LAST WAVE v121: solo combat variety, daily missions, comfort settings. */
(() => {
  "use strict";
  const VERSION=121;
  const VARIANTS={
    charger:{name:"돌격체",symbol:"⚡",color:"#ffd34d",minWave:4,hp:1.05},
    splitter:{name:"분열체",symbol:"◆",color:"#c78bff",minWave:6,hp:1.25},
    healer:{name:"치유체",symbol:"✚",color:"#6dffb0",minWave:8,hp:1.2}
  };
  const CONTRACTS={
    none:{name:"계약 없음",desc:"평소대로 진행합니다.",hp:1,speed:1,damage:1,bonus:0},
    tough:{name:"강철 계약",desc:"적 체력 +30% · 웨이브 자금 +40%",hp:1.3,speed:1,damage:1,bonus:.4},
    swift:{name:"질주 계약",desc:"적 속도 +15% · 웨이브 자금 +40%",hp:1,speed:1.15,damage:1,bonus:.4},
    deadly:{name:"죽음의 계약",desc:"적 체력 +30% · 피해 +25% · 웨이브 자금 +100%",hp:1.3,speed:1,damage:1.25,bonus:1}
  };
  const MISSIONS=[
    {id:"kills",name:"소탕 작전",desc:"적 150마리 처치",target:150,reward:500},
    {id:"elites",name:"정예 사냥",desc:"엘리트 5마리 처치",target:5,reward:600},
    {id:"wave",name:"방어선 유지",desc:"웨이브 10 도달",target:10,reward:600},
    {id:"bosses",name:"거인 처치",desc:"보스 1마리 처치",target:1,reward:700},
    {id:"variants",name:"변이 표본",desc:"변이 적 15마리 처치",target:15,reward:500},
    {id:"events",name:"돌발 상황",desc:"웨이브 이벤트 2회 겪기",target:2,reward:500},
    {id:"contracts",name:"위험한 거래",desc:"위험 계약 1회 완수",target:1,reward:700}
  ];
  const NOTES=[
    "새 변이 적: 돌격체, 분열체, 치유체 (솔로)",
    "웨이브 이벤트: 보급 낙하, 황금 습격, 핏빛 달 (솔로)",
    "상점에서 고르는 위험 계약 (솔로)",
    "보스 처치 시 보급 상자 (솔로)",
    "일일 미션과 새 업적 6개",
    "첫 판 안내와 편의 설정"
  ];
  const runtime={contract:"none",activeContract:"none",event:null,crate:null,bloodMoon:false};
  const byId=id=>document.getElementById(id);
  const solo=()=>!multiplayer.active;
  const countable=()=>window.__lastWaveV92?.state?.training!==true;

  function meta(){
    const m=save.v121&&typeof save.v121==="object"?save.v121:(save.v121={});
    m.stats={variants:0,golden:0,crates:0,events:0,contracts:0,deadly:0,...(m.stats||{})};
    m.settings={noShake:false,fewerParticles:false,strongMarks:false,largeText:false,...(m.settings||{})};
    return m;
  }
  function dateKey(now=Date.now()){return new Date(now+9*3600e3).toISOString().slice(0,10);}
  function hash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function missionsFor(key){
    const pool=[...MISSIONS].sort((a,b)=>hash(key+a.id)-hash(key+b.id));
    return pool.slice(0,3);
  }
  function daily(){
    const m=meta(),key=dateKey();
    if(m.daily?.date!==key)m.daily={date:key,progress:{},claimed:[]};
    return m.daily;
  }
  function advance(id,amount=1,absolute=false){
    if(!countable())return;
    const d=daily();
    d.progress[id]=absolute?Math.max(d.progress[id]||0,amount):(d.progress[id]||0)+amount;
    for(const mission of missionsFor(d.date)){
      if(mission.id!==id||d.claimed.includes(id)||d.progress[id]<mission.target)continue;
      d.claimed.push(id);
      save.credits=(Number(save.credits)||0)+mission.reward;
      showMessage(`일일 미션 완료 · ${mission.name}`,`🪙 ${formatNumber(mission.reward)}`);
      persist({cloudDelay:1200});
      v82RefreshCurrencyUi?.();
    }
  }
  function bump(key,amount=1){if(countable())meta().stats[key]+=amount;}

  [
    {id:"v121variants",name:"변이 연구가",desc:"변이 적 100마리 처치",target:100,get:()=>meta().stats.variants,reward:{credits:1500}},
    {id:"v121variants2",name:"변이 박멸",desc:"변이 적 1,000마리 처치",target:1000,get:()=>meta().stats.variants,reward:{credits:6000,prism:2}},
    {id:"v121golden",name:"황금 사냥꾼",desc:"황금 습격체 10마리 처치",target:10,get:()=>meta().stats.golden,reward:{credits:2500}},
    {id:"v121crates",name:"보급 담당관",desc:"보급 상자 25개 회수",target:25,get:()=>meta().stats.crates,reward:{credits:2500,prism:1}},
    {id:"v121contracts",name:"계약 전문가",desc:"위험 계약 20회 완수",target:20,get:()=>meta().stats.contracts,reward:{credits:4000,relics:1}},
    {id:"v121deadly",name:"죽음과의 거래",desc:"죽음의 계약 5회 완수",target:5,get:()=>meta().stats.deadly,reward:{credits:5000,talentTokens:1}}
  ].forEach(v84AddAchievement);

  function makeVariant(enemy){
    const options=Object.entries(VARIANTS).filter(([,v])=>wave>=v.minWave);
    if(!options.length||runRandom()>=Math.min(.28,.08+wave*.006))return;
    const [id,v]=options[Math.floor(runRandom()*options.length)];
    enemy.v121Variant=id;
    enemy.v121Timer=2+runRandom()*2;
    enemy.v121BaseSpeed=enemy.speed;
    enemy.maxHp*=v.hp;enemy.hp=enemy.maxHp;
  }
  function applyEffects(enemy){
    const c=CONTRACTS[runtime.activeContract]||CONTRACTS.none;
    const moon=runtime.bloodMoon?1.15:1;
    enemy.maxHp*=c.hp;enemy.hp=enemy.maxHp;
    enemy.speed*=c.speed*(runtime.bloodMoon?1.1:1);
    enemy.damage*=c.damage*moon;
  }
  const baseSpawnEnemy=spawnEnemy;
  spawnEnemy=function(){
    const before=enemies.length,result=baseSpawnEnemy();
    if(solo())for(let i=before;i<enemies.length;i++){makeVariant(enemies[i]);applyEffects(enemies[i]);}
    return result;
  };
  const baseSpawnBoss=spawnBoss;
  spawnBoss=function(){
    const before=enemies.length,result=baseSpawnBoss();
    if(solo())for(let i=before;i<enemies.length;i++)applyEffects(enemies[i]);
    return result;
  };

  function updateVariant(enemy,dt){
    if(enemy.dead||!enemy.v121Variant)return;
    enemy.v121Timer-=dt;
    if(enemy.v121Variant==="charger"){
      if(enemy.v121Charging){
        if(enemy.v121Timer<=0){enemy.v121Charging=false;enemy.speed=enemy.v121BaseSpeed;enemy.v121Timer=3;}
      }else if(enemy.v121Timer<=0){
        enemy.v121Charging=true;enemy.v121BaseSpeed=enemy.speed;enemy.speed*=2.6;enemy.v121Timer=.8;
      }
    }else if(enemy.v121Variant==="healer"&&enemy.v121Timer<=0){
      enemy.v121Timer=2.5;
      for(const other of enemies){
        if(other===enemy||other.dead||other.boss)continue;
        if(Math.hypot(other.x-enemy.x,other.y-enemy.y)>150||other.hp>=other.maxHp)continue;
        other.hp=Math.min(other.maxHp,other.hp+other.maxHp*.06);
        addFloatingText(other.x,other.y-other.radius,"+","#6dffb0",14);
      }
    }
  }
  function updateGolden(enemy,dt){
    if(!enemy.v121Golden||enemy.dead)return;
    enemy.v121GoldenTime-=dt;
    if(enemy.v121GoldenTime<=0){
      enemy.dead=true;
      showMessage("황금 습격체 도주","다음 기회를 노리세요.");
    }
  }
  const baseUpdateEnemy=updateEnemy;
  updateEnemy=function(enemy,dt){
    updateVariant(enemy,dt);updateGolden(enemy,dt);
    return baseUpdateEnemy(enemy,dt);
  };

  function split(enemy){
    for(const side of [-1,1]){
      if(enemies.length>=MAX_ENEMIES)return;
      enemies.push({...enemy,id:createId(),x:enemy.x+side*enemy.radius,y:enemy.y,radius:enemy.radius*.72,
        maxHp:enemy.maxHp*.35,hp:enemy.maxHp*.35,dead:false,burn:0,poison:0,slow:0,elite:false,
        v121Variant:null,v121Splitling:true});
    }
  }
  const baseKillEnemy=killEnemy;
  killEnemy=function(enemy,owner){
    const alive=Boolean(enemy&&!enemy.dead);
    const result=baseKillEnemy(enemy,owner);
    if(!alive||!enemy.dead)return result;
    if(solo()){
      if(enemy.v121Variant==="splitter")split(enemy);
      if(enemy.v121Golden){
        money+=300+wave*40;
        score+=getDifficultyAdjustedScore(wave*20);
        bump("golden");
        addFloatingText(enemy.x,enemy.y-enemy.radius,"황금 보상!","#ffd34d",18);
      }
      if(enemy.boss)dropCrate(enemy.x,enemy.y);
    }
    if(owner?.local){
      advance("kills");
      if(enemy.elite)advance("elites");
      if(enemy.boss)advance("bosses");
      if(enemy.v121Variant){advance("variants");bump("variants");}
    }
    return result;
  };

  function dropCrate(x,y){
    runtime.crate={x,y,time:25};
  }
  function collectCrate(){
    const gain=150+wave*25;
    money+=gain;
    if(player)player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.2);
    addFloatingText(player.x,player.y-40,`보급 +${formatNumber(gain)}`,"#71dcff",18);
    runtime.crate=null;
    bump("crates");
    syncShopEconomyUI?.();
  }
  function startEvent(){
    const roll=runRandom();
    bump("events");advance("events");
    if(roll<.4){
      runtime.event="supply";
      const angle=runRandom()*Math.PI*2,range=200+runRandom()*180;
      dropCrate(player.x+Math.cos(angle)*range,player.y+Math.sin(angle)*range);
      showMessage("이벤트 · 보급 낙하","상자를 회수하면 자금과 체력을 얻습니다.",2.4);
    }else if(roll<.7){
      runtime.event="golden";
      const before=enemies.length;
      baseSpawnEnemy();
      const enemy=enemies[before];
      if(enemy){
        enemy.v121Golden=true;enemy.v121GoldenTime=14;enemy.color="#ffd34d";
        enemy.maxHp*=2.5;enemy.hp=enemy.maxHp;enemy.speed*=1.35;
      }
      showMessage("이벤트 · 황금 습격","14초 안에 처치하면 큰돈을 얻습니다.",2.4);
    }else{
      runtime.event="bloodMoon";
      runtime.bloodMoon=true;
      showMessage("이벤트 · 핏빛 달","적이 강해지는 대신 웨이브 자금 +50%",2.4);
    }
  }
  const baseStartWave=startWave;
  startWave=function(){
    if(solo()){
      runtime.activeContract=runtime.contract;
      runtime.contract="none";
      runtime.bloodMoon=false;
      runtime.event=null;
    }
    const result=baseStartWave();
    advance("wave",wave,true);
    if(solo()&&state==="playing"&&wave>=3&&wave%10!==0&&runRandom()<.3)startEvent();
    return result;
  };
  const baseCompleteWave=completeWave;
  completeWave=function(){
    const was=state==="playing";
    const finishedWave=wave;
    const result=baseCompleteWave();
    if(!was||state==="playing")return result;
    if(solo()){
      const base=120+finishedWave*30;
      const c=CONTRACTS[runtime.activeContract]||CONTRACTS.none;
      let bonus=base*c.bonus;
      if(runtime.bloodMoon)bonus+=base*.5;
      if(bonus>0){
        money+=Math.floor(bonus);
        syncShopEconomyUI?.();
      }
      if(c.bonus>0){
        bump("contracts");advance("contracts");
        if(runtime.activeContract==="deadly")bump("deadly");
      }
      runtime.activeContract="none";runtime.bloodMoon=false;runtime.event=null;runtime.crate=null;
    }
    v82CheckAchievements();
    persist({cloudDelay:2000});
    const m=meta();
    if(!m.tutorialDone){m.tutorialDone=true;hint("상점에서 무기와 강화를 고른 뒤 다음 웨이브를 시작하세요.",6);}
    return result;
  };
  const baseStartRun=startRun;
  startRun=function(...args){
    Object.assign(runtime,{contract:"none",activeContract:"none",event:null,crate:null,bloodMoon:false});
    const result=baseStartRun(...args);
    if(!meta().tutorialDone)hint(IS_MOBILE?"왼쪽 스틱으로 이동, 오른쪽 스틱으로 조준·사격합니다.":"WASD로 이동, 마우스로 조준, 클릭으로 사격합니다.",7);
    return result;
  };
  const baseUpdate=update;
  update=function(dt){
    const result=baseUpdate(dt);
    if(state==="playing"&&!paused&&runtime.crate&&player){
      runtime.crate.time-=dt;
      if(runtime.crate.time<=0)runtime.crate=null;
      else if(Math.hypot(player.x-runtime.crate.x,player.y-runtime.crate.y)<(player.radius||18)+34)collectCrate();
    }
    if(meta().settings.fewerParticles&&particles.length>40)particles.length=40;
    if(hintTime>0){
      hintTime-=dt;
      if(hintTime<=0&&byId("lw121Hint"))byId("lw121Hint").style.display="none";
    }
    return result;
  };
  const baseDraw=draw;
  draw=function(...args){
    if(meta().settings.noShake)camera.shake=0;
    return baseDraw(...args);
  };
  const baseDrawBullets=drawBullets;
  drawBullets=function(...args){
    const crate=runtime.crate;
    if(crate){
      const pulse=1+Math.sin(performance.now()/180)*.08,at=project(crate.x,crate.y);
      ctx.save();ctx.translate(at.x,at.y);ctx.scale(pulse,pulse);
      ctx.fillStyle="#b9792f";ctx.strokeStyle="#71dcff";ctx.lineWidth=3;
      ctx.fillRect(-16,-14,32,28);ctx.strokeRect(-16,-14,32,28);
      ctx.fillStyle="#fff";ctx.font="bold 18px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("✚",0,1);
      ctx.restore();
    }
    return baseDrawBullets(...args);
  };
  const baseDrawEnemy=drawEnemy;
  drawEnemy=function(enemy){
    const result=baseDrawEnemy(enemy);
    const v=VARIANTS[enemy?.v121Variant];
    if(!enemy||enemy.dead||(!v&&!enemy.v121Golden))return result;
    const strong=meta().settings.strongMarks;
    const color=v?v.color:"#ffd34d",symbol=v?v.symbol:"★",at=project(enemy.x,enemy.y);
    ctx.save();
    ctx.strokeStyle=color;ctx.lineWidth=strong?5:2.5;ctx.globalAlpha=.9;
    ctx.beginPath();ctx.arc(at.x,at.y-enemy.radius*.6,enemy.radius+6,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=1;ctx.fillStyle=color;ctx.font=`bold ${strong?22:16}px sans-serif`;
    ctx.textAlign="center";ctx.textBaseline="bottom";
    ctx.fillText(symbol,at.x,at.y-enemy.radius*1.6-10);
    ctx.restore();
    return result;
  };

  let hintTime=0;
  function hint(text,seconds){
    let el=byId("lw121Hint");
    if(!el){el=document.createElement("div");el.id="lw121Hint";document.body.append(el);}
    el.textContent=text;el.style.display="block";hintTime=seconds;
  }

  function renderContracts(){
    const shop=byId("shopMoney")?.closest(".panel")||ui.shop;
    let root=byId("lw121Contracts");
    if(!solo()){root?.remove();return;}
    if(!root){
      root=document.createElement("section");root.id="lw121Contracts";
      const anchor=byId("healNotice");
      if(anchor?.parentNode)anchor.parentNode.insertBefore(root,anchor.nextSibling);else shop.append(root);
    }
    const chosen=CONTRACTS[runtime.contract];
    root.innerHTML=`<h3>위험 계약</h3><small>${chosen.desc}</small><div class="lw121-contract-list"></div>`;
    const list=root.querySelector(".lw121-contract-list");
    for(const [id,c]of Object.entries(CONTRACTS)){
      const button=document.createElement("button");
      button.type="button";button.className="btn"+(id===runtime.contract?" active":"");
      button.dataset.lw121Contract=id;button.textContent=c.name;
      button.onclick=()=>{runtime.contract=id;renderContracts();};
      list.append(button);
    }
  }
  const baseOpenShop=openShop;
  openShop=function(...args){
    const result=baseOpenShop(...args);
    if(!meta().tutorialHintShown){meta().tutorialHintShown=true;}else{hintTime=0;const el=byId("lw121Hint");if(el)el.style.display="none";}
    renderContracts();return result;
  };

  function renderCenter(){
    const d=daily(),root=byId("lw121Missions");
    root.innerHTML=missionsFor(d.date).map(mission=>{
      const value=Math.min(mission.target,d.progress[mission.id]||0),done=d.claimed.includes(mission.id);
      return `<article class="lw121-card${done?" done":""}"><h3>${mission.name}</h3><p>${mission.desc}</p>
        <div class="lw121-bar"><i style="width:${value/mission.target*100}%"></i></div>
        <p>${value} / ${mission.target} · ${done?"완료":"🪙 "+formatNumber(mission.reward)}</p></article>`;
    }).join("");
    const m=meta();
    for(const input of document.querySelectorAll("[data-lw121-setting]"))input.checked=Boolean(m.settings[input.dataset.lw121Setting]);
  }
  function applySettings(){
    document.body.classList.toggle("lw121-large-text",meta().settings.largeText);
  }
  function ensureUi(){
    if(byId("lw121Center"))return;
    const options=[
      ["noShake","화면 흔들림 끄기"],["fewerParticles","효과 줄이기 (저사양 기기 권장)"],
      ["strongMarks","변이 적 표시 강조"],["largeText","큰 글씨"]
    ];
    const overlay=document.createElement("div");
    overlay.id="lw121Center";overlay.className="overlay";overlay.setAttribute("aria-hidden","true");
    overlay.innerHTML=`<div class="panel lw121-panel">
      <h2>일일 미션 · 설정</h2>
      <div class="section-title">오늘의 미션 (한국 시간 자정에 바뀝니다)</div>
      <div id="lw121Missions" class="lw121-grid"></div>
      <div class="section-title">편의 설정</div>
      ${options.map(([id,label])=>`<label class="lw121-option"><span>${label}</span><input type="checkbox" data-lw121-setting="${id}"></label>`).join("")}
      <div class="section-title" style="margin-top:16px">v${VERSION} 업데이트 내역</div>
      <ul class="lw121-notes">${NOTES.map(note=>`<li>${note}</li>`).join("")}</ul>
      <div class="actions"><button id="lw121Close" class="btn primary" type="button">닫기</button></div>
    </div>`;
    document.body.append(overlay);
    const button=document.createElement("button");
    button.id="lw121CenterButton";button.className="btn";button.type="button";
    button.textContent="일일 미션 · 설정";
    if(meta().seenVersion!==VERSION){
      const badge=document.createElement("span");badge.className="lw121-new";badge.textContent="NEW";button.append(badge);
    }
    const target=document.querySelector("#menu .menu-buttons");
    target?.insertBefore(button,byId("helpButton")||null);
    button.onclick=()=>{
      meta().seenVersion=VERSION;button.querySelector(".lw121-new")?.remove();
      persist({cloud:false});renderCenter();showOverlay(overlay);
    };
    byId("lw121Close").onclick=()=>hideOverlay(overlay);
    overlay.addEventListener("change",event=>{
      const key=event.target?.dataset?.lw121Setting;
      if(!key)return;
      meta().settings[key]=event.target.checked;
      applySettings();persist({cloud:false});
    });
  }
  ensureUi();applySettings();
  window.__lastWaveV121={version:VERSION,runtime,meta,daily,missionsFor,dateKey,CONTRACTS,VARIANTS,startEvent,dropCrate,advance};
})();
