/* Last Wave v97
 * - 적응형 멀티플레이 복구
 * - 24시간/6시간 프리즘 상자
 * - 확장 직업, 고유 특성, Z/X 일반 스킬, 강화 궁극기
 */
(() => {
  "use strict";

  const META_KEY="lastWaveV97Rewards";
  const HOUR=60*60*1000;
  const now=()=>Date.now();
  const clampNumber=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
  const randomInt=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
  let rewardMeta;
  try{
    rewardMeta=JSON.parse(localStorage.getItem(META_KEY)||"{}");
  }catch{
    rewardMeta={};
  }
  rewardMeta.chests=rewardMeta.chests||{};

  function persistRewardMeta(){
    localStorage.setItem(META_KEY,JSON.stringify(rewardMeta));
  }

  const jobPatch={
    soldier:{
      cost:0,desc:"돌격 화력 +18% · 재장전 없는 전투 리듬",
      trait:"전술 교리: 피해 +18%, 치명타 +5%",
      skills:[
        {id:"suppress",name:"제압 사격",key:"Z",cooldown:8,desc:"가까운 적 최대 10명에게 정밀 지원 사격"},
        {id:"combatStim",name:"전투 자극제",key:"X",cooldown:16,desc:"6초간 공격·이동 속도 상승"}
      ]
    },
    student:{
      cost:160,desc:"기동·습득 범위 특화",
      trait:"빠른 학습: 이동 +16%, 습득 범위 +80%, 경험치 +12%",
      skills:[
        {id:"quickStudy",name:"속성 복습",key:"Z",cooldown:9,desc:"주변 적을 둔화하고 궁극기 충전"},
        {id:"secondWind",name:"쉬는 시간",key:"X",cooldown:18,desc:"체력 회복 후 대시 초기화"}
      ]
    },
    scientist:{
      cost:280,desc:"상태 이상·연쇄 반응 특화",
      trait:"촉매 반응: 상태 이상 지속 +40%, 속성 피해 +22%",
      skills:[
        {id:"cryoPulse",name:"극저온 펄스",key:"Z",cooldown:10,desc:"주변 적 피해·강한 둔화"},
        {id:"catalyst",name:"촉매 폭탄",key:"X",cooldown:15,desc:"상태 이상이 걸린 적을 연쇄 폭발"}
      ]
    },
    courier:{
      cost:340,desc:"초고속 돌파·회피 특화",
      trait:"특급 배송: 이동 +34%, 대시 재사용 -30%, 최대 체력 -12%",
      skills:[
        {id:"blinkStrike",name:"퀵 딜리버리",key:"Z",cooldown:7,desc:"조준 방향 순간 이동·경로 피해"},
        {id:"overdrive",name:"익스프레스",key:"X",cooldown:14,desc:"5초간 초가속·접촉 피해"}
      ]
    },
    guard:{
      cost:480,desc:"방어·보호막·반격 특화",
      trait:"방탄 태세: 피해 감소 24%, 시작 보호막 +65",
      skills:[
        {id:"barrier",name:"휴대 방벽",key:"Z",cooldown:11,desc:"보호막 즉시 충전"},
        {id:"shockwave",name:"진압 충격파",key:"X",cooldown:15,desc:"적탄 제거·근거리 반격"}
      ]
    },
    medic:{
      cost:620,desc:"회복·팀 생존 특화",
      trait:"응급 처치: 초당 재생 2.0, 회복 초과분 보호막 전환",
      skills:[
        {id:"triage",name:"응급 주사",key:"Z",cooldown:8,desc:"체력이 낮은 팀원 즉시 회복"},
        {id:"cleanse",name:"정화 지대",key:"X",cooldown:17,desc:"팀 회복·주변 적 약화"}
      ]
    },
    engineer:{
      cost:780,desc:"공격 속도·자동 지원 특화",
      trait:"정밀 튜닝: 공격 속도 +13%, 펫 화력 +35%",
      skills:[
        {id:"turretVolley",name:"터렛 일제사격",key:"Z",cooldown:9,desc:"자동 추적탄 12발 발사"},
        {id:"fieldRepair",name:"현장 정비",key:"X",cooldown:16,desc:"보호막 회복·스킬 재사용 단축"}
      ]
    },
    firefighter:{
      cost:940,desc:"높은 체력·화염 제압 특화",
      trait:"내열 장비: 최대 체력 +25%, 화상 피해 +45%",
      skills:[
        {id:"fireRing",name:"화염 고리",key:"Z",cooldown:9,desc:"주변 적을 태우고 밀어냄"},
        {id:"rescueRush",name:"긴급 구조",key:"X",cooldown:15,desc:"무적 돌진·주변 팀원 보호"}
      ]
    },
    ranger:{
      name:"레인저",cost:1160,desc:"원거리 정밀 타격·표식 특화",ultimate:"헌터 오버워치",
      trait:"사냥꾼의 감각: 피해 +10%, 치명타 +14%, 습득 범위 +35%",
      skills:[
        {id:"markedShot",name:"표식 사격",key:"Z",cooldown:8,desc:"가장 강한 적에게 고화력 사격"},
        {id:"camouflage",name:"위장 망토",key:"X",cooldown:18,desc:"3초 무적·치명타 강화"}
      ],
      ultimates:[
        {id:"hunterOverwatch",name:"헌터 오버워치",desc:"전장 최강 적들을 순서대로 관통 저격합니다."},
        {id:"arrowRain",name:"유성 탄막",desc:"화면 전체에 고속 정밀탄을 쏟아붓습니다."}
      ]
    },
    chronomancer:{
      name:"시간술사",cost:1420,desc:"시간 제어·재사용 가속 특화",ultimate:"크로노 브레이크",
      trait:"시간 편향: 이동 +10%, 일반 스킬 재사용 -22%",
      skills:[
        {id:"timeSlice",name:"시간 절단",key:"Z",cooldown:8,desc:"전방 적 피해·시간 둔화"},
        {id:"rollback",name:"부분 역행",key:"X",cooldown:19,desc:"체력 회복·모든 재사용 단축"}
      ],
      ultimates:[
        {id:"chronoBreak",name:"크로노 브레이크",desc:"적의 시간을 멈추고 누적된 피해를 한꺼번에 폭발시킵니다."},
        {id:"futureEcho",name:"미래의 메아리",desc:"강력한 미래 사격을 여러 차례 현재로 불러옵니다."}
      ]
    },
    artificer:{
      name:"프리즘 공학자",cost:1740,desc:"프리즘 병기·보호막 특화",ultimate:"프리즘 성채",
      trait:"프리즘 회로: 시작 보호막 +40, 공격 속도 +8%, 피해 +8%",
      skills:[
        {id:"prismTurret",name:"프리즘 포탑",key:"Z",cooldown:9,desc:"굴절 추적탄 연속 발사"},
        {id:"chargeMine",name:"충전 지뢰",key:"X",cooldown:15,desc:"주변 적에게 대형 프리즘 폭발"}
      ],
      ultimates:[
        {id:"prismCitadel",name:"프리즘 성채",desc:"완전 보호막과 전방위 굴절탄을 동시에 전개합니다."},
        {id:"spectrumCollapse",name:"스펙트럼 붕괴",desc:"모든 적에게 속성 붕괴 피해와 상태 이상을 부여합니다."}
      ]
    },
    voidwalker:{
      name:"공허 방랑자",cost:2100,desc:"공간 이동·광역 붕괴 특화",ultimate:"이벤트 호라이즌",
      trait:"공허 동조: 이동 +12%, 회피 12%, 피해 +12%",
      skills:[
        {id:"voidStep",name:"공허 걸음",key:"Z",cooldown:7,desc:"순간 이동 후 출발·도착점 폭발"},
        {id:"gravityWell",name:"중력 우물",key:"X",cooldown:16,desc:"주변 적을 끌어당기고 피해"},
      ],
      ultimates:[
        {id:"eventHorizon",name:"이벤트 호라이즌",desc:"전장 중앙에 거대한 공허 붕괴를 일으킵니다."},
        {id:"dimensionRift",name:"차원 균열",desc:"여러 균열이 강한 적을 추적해 연속 폭발합니다."}
      ]
    }
  };

  for(const [id,patch] of Object.entries(jobPatch)){
    if(JOBS[id]) Object.assign(JOBS[id],patch);
    else JOBS[id]=patch;
  }

  const baseCreatePlayer=createPlayer;
  createPlayer=function(...args){
    const member=baseCreatePlayer(...args);
    const id=member.job;
    member.lw97SkillReadyAt=[0,0];
    member.lw97SkillCooldownMult=1;
    member.lw97Dodge=0;
    if(id==="soldier"){member.damageMult*=1.026;member.buffs.crit+=.05;}
    if(id==="student"){member.speed*=1.02;member.pickupRange*=1.125;member.lw97XpMult=1.12;}
    if(id==="scientist"){member.lw97ElementMult=1.22;member.lw97StatusMult=1.4;}
    if(id==="courier"){member.dashCooldownMult=.7;}
    if(id==="guard"){member.armor=Math.max(member.armor,.24);member.maxShield+=30;member.shield+=30;}
    if(id==="medic"){member.regen=Math.max(member.regen,2);}
    if(id==="engineer"){member.buffs.rate+=.13;member.lw97PetMult=1.35;}
    if(id==="firefighter"){const gain=member.maxHp*.06;member.maxHp+=gain;member.hp+=gain;member.lw97BurnMult=1.45;}
    if(id==="ranger"){member.damageMult*=1.1;member.buffs.crit+=.14;member.pickupRange*=1.35;}
    if(id==="chronomancer"){member.speed*=1.1;member.lw97SkillCooldownMult=.78;}
    if(id==="artificer"){member.damageMult*=1.08;member.buffs.rate+=.08;member.maxShield+=40;member.shield+=40;}
    if(id==="voidwalker"){member.damageMult*=1.12;member.speed*=1.12;member.lw97Dodge=.12;}
    return member;
  };

  function nearestTargets(limit=12,radius=760){
    if(!player) return[];
    return enemies.filter(e=>!e.dead&&distance(player,e)<=radius)
      .sort((a,b)=>distance(player,a)-distance(player,b)).slice(0,limit);
  }
  function hitTargets(targets,damage,color="#6deaff"){
    for(const enemy of targets){
      damageEnemy(enemy,damage*(player?.damageMult||1),player,{silentText:true});
      if(typeof createHitEffect==="function") createHitEffect(enemy.x,enemy.y,color,false);
    }
  }
  function fireTrackingVolley(count,damage,color="#72e9ff"){
    const targets=nearestTargets(count,900);
    for(let i=0;i<targets.length&&bullets.length<MAX_BULLETS;i++){
      const enemy=targets[i],angle=Math.atan2(enemy.y-player.y,enemy.x-player.x);
      bullets.push({id:createId(),x:player.x,y:player.y,vx:Math.cos(angle)*1250,vy:Math.sin(angle)*1250,
        damage:damage*(player.damageMult||1),radius:5,life:1.25,ownerId:player.id,weaponId:"lw97Skill",
        colorType:"power",color,pierce:2,blast:0,chain:0,instantKill:false,split:false,hitIds:[],hitObjectiveIds:[]});
    }
  }
  function useJobSkill(slot){
    if(!player||state!=="playing"||paused||player.dead||player.downed) return false;
    const job=JOBS[player.job]||JOBS.soldier;
    const skill=job.skills?.[slot];
    if(!skill) return false;
    const readyAt=Number(player.lw97SkillReadyAt?.[slot])||0;
    if(now()<readyAt) return false;
    player.lw97SkillReadyAt=player.lw97SkillReadyAt||[0,0];
    player.lw97SkillReadyAt[slot]=now()+skill.cooldown*1000*(player.lw97SkillCooldownMult||1);
    const id=skill.id;
    const around=nearestTargets(36,620);
    if(id==="suppress") fireTrackingVolley(10,105);
    else if(id==="combatStim"){player.lw97StimUntil=now()+6000;player.buffs.rate+=.25;player.speed*=1.18;}
    else if(id==="quickStudy"){for(const e of around){e.slow=Math.max(e.slow||0,4);} player.ultimate=Math.min(100,player.ultimate+18);}
    else if(id==="secondWind"){player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.3);player.dashCooldown=0;player.invincible=Math.max(player.invincible,.7);}
    else if(id==="cryoPulse"){hitTargets(around,125,"#82efff");for(const e of around)e.slow=Math.max(e.slow||0,5);}
    else if(id==="catalyst"){hitTargets(around.filter(e=>e.burn||e.poison||e.slow),225,"#c56cff");}
    else if(id==="blinkStrike"||id==="voidStep"){const a=player.angle||0,ox=player.x,oy=player.y;player.x+=Math.cos(a)*190;player.y+=Math.sin(a)*190;player.invincible=Math.max(player.invincible,.5);hitTargets(enemies.filter(e=>!e.dead&&(Math.hypot(e.x-ox,e.y-oy)<130||distance(player,e)<130)).slice(0,22),190);}
    else if(id==="overdrive"){player.lw97OverdriveUntil=now()+5000;player.invincible=Math.max(player.invincible,.5);}
    else if(id==="barrier"){player.maxShield=Math.max(player.maxShield||0,110);player.shield=Math.min(player.maxShield,(player.shield||0)+85);}
    else if(id==="shockwave"){for(let i=enemyBullets.length-1;i>=0;i--)if(distance(player,enemyBullets[i])<360)enemyBullets.splice(i,1);hitTargets(nearestTargets(25,360),190);}
    else if(id==="triage"){const living=[...players.values()].filter(m=>!m.dead);const target=living.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]||player;target.hp=Math.min(target.maxHp,target.hp+target.maxHp*.38);}
    else if(id==="cleanse"){for(const m of players.values()){if(!m.dead)m.hp=Math.min(m.maxHp,m.hp+m.maxHp*.16);}hitTargets(around,110);}
    else if(id==="turretVolley") fireTrackingVolley(12,88);
    else if(id==="fieldRepair"){player.shield=Math.min(player.maxShield||70,(player.shield||0)+55);player.lw97SkillReadyAt[0]=Math.max(now(),player.lw97SkillReadyAt[0]-4500);}
    else if(id==="fireRing"){hitTargets(around,145,"#ff9a52");for(const e of around)e.burn=Math.max(e.burn||0,7);}
    else if(id==="rescueRush"){player.invincible=Math.max(player.invincible,1.7);for(const m of players.values())if(!m.dead)m.shield=Math.max(m.shield||0,25);}
    else if(id==="markedShot"){const target=[...enemies].filter(e=>!e.dead).sort((a,b)=>(b.maxHp||0)-(a.maxHp||0))[0];if(target)hitTargets([target],520,"#b8ffcf");}
    else if(id==="camouflage"){player.invincible=Math.max(player.invincible,3);player.lw97CritUntil=now()+5000;}
    else if(id==="timeSlice"){hitTargets(around,180,"#b99cff");for(const e of around)e.slow=Math.max(e.slow||0,6);}
    else if(id==="rollback"){player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.28);player.lw97SkillReadyAt=player.lw97SkillReadyAt.map(t=>Math.max(now(),t-6000));player.dashCooldown=0;}
    else if(id==="prismTurret") fireTrackingVolley(14,95,"#70ffe0");
    else if(id==="chargeMine"){hitTargets(nearestTargets(35,430),250,"#59ffd4");createExplosionVisual(player.x,player.y,220);}
    else if(id==="gravityWell"){hitTargets(around,165,"#9c72ff");for(const e of around){const a=Math.atan2(player.y-e.y,player.x-e.x);e.x+=Math.cos(a)*65;e.y+=Math.sin(a)*65;}}
    playSfx("dash");
    showMessage(`${skill.key} · ${skill.name}`,skill.desc,1.2);
    updateSkillDock();
    return true;
  }

  const baseUseUltimate=useUltimate;
  useUltimate=function(){
    if(!player||player.ultimate<100) return;
    const jobId=player.job;
    const chosen=getSelectedUltimate(jobId);
    if(["hunterOverwatch","arrowRain","chronoBreak","futureEcho","prismCitadel","spectrumCollapse","eventHorizon","dimensionRift"].includes(chosen.id)){
      player.ultimate=0;playSfx("ultimate");
      const all=[...enemies].filter(e=>!e.dead).sort((a,b)=>(b.maxHp||0)-(a.maxHp||0));
      if(chosen.id==="hunterOverwatch")hitTargets(all.slice(0,16),820,"#caffdd");
      if(chosen.id==="arrowRain")hitTargets(all.slice(0,80),390,"#a7ffd1");
      if(chosen.id==="chronoBreak"){hitTargets(all.slice(0,100),560,"#c8a2ff");for(const e of all)e.slow=Math.max(e.slow||0,10);}
      if(chosen.id==="futureEcho"){fireTrackingVolley(30,260,"#d5b7ff");}
      if(chosen.id==="prismCitadel"){player.maxShield=Math.max(player.maxShield||0,220);player.shield=player.maxShield;player.invincible=Math.max(player.invincible,5);fireTrackingVolley(38,240,"#62ffe0");}
      if(chosen.id==="spectrumCollapse"){hitTargets(all.slice(0,120),480,"#72ffe7");for(const e of all){e.burn=10;e.poison=10;e.slow=8;}}
      if(chosen.id==="eventHorizon"){hitTargets(all.slice(0,120),650,"#9b6cff");createExplosionVisual(player.x,player.y,420);}
      if(chosen.id==="dimensionRift")hitTargets(all.slice(0,28),900,"#b58cff");
      player.lw97SkillReadyAt=[now(),now()];
      showMessage(chosen.name,chosen.desc);
    }else{
      baseUseUltimate();
      if(player){
        hitTargets(nearestTargets(40,820),95+player.level*8,"#ffe37d");
        player.lw97SkillReadyAt=(player.lw97SkillReadyAt||[0,0]).map(t=>Math.max(now(),t-5000));
      }
    }
  };

  const baseUpdatePlayer=updatePlayer;
  updatePlayer=function(member,dt){
    if(member?.lw97StimUntil&&now()>=member.lw97StimUntil){
      member.lw97StimUntil=0;member.buffs.rate=Math.max(0,(member.buffs.rate||0)-.25);member.speed/=1.18;
    }
    return baseUpdatePlayer(member,dt);
  };

  const baseGainXp=gainXp;
  gainXp=function(owner,amount){
    return baseGainXp(owner,amount*(owner?.lw97XpMult||1));
  };

  const baseDash=dash;
  dash=function(){
    const before=player?.dashCooldown;
    const result=baseDash();
    if(player&&player.dashCooldown!==before&&player.dashCooldown>0){
      player.dashCooldown*=player.dashCooldownMult||1;
    }
    return result;
  };

  const baseRenderJobs=renderJobs;
  renderJobs=function(){
    baseRenderJobs();
    const cards=[...ui.jobGrid.querySelectorAll(".job-card")];
    Object.entries(JOBS).forEach(([id,job],index)=>{
      const card=cards[index];
      if(!card||!job.skills) return;
      const detail=document.createElement("span");
      detail.className="lw97-job-details";
      detail.textContent=`특성 · ${job.trait} / 스킬 · ${job.skills.map(s=>`${s.key} ${s.name}`).join(" · ")}`;
      card.querySelector("p")?.append(detail);
      card.dataset.jobId=id;
    });
  };

  function formatRemaining(ms){
    if(ms<=0)return"지금 열 수 있습니다";
    const total=Math.ceil(ms/1000),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  const chestDefs={
    daily24:{name:"대형 프리즘 상자",hours:24,min:95,max:155,xpMin:220,xpMax:400,className:"day"},
    supply6:{name:"신속 보급 상자",hours:6,min:28,max:52,xpMin:70,xpMax:140,className:"six"}
  };
  function chestReadyAt(id){return Number(rewardMeta.chests[id]?.readyAt)||0;}
  function claimChest(id){
    const def=chestDefs[id];if(!def||now()<chestReadyAt(id))return;
    const prism=randomInt(def.min,def.max),xp=randomInt(def.xpMin,def.xpMax);
    save.prism=Math.max(0,Number(save.prism)||0)+prism;
    save.profileXp=Math.max(0,Number(save.profileXp)||0)+xp;
    rewardMeta.chests[id]={lastClaimAt:now(),readyAt:now()+def.hours*HOUR};
    persistRewardMeta();persist();refreshProfileSummary();renderJobs();renderChests();
    playSfx("evolve");showMessage(def.name,`프리즘 +${prism} · 프로필 XP +${xp}`);
  }
  function renderChests(){
    for(const [id,def] of Object.entries(chestDefs)){
      const ready=now()>=chestReadyAt(id),remaining=chestReadyAt(id)-now();
      const clock=document.querySelector(`[data-lw97-clock="${id}"]`);
      const button=document.querySelector(`[data-lw97-claim="${id}"]`);
      if(clock)clock.textContent=formatRemaining(remaining);
      if(button){button.disabled=!ready;button.textContent=ready?"상자 열기":`${def.hours}시간 충전 중`;}
    }
    const dot=document.querySelector(".lw97-ready-dot");
    if(dot)dot.classList.toggle("ready",Object.keys(chestDefs).some(id=>now()>=chestReadyAt(id)));
  }
  function openChestPopup(){document.getElementById("lw97ChestOverlay")?.classList.add("show");renderChests();}
  function closeChestPopup(){document.getElementById("lw97ChestOverlay")?.classList.remove("show");}
  function installChestUi(){
    const oldButton=document.getElementById("dailyChestMenuButton");
    if(oldButton){
      const button=oldButton.cloneNode(true);
      oldButton.replaceWith(button);button.disabled=false;
      const text=button.querySelector("#dailyChestMenuButtonText");if(text)text.textContent="";
      button.insertAdjacentHTML("beforeend",'<span class="lw97-ready-dot" aria-hidden="true"></span>');
      button.setAttribute("aria-label","보상 상자 열기");button.onclick=openChestPopup;
    }
    document.body.insertAdjacentHTML("beforeend",`
      <div id="lw97ChestOverlay" class="lw97-overlay" role="dialog" aria-modal="true" aria-labelledby="lw97ChestTitle">
        <section class="lw97-panel">
          <header class="lw97-panel-head"><div><small>PRISM SUPPLY</small><h2 id="lw97ChestTitle">보상 보관소</h2></div><button class="btn lw97-close" aria-label="닫기">×</button></header>
          <div class="lw97-chest-grid">${Object.entries(chestDefs).map(([id,def])=>`
            <article class="lw97-chest-card ${def.className}">
              <div class="lw97-chest-art" aria-hidden="true"></div><h3>${def.name}</h3>
              <p>프리즘 ${def.min}~${def.max} · 프로필 XP ${def.xpMin}~${def.xpMax}</p>
              <strong class="lw97-countdown" data-lw97-clock="${id}"></strong>
              <button class="btn primary lw97-claim" data-lw97-claim="${id}">상자 열기</button>
            </article>`).join("")}</div>
        </section></div>`);
    const overlay=document.getElementById("lw97ChestOverlay");
    overlay.querySelector(".lw97-close").onclick=closeChestPopup;
    overlay.onclick=e=>{if(e.target===overlay)closeChestPopup();};
    overlay.querySelectorAll("[data-lw97-claim]").forEach(button=>button.onclick=()=>claimChest(button.dataset.lw97Claim));
    renderChests();setInterval(renderChests,1000);
  }

  function updateSkillDock(){
    const dock=document.getElementById("lw97SkillDock");if(!dock)return;
    const job=player?(JOBS[player.job]||JOBS.soldier):JOBS[save.selectedJob]||JOBS.soldier;
    dock.style.display=state==="playing"?"flex":"none";
    dock.querySelectorAll("button").forEach((button,index)=>{
      const skill=job.skills?.[index];if(!skill)return;
      const remaining=Math.max(0,(Number(player?.lw97SkillReadyAt?.[index])||0)-now());
      button.classList.toggle("cooling",remaining>0);
      button.innerHTML=`<strong>${skill.key} · ${skill.name}</strong><small>${remaining?`${(remaining/1000).toFixed(1)}초`:"사용 가능"}</small>`;
    });
  }
  function installSkillUi(){
    document.body.insertAdjacentHTML("beforeend",`<div id="lw97SkillDock" class="lw97-skill-dock">
      <button class="lw97-skill-button" data-slot="0"></button><button class="lw97-skill-button" data-slot="1"></button></div>
      <div id="lw97NetworkPill" class="lw97-network-pill"></div>`);
    document.querySelectorAll(".lw97-skill-button").forEach(b=>b.onclick=()=>useJobSkill(Number(b.dataset.slot)));
    addEventListener("keydown",event=>{
      if(event.repeat||isEditableInputTarget(event.target))return;
      if(event.code==="KeyZ"){event.preventDefault();useJobSkill(0);}
      if(event.code==="KeyX"){event.preventDefault();useJobSkill(1);}
      if(event.code==="Escape"&&document.getElementById("lw97ChestOverlay")?.classList.contains("show")){
        event.stopImmediatePropagation();closeChestPopup();
      }
    },true);
    setInterval(updateSkillDock,100);
  }

  const baseRefreshDailyRewardUi=refreshDailyRewardUi;
  refreshDailyRewardUi=function(){
    baseRefreshDailyRewardUi();
    const button=document.getElementById("dailyChestMenuButton");
    if(button){button.disabled=false;button.setAttribute("aria-label","보상 상자 열기");}
    const text=document.getElementById("dailyChestMenuButtonText");if(text)text.textContent="";
    renderChests();
  };

  const baseConnectRealtimeRoom=connectRealtimeRoom;
  connectRealtimeRoom=async function(...args){
    const result=await baseConnectRealtimeRoom(...args);
    const channel=multiplayer.channel;
    if(channel&&!channel.__lw97Stabilized){
      channel.__lw97Stabilized=true;
      channel.on("broadcast",{event:"lw97_resync_request"},({payload})=>{
        if(!multiplayer.isHost||!payload)return;
        multiplayer.snapshotTimer=0;multiplayer.fullSnapshotTimer=0;multiplayer.projectileSyncTimer=0;
        sendWorldFrame();sendWorldSnapshot();sendProjectileFrame();sendLoadoutRoster();
      });
      channel.on("broadcast",{event:"lw97_resync_ack"},()=>{multiplayer.lastSnapshotAt=performance.now();});
    }
    return result;
  };
  let lastResyncRequest=0;
  function requestResync(reason){
    if(!multiplayer.active||multiplayer.isHost||!multiplayer.channel||performance.now()-lastResyncRequest<1800)return;
    lastResyncRequest=performance.now();
    sendRoomEvent("lw97_resync_request",{playerId:save.playerId,reason,lastFrameSeq:multiplayer.lastFrameSeq},{silent:true});
  }
  setInterval(()=>{
    const pill=document.getElementById("lw97NetworkPill");
    if(!multiplayer.active){pill?.classList.remove("show");return;}
    const age=performance.now()-(multiplayer.lastSnapshotAt||performance.now());
    if(!multiplayer.isHost&&state==="playing"&&age>1100)requestResync("frame-gap");
    if(multiplayer.isHost&&state==="playing"&&(multiplayer.latencyMs>190||multiplayer.jitterMs>85)){
      multiplayer.snapshotTimer=Math.min(multiplayer.snapshotTimer,.075);
      multiplayer.fullSnapshotTimer=Math.min(multiplayer.fullSnapshotTimer,.75);
    }
    if(pill){pill.classList.add("show");pill.textContent=`${multiplayer.isHost?"HOST":"CLIENT"} · ${Math.round(multiplayer.latencyMs||0)}ms · J${Math.round(multiplayer.jitterMs||0)}`;}
  },450);
  addEventListener("visibilitychange",()=>{if(!document.hidden)requestResync("visibility-return");});
  addEventListener("online",()=>requestResync("online"));

  installChestUi();
  installSkillUi();
  renderJobs();
  window.__lastWaveV97={version:97,chestDefs,jobPatch,useJobSkill,requestResync};
})();
