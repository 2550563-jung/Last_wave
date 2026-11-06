/* LAST WAVE v125: quick start, gentle first runs, richer game over, challenge and
   invite links, zones with hazards, boss patterns and trophies, creative mode. */
(() => {
  "use strict";
  const byId=id=>document.getElementById(id);
  const authority=()=>!multiplayer.active||multiplayer.isHost;
  const v92=()=>window.__lastWaveV92?.state;
  const GAME_URL="https://2550563-jung.github.io/Last_wave/";

  function meta(){
    const m=save.v125&&typeof save.v125==="object"?save.v125:(save.v125={});
    m.tips=Array.isArray(m.tips)?m.tips:[];
    m.trophies=m.trophies&&typeof m.trophies==="object"?m.trophies:{};
    return m;
  }

  /* ---------- Creative mode rules ---------- */
  const RULES=[
    {group:"적",items:[
      {id:"enemyHp",name:"적 체력",min:10,max:500,step:10,unit:"%",value:100},
      {id:"enemySpeed",name:"적 이동 속도",min:25,max:300,step:5,unit:"%",value:100},
      {id:"enemyDamage",name:"적 공격력",min:0,max:500,step:10,unit:"%",value:100},
      {id:"enemyCount",name:"웨이브당 적 수",min:10,max:300,step:10,unit:"%",value:100}
    ]},
    {group:"보스",items:[
      {id:"bossEvery",name:"보스 등장 간격",min:0,max:25,step:1,unit:"웨이브",value:10,zero:"보스 없음"},
      {id:"bossHp",name:"보스 체력",min:10,max:500,step:10,unit:"%",value:100},
      {id:"bossPatterns",name:"보스 전용 패턴",type:"toggle",value:true}
    ]},
    {group:"플레이어",items:[
      {id:"playerHp",name:"최대 체력",min:10,max:1000,step:10,unit:"%",value:100},
      {id:"playerDamage",name:"공격력",min:10,max:1000,step:10,unit:"%",value:100},
      {id:"playerSpeed",name:"이동 속도",min:50,max:250,step:5,unit:"%",value:100},
      {id:"invincible",name:"무적",type:"toggle",value:false}
    ]},
    {group:"경제와 진행",items:[
      {id:"startWave",name:"시작 웨이브",min:1,max:150,step:1,unit:"",value:1},
      {id:"startMoney",name:"시작 자금",min:0,max:100000,step:500,unit:"",value:0},
      {id:"moneyGain",name:"획득 자금",min:0,max:1000,step:10,unit:"%",value:100},
      {id:"gameSpeed",name:"게임 속도",min:50,max:200,step:5,unit:"%",value:100}
    ]},
    {group:"시스템",items:[
      {id:"variants",name:"변이 적",type:"toggle",value:true},
      {id:"events",name:"웨이브 이벤트",type:"toggle",value:true},
      {id:"hazards",name:"구역 위험 요소",type:"toggle",value:true},
      {id:"zoneLock",name:"구역 고정",type:"select",value:"auto",options:[["auto","웨이브에 따라"],["0","도심"],["1","지하철"],["2","연구소"],["3","폭풍 항구"],["4","붕괴 지대"]]},
      {id:"adminTrial",name:"관리자 체험",type:"toggle",value:false}
    ]}
  ];
  const DEFAULT_RULES=Object.fromEntries(RULES.flatMap(g=>g.items).map(r=>[r.id,r.value]));
  const PRESETS={
    "기본":{},
    "연습":{enemyHp:50,enemyDamage:30,playerHp:200,startMoney:3000},
    "지옥":{enemyHp:250,enemySpeed:140,enemyDamage:250,enemyCount:200,bossEvery:3},
    "보스 러시":{bossEvery:1,enemyCount:30,startMoney:10000,startWave:10},
    "샌드박스":{invincible:true,startMoney:100000,moneyGain:300,adminTrial:true}
  };
  const RULE_KEY="lw_creative_rules";
  function loadRules(){
    try{return {...DEFAULT_RULES,...JSON.parse(localStorage.getItem(RULE_KEY)||"{}")};}catch{return {...DEFAULT_RULES};}
  }
  let draftRules=loadRules();
  const creative={active:false,rules:null,saved:null,lastMoney:0};
  const rule=id=>creative.active?creative.rules[id]:DEFAULT_RULES[id];
  // Read by v121, which starts the wave events.
  window.__lastWaveCreative={get noEvents(){return creative.active&&!creative.rules.events;}};

  function restoreSave(){
    if(!creative.saved)return;
    for(const key of Object.keys(save))delete save[key];
    Object.assign(save,JSON.parse(creative.saved));
    creative.saved=null;
  }
  function endCreative(){
    if(!creative.active)return;
    creative.active=false;
    adminMode=false;
    document.body.classList.remove("lw125-admin-trial");
    try{adminBuffsV84?.clear();}catch{}
    adminInvincible=false;
    restoreSave();
    updateAdminButton?.();
  }
  /* A creative run must leave no trace: nothing it changes is written anywhere,
     so closing the tab mid-run also keeps the real save intact. */
  const basePersist=persist;
  persist=function(...args){return creative.active?undefined:basePersist(...args);};
  const baseSyncCloud=syncCloudProfile;
  syncCloudProfile=function(...args){return creative.active?Promise.resolve(false):baseSyncCloud(...args);};
  const baseSubmitRanking=submitRanking;
  submitRanking=function(...args){
    if(creative.active||challenge.active)return Promise.resolve({skipped:true,reason:creative.active?"creative":"challenge"});
    return baseSubmitRanking(...args);
  };
  const baseSkip=rankingSkipMessage;
  rankingSkipMessage=function(){
    if(creative.active)return "크리에이티브 모드는 랭킹과 보상에서 제외됩니다.";
    if(challenge.active)return "도전 링크 판은 랭킹에서 제외됩니다.";
    return baseSkip();
  };

  function startCreative(){
    const state92=v92();
    localStorageSet(RULE_KEY,JSON.stringify(draftRules));
    hideOverlay(byId("lw125Creative"));
    creative.saved=JSON.stringify(save);
    creative.rules={...draftRules};
    creative.active=true;
    if(state92){state92.runType="training";state92.training=true;state92.roomModifier="normal";}
    gameMode="normal";
    startRun("normal");
    byId("lw92TrainingBar")?.classList.remove("show");
    const r=creative.rules;
    if(player){
      player.maxHp=Math.max(1,player.maxHp*r.playerHp/100);player.hp=player.maxHp;
      player.damageMult*=r.playerDamage/100;
      player.speed*=r.playerSpeed/100;
    }
    money+=Number(r.startMoney)||0;
    creative.lastMoney=money;
    if(r.invincible)adminInvincible=true;
    if(r.startWave>1){
      enemies.length=0;enemyBullets.length=0;spawnRemaining=0;
      wave=r.startWave-1;
      startWave();
    }
    if(r.adminTrial){
      adminMode=true;
      document.body.classList.add("lw125-admin-trial");
      updateAdminButton?.();
      showMessage("관리자 체험","관리자 버튼을 누르면 비밀번호 없이 패널이 열립니다. 이번 판에만 적용됩니다.",4);
    }else showMessage("크리에이티브 모드","랭킹과 보상에서 제외됩니다.",2.4);
  }
  const localStorageSet=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};

  function ruleLabel(item,value){
    if(item.zero&&Number(value)===0)return item.zero;
    return `${Number(value).toLocaleString()}${item.unit?` ${item.unit}`:""}`.replace(" %","%");
  }
  function renderCreative(){
    const body=byId("lw125CreativeBody");
    body.innerHTML="";
    for(const group of RULES){
      const box=document.createElement("section");
      box.className="lw125-rule-group";
      box.innerHTML=`<h3>${group.group}</h3>`;
      for(const item of group.items){
        const row=document.createElement("label");
        row.className="lw125-rule";
        const name=document.createElement("span");name.textContent=item.name;
        row.append(name);
        if(item.type==="toggle"){
          const input=document.createElement("input");
          input.type="checkbox";input.checked=Boolean(draftRules[item.id]);input.dataset.rule=item.id;
          input.onchange=()=>{draftRules[item.id]=input.checked;};
          row.append(input);
        }else if(item.type==="select"){
          const input=document.createElement("select");
          input.dataset.rule=item.id;
          for(const [value,text] of item.options)input.add(new Option(text,value,false,String(draftRules[item.id])===value));
          input.onchange=()=>{draftRules[item.id]=input.value;};
          row.append(input);
        }else{
          const value=document.createElement("b");value.textContent=ruleLabel(item,draftRules[item.id]);
          const input=document.createElement("input");
          input.type="range";input.min=item.min;input.max=item.max;input.step=item.step;input.value=draftRules[item.id];input.dataset.rule=item.id;
          input.oninput=()=>{draftRules[item.id]=Number(input.value);value.textContent=ruleLabel(item,input.value);};
          row.append(value,input);
        }
        box.append(row);
      }
      body.append(box);
    }
  }
  function buildCreative(){
    const overlay=document.createElement("div");
    overlay.id="lw125Creative";overlay.className="overlay";
    overlay.innerHTML=`<div class="panel lw125-creative-panel"><div class="eyebrow">CREATIVE</div><h2>크리에이티브 모드</h2>
      <p class="lw125-note">규칙을 직접 정해 플레이합니다. <b>랭킹, 크레딧, 업적, 미션에 반영되지 않습니다.</b> 직업은 메인 화면에서 고른 직업을 씁니다.</p>
      <div id="lw125Presets" class="lw125-presets"></div><div id="lw125CreativeBody"></div>
      <div class="actions"><button id="lw125CreativeClose" class="btn" type="button">닫기</button>
      <button id="lw125CreativeStart" class="btn primary" type="button">이 규칙으로 시작</button></div></div>`;
    document.body.append(overlay);
    const presets=byId("lw125Presets");
    for(const [name,values] of Object.entries(PRESETS)){
      const b=document.createElement("button");
      b.type="button";b.className="btn";b.textContent=name;
      b.onclick=()=>{draftRules={...DEFAULT_RULES,...values};renderCreative();};
      presets.append(b);
    }
    byId("lw125CreativeClose").onclick=()=>hideOverlay(overlay);
    byId("lw125CreativeStart").onclick=startCreative;
    renderCreative();
    return overlay;
  }
  // The trial never offers buttons that could wipe stored data.
  const baseOpenAdmin=openAdminPanel;
  openAdminPanel=function(...args){
    const result=baseOpenAdmin(...args);
    if(creative.active)for(const b of byId("adminPanel").querySelectorAll("button")){
      if(/초기화|삭제/.test(b.textContent))b.classList.add("lw125-trial-hidden");
    }
    return result;
  };

  // Inside the trial the admin button opens the panel directly, without the password.
  // Everywhere else the regular login stays exactly as it was.
  const trialOn=()=>creative.active&&creative.rules.adminTrial;
  const floatingAdmin=byId("adminFloatingButton");
  if(floatingAdmin){
    const baseOpen=floatingAdmin.onclick;
    floatingAdmin.onclick=function(...args){
      if(trialOn()){adminMode=true;openAdminPanel();return;}
      return baseOpen?.apply(this,args);
    };
  }
  const adminClose=byId("adminPanelCloseButton");
  if(adminClose){
    const baseClose=adminClose.onclick;
    adminClose.onclick=function(...args){
      const result=baseClose?.apply(this,args);
      // Closing the panel normally ends admin mode, but the trial lasts the whole run.
      if(trialOn()){adminMode=true;updateAdminButton?.();}
      return result;
    };
  }

  /* ---------- Menu: quick start ---------- */
  function buildMenu(){
    const panel=byId("menu")?.querySelector(".panel");
    if(!panel)return;
    const tagline=panel.querySelector(":scope > p");
    const box=document.createElement("div");
    box.id="lw125Quick";
    box.innerHTML=`<button id="lw125QuickStart" class="btn primary" type="button">▶ 바로 시작</button>
      <div class="lw125-quick-row"><button id="lw125PickJob" class="btn" type="button">직업 고르기</button>
      <button id="lw125CreativeOpen" class="btn" type="button">크리에이티브</button>
      <button id="lw125TrophiesOpen" class="btn" type="button">보스 전리품</button></div>`;
    tagline.after(box);
    const fold=document.createElement("details");
    fold.id="lw125AccountFold";
    fold.innerHTML="<summary>닉네임 · 계정 (선택)</summary>";
    box.after(fold);
    for(const node of [panel.querySelector(".nickname-line"),byId("nicknameStatus"),panel.querySelector(".account-box")]){
      if(node)fold.append(node);
    }
    byId("lw125QuickStart").onclick=()=>{
      try{gameMode="normal";startRun("normal");}catch(error){ui.nicknameStatus.textContent=error.message;fold.open=true;}
    };
    byId("lw125PickJob").onclick=()=>byId("jobGrid")?.scrollIntoView({behavior:"smooth",block:"center"});
    const creativeOverlay=buildCreative();
    byId("lw125CreativeOpen").onclick=()=>{renderCreative();showOverlay(creativeOverlay);};
    const trophies=buildTrophies();
    byId("lw125TrophiesOpen").onclick=()=>{renderTrophies();showOverlay(trophies);};
  }

  /* ---------- First runs: gentler enemies and tips ---------- */
  const EASY_RUNS=2,EASY_WAVES=5,TIP_RUNS=3;
  let runStartCount=0;
  const plainRun=()=>gameMode==="normal"&&!multiplayer.active&&!creative.active&&!challenge.active&&(v92()?.runType||"normal")==="normal";
  const easyRun=()=>plainRun()&&runStartCount<EASY_RUNS&&wave<=EASY_WAVES;
  let tipTime=0;
  function hideTips(){
    tipTime=0;
    for(const id of ["lw125Tip","lw121Hint"]){const el=byId(id);if(el)el.style.display="none";}
  }
  function tip(id,text,seconds=6){
    const m=meta();
    if(runStartCount>=TIP_RUNS||creative.active||m.tips.includes(id))return;
    m.tips.push(id);
    let el=byId("lw125Tip");
    if(!el){el=document.createElement("div");el.id="lw125Tip";el.setAttribute("role","status");document.body.append(el);}
    el.textContent=text;el.style.display="block";tipTime=seconds;
  }
  const baseOpenLevelUp=openLevelUp;
  openLevelUp=function(...args){
    const result=baseOpenLevelUp(...args);
    tip("levelUp","레벨 업! 능력을 하나 고르세요. 이번 판 동안 유지됩니다.");
    return result;
  };

  /* ---------- Zones ---------- */
  const ZONES=[
    {name:"도심",desc:"모든 것이 시작된 거리",tint:null,hazard:null},
    {name:"지하철",desc:"경고선이 보이면 피하세요. 전동차가 지나갑니다.",tint:"rgba(10,18,52,.34)",dark:.5,hazard:"train",color:"#ffd34d"},
    {name:"연구소",desc:"노출된 배관에서 독가스가 터집니다.",tint:"rgba(30,92,48,.2)",dark:.12,hazard:"gas",color:"#7dff8a"},
    {name:"폭풍 항구",desc:"번개가 표시된 곳에 떨어집니다.",tint:"rgba(40,60,86,.3)",dark:.22,hazard:"storm",color:"#8fd8ff"},
    {name:"붕괴 지대",desc:"모든 위험이 섞여 몰려옵니다.",tint:"rgba(86,16,62,.24)",dark:.3,hazard:"mix",color:"#ff6fb5"}
  ];
  function zoneIndex(forWave=wave){
    const lock=creative.active?creative.rules.zoneLock:"auto";
    if(lock!=="auto"&&ZONES[lock])return Number(lock);
    return Math.min(ZONES.length-1,Math.floor(Math.max(0,forWave-1)/25));
  }
  let shownZone=0;
  function announceZone(){
    const index=zoneIndex();
    if(index===shownZone)return;
    shownZone=index;
    const zone=ZONES[index];
    showMessage(`구역 진입 · ${zone.name}`,zone.desc,3.4);
    if(authority()&&index>0&&!creative.rules?.zoneLock?.match?.(/\d/)){
      money+=Math.floor(800*index*getMultiplayerMoneyMultiplier());
      addFloatingText(player?.x||0,(player?.y||0)-40,"구역 돌파 보상!","#ffd34d",20);
    }
  }

  /* ---------- Telegraphed attacks, shared by zones and bosses ---------- */
  let marks=[],hazardTimer=8,markId=0,bossEvents=[],bossEventId=0,seenBossEvent=0;
  const BULLET_CAP=180;
  function fire(x,y,angle,speed,damage,life=3,radius=7){
    if(enemyBullets.length>=BULLET_CAP)return;
    enemyBullets.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage,radius,life});
  }
  function ring(x,y,count,speed,damage,offset=0,life=3){
    for(let i=0;i<count;i++)fire(x,y,offset+Math.PI*2*i/count,speed,damage,life);
  }
  function addMark(mark){marks.push({id:++markId,time:mark.total,...mark});}
  function targetPlayer(){
    const list=[...players.values()].filter(member=>!member.dead);
    return list[Math.floor(runRandom()*list.length)]||player;
  }
  const areaDamage=()=>(6+Math.min(wave,120)*.55)*(creative.active?creative.rules.enemyDamage/100:1);
  function detonate(mark){
    const d=mark.damage;
    if(mark.kind==="circle"){
      ring(mark.x,mark.y,mark.count||10,mark.speed||240,d,0,mark.life||1.1);
      addParticle({type:"shockwave",x:mark.x,y:mark.y,radius:mark.r,color:mark.color,width:9,life:.45,maxLife:.45});
      camera.shake=Math.max(camera.shake,4);
    }else if(mark.kind==="line"){
      // A row of fast shots sweeping along the warned strip.
      const step=44,dx=Math.cos(mark.angle),dy=Math.sin(mark.angle);
      for(let i=-5;i<=5;i++){
        const px=mark.x-dx*mark.len/2-dy*i*step*.3,py=mark.y-dy*mark.len/2+dx*i*step*.3;
        fire(px,py,mark.angle,mark.speed||760,d,mark.len/(mark.speed||760),10);
      }
      camera.shake=Math.max(camera.shake,6);
    }else if(mark.kind==="blink"){
      const boss=enemies.find(enemy=>enemy.id===mark.owner&&!enemy.dead);
      if(boss){boss.x=mark.x;boss.y=mark.y;}
      ring(mark.x,mark.y,14,250,d);
    }
    playSfx("bossSkill");
  }
  function spawnHazard(kind){
    const target=targetPlayer();
    if(!target)return;
    const color=ZONES[zoneIndex()].color;
    const damage=areaDamage();
    if(kind==="mix")kind=["train","gas","storm"][Math.floor(runRandom()*3)];
    if(kind==="train"){
      const vertical=runRandom()<.5;
      addMark({kind:"line",x:target.x,y:target.y,angle:vertical?Math.PI/2:0,len:1500,width:70,total:1.3,color,damage:damage*1.3,speed:900});
    }else if(kind==="gas"){
      addMark({kind:"circle",x:target.x+(runRandom()-.5)*160,y:target.y+(runRandom()-.5)*160,r:110,total:1.4,color,damage,count:12,speed:170,life:1.5});
    }else{
      for(let i=0;i<3;i++)addMark({kind:"circle",x:target.x+(runRandom()-.5)*360,y:target.y+(runRandom()-.5)*360,r:80,total:1+i*.25,color,damage:damage*1.2,count:8,speed:300,life:.7});
    }
  }
  function updateMarks(dt){
    for(const mark of marks){
      mark.time-=dt;
      if(mark.time<=0&&authority())detonate(mark);
    }
    marks=marks.filter(mark=>mark.time>0);
    if(!authority()||state!=="playing"||(creative.active&&!creative.rules.hazards))return;
    const zone=ZONES[zoneIndex()];
    if(!zone.hazard||spawnRemaining+enemies.length<=0)return;
    hazardTimer-=dt;
    if(hazardTimer<=0){hazardTimer=Math.max(5,10-zoneIndex());spawnHazard(zone.hazard);}
  }
  function drawMarks(){
    if(!marks.length)return;
    ctx.save();
    for(const mark of marks){
      const progress=1-Math.max(0,mark.time)/mark.total,at=project(mark.x,mark.y);
      ctx.strokeStyle=mark.color;ctx.fillStyle=mark.color;ctx.lineWidth=3;
      if(mark.kind==="line"){
        const dx=Math.cos(mark.angle),dy=Math.sin(mark.angle)*WORLD_Y_SCALE,len=mark.len/2,w=mark.width/2;
        ctx.translate(at.x,at.y);ctx.rotate(Math.atan2(dy,dx));
        ctx.globalAlpha=.14+progress*.3;ctx.fillRect(-len,-w,len*2,w*2);
        ctx.globalAlpha=.9;ctx.strokeRect(-len,-w,len*2,w*2);
        ctx.setTransform(baseTransform);
      }else{
        ctx.globalAlpha=.9;
        ctx.beginPath();ctx.ellipse(at.x,at.y,mark.r,mark.r*WORLD_Y_SCALE,0,0,Math.PI*2);ctx.stroke();
        ctx.globalAlpha=.32;
        ctx.beginPath();ctx.ellipse(at.x,at.y,mark.r*progress,mark.r*progress*WORLD_Y_SCALE,0,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }
  let baseTransform=null;
  const baseDrawBullets=drawBullets;
  drawBullets=function(...args){
    baseTransform=ctx.getTransform();
    const result=baseDrawBullets(...args);
    drawMarks();
    return result;
  };
  const baseAtmosphere=drawAtmosphere;
  drawAtmosphere=function(...args){
    const result=baseAtmosphere(...args);
    if(!["playing","shop","levelUp"].includes(state)&&!player)return result;
    const zone=ZONES[zoneIndex()];
    if(zone.tint){
      ctx.save();
      ctx.fillStyle=zone.tint;ctx.fillRect(0,0,WIDTH,HEIGHT);
      if(zone.dark&&player){
        const at=project(player.x,player.y),edge=Math.max(WIDTH,HEIGHT)*.72;
        const shade=ctx.createRadialGradient(at.x,at.y,Math.min(WIDTH,HEIGHT)*.28,at.x,at.y,edge);
        shade.addColorStop(0,"rgba(0,0,0,0)");shade.addColorStop(1,`rgba(0,0,0,${zone.dark})`);
        ctx.fillStyle=shade;ctx.fillRect(0,0,WIDTH,HEIGHT);
      }
      ctx.restore();
    }
    return result;
  };

  /* ---------- Boss patterns and trophies ---------- */
  const SPIN=(boss,d)=>{boss.v125Spin={time:2.2,angle:boss.angle,tick:0,damage:d};};
  const BOSS_PATTERNS=[
    {pattern:"경고선을 따라 돌진합니다",reward:"이번 판 공격력 +6%",buff:p=>{p.damageMult*=1.06;},
     act(boss,d,t){dash(boss,t,1);}},
    {pattern:"감염자 무리를 불러냅니다",reward:"이번 판 최대 체력 +10%",buff:p=>{p.maxHp*=1.1;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.1);},
     act(boss){for(let i=0;i<4&&enemies.length<getActiveEnemyCap();i++){const n=enemies.length;spawnEnemy();const e=enemies[n];if(e){e.x=boss.x+Math.cos(i*1.57)*90;e.y=boss.y+Math.sin(i*1.57)*90;}}}},
    {pattern:"독 웅덩이를 세 곳에 터뜨립니다",reward:"이번 판 체력 재생 +1",buff:p=>{p.regen=(Number(p.regen)||0)+1;},
     act(boss,d,t){for(let i=0;i<3;i++)addMark({kind:"circle",x:t.x+(runRandom()-.5)*260,y:t.y+(runRandom()-.5)*260,r:100,total:1.1+i*.2,color:"#7dff8a",damage:d,count:12,speed:180,life:1.4});}},
    {pattern:"회전 탄막을 쏟아냅니다",reward:"이번 판 방어력 +3",buff:p=>{p.armor=(Number(p.armor)||0)+3;},
     act(boss,d){SPIN(boss,d);}},
    {pattern:"세 번 연속 돌진합니다",reward:"이번 판 이동 속도 +5%",buff:p=>{p.speed*=1.05;},
     act(boss,d,t){for(let i=0;i<3;i++)setTimeout(()=>{if(!boss.dead&&state==="playing")dash(boss,t,.55);},i*950);}},
    {pattern:"느린 탄막을 겹겹이 뿌립니다",reward:"이번 판 획득 범위 +25",buff:p=>{p.pickupRange=(Number(p.pickupRange)||0)+25;},
     act(boss,d){[0,.45,.9].forEach((delay,i)=>setTimeout(()=>{if(!boss.dead&&state==="playing")ring(boss.x,boss.y,14,125,d,i*.22,4);},delay*1000));}},
    {pattern:"표시된 곳으로 순간이동합니다",reward:"이번 판 공격력 +8%",buff:p=>{p.damageMult*=1.08;},
     act(boss,d,t){addMark({kind:"blink",owner:boss.id,x:t.x+(runRandom()-.5)*240,y:t.y+(runRandom()-.5)*240,r:90,total:.9,color:"#b28cff",damage:d});}},
    {pattern:"지진파를 세 번 일으킵니다",reward:"이번 판 최대 체력 +15%",buff:p=>{p.maxHp*=1.15;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.15);},
     act(boss,d){[0,.6,1.2].forEach((delay,i)=>setTimeout(()=>{if(!boss.dead&&state==="playing"){ring(boss.x,boss.y,20,190+i*40,d,i*.16,2.6);camera.shake=Math.max(camera.shake,7);}},delay*1000));}},
    {pattern:"번개를 다섯 곳에 떨어뜨립니다",reward:"이번 판 이동 속도 +7%",buff:p=>{p.speed*=1.07;},
     act(boss,d,t){for(let i=0;i<5;i++)addMark({kind:"circle",x:t.x+(runRandom()-.5)*420,y:t.y+(runRandom()-.5)*420,r:75,total:.9+i*.18,color:"#8fd8ff",damage:d,count:8,speed:300,life:.7});}},
    {pattern:"십자 광선을 발사합니다",reward:"이번 판 공격력 +12%",buff:p=>{p.damageMult*=1.12;},
     act(boss,d){addMark({kind:"line",x:boss.x,y:boss.y,angle:0,len:1400,width:60,total:1.2,color:"#ff6fb5",damage:d*1.2,speed:800});addMark({kind:"line",x:boss.x,y:boss.y,angle:Math.PI/2,len:1400,width:60,total:1.2,color:"#ff6fb5",damage:d*1.2,speed:800});}}
  ];
  function dash(boss,target,duration){
    const angle=Math.atan2(target.y-boss.y,target.x-boss.x);
    addMark({kind:"warn",x:boss.x,y:boss.y,r:boss.radius||50,total:.5,color:"#ff7a5a",damage:0});
    setTimeout(()=>{
      if(boss.dead||state!=="playing")return;
      boss.v125Dash={time:.55*duration+.2,vx:Math.cos(angle)*620,vy:Math.sin(angle)*620};
    },500);
  }
  function updateBossPattern(boss,dt){
    if(!authority()||boss.trainingTarget||(creative.active&&!creative.rules.bossPatterns))return;
    if(boss.v125Dash){
      boss.v125Dash.time-=dt;
      boss.x+=boss.v125Dash.vx*dt;boss.y+=boss.v125Dash.vy*dt;
      if(boss.v125Dash.time<=0)boss.v125Dash=null;
    }
    if(boss.v125Spin){
      const spin=boss.v125Spin;
      spin.time-=dt;spin.tick-=dt;spin.angle+=dt*2.6;
      if(spin.tick<=0){spin.tick=.13;for(let i=0;i<3;i++)fire(boss.x,boss.y,spin.angle+i*2.094,210,spin.damage,3.4,6);}
      if(spin.time<=0)boss.v125Spin=null;
    }
    boss.v125Timer=(Number.isFinite(boss.v125Timer)?boss.v125Timer:4)-dt;
    if(boss.v125Timer>0)return;
    boss.v125Timer=boss.phase>=2?5.5:7.5;
    const pattern=BOSS_PATTERNS[Math.max(0,Number(boss.bossIndex)||0)%BOSS_PATTERNS.length];
    const target=targetPlayer();
    if(target)pattern.act(boss,(Number(boss.damage)||10)*.5,target);
  }
  const baseUpdateBoss=updateBoss;
  updateBoss=function(boss,target,dt,...rest){
    const result=baseUpdateBoss(boss,target,dt,...rest);
    if(boss&&!boss.dead&&Number.isFinite(dt))updateBossPattern(boss,dt);
    return result;
  };
  function applyBossReward(index){
    const pattern=BOSS_PATTERNS[index%BOSS_PATTERNS.length];
    const name=BOSSES[index%BOSSES.length]?.[0]||"BOSS";
    if(player&&!player.dead)pattern.buff(player);
    if(creative.active){showMessage(`${name} 처치`,pattern.reward,2.6);return;}
    const m=meta(),key=String(index%BOSS_PATTERNS.length),first=!m.trophies[key];
    m.trophies[key]=(Number(m.trophies[key])||0)+1;
    if(first){
      const credits=800+index%BOSS_PATTERNS.length*400;
      save.credits=(Number(save.credits)||0)+credits;
      showMessage(`새 전리품 · ${name}`,`${pattern.reward} · 첫 처치 크레딧 +${credits.toLocaleString()}`,3.4);
    }else showMessage(`${name} 처치`,pattern.reward,2.6);
    persist({cloudDelay:2000});
  }
  const baseKillEnemy=killEnemy;
  killEnemy=function(enemy,owner,...rest){
    const alive=Boolean(enemy&&!enemy.dead);
    const result=baseKillEnemy(enemy,owner,...rest);
    if(alive&&enemy.dead&&enemy.boss&&!enemy.trainingTarget&&authority()){
      const index=Math.max(0,Number(enemy.bossIndex)||0);
      bossEvents.push([++bossEventId,index]);
      if(bossEvents.length>8)bossEvents.shift();
      seenBossEvent=bossEventId;
      applyBossReward(index);
    }
    return result;
  };
  function buildTrophies(){
    const overlay=document.createElement("div");
    overlay.id="lw125Trophies";overlay.className="overlay";
    overlay.innerHTML=`<div class="panel lw125-trophy-panel"><div class="eyebrow">BOSS TROPHIES</div><h2>보스 전리품</h2>
      <p class="lw125-note">처음 처치하면 크레딧을 받고, 처치할 때마다 그 판에서 강해집니다.</p>
      <div id="lw125TrophyList"></div><div class="actions"><button id="lw125TrophiesClose" class="btn primary" type="button">닫기</button></div></div>`;
    document.body.append(overlay);
    byId("lw125TrophiesClose").onclick=()=>hideOverlay(overlay);
    return overlay;
  }
  function renderTrophies(){
    const list=byId("lw125TrophyList"),m=meta();
    list.innerHTML="";
    BOSS_PATTERNS.forEach((pattern,index)=>{
      const count=Number(m.trophies[index])||0;
      const row=document.createElement("article");
      row.className="lw125-trophy"+(count?" owned":"");
      const title=document.createElement("b");title.textContent=count?BOSSES[index][0]:"???";
      const text=document.createElement("small");text.textContent=count?`${pattern.pattern} · ${pattern.reward} · ${count}회 처치`:`보상: ${pattern.reward}`;
      row.append(title,text);
      list.append(row);
    });
  }

  /* ---------- Multiplayer sync ---------- */
  const packMark=m=>[m.id,m.kind,Math.round(m.x),Math.round(m.y),m.r||0,m.angle||0,m.len||0,m.width||0,+m.time.toFixed(2),m.total,m.color];
  const baseMakeSnapshot=makeSnapshot;
  makeSnapshot=function(){
    const snapshot=baseMakeSnapshot();
    snapshot.v125={m:marks.map(packMark),b:bossEvents};
    return snapshot;
  };
  const baseApplySnapshot=applyWorldSnapshot;
  applyWorldSnapshot=function(snapshot,...args){
    const result=baseApplySnapshot(snapshot,...args);
    const data=snapshot?.v125;
    if(data&&!authority()){
      marks=(Array.isArray(data.m)?data.m:[]).slice(0,40).map(m=>({id:m[0],kind:m[1],x:m[2],y:m[3],r:m[4],angle:m[5],len:m[6],width:m[7],time:m[8],total:m[9]||1,color:m[10]}));
      for(const [id,index] of Array.isArray(data.b)?data.b:[]){
        if(id>seenBossEvent){seenBossEvent=id;applyBossReward(Number(index)||0);}
      }
    }
    return result;
  };

  /* ---------- Challenge links ---------- */
  const challenge={active:false,data:null,seed:"",lastResult:null};
  let runSeed="";
  const encode=data=>btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  function decode(text){
    try{
      const raw=JSON.parse(decodeURIComponent(escape(atob(String(text).replace(/-/g,"+").replace(/_/g,"/")))));
      const seed=String(raw.s||"").replace(/[^a-z0-9]/gi,"").slice(0,16);
      const scoreValue=Math.floor(Number(raw.p)),waveValue=Math.floor(Number(raw.w));
      if(!seed||!Number.isFinite(scoreValue)||scoreValue<0||!Number.isFinite(waveValue)||waveValue<1)return null;
      return {s:seed,p:Math.min(scoreValue,1e12),w:Math.min(waveValue,1e4),n:String(raw.n||"").slice(0,16)};
    }catch{return null;}
  }
  const newSeed=()=>Math.random().toString(36).slice(2,10)||"lastwave";
  function shareUrl(run){
    if(!runSeed||creative.active||gameMode!=="normal"||multiplayer.active||(v92()?.runType||"normal")!=="normal")return `${GAME_URL}?ref=share`;
    return `${GAME_URL}?ref=challenge&c=${encode({s:runSeed,p:run.score,w:run.wave,n:safeText(save.nickname||"",16)})}`;
  }
  function startChallenge(data){
    challenge.active=true;challenge.data=data;
    gameMode="normal";
    startRun("normal");
    showMessage("도전 시작",`목표 점수 ${formatNumber(data.p)}`,3);
  }
  function waitForFreeScreen(callback){
    const check=()=>{
      if(byId("lw122Updates")){setTimeout(check,300);return;}
      callback();
    };
    check();
  }
  function promptOverlay(id,title,html,button,onConfirm){
    const overlay=document.createElement("div");
    overlay.id=id;overlay.className="overlay";
    overlay.innerHTML=`<div class="panel lw125-link-panel"><div class="eyebrow">LAST WAVE</div><h2></h2><p class="lw125-link-body"></p>
      <div class="actions"><button class="btn" data-close type="button">나중에</button><button class="btn primary" data-go type="button"></button></div></div>`;
    overlay.querySelector("h2").textContent=title;
    overlay.querySelector(".lw125-link-body").textContent=html;
    const go=overlay.querySelector("[data-go]");go.textContent=button;
    const close=()=>{hideOverlay(overlay);overlay.remove();};
    overlay.querySelector("[data-close]").onclick=close;
    go.onclick=()=>{close();onConfirm();};
    document.body.append(overlay);
    showOverlay(overlay);
  }
  function readLinks(){
    let params;
    try{params=new URLSearchParams(location.search);}catch{return;}
    const data=params.get("c")?decode(params.get("c")):null;
    const room=params.get("room")?normalizeRoomCode(params.get("room")):"";
    if(params.has("c")||params.has("room")){
      params.delete("c");params.delete("room");
      const rest=params.toString();
      try{history.replaceState(null,"",location.pathname+(rest?`?${rest}`:""));}catch{}
    }
    if(room&&room.length===6){
      waitForFreeScreen(()=>promptOverlay("lw125Invite","멀티플레이 초대",`방 ${room}에 친구가 기다리고 있습니다. 함께 파도를 막아 볼까요?`,"참가하기",()=>{
        byId("multiButton").click();
        byId("roomCodeInput").value=room;
        byId("joinRoomButton").click();
      }));
    }else if(data){
      const who=data.n||"다른 생존자";
      waitForFreeScreen(()=>promptOverlay("lw125ChallengeOffer","도전장이 도착했습니다",
        `${who}님의 기록: 웨이브 ${formatNumber(data.w)}, 점수 ${formatNumber(data.p)}. 같은 출발 조건으로 이 점수를 넘어 보세요. 도전 판은 랭킹에 들어가지 않습니다.`,
        "도전하기",()=>startChallenge(data)));
    }
  }
  function buildInvite(){
    const actions=byId("lobby")?.querySelector(".actions");
    if(!actions)return;
    const box=document.createElement("div");
    box.id="lw125InviteBox";
    box.innerHTML=`<button id="lw125InviteButton" class="btn gold-btn" type="button">친구 초대 링크 보내기</button><small id="lw125InviteStatus" role="status"></small>`;
    actions.before(box);
    byId("lw125InviteButton").onclick=async()=>{
      const code=normalizeRoomCode(byId("roomCodeText").textContent);
      const status=byId("lw125InviteStatus");
      if(code.length!==6){status.textContent="방 코드가 아직 준비되지 않았습니다.";return;}
      const url=`${GAME_URL}?ref=invite&room=${code}`,text="Last Wave 같이 하자! 링크를 누르면 내 방으로 들어옵니다.";
      try{
        if(navigator.share&&/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)){await navigator.share({text,url});status.textContent="";return;}
        await navigator.clipboard.writeText(`${text}\n${url}`);
        status.textContent="초대 링크를 복사했습니다. 친구에게 붙여 넣어 보내세요.";
      }catch(error){
        if(error?.name!=="AbortError")status.textContent=url;
      }
    };
  }

  /* ---------- Game over screen ---------- */
  const bossWaveAfter=current=>{
    const every=creative.active?creative.rules.bossEvery:10;
    return every>0?Math.floor(current/every+1)*every:0;
  };
  function nearestThreat(){
    if(!player)return "";
    let best=null,bestRange=Infinity;
    for(const enemy of enemies){
      if(enemy.dead)continue;
      const range=Math.hypot(enemy.x-player.x,enemy.y-player.y)-(enemy.boss?300:0);
      if(range<bestRange){bestRange=range;best=enemy;}
    }
    if(!best)return "";
    return best.boss?(BOSSES[(Number(best.bossIndex)||0)%BOSSES.length]?.[0]||"보스"):(ENEMY_TYPES[best.type]?.name||"감염자");
  }
  function nextGoals(finalWave,finalScore,prevWave,prevScore){
    const goals=[];
    if(finalWave>prevWave&&prevWave>0)goals.push(`최고 웨이브 갱신! ${formatNumber(prevWave)} → ${formatNumber(finalWave)}`);
    else if(prevWave>finalWave)goals.push(`최고 웨이브까지 ${formatNumber(prevWave-finalWave)}웨이브 남았습니다.`);
    if(finalScore>prevScore&&prevScore>0)goals.push(`최고 점수 갱신! ${formatNumber(finalScore)}점`);
    const bossAt=bossWaveAfter(finalWave);
    if(bossAt)goals.push(`다음 보스는 웨이브 ${formatNumber(bossAt)}에 나옵니다.`);
    const nextZone=(Math.floor(Math.max(0,finalWave-1)/25)+1)*25+1;
    const zone=ZONES[Math.min(ZONES.length-1,Math.floor((nextZone-1)/25))];
    if(finalWave<nextZone&&nextZone<=101)goals.push(`웨이브 ${formatNumber(nextZone)}에서 새 구역 '${zone.name}'이 열립니다.`);
    return goals.slice(0,3);
  }
  let replay=null;
  function buildGameOver(){
    const anchor=byId("rankingResult");
    if(!anchor)return;
    const box=document.createElement("div");
    box.id="lw125Result";
    box.innerHTML=`<p id="lw125Challenge"></p><p id="lw125Threat"></p><ul id="lw125Goals"></ul>
      <button id="lw125Retry" class="btn primary" type="button">바로 다시 하기</button>`;
    anchor.after(box);
    byId("lw125Retry").onclick=()=>{
      const go=replay;
      hideOverlay(ui.gameOver);
      returnToMenu();
      if(go)go();
    };
  }
  const baseFinishRun=finishRun;
  finishRun=function(...args){
    if(runEnded)return baseFinishRun(...args);
    const prevWave=Number(save.bestWave)||0,prevScore=Number(save.bestScore)||0;
    const finalWave=Number(wave)||1,finalScore=Math.floor(Number(score)||0);
    const threat=nearestThreat();
    const wasCreative=creative.active,wasChallenge=challenge.active,data=challenge.data,rules=creative.rules;
    const plain=gameMode==="normal"&&!multiplayer.active&&(v92()?.runType||"normal")==="normal";
    replay=wasCreative?()=>{draftRules={...rules};startCreative();}
      :wasChallenge?()=>startChallenge(data)
      :plain?()=>{gameMode="normal";startRun("normal");}
      :null;
    const result=baseFinishRun(...args);
    // Combat tips must not cover the result screen.
    document.body.classList.add("lw125-over");
    hideTips();
    byId("lw125Retry").hidden=!replay;
    const challengeLine=byId("lw125Challenge");
    if(wasChallenge&&data){
      const won=finalScore>data.p;
      challengeLine.textContent=won
        ?`도전 성공! ${data.n||"상대"}님의 점수를 ${formatNumber(finalScore-data.p)}점 넘었습니다. 기록을 공유해 되돌려 주세요.`
        :`도전 실패. ${data.n||"상대"}님의 점수까지 ${formatNumber(data.p-finalScore)}점 남았습니다.`;
      challengeLine.className=won?"won":"lost";
    }else{challengeLine.textContent="";challengeLine.className="";}
    byId("lw125Threat").textContent=threat?`마지막에 가장 가까이 있던 적: ${threat}`:"";
    const goals=byId("lw125Goals");goals.innerHTML="";
    if(!wasCreative)for(const goal of nextGoals(finalWave,finalScore,prevWave,prevScore)){
      const li=document.createElement("li");li.textContent=goal;goals.append(li);
    }
    if(wasCreative){
      byId("prestigeButton")?.classList.add("hidden");
      byId("lw124ShareButton")?.setAttribute("hidden","");
      byId("rankingResult").textContent="크리에이티브 모드 기록은 랭킹과 보상에 반영되지 않습니다.";
    }else byId("lw124ShareButton")?.removeAttribute("hidden");
    const nickname=safeText(save.nickname||"",16);
    if(!wasCreative&&v92()?.runType==="weekly"&&!nickname)byId("rankingResult").textContent="닉네임이 없어 주간 랭킹에 등록되지 않았습니다. 메인 화면에서 닉네임을 정한 뒤 다시 도전하세요.";
    return result;
  };
  const baseReturnToMenu=returnToMenu;
  returnToMenu=function(...args){
    const result=baseReturnToMenu(...args);
    // Combat HUD and tips belong to a run, not to the menu.
    document.body.classList.add("lw125-over");
    hideTips();
    marks=[];
    challenge.active=false;challenge.data=null;
    if(creative.active)endCreative();
    return result;
  };

  /* ---------- Hooks into waves, spawns and the game loop ---------- */
  const baseStartRun=startRun;
  startRun=function(...args){
    document.body.classList.remove("lw125-over");
    marks=[];shownZone=0;hazardTimer=8;bossEvents=[];bossEventId=0;seenBossEvent=0;
    runStartCount=getProfileStats().runs;
    runSeed="";
    const result=baseStartRun(...args);
    if(easyRun())showMessage("첫 판 보호","처음 몇 웨이브는 적이 약하게 나옵니다.",3);
    return result;
  };
  const baseStartWave=startWave;
  startWave=function(...args){
    if(wave===0&&gameMode==="normal"&&!multiplayer.active&&!creative.active&&(v92()?.runType||"normal")==="normal"){
      runSeed=challenge.active?challenge.data.s:newSeed();
      runRandom=seededRandom(stringHash(`LAST_WAVE_CHALLENGE_${runSeed}`));
    }
    const result=baseStartWave(...args);
    if(state==="playing"&&authority()){
      if(creative.active){
        const r=creative.rules;
        spawnRemaining=Math.max(1,Math.round(spawnRemaining*r.enemyCount/100));
        if(r.bossEvery>0&&r.bossEvery!==10&&wave%r.bossEvery===0&&!enemies.some(e=>e.boss&&!e.dead)){allowBoss=true;spawnBoss();allowBoss=false;}
      }
      announceZone();
      if(wave===10||wave%10===0)tip("boss","보스 웨이브! 바닥의 경고 표시를 피하세요. 처치하면 그 판에서 강해집니다.");
      if(wave===2)tip("shop","웨이브 사이 상점에서 무기와 강화를 고를 수 있습니다.");
    }
    return result;
  };
  let allowBoss=false;
  const baseSpawnBoss=spawnBoss;
  spawnBoss=function(...args){
    if(creative.active&&!allowBoss&&(creative.rules.bossEvery===0||creative.rules.bossEvery!==10))return;
    const before=enemies.length,result=baseSpawnBoss(...args);
    if(creative.active&&authority())for(let i=before;i<enemies.length;i++){
      const enemy=enemies[i];
      enemy.maxHp*=creative.rules.bossHp/100;enemy.hp=enemy.maxHp;
      enemy.damage*=creative.rules.enemyDamage/100;
    }
    return result;
  };
  const baseSpawnEnemy=spawnEnemy;
  spawnEnemy=function(...args){
    const before=enemies.length,result=baseSpawnEnemy(...args);
    if(!authority())return result;
    const easy=easyRun();
    for(let i=before;i<enemies.length;i++){
      const enemy=enemies[i];
      if(easy){enemy.maxHp*=.7;enemy.hp=enemy.maxHp;enemy.damage*=.65;}
      if(creative.active){
        const r=creative.rules;
        if(!r.variants&&enemy.v121Variant)enemy.v121Variant=null;
        enemy.maxHp*=r.enemyHp/100;enemy.hp=enemy.maxHp;
        enemy.speed*=r.enemySpeed/100;
        enemy.damage*=r.enemyDamage/100;
      }
    }
    return result;
  };
  const baseUpdate=update;
  update=function(dt,...rest){
    const speed=creative.active?creative.rules.gameSpeed/100:1;
    const step=dt*speed;
    const result=baseUpdate(step,...rest);
    if(state==="playing"&&!paused)updateMarks(step);
    if(creative.active){
      const gain=creative.rules.moneyGain/100;
      if(gain!==1&&money>creative.lastMoney)money=creative.lastMoney+Math.floor((money-creative.lastMoney)*gain);
      creative.lastMoney=money;
    }
    if(tipTime>0){
      tipTime-=dt;
      if(tipTime<=0&&byId("lw125Tip"))byId("lw125Tip").style.display="none";
    }
    return result;
  };
  byId("lw92WeeklyStart")?.addEventListener("click",()=>{
    if(!safeText(save.nickname||"",16))setTimeout(()=>showMessage("닉네임 없음","닉네임을 정해야 주간 랭킹에 등록됩니다.",4),2600);
  });

  /* ---------- v128: the shop closes itself after 20 seconds ---------- */
  const SHOP_SECONDS=30;
  let shopLeft=0,shopTimer=0,shopLast=0;
  const isShown=el=>Boolean(el)&&getComputedStyle(el).display!=="none"&&getComputedStyle(el).visibility!=="hidden";
  function shopLabel(text){
    const button=byId("nextWaveButton");
    if(!button)return;
    let label=byId("lw128ShopTimer");
    if(!label){label=document.createElement("span");label.id="lw128ShopTimer";button.append(label);}
    label.textContent=text;
  }
  function stopShopTimer(){
    clearInterval(shopTimer);shopTimer=0;
    shopLabel("");
  }
  function tickShop(){
    if(state==="menu"||runEnded||!isShown(ui.shop)){stopShopTimer();return;}
    const now=performance.now(),elapsed=(now-shopLast)/1000;
    shopLast=now;
    // The clock never stops, even with another window open above the shop.
    shopLeft=Math.max(0,shopLeft-elapsed);
    shopLabel(` (${Math.ceil(shopLeft)})`);
    const reward=byId("lw108RewardOverlay");
    if(reward)reward.dataset.lw129Left=` · ${Math.ceil(shopLeft)}초`;
    if(shopLeft>0)return;
    stopShopTimer();
    closeAboveShop();
    // In multiplayer only the host may start the wave; the others follow its signal.
    if(!multiplayer.active||multiplayer.isHost)byId("nextWaveButton").click();
  }
  // Time is up: a pending reward takes its first option, other windows close.
  function closeAboveShop(){
    const reward=byId("lw108RewardOverlay");
    if(reward?.classList.contains("show"))reward.querySelector(".lw108-reward-card")?.click();
    for(const el of document.querySelectorAll(".overlay")){
      if(el===ui.shop||el.id==="lw108RewardOverlay"||!isShown(el))continue;
      const close=el.querySelector("button[data-close],button[id$='CloseButton'],button[id$='Close'],button[id$='CancelButton'],button[id$='Cancel']");
      if(close&&!close.disabled)close.click();else hideOverlay(el);
    }
  }
  const baseOpenShop=openShop;
  openShop=function(...args){
    const result=baseOpenShop(...args);
    clearInterval(shopTimer);
    shopLeft=SHOP_SECONDS;shopLast=performance.now();
    shopLabel(` (${SHOP_SECONDS})`);
    shopTimer=setInterval(tickShop,200);
    return result;
  };

  buildMenu();
  buildInvite();
  buildGameOver();
  if(document.readyState==="complete")readLinks();else addEventListener("load",readLinks,{once:true});
  window.__lastWaveV125={ZONES,BOSS_PATTERNS,RULES,DEFAULT_RULES,PRESETS,creative,challenge,zoneIndex,decode,encode,shareUrl,spawnHazard,
    get shopLeft(){return shopLeft;},setShopLeft(value){shopLeft=value;},get marks(){return marks;},get runSeed(){return runSeed;},startCreative,setRules(rules){draftRules={...DEFAULT_RULES,...rules};}};
})();
