/* Last Wave v108: Director, mutations, tactical rewards, co-op and seasons. */
(() => {
  "use strict";

  const VERSION=108;
  const ELITE_MUTATIONS=[
    {id:"bulwark",name:"철갑",color:"#79d9ff",hp:1.55,damage:1.08,speed:.94},
    {id:"frenzy",name:"광란",color:"#ff6b82",hp:1.12,damage:1.34,speed:1.22},
    {id:"regenerator",name:"재생",color:"#75ffad",hp:1.28,damage:1.12,speed:1.02},
    {id:"volatile",name:"폭발",color:"#ffc65e",hp:1.18,damage:1.25,speed:1.08}
  ];
  const REWARDS=[
    {id:"field_repair",name:"현장 정비",desc:"팀 전원의 체력을 35% 회복하고 보호막 25를 지급합니다.",tag:"협동 회복",apply(){for(const member of players.values()){if(!member||member.dead)continue;member.hp=Math.min(member.maxHp,member.hp+member.maxHp*.35);member.maxShield=Math.max(Number(member.maxShield)||0,(Number(member.shield)||0)+25);member.shield=(Number(member.shield)||0)+25;}}},
    {id:"war_chest",name:"전쟁 물자",desc:"현재 웨이브에 비례한 공용 자금을 즉시 확보합니다.",tag:"공용 경제",apply(){money+=Math.round(500+wave*95);if(multiplayer.active&&multiplayer.isHost&&typeof broadcastSharedMoney==="function")broadcastSharedMoney("v108_reward");}},
    {id:"overclock",name:"전술 오버클럭",desc:"내 공격력과 연사 보너스를 영구적으로 6%씩 강화합니다.",tag:"개인 화력",apply(){if(!player)return;player.buffs.damage=(Number(player.buffs.damage)||0)+.06;player.buffs.rate=(Number(player.buffs.rate)||0)+.06;}},
    {id:"second_wind",name:"두 번째 숨결",desc:"궁극기를 45% 충전하고 최대 체력을 8% 높입니다.",tag:"생존력",apply(){if(!player)return;const before=player.maxHp;player.maxHp*=1.08;player.hp+=player.maxHp-before;player.ultimate=Math.min(100,(Number(player.ultimate)||0)+45);}},
    {id:"salvage",name:"정밀 회수",desc:"진화 프리즘 1개와 웨이브 비례 보급 자금을 얻습니다.",tag:"성장",apply(){evolutionCores++;money+=Math.round(220+wave*45);if(multiplayer.active&&multiplayer.isHost&&typeof broadcastSharedMoney==="function")broadcastSharedMoney("v108_salvage");}}
  ];

  const runtime={plan:null,rewardWave:0,rewardOpen:false,teamChain:0,teamChainTimer:0,lastCoopTick:0,bossPhaseEvents:0,eliteKills:0,telemetry:[]};

  function playerCount(){
    if(!multiplayer.active)return 1;
    return Math.max(1,Math.min(4,typeof getMultiplayerPlayerCount==="function"?getMultiplayerPlayerCount():players.size));
  }

  function getThreatBudget(waveNumber=wave,partySize=playerCount()){
    const w=Math.max(1,Math.floor(Number(waveNumber)||1));
    const party=Math.max(1,Math.min(4,Math.floor(Number(partySize)||1)));
    const base=12+w*2.8+Math.pow(w,1.32)*.72;
    return Math.round(base*(1+(party-1)*.28));
  }

  function buildWavePlan(waveNumber=wave,partySize=playerCount()){
    const w=Math.max(1,Math.floor(Number(waveNumber)||1));
    const budget=getThreatBudget(w,partySize);
    const tier=Math.min(6,1+Math.floor((w-1)/8));
    return{
      wave:w,budget,tier,
      extraSpawns:Math.max(0,Math.round(budget/28)-1),
      eliteChance:Math.min(.56,.05+w*.008+Math.max(0,partySize-1)*.025),
      mutationSlots:w>=35?2:1,
      bossPhases:w>=30?3:2
    };
  }

  function emitTelemetry(event,data={}){
    const entry={event,at:new Date().toISOString(),wave:Number(wave)||0,...data};
    runtime.telemetry.push(entry);
    if(runtime.telemetry.length>80)runtime.telemetry.shift();
    try{localStorage.setItem("lastWaveTelemetryV108",JSON.stringify(runtime.telemetry.slice(-40)));}catch{}
    console.info("[LastWave]",entry);
  }

  function ensureUi(){
    if(document.getElementById("lw108DirectorHud"))return;
    const director=document.createElement("div");
    director.id="lw108DirectorHud";director.className="lw108-director-hud";
    director.innerHTML="<strong>WAVE DIRECTOR</strong><span></span>";
    const combo=document.createElement("div");combo.id="lw108ComboHud";combo.className="lw108-combo-hud";
    const reward=document.createElement("div");reward.id="lw108RewardOverlay";reward.className="lw108-reward-overlay";reward.setAttribute("role","dialog");reward.setAttribute("aria-modal","true");
    reward.innerHTML='<section class="lw108-reward-panel"><h2>전술 보급 선택</h2><p>다음 웨이브를 위한 보급 하나를 선택하세요.</p><div id="lw108RewardGrid" class="lw108-reward-grid"></div></section>';
    document.body.append(director,combo,reward);
  }

  function renderDirector(){
    ensureUi();
    const node=document.getElementById("lw108DirectorHud");
    const plan=runtime.plan;
    node?.classList.toggle("show",Boolean(plan&&state==="playing"));
    if(node&&plan){node.querySelector("span").textContent=`위협 ${plan.budget} · 단계 ${plan.tier} · 변이율 ${Math.round(plan.eliteChance*100)}% · 보스 ${plan.bossPhases}페이즈`;}
  }

  function chooseMutation(enemy){
    if(!enemy||enemy.dead||enemy.v108MutationIds)return;
    const plan=runtime.plan||buildWavePlan();
    const shouldMutate=enemy.boss||enemy.elite||runRandom()<plan.eliteChance;
    if(!shouldMutate)return;
    enemy.elite=true;
    const count=enemy.boss?Math.min(2,plan.mutationSlots):plan.mutationSlots;
    const pool=[...ELITE_MUTATIONS];
    enemy.v108MutationIds=[];
    for(let index=0;index<count&&pool.length;index++){
      const selected=pool.splice(Math.floor(runRandom()*pool.length),1)[0];
      enemy.v108MutationIds.push(selected.id);
      enemy.maxHp*=selected.hp;enemy.hp*=selected.hp;enemy.damage*=selected.damage;enemy.speed*=selected.speed;
      enemy.v108MutationColor=selected.color;
    }
    enemy.v108BaseDamage=enemy.damage;
    enemy.v108RegenTimer=0;
  }

  function applyMutationsFrom(before){for(let i=before;i<enemies.length;i++)chooseMutation(enemies[i]);}

  function radialBurst(enemy,count=12,speed=230,damageScale=.58){
    const capacity=Math.max(0,180-enemyBullets.length);count=Math.min(count,capacity);
    for(let index=0;index<count;index++){
      const angle=Math.PI*2*index/count;
      enemyBullets.push({x:enemy.x,y:enemy.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage:enemy.damage*damageScale,radius:6,life:4});
    }
  }

  function updateMutation(enemy,dt){
    if(!enemy?.v108MutationIds||enemy.dead)return;
    if(enemy.v108MutationIds.includes("regenerator")&&enemy.hp<enemy.maxHp){enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.maxHp*.008*dt);}
    if(enemy.v108MutationIds.includes("frenzy")){const missing=1-enemy.hp/Math.max(1,enemy.maxHp);enemy.damage=enemy.v108BaseDamage*(1+missing*.45);}
  }

  function handleMutationDeath(enemy){
    if(!enemy?.v108MutationIds)return;
    if(enemy.v108MutationIds.includes("volatile")){
      radialBurst(enemy,10,210,.42);
      addParticle({type:"shockwave",x:enemy.x,y:enemy.y,radius:120,color:"#ffb34f",width:9,life:.45,maxLife:.45});
    }
    runtime.eliteKills++;
  }

  function bossPhaseUpdate(boss){
    if(!boss?.boss||boss.dead)return;
    const ratio=boss.hp/Math.max(1,boss.maxHp);
    const targetPhase=(runtime.plan?.bossPhases===3&&ratio<=.25)?3:ratio<=.55?2:1;
    if(targetPhase<=Number(boss.v108BossPhase||1))return;
    boss.v108BossPhase=targetPhase;boss.phase=Math.max(Number(boss.phase)||1,targetPhase);
    boss.speed*=targetPhase===3?1.18:1.1;boss.damage*=targetPhase===3?1.22:1.12;
    radialBurst(boss,targetPhase===3?18:12,targetPhase===3?290:240,.62);
    if(targetPhase===3){spawnRemaining=Math.min(Math.max(0,getActiveEnemyCap()-enemies.length-2),spawnRemaining+Math.max(2,Math.floor(wave/10)));}
    runtime.bossPhaseEvents++;
    showMessage(`보스 ${targetPhase}페이즈`,targetPhase===3?"최종 폭주 · 지원 감염체가 합류합니다.":"패턴 강화 · 방사 공격에 주의하세요.");
    emitTelemetry("boss_phase",{phase:targetPhase,bossId:boss.id});
  }

  function tickCoop(){
    if(!multiplayer.active||!multiplayer.isHost)return;
    const living=[...players.values()].filter(member=>member&&!member.dead&&!member.downed);
    if(living.length<2)return;
    let linked=0;
    for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++)if(distance(living[i],living[j])<=210)linked++;
    if(!linked)return;
    for(const member of living){member.shield=Math.min(Math.max(20,Number(member.maxShield)||20),(Number(member.shield)||0)+Math.min(2.5,.6*linked));}
  }

  function registerTeamKill(){
    if(!multiplayer.active)return;
    runtime.teamChain++;runtime.teamChainTimer=3.5;
    const node=document.getElementById("lw108ComboHud");
    if(node){node.textContent=`TEAM CHAIN ×${runtime.teamChain}`;node.classList.add("show");}
    if(multiplayer.isHost&&runtime.teamChain>0&&runtime.teamChain%20===0){money+=100+wave*8;for(const member of players.values()){if(member&&!member.dead)member.hp=Math.min(member.maxHp,member.hp+member.maxHp*.08);}if(typeof broadcastSharedMoney==="function")broadcastSharedMoney("v108_team_chain");showMessage("협동 연계 보너스",`${runtime.teamChain} 연속 처치 · 팀 회복과 보급 획득`);}
  }

  function rewardChoices(){
    const pool=[...REWARDS],choices=[];
    while(choices.length<3&&pool.length)choices.push(pool.splice(Math.floor(runRandom()*pool.length),1)[0]);
    return choices;
  }

  function openTacticalReward(){
    if(runtime.rewardOpen||runtime.rewardWave===wave||!player)return;
    ensureUi();runtime.rewardOpen=true;runtime.rewardWave=wave;paused=true;
    const overlay=document.getElementById("lw108RewardOverlay"),grid=document.getElementById("lw108RewardGrid");grid.innerHTML="";
    for(const reward of rewardChoices()){
      const button=document.createElement("button");button.type="button";button.className="lw108-reward-card";
      button.innerHTML=`<b>${reward.name}</b><span>${reward.desc}</span><small>${reward.tag}</small>`;
      button.onclick=()=>{reward.apply();runtime.rewardOpen=false;overlay.classList.remove("show");paused=false;syncShopEconomyUI?.();emitTelemetry("reward_choice",{reward:reward.id});showMessage("전술 보급 확보",reward.name);};
      grid.append(button);
    }
    overlay.classList.add("show");
  }

  function seasonKey(date=new Date()){
    const year=date.getUTCFullYear();const quarter=Math.floor(date.getUTCMonth()/3)+1;
    return `${year}-S${quarter}`;
  }

  async function loadSeasonRanking(limit=20){
    if(!sbClient)return[];
    const {data,error}=await sbClient.rpc("lw_list_season_rankings_v1",{p_season_key:seasonKey(),p_limit:Math.max(1,Math.min(100,limit))});
    if(error)throw error;return Array.isArray(data)?data:[];
  }

  function ensureSeasonUi(){
    const weekly=document.getElementById("lw92WeeklyRanking");
    if(!weekly||document.getElementById("lw108SeasonPanel"))return;
    const panel=document.createElement("section");
    panel.id="lw108SeasonPanel";panel.className="lw108-season-panel";
    panel.innerHTML=`<h3>검증 시즌 랭킹 · ${seasonKey()}</h3><div id="lw108SeasonRows">시즌 기록을 불러오는 중...</div><button id="lw108SeasonRefresh" class="btn" type="button">시즌 랭킹 새로고침</button>`;
    weekly.insertAdjacentElement("afterend",panel);
    document.getElementById("lw108SeasonRefresh").onclick=renderSeasonRanking;
  }

  async function renderSeasonRanking(){
    ensureSeasonUi();
    const root=document.getElementById("lw108SeasonRows");if(!root)return;
    root.textContent="시즌 기록을 불러오는 중...";
    try{
      const rows=await loadSeasonRanking();root.innerHTML="";
      if(!rows.length){root.textContent="이번 시즌의 검증 기록이 아직 없습니다.";return;}
      rows.forEach((row,index)=>{
        const line=document.createElement("div");line.className="lw108-season-row";
        const rank=document.createElement("b");rank.textContent=`#${index+1}`;
        const name=document.createElement("span");name.textContent=String(row.nickname||"SURVIVOR");
        const scoreNode=document.createElement("span");scoreNode.textContent=`${Number(row.score||0).toLocaleString()} · W${Number(row.wave)||1}`;
        line.append(rank,name,scoreNode);root.append(line);
      });
    }catch(error){root.textContent=`시즌 랭킹 연결 지연 · ${String(error?.message||error)}`;}
  }

  const baseStartWave=startWave;
  startWave=function(){
    const result=baseStartWave();
    if(state==="playing"&&(!multiplayer.active||multiplayer.isHost)){
      runtime.plan=buildWavePlan(wave,playerCount());
      const cap=Math.max(0,getActiveEnemyCap()-5);
      spawnRemaining=Math.min(cap,spawnRemaining+runtime.plan.extraSpawns);
      for(const enemy of enemies)chooseMutation(enemy);
      emitTelemetry("wave_plan",runtime.plan);
    }
    renderDirector();return result;
  };

  const baseSpawnEnemy=spawnEnemy;
  spawnEnemy=function(){const before=enemies.length,result=baseSpawnEnemy();applyMutationsFrom(before);return result;};
  const baseSpawnBoss=spawnBoss;
  spawnBoss=function(){const before=enemies.length,result=baseSpawnBoss();applyMutationsFrom(before);for(let i=before;i<enemies.length;i++)if(enemies[i]?.boss)enemies[i].v108BossPhase=1;return result;};
  const baseUpdateEnemy=updateEnemy;
  updateEnemy=function(enemy,dt){updateMutation(enemy,dt);return baseUpdateEnemy(enemy,dt);};
  const baseUpdateBoss=updateBoss;
  updateBoss=function(boss,...args){const result=baseUpdateBoss(boss,...args);bossPhaseUpdate(boss);return result;};
  const baseKillEnemy=killEnemy;
  killEnemy=function(enemy,owner){const alive=Boolean(enemy&&!enemy.dead);const result=baseKillEnemy(enemy,owner);if(alive&&enemy?.dead){handleMutationDeath(enemy);registerTeamKill();}return result;};
  const baseCompleteWave=completeWave;
  completeWave=function(){const wasPlaying=state==="playing";const result=baseCompleteWave();renderDirector();if(wasPlaying)setTimeout(openTacticalReward,320);return result;};
  const baseStartRun=startRun;
  startRun=function(...args){runtime.plan=null;runtime.rewardWave=0;runtime.rewardOpen=false;runtime.teamChain=0;runtime.teamChainTimer=0;runtime.bossPhaseEvents=0;runtime.eliteKills=0;document.getElementById("lw108RewardOverlay")?.classList.remove("show");return baseStartRun(...args);};
  const baseUpdate=update;
  update=function(dt){const result=baseUpdate(dt);runtime.teamChainTimer=Math.max(0,runtime.teamChainTimer-dt);if(runtime.teamChainTimer===0){runtime.teamChain=0;document.getElementById("lw108ComboHud")?.classList.remove("show");}runtime.lastCoopTick-=dt;if(runtime.lastCoopTick<=0){runtime.lastCoopTick=1;tickCoop();}return result;};
  const baseDrawEnemy=drawEnemy;
  drawEnemy=function(enemy){const result=baseDrawEnemy(enemy);if(enemy?.v108MutationIds&&!enemy.dead){ctx.save();ctx.strokeStyle=enemy.v108MutationColor||"#8feaff";ctx.lineWidth=3;ctx.globalAlpha=.82;ctx.beginPath();ctx.arc(enemy.x,enemy.y,enemy.radius+6,0,Math.PI*2);ctx.stroke();ctx.restore();}return result;};

  ensureUi();ensureSeasonUi();
  addEventListener("DOMContentLoaded",ensureSeasonUi,{once:true});
  document.getElementById("lw92OperationsButton")?.addEventListener("click",()=>renderSeasonRanking());
  document.getElementById("gameVersion")?.replaceChildren("v108");
  window.__lastWaveV108={version:VERSION,getThreatBudget,buildWavePlan,seasonKey,loadSeasonRanking,renderSeasonRanking,mutations:ELITE_MUTATIONS.map(item=>item.id),rewards:REWARDS.map(item=>item.id),runtime};
})();
