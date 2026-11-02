/* LAST WAVE v121-v122: host-synced combat variety, daily missions, settings. */
(() => {
  "use strict";
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
  const EVENT_TEXT={
    supply:["이벤트 · 보급 낙하","상자를 회수하면 자금과 체력을 얻습니다."],
    golden:["이벤트 · 황금 습격","14초 안에 처치하면 큰돈을 얻습니다."],
    bloodMoon:["이벤트 · 핏빛 달","적이 강해지는 대신 웨이브 자금 +50%"]
  };
  const TEAM_KEYS=["kills","elites","bosses","variants","golden","crates","events","contracts","deadly"];
  const emptyTeam=()=>Object.fromEntries(TEAM_KEYS.map(key=>[key,0]));
  const runtime={contract:"none",activeContract:"none",event:null,crate:null,bloodMoon:false,team:emptyTeam(),seenTeam:null,lastKills:null};
  const byId=id=>document.getElementById(id);
  // Solo players and the room host run combat; other players follow world frames.
  const authority=()=>!multiplayer.active||multiplayer.isHost;
  const spectatorClient=()=>multiplayer.active&&!multiplayer.isHost;
  const countable=()=>window.__lastWaveV92?.state?.training!==true;

  function meta(){
    const m=save.v121&&typeof save.v121==="object"?save.v121:(save.v121={});
    m.stats={variants:0,golden:0,crates:0,events:0,contracts:0,deadly:0,...(m.stats||{})};
    m.settings={fewerParticles:false,strongMarks:false,...(m.settings||{})};
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
  function bump(key,amount=1){if(countable()&&key in meta().stats)meta().stats[key]+=amount;}
  function credit(key,amount=1){
    bump(key,amount);
    if(MISSIONS.some(mission=>mission.id===key))advance(key,amount);
  }
  // Team progress counters travel in world frames, so every player gets credit.
  function teamCredit(key){runtime.team[key]+=1;credit(key);}
  function shareMoney(){
    if(multiplayer.active&&multiplayer.isHost)broadcastSharedMoney("v121");
  }

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
    if(authority())for(let i=before;i<enemies.length;i++){makeVariant(enemies[i]);applyEffects(enemies[i]);}
    return result;
  };
  const baseSpawnBoss=spawnBoss;
  spawnBoss=function(){
    const before=enemies.length,result=baseSpawnBoss();
    if(authority())for(let i=before;i<enemies.length;i++)applyEffects(enemies[i]);
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
    if(authority()){updateVariant(enemy,dt);updateGolden(enemy,dt);}
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
    if(authority()){
      if(enemy.v121Variant==="splitter")split(enemy);
      if(enemy.v121Golden){
        money+=Math.floor((300+wave*40)*getMultiplayerMoneyMultiplier());
        score+=getDifficultyAdjustedScore(wave*20);
        teamCredit("golden");
        addFloatingText(enemy.x,enemy.y-enemy.radius,"황금 보상!","#ffd34d",18);
        shareMoney();
      }
      if(enemy.boss){dropCrate(enemy.x,enemy.y);teamCredit("bosses");}
      if(enemy.elite)teamCredit("elites");
      if(enemy.v121Variant)teamCredit("variants");
    }
    if(owner?.local)advance("kills");
    return result;
  };

  function dropCrate(x,y){
    runtime.crate={x,y,time:25};
  }
  function collectCrate(member){
    const gain=Math.floor((150+wave*25)*getMultiplayerMoneyMultiplier());
    money+=gain;
    member.hp=Math.min(member.maxHp,member.hp+member.maxHp*.2);
    addFloatingText(member.x,member.y-40,`보급 +${formatNumber(gain)}`,"#71dcff",18);
    runtime.crate=null;
    teamCredit("crates");
    shareMoney();
    syncShopEconomyUI?.();
  }
  function announce(kind){
    const text=EVENT_TEXT[kind];
    if(text)showMessage(text[0],text[1],2.4);
  }
  function startEvent(){
    const roll=runRandom();
    teamCredit("events");
    if(roll<.4){
      runtime.event="supply";
      const angle=runRandom()*Math.PI*2,range=200+runRandom()*180;
      dropCrate(player.x+Math.cos(angle)*range,player.y+Math.sin(angle)*range);
    }else if(roll<.7){
      runtime.event="golden";
      const before=enemies.length;
      baseSpawnEnemy();
      const enemy=enemies[before];
      if(enemy){
        enemy.v121Golden=true;enemy.v121GoldenTime=14;enemy.color="#ffd34d";
        enemy.maxHp*=2.5;enemy.hp=enemy.maxHp;enemy.speed*=1.35;
      }
    }else{
      runtime.event="bloodMoon";
      runtime.bloodMoon=true;
    }
    announce(runtime.event);
  }
  const baseStartWave=startWave;
  startWave=function(){
    if(authority()){
      runtime.activeContract=runtime.contract;
      runtime.contract="none";
      runtime.bloodMoon=false;
      runtime.event=null;
    }
    const result=baseStartWave();
    advance("wave",wave,true);
    if(authority()&&state==="playing"&&wave>=3&&wave%10!==0&&runRandom()<.3)startEvent();
    return result;
  };
  const baseCompleteWave=completeWave;
  completeWave=function(){
    const was=state==="playing";
    const finishedWave=wave;
    const result=baseCompleteWave();
    if(!was||state==="playing")return result;
    if(authority()){
      const base=(120+finishedWave*30)*getMultiplayerMoneyMultiplier();
      const c=CONTRACTS[runtime.activeContract]||CONTRACTS.none;
      let bonus=base*c.bonus;
      if(runtime.bloodMoon)bonus+=base*.5;
      if(bonus>0){
        money+=Math.floor(bonus);
        shareMoney();
        syncShopEconomyUI?.();
      }
      if(c.bonus>0){
        teamCredit("contracts");
        if(runtime.activeContract==="deadly")teamCredit("deadly");
      }
      runtime.activeContract="none";runtime.bloodMoon=false;runtime.event=null;runtime.crate=null;
    }
    return result;
  };
  const baseStartRun=startRun;
  startRun=function(...args){
    Object.assign(runtime,{contract:"none",activeContract:"none",event:null,crate:null,bloodMoon:false,team:emptyTeam(),seenTeam:null,lastKills:null});
    const result=baseStartRun(...args);
    if(!meta().tutorialDone)hint(IS_MOBILE?"왼쪽 스틱으로 이동, 오른쪽 스틱으로 조준·사격합니다.":"WASD로 이동, 마우스로 조준, 클릭으로 사격합니다.",7);
    return result;
  };
  const baseUpdate=update;
  update=function(dt){
    const result=baseUpdate(dt);
    if(authority()&&state==="playing"&&!paused&&runtime.crate){
      runtime.crate.time-=dt;
      if(runtime.crate.time<=0)runtime.crate=null;
      else for(const member of players.values()){
        if(member.dead||Math.hypot(member.x-runtime.crate.x,member.y-runtime.crate.y)>=(member.radius||18)+34)continue;
        collectCrate(member);
        break;
      }
    }
    if(meta().settings.fewerParticles&&particles.length>40)particles.length=40;
    if(hintTime>0){
      hintTime-=dt;
      if(hintTime<=0&&byId("lw121Hint"))byId("lw121Hint").style.display="none";
    }
    return result;
  };
  function packState(){
    const c=runtime.crate;
    return {c:c?[Math.round(c.x),Math.round(c.y),Math.round(c.time)]:null,a:runtime.activeContract,e:runtime.event,m:runtime.bloodMoon?1:0,t:runtime.team};
  }
  function creditLocalKills(){
    const kills=Number(player?.kills);
    if(!Number.isFinite(kills))return;
    if(runtime.lastKills!==null&&kills>runtime.lastKills)advance("kills",kills-runtime.lastKills);
    runtime.lastKills=kills;
  }
  function applyState(data){
    if(!data||!spectatorClient())return;
    if(data.e&&data.e!==runtime.event)announce(data.e);
    if(data.a!==runtime.activeContract&&CONTRACTS[data.a]&&data.a!=="none"){
      showMessage(`위험 계약 · ${CONTRACTS[data.a].name}`,CONTRACTS[data.a].desc,2.4);
    }
    runtime.event=data.e||null;
    runtime.activeContract=CONTRACTS[data.a]?data.a:"none";
    runtime.bloodMoon=Boolean(data.m);
    runtime.crate=Array.isArray(data.c)?{x:data.c[0],y:data.c[1],time:data.c[2]}:null;
    const team={...emptyTeam(),...(data.t||{})};
    if(runtime.seenTeam){
      for(const key of TEAM_KEYS){
        const delta=team[key]-runtime.seenTeam[key];
        if(delta>0&&Number.isFinite(delta))credit(key,delta);
      }
    }
    runtime.seenTeam=team;
    runtime.team={...team};
    creditLocalKills();
  }
  const baseMakeWorldFrame=makeWorldFrame;
  makeWorldFrame=function(){const frame=baseMakeWorldFrame();frame.v121=packState();return frame;};
  const baseApplyWorldFrame=applyWorldFrame;
  applyWorldFrame=function(frame,...args){
    const result=baseApplyWorldFrame(frame,...args);
    applyState(frame?.v121);
    return result;
  };
  const baseMakeSnapshot=makeSnapshot;
  makeSnapshot=function(){const snapshot=baseMakeSnapshot();snapshot.v121=packState();return snapshot;};
  const baseApplySnapshot=applyWorldSnapshot;
  applyWorldSnapshot=function(snapshot,...args){
    const result=baseApplySnapshot(snapshot,...args);
    applyState(snapshot?.v121);
    return result;
  };
  const baseEnemyFrame=networkEnemyFrame;
  networkEnemyFrame=function(enemy){
    const frame=baseEnemyFrame(enemy);
    const mark=enemy.v121Golden?"golden":enemy.v121Variant;
    if(mark)frame[17]=mark;
    return frame;
  };
  const baseDecodeEnemy=decodeNetworkEnemyFrame;
  decodeNetworkEnemyFrame=function(data){
    const enemy=baseDecodeEnemy(data);
    if(Array.isArray(data)&&enemy){
      enemy.v121Golden=data[17]==="golden";
      enemy.v121Variant=VARIANTS[data[17]]?data[17]:null;
    }
    return enemy;
  };
  const baseEnemySnapshot=networkEnemySnapshot;
  networkEnemySnapshot=function(enemy){
    const snapshot=baseEnemySnapshot(enemy);
    for(const key of ["v121Variant","v121Timer","v121BaseSpeed","v121Charging","v121Golden","v121GoldenTime","v121Splitling"]){
      if(enemy[key]!==undefined)snapshot[key]=enemy[key];
    }
    return snapshot;
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
    if(!root){
      root=document.createElement("section");root.id="lw121Contracts";
      const anchor=byId("healNotice");
      if(anchor?.parentNode)anchor.parentNode.insertBefore(root,anchor.nextSibling);else shop.append(root);
    }
    if(spectatorClient()){
      root.innerHTML="<h3>위험 계약</h3><small>방장이 고르며, 다음 웨이브가 시작될 때 알려 드립니다.</small>";
      return;
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
    const m=meta();
    v82CheckAchievements();
    persist({cloudDelay:2000});
    if(m.tutorialDone){
      hintTime=0;
      const el=byId("lw121Hint");
      if(el)el.style.display="none";
    }else{
      m.tutorialDone=true;
      hint("상점에서 무기와 강화를 고른 뒤 다음 웨이브를 시작하세요.",6);
    }
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
  }
  function ensureUi(){
    if(byId("lw121Center"))return;
    const overlay=document.createElement("div");
    overlay.id="lw121Center";overlay.className="overlay";overlay.setAttribute("aria-hidden","true");
    overlay.innerHTML=`<div class="panel lw121-panel">
      <h2>일일 미션</h2>
      <div class="section-title">오늘의 미션 (한국 시간 자정에 바뀝니다)</div>
      <div id="lw121Missions" class="lw121-grid"></div>
      <div class="actions"><button id="lw121Close" class="btn primary" type="button">닫기</button></div>
    </div>`;
    document.body.append(overlay);
    const button=document.createElement("button");
    button.id="lw121CenterButton";button.className="btn";button.type="button";
    button.textContent="일일 미션";
    const target=document.querySelector("#menu .menu-buttons");
    target?.insertBefore(button,byId("helpButton")||null);
    button.onclick=()=>{renderCenter();showOverlay(overlay);};
    byId("lw121Close").onclick=()=>hideOverlay(overlay);

    // Comfort options live in the one settings menu.
    const grid=document.querySelector("#lw111SettingsOverlay .lw111-settings-grid");
    for(const [id,label] of [["fewerParticles","효과 줄이기 (저사양 권장)"],["strongMarks","변이 적 표시 강조"]]){
      const row=document.createElement("label");
      row.className="lw121-option";
      row.innerHTML=`<span>${label}</span><input type="checkbox" data-lw121-setting="${id}">`;
      const input=row.querySelector("input");
      input.checked=Boolean(meta().settings[id]);
      input.onchange=()=>{meta().settings[id]=input.checked;persist({cloud:false});};
      grid?.append(row);
    }
  }
  ensureUi();
  window.__lastWaveV121={runtime,packState,meta,daily,missionsFor,dateKey,CONTRACTS,VARIANTS,startEvent,dropCrate,advance};
})();
