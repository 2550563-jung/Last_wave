/* Last Wave v98
 * - 투구/흉갑/각반/장화 슬롯과 매 판 초기화되는 방어구
 * - 근접 무기 5종 추가
 * - 기본 무기 우선 + 지속 DPS 내림차순 정렬 및 공격력 중심 밸런스
 */
(() => {
  "use strict";

  const slotNames={helmet:"투구",chest:"흉갑",legs:"각반",boots:"장화"};
  const ARMOR={
    helmet:[
      {id:"wornHelmet",name:"낡은 철제 투구",cost:0,desc:"기본 투구 · 최대 체력 +4",stats:{maxHp:4}},
      {id:"scoutVisor",name:"정찰 바이저",cost:900,desc:"치명타 +5% · 습득 범위 +20%",stats:{crit:.05,pickup:.2}},
      {id:"engineerGoggles",name:"공학 전술 고글",cost:2300,desc:"공격 속도 +5% · 일반 스킬 재사용 -6%",stats:{rate:.05,skillCooldown:.06}},
      {id:"prismCrown",name:"프리즘 지휘 투구",cost:5400,desc:"피해 +8% · 보호막 +24",stats:{damage:.08,shield:24}}
    ],
    chest:[
      {id:"wornChest",name:"낡은 가죽 흉갑",cost:0,desc:"기본 흉갑 · 피해 감소 +3%",stats:{armor:.03}},
      {id:"tacticalVest",name:"전술 방탄 흉갑",cost:1500,desc:"피해 감소 +8% · 최대 체력 +12",stats:{armor:.08,maxHp:12}},
      {id:"guardianPlate",name:"수호자 판금 흉갑",cost:3900,desc:"피해 감소 +14% · 이동 -3%",stats:{armor:.14,speed:-.03}},
      {id:"reactivePrism",name:"반응형 프리즘 흉갑",cost:6800,desc:"피해 감소 +10% · 보호막 +55",stats:{armor:.10,shield:55}}
    ],
    legs:[
      {id:"wornLegs",name:"낡은 천 각반",cost:0,desc:"기본 각반 · 이동 속도 +2%",stats:{speed:.02}},
      {id:"mobilityLegs",name:"기동 전술 각반",cost:1250,desc:"이동 속도 +8%",stats:{speed:.08}},
      {id:"shockLegs",name:"충격 흡수 각반",cost:3100,desc:"피해 감소 +6% · 최대 체력 +16",stats:{armor:.06,maxHp:16}},
      {id:"phaseLegs",name:"위상 전이 각반",cost:6100,desc:"이동 속도 +10% · 회피 +7%",stats:{speed:.10,dodge:.07}}
    ],
    boots:[
      {id:"wornBoots",name:"낡은 전투 장화",cost:0,desc:"기본 장화 · 이동 속도 +2%",stats:{speed:.02}},
      {id:"sprintBoots",name:"질주 전술 장화",cost:1100,desc:"이동 속도 +7% · 대시 재사용 -8%",stats:{speed:.07,dashCooldown:.08}},
      {id:"magBoots",name:"자력 안정 장화",cost:2700,desc:"이동 속도 +5% · 습득 범위 +35%",stats:{speed:.05,pickup:.35}},
      {id:"voidBoots",name:"공허 도약 장화",cost:5900,desc:"이동 속도 +9% · 회피 +6%",stats:{speed:.09,dodge:.06}}
    ]
  };
  const defaults={helmet:"wornHelmet",chest:"wornChest",legs:"wornLegs",boots:"wornBoots"};
  const armorById=new Map(Object.values(ARMOR).flat().map(item=>[item.id,item]));

  Object.assign(MELEE_WEAPONS,{
    salvageSpear:{name:"고철 장창",cost:2500,damage:235,range:178,cooldown:1.02,arc:1.05,desc:"긴 사거리로 적 대열을 찌르는 관통형 장창."},
    twinBlades:{name:"쌍열 단검",cost:4600,damage:190,range:104,cooldown:.46,arc:1.82,desc:"짧은 간격으로 연속 베기를 넣는 고속 근접무기."},
    sledgeHammer:{name:"진압 대형 망치",cost:7800,damage:720,range:132,cooldown:1.42,arc:1.45,desc:"느리지만 넓은 충격파와 압도적인 일격을 만드는 중량 무기."},
    powerFist:{name:"프리즘 파워 피스트",cost:11200,damage:520,range:112,cooldown:.64,arc:1.92,desc:"근거리에서 고밀도 프리즘 충격을 연속 방출하는 강화 장갑."},
    voidScythe:{name:"공허 절단 낫",cost:16500,damage:980,range:205,cooldown:.88,arc:2.25,desc:"넓은 부채꼴을 가르는 최상급 공간 절단 근접무기."}
  });

  function directDps(weapon){return Math.round((Number(weapon.damage)||0)*(Number(weapon.rate)||0)*Math.max(1,Number(weapon.pellets)||1));}
  function meleeDps(weapon){return Math.round((Number(weapon.damage)||0)/Math.max(.05,Number(weapon.cooldown)||1));}

  /* 일반 구매 총기는 가격 곡선에 맞춰 직접 DPS를 평탄화한다.
     연사 속도는 유지하고 공격력만 조절하여 조작감을 보존한다. */
  for(const weapon of Object.values(WEAPONS)){
    if(weapon.admin||weapon.fusion||weapon.replica||weapon.cost<=0)continue;
    const targetDps=92+Math.sqrt(weapon.cost)*2.52;
    const shotsPerSecond=Math.max(.05,weapon.rate)*Math.max(1,weapon.pellets||1);
    weapon.damage=Math.max(4,Math.round(targetDps/shotsPerSecond));
  }

  function reorderObject(object,defaultId,score){
    const entries=Object.entries(object);
    const first=entries.find(([id])=>id===defaultId);
    const rest=entries.filter(([id])=>id!==defaultId).sort((a,b)=>score(b[1])-score(a[1])||a[1].name.localeCompare(b[1].name,"ko"));
    for(const key of Object.keys(object))delete object[key];
    if(first)object[first[0]]=first[1];
    for(const [id,item] of rest)object[id]=item;
  }
  reorderObject(WEAPONS,"pistol",directDps);
  reorderObject(MELEE_WEAPONS,"wornSword",meleeDps);

  function resetEquipment(member){
    member.equipment={...defaults};
    member.ownedArmor=Object.values(defaults);
    member._lw98BaseStats=null;
    applyEquipment(member);
  }
  function applyEquipment(member){
    if(!member)return;
    if(!member._lw98BaseStats){
      member._lw98BaseStats={
        maxHp:member.maxHp,hp:member.hp,speed:member.speed,damageMult:member.damageMult,
        armor:member.armor,pickupRange:member.pickupRange,maxShield:member.maxShield||0,
        shield:member.shield||0,rate:Number(member.buffs?.rate)||0,
        dodge:Number(member.lw97Dodge)||0,skillMult:Number(member.lw97SkillCooldownMult)||1
      };
    }
    const base=member._lw98BaseStats;
    const oldRatio=member.maxHp?member.hp/member.maxHp:1;
    const total={maxHp:0,speed:0,damage:0,armor:0,pickup:0,shield:0,rate:0,dodge:0,skillCooldown:0,dashCooldown:0};
    for(const id of Object.values(member.equipment||defaults)){
      const item=armorById.get(id);if(!item)continue;
      for(const [key,value] of Object.entries(item.stats))total[key]=(total[key]||0)+value;
    }
    member.maxHp=base.maxHp+total.maxHp;
    member.hp=Math.min(member.maxHp,Math.max(1,member.maxHp*oldRatio));
    member.speed=base.speed*(1+total.speed);
    member.damageMult=base.damageMult*(1+total.damage);
    member.armor=Math.min(.65,base.armor+total.armor);
    member.pickupRange=base.pickupRange*(1+total.pickup);
    member.maxShield=base.maxShield+total.shield;
    member.shield=Math.min(member.maxShield,Math.max(base.shield,member.shield||0));
    if(member.buffs)member.buffs.rate=base.rate+total.rate;
    member.lw97Dodge=Math.min(.3,base.dodge+total.dodge);
    member.lw97SkillCooldownMult=base.skillMult*(1-total.skillCooldown);
    member.lw98DashCooldownMult=1-total.dashCooldown;
  }
  function equipArmor(slot,id){
    if(!player||!ARMOR[slot]?.some(item=>item.id===id))return;
    const item=armorById.get(id);
    const owned=player.ownedArmor?.includes(id);
    const finish=()=>{
      if(!player.ownedArmor.includes(id))player.ownedArmor.push(id);
      player.equipment[slot]=id;applyEquipment(player);renderEquipment();notifyMultiplayerLoadoutChanged();
    };
    if(owned||item.cost===0)finish();
    else if(state==="playing"||state==="waveComplete"){
      spendSharedRunMoney(item.cost,`armor:${id}`,finish,message=>showMessage("구매 실패",message||"공용 돈이 부족합니다."));
    }else showMessage("전투 장비","방어구는 매 판 초기화되며 전투 중 획득한 돈으로 구매합니다.");
  }

  function renderEquipment(){
    const slots=document.getElementById("lw98EquipmentSlots");
    const catalog=document.getElementById("lw98ArmorCatalog");
    if(!slots||!catalog)return;
    const current=player?.equipment||defaults;
    slots.innerHTML=Object.entries(slotNames).map(([slot,label])=>{
      const item=armorById.get(current[slot])||armorById.get(defaults[slot]);
      return `<div class="lw98-slot"><small>${label}</small><strong>${item.name}</strong><span>${item.desc}</span></div>`;
    }).join("");
    catalog.innerHTML="";
    for(const [slot,label] of Object.entries(slotNames)){
      catalog.insertAdjacentHTML("beforeend",`<h3 class="lw98-category-title">${label}</h3>`);
      for(const item of ARMOR[slot]){
        const equipped=current[slot]===item.id;
        const owned=player?.ownedArmor?.includes(item.id)||item.cost===0;
        const card=document.createElement("article");
        card.className=`lw98-armor-card${equipped?" equipped":""}`;
        card.innerHTML=`<h3>${item.name}</h3><p>${item.desc}</p><button class="btn ${owned?"":"primary"}">${equipped?"장착 중":owned?"장착":`₩${formatNumber(item.cost)} 구매`}</button>`;
        const button=card.querySelector("button");button.disabled=equipped;button.onclick=()=>equipArmor(slot,item.id);
        catalog.append(card);
      }
    }
  }
  function openEquipment(){
    document.getElementById("lw98EquipmentOverlay")?.classList.add("show");renderEquipment();
  }
  function closeEquipment(){document.getElementById("lw98EquipmentOverlay")?.classList.remove("show");}
  function installEquipmentUi(){
    const anchor=document.getElementById("dailyChestMenuButton");
    if(anchor?.parentElement){
      const button=document.createElement("button");button.id="lw98EquipmentMenuButton";button.className="btn lw98-equipment-menu-btn";
      button.textContent="장비";button.onclick=openEquipment;anchor.insertAdjacentElement("afterend",button);
    }
    document.body.insertAdjacentHTML("beforeend",`
      <div id="lw98EquipmentOverlay" class="lw97-overlay" role="dialog" aria-modal="true" aria-labelledby="lw98EquipmentTitle">
        <section class="lw97-panel">
          <header class="lw97-panel-head"><div><small>RUN EQUIPMENT</small><h2 id="lw98EquipmentTitle">방어구 장비</h2></div><button class="btn lw97-close" aria-label="닫기">×</button></header>
          <p>방어구와 구매 상태는 무기처럼 새 게임을 시작할 때 기본 장비로 초기화됩니다.</p>
          <div id="lw98EquipmentSlots" class="lw98-equipment-grid"></div>
          <div id="lw98ArmorCatalog" class="lw98-armor-catalog"></div>
        </section></div>`);
    const overlay=document.getElementById("lw98EquipmentOverlay");
    overlay.querySelector(".lw97-close").onclick=closeEquipment;
    overlay.onclick=e=>{if(e.target===overlay)closeEquipment();};
    addEventListener("keydown",event=>{
      if(event.code==="Escape"&&overlay.classList.contains("show")){event.stopImmediatePropagation();closeEquipment();}
    },true);
    renderEquipment();
  }

  const baseStartRun=startRun;
  startRun=function(...args){
    const result=baseStartRun(...args);
    resetEquipment(player);
    player.meleeWeapon="wornSword";player.ownedMelee=["wornSword"];
    renderEquipment();
    return result;
  };

  const baseDamagePlayer=damagePlayer;
  damagePlayer=function(target,amount){
    if(target?.lw97Dodge>0&&runRandom()<target.lw97Dodge){
      if(target.local)addFloatingText(target.x,target.y-22,"회피","#76f5ff",13);
      target.invincible=Math.max(target.invincible||0,.12);
      return;
    }
    return baseDamagePlayer(target,amount);
  };

  const baseDashV98=dash;
  dash=function(){
    const before=player?.dashCooldown;
    const result=baseDashV98();
    if(player&&player.dashCooldown!==before&&player.dashCooldown>0){
      player.dashCooldown*=player.lw98DashCooldownMult||1;
    }
    return result;
  };

  const baseRenderWeapons=renderWeapons;
  renderWeapons=function(){
    baseRenderWeapons();
    const visible=Object.entries(WEAPONS).filter(([id,weapon])=>!weapon.admin&&(!weapon.fusion||player.weaponSlots.includes(id)));
    [...document.querySelectorAll("#weaponGrid .card")].forEach((card,index)=>{
      const weapon=visible[index]?.[1];if(!weapon)return;
      const badge=document.createElement("span");badge.className="lw98-dps";badge.textContent=`지속 DPS ${formatNumber(directDps(weapon))}`;
      card.querySelector("p")?.append(badge);
    });
  };
  const baseRenderMelee=renderMelee;
  renderMelee=function(){
    baseRenderMelee();
    const entries=Object.entries(MELEE_WEAPONS);
    [...document.querySelectorAll("#meleeGrid .card")].forEach((card,index)=>{
      const weapon=entries[index]?.[1];if(!weapon)return;
      const badge=document.createElement("span");badge.className="lw98-dps";badge.textContent=`지속 DPS ${formatNumber(meleeDps(weapon))}`;
      card.querySelector("p")?.append(badge);
    });
  };

  installEquipmentUi();
  window.__lastWaveV98={version:98,ARMOR,slotNames,directDps,meleeDps,resetEquipment};
})();
