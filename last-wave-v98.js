/* Last Wave v98
 * - 방어구는 한 판에서만 구매·장착되며 새 게임마다 기본 장비로 초기화됩니다.
 * - 방어구는 메인 화면이 아니라 웨이브 정비 화면에서만 관리합니다.
 * - 근접 무기 5종과 지속 DPS 정렬을 유지합니다.
 */
(() => {
  "use strict";

  const slotNames={
    helmet:"머리 장비",
    chest:"상체 방어구",
    legs:"하체 방어구",
    boots:"신발"
  };
  const slotIcons={
    helmet:"◉",
    chest:"◆",
    legs:"▥",
    boots:"▰"
  };
  const rarityNames={
    basic:"기본",
    common:"일반",
    rare:"희귀",
    epic:"특수"
  };
  const ARMOR={
    helmet:[
      {id:"wornHelmet",name:"허름한 철제 모자",rarity:"basic",cost:550,desc:"가벼운 머리 보호구 · 최대 체력 +4",stats:{maxHp:4}},
      {id:"scoutVisor",name:"정찰 바이저",rarity:"common",cost:900,desc:"치명타 확률 +5% · 획득 범위 +20%",stats:{crit:.05,pickup:.2}},
      {id:"combatHelmet",name:"강화 전투 헬멧",rarity:"rare",cost:2100,desc:"최대 체력 +12 · 피해 감소 +4%",stats:{maxHp:12,armor:.04}},
      {id:"medicHeadset",name:"구조대 통신 헬멧",rarity:"rare",cost:2700,desc:"최대 체력 +8 · 스킬 재사용 -6%",stats:{maxHp:8,skillCooldown:.06}},
      {id:"engineerGoggles",name:"공학 전술 고글",rarity:"rare",cost:3200,desc:"공격 속도 +6% · 스킬 재사용 -7%",stats:{rate:.06,skillCooldown:.07}},
      {id:"prismCrown",name:"프리즘 지휘 헬멧",rarity:"epic",cost:6200,desc:"공격력 +9% · 보호막 +28",stats:{damage:.09,shield:28}}
    ],
    chest:[
      {id:"wornChest",name:"허름한 가죽 조끼",rarity:"basic",cost:0,desc:"시작 장비 · 피해 감소 +3%",stats:{armor:.03}},
      {id:"lightVest",name:"경량 방탄 조끼",rarity:"common",cost:1200,desc:"피해 감소 +6% · 이동 속도 +2%",stats:{armor:.06,speed:.02}},
      {id:"tacticalVest",name:"전술 방탄복",rarity:"rare",cost:2600,desc:"피해 감소 +9% · 최대 체력 +14",stats:{armor:.09,maxHp:14}},
      {id:"assaultRig",name:"돌격대 전투복",rarity:"rare",cost:3500,desc:"피해 감소 +7% · 공격력 +5%",stats:{armor:.07,damage:.05}},
      {id:"guardianPlate",name:"수호자 중장갑",rarity:"rare",cost:4700,desc:"피해 감소 +15% · 이동 속도 -2%",stats:{armor:.15,speed:-.02}},
      {id:"reactivePrism",name:"반응형 프리즘 방탄복",rarity:"epic",cost:7600,desc:"피해 감소 +11% · 보호막 +60",stats:{armor:.11,shield:60}}
    ],
    legs:[
      {id:"wornLegs",name:"허름한 작업 바지",rarity:"basic",cost:0,desc:"시작 장비 · 이동 속도 +2%",stats:{speed:.02}},
      {id:"combatLegs",name:"보강 전술 하의",rarity:"common",cost:1100,desc:"최대 체력 +8 · 피해 감소 +3%",stats:{maxHp:8,armor:.03}},
      {id:"mobilityLegs",name:"기동 전술 하의",rarity:"rare",cost:2300,desc:"이동 속도 +8%",stats:{speed:.08}},
      {id:"gunnerLegs",name:"사수 전술 하의",rarity:"rare",cost:3300,desc:"공격 속도 +5% · 이동 속도 +4%",stats:{rate:.05,speed:.04}},
      {id:"shockLegs",name:"충격 흡수 하의",rarity:"rare",cost:3900,desc:"피해 감소 +7% · 최대 체력 +20",stats:{armor:.07,maxHp:20}},
      {id:"phaseLegs",name:"위상 전이 하의",rarity:"epic",cost:6900,desc:"이동 속도 +10% · 회피 +7%",stats:{speed:.10,dodge:.07}}
    ],
    boots:[
      {id:"wornBoots",name:"허름한 작업화",rarity:"basic",cost:450,desc:"가벼운 작업용 신발 · 이동 속도 +2%",stats:{speed:.02}},
      {id:"reinforcedBoots",name:"보강 전투화",rarity:"common",cost:950,desc:"이동 속도 +3% · 피해 감소 +3%",stats:{speed:.03,armor:.03}},
      {id:"sprintBoots",name:"질주 전투화",rarity:"rare",cost:2200,desc:"이동 속도 +8% · 대시 재사용 -10%",stats:{speed:.08,dashCooldown:.10}},
      {id:"medicBoots",name:"구조대 기동화",rarity:"rare",cost:2850,desc:"이동 속도 +6% · 스킬 재사용 -5%",stats:{speed:.06,skillCooldown:.05}},
      {id:"magBoots",name:"자력 안정 전투화",rarity:"rare",cost:3400,desc:"이동 속도 +5% · 획득 범위 +35%",stats:{speed:.05,pickup:.35}},
      {id:"voidBoots",name:"공허 도약 전투화",rarity:"epic",cost:6600,desc:"이동 속도 +9% · 회피 +6%",stats:{speed:.09,dodge:.06}}
    ]
  };
  const defaults={
    helmet:null,
    chest:"wornChest",
    legs:"wornLegs",
    boots:null
  };
  const armorEntries=Object.entries(ARMOR).flatMap(([slot,items])=>items.map(item=>({...item,slot})));
  const armorById=new Map(armorEntries.map(item=>[item.id,item]));

  Object.assign(MELEE_WEAPONS,{
    salvageSpear:{name:"고철 장창",cost:2500,damage:235,range:178,cooldown:1.02,arc:1.05,desc:"긴 사거리로 적 무리를 찌르는 관통형 장창."},
    twinBlades:{name:"쌍열 단검",cost:4600,damage:190,range:104,cooldown:.46,arc:1.82,desc:"짧은 간격으로 연속 베기를 넣는 고속 근접 무기."},
    sledgeHammer:{name:"진압 대형 망치",cost:7800,damage:720,range:132,cooldown:1.42,arc:1.45,desc:"느리지만 넓은 충격파와 높은 피해를 주는 중량 무기."},
    powerFist:{name:"프리즘 파워 피스트",cost:11200,damage:520,range:112,cooldown:.64,arc:1.92,desc:"근거리에서 강한 프리즘 충격을 연속 방출하는 강화 장갑."},
    voidScythe:{name:"공허 절단 낫",cost:16500,damage:980,range:205,cooldown:.88,arc:2.25,desc:"넓은 부채꼴 공간을 가르는 최상급 근접 무기."}
  });

  function directDps(weapon){
    return Math.round((Number(weapon.damage)||0)*(Number(weapon.rate)||0)*Math.max(1,Number(weapon.pellets)||1));
  }
  function meleeDps(weapon){
    return Math.round((Number(weapon.damage)||0)/Math.max(.05,Number(weapon.cooldown)||1));
  }

  for(const weapon of Object.values(WEAPONS)){
    if(weapon.admin||weapon.fusion||weapon.replica||weapon.cost<=0)continue;
    const targetDps=92+Math.sqrt(weapon.cost)*2.52;
    const shotsPerSecond=Math.max(.05,weapon.rate)*Math.max(1,weapon.pellets||1);
    weapon.damage=Math.max(4,Math.round(targetDps/shotsPerSecond));
  }

  function reorderObject(object,defaultId,score){
    const entries=Object.entries(object);
    const first=entries.find(([id])=>id===defaultId);
    const rest=entries
      .filter(([id])=>id!==defaultId)
      .sort((a,b)=>score(a[1])-score(b[1])||a[1].name.localeCompare(b[1].name,"ko"));
    for(const key of Object.keys(object))delete object[key];
    if(first)object[first[0]]=first[1];
    for(const [id,item] of rest)object[id]=item;
  }
  reorderObject(WEAPONS,"pistol",directDps);
  reorderObject(MELEE_WEAPONS,"wornSword",meleeDps);

  function sanitizeEquipment(value){
    const result={...defaults};
    for(const slot of Object.keys(defaults)){
      const id=value?.[slot];
      if(typeof id==="string"&&ARMOR[slot].some(item=>item.id===id))result[slot]=id;
    }
    return result;
  }

  function sanitizeOwnedArmor(value){
    const valid=Array.isArray(value)
      ? value.filter(id=>typeof id==="string"&&armorById.has(id))
      : [];
    return [...new Set([...Object.values(defaults).filter(Boolean),...valid])];
  }

  function emptyEquipmentBonus(){
    return {
      maxHp:0,speed:0,damage:0,armor:0,pickup:0,shield:0,
      rate:0,crit:0,dodge:0,skillCooldown:0,dashCooldown:0
    };
  }

  function collectEquipmentBonus(equipment){
    const total=emptyEquipmentBonus();
    for(const id of Object.values(sanitizeEquipment(equipment))){
      if(!id)continue;
      const item=armorById.get(id);
      if(!item)continue;
      for(const [key,value] of Object.entries(item.stats)){
        total[key]=(total[key]||0)+(Number(value)||0);
      }
    }
    return total;
  }

  function applyEquipment(member){
    if(!member)return;
    member.equipment=sanitizeEquipment(member.equipment);
    member.ownedArmor=sanitizeOwnedArmor(member.ownedArmor);

    const old=member._lw98EquipmentBonus||emptyEquipmentBonus();
    const next=collectEquipmentBonus(member.equipment);
    const missingHp=Math.max(0,(Number(member.maxHp)||1)-(Number(member.hp)||0));
    const oldSpeed=Math.max(.1,1+old.speed);
    const oldDamage=Math.max(.1,1+old.damage);
    const oldPickup=Math.max(.1,1+old.pickup);
    const oldSkill=Math.max(.1,1-old.skillCooldown);
    const oldDash=Math.max(.1,1-old.dashCooldown);

    member.maxHp=Math.max(1,(Number(member.maxHp)||1)-old.maxHp+next.maxHp);
    member.hp=clamp(member.maxHp-missingHp,1,member.maxHp);
    member.speed=(Number(member.speed)||1)/oldSpeed*(1+next.speed);
    member.damageMult=(Number(member.damageMult)||1)/oldDamage*(1+next.damage);
    member.armor=clamp((Number(member.armor)||0)-old.armor+next.armor,0,.65);
    member.pickupRange=(Number(member.pickupRange)||1)/oldPickup*(1+next.pickup);
    member.maxShield=Math.max(0,(Number(member.maxShield)||0)-old.shield+next.shield);
    member.shield=clamp((Number(member.shield)||0)-old.shield+next.shield,0,member.maxShield);

    if(member.buffs){
      member.buffs.rate=(Number(member.buffs.rate)||0)-old.rate+next.rate;
      member.buffs.crit=(Number(member.buffs.crit)||0)-old.crit+next.crit;
    }
    member.lw97Dodge=clamp((Number(member.lw97Dodge)||0)-old.dodge+next.dodge,0,.3);
    member.lw97SkillCooldownMult=(Number(member.lw97SkillCooldownMult)||1)/oldSkill*(1-next.skillCooldown);
    member.lw98DashCooldownMult=(Number(member.lw98DashCooldownMult)||1)/oldDash*(1-next.dashCooldown);
    member._lw98EquipmentBonus=next;
  }

  function resetEquipment(member){
    if(!member)return;
    member._lw98EquipmentBonus=null;
    member.equipment={...defaults};
    member.ownedArmor=[...Object.values(defaults).filter(Boolean)];
    applyEquipment(member);
  }

  function formatArmorSummary(member){
    const bonus=collectEquipmentBonus(member?.equipment||defaults);
    const parts=[];
    if(bonus.armor)parts.push(`피해 감소 +${Math.round(bonus.armor*100)}%`);
    if(bonus.maxHp)parts.push(`최대 체력 +${bonus.maxHp}`);
    if(bonus.speed)parts.push(`이동 +${Math.round(bonus.speed*100)}%`);
    if(bonus.damage)parts.push(`공격 +${Math.round(bonus.damage*100)}%`);
    if(bonus.shield)parts.push(`보호막 +${bonus.shield}`);
    return parts.join(" · ")||"장착된 방어구 없음";
  }

  function equipArmor(slot,id){
    if(!player||state!=="waveComplete"||!ARMOR[slot]?.some(item=>item.id===id))return;
    const item=armorById.get(id);
    const owned=player.ownedArmor?.includes(id);
    const finish=()=>{
      player.ownedArmor=sanitizeOwnedArmor([...(player.ownedArmor||[]),id]);
      player.equipment=sanitizeEquipment(player.equipment);
      player.equipment[slot]=id;
      applyEquipment(player);
      renderEquipment();
      notifyMultiplayerLoadoutChanged();
      showMessage("방어구 장착",item.name);
    };
    if(owned||item.cost===0){
      finish();
      return;
    }
    spendSharedRunMoney(
      item.cost,
      `armor:${id}`,
      finish,
      message=>showMessage("구매 실패",message||"공용 돈이 부족합니다.")
    );
  }

  function renderEquipment(){
    const slots=document.getElementById("lw98EquipmentSlots");
    const catalog=document.getElementById("lw98ArmorCatalog");
    const summary=document.getElementById("lw98EquipmentSummary");
    if(!slots||!catalog)return;

    const current=sanitizeEquipment(player?.equipment||defaults);
    const owned=sanitizeOwnedArmor(player?.ownedArmor);
    if(summary)summary.textContent=formatArmorSummary(player);

    slots.innerHTML=Object.entries(slotNames).map(([slot,label])=>{
        const item=armorById.get(current[slot]);
        if(!item){
          return `<article class="lw98-slot empty" data-slot="${slot}">
            <div class="lw98-slot-icon" aria-hidden="true">${slotIcons[slot]}</div>
            <div><small>${label}</small><strong>비어 있음</strong><span>정비소에서 장비를 구매해 장착하세요.</span></div>
          </article>`;
        }
        return `<article class="lw98-slot" data-slot="${slot}">
        <div class="lw98-slot-icon" aria-hidden="true">${slotIcons[slot]}</div>
        <div><small>${label}</small><strong>${item.name}</strong><span>${item.desc}</span></div>
      </article>`;
    }).join("");

    catalog.innerHTML="";
    for(const [slot,label] of Object.entries(slotNames)){
      const group=document.createElement("section");
      group.className="lw98-armor-group";
      group.innerHTML=`<h3><span aria-hidden="true">${slotIcons[slot]}</span>${label}</h3><div class="lw98-armor-row"></div>`;
      const row=group.querySelector(".lw98-armor-row");

      for(const item of ARMOR[slot]){
        const equipped=current[slot]===item.id;
        const isOwned=owned.includes(item.id);
        const card=document.createElement("article");
        card.className=`lw98-armor-card rarity-${item.rarity}${equipped?" equipped":""}`;
        card.innerHTML=`<div class="lw98-armor-card-top">
          <span class="lw98-rarity">${rarityNames[item.rarity]}</span>
          ${equipped?'<span class="lw98-equipped-mark">장착 중</span>':""}
        </div>
        <h4>${item.name}</h4>
        <p>${item.desc}</p>
        <button class="btn ${isOwned?"":"primary"}" type="button">
          ${equipped?"장착 중":isOwned?"장착":`₩ ${formatNumber(item.cost)} 구매`}
        </button>`;
        const button=card.querySelector("button");
        button.disabled=equipped||state!=="waveComplete";
        button.onclick=()=>equipArmor(slot,item.id);
        row.append(card);
      }
      catalog.append(group);
    }
    window.__lastWaveV102?.decorateArmor?.(catalog);
  }

  function installEquipmentUi(){
    document.getElementById("lw98EquipmentMenuButton")?.remove();
    document.getElementById("lw98EquipmentOverlay")?.remove();
    if(document.getElementById("lw98EquipmentSection"))return;
    const meleeGrid=document.getElementById("meleeGrid");
    if(!meleeGrid)return;

    const section=document.createElement("section");
    section.id="lw98EquipmentSection";
    section.className="lw98-equipment-section";
    section.innerHTML=`
      <div class="section-title lw98-equipment-title">
        <span>방어구</span>
        <small>이번 게임에서만 유지</small>
      </div>
      <p class="lw98-equipment-guide">머리, 상체, 하체, 신발 장비를 정비합니다. 상체와 하체는 허름한 시작 장비가 지급되며 머리와 신발은 비어 있습니다. 구매한 장비는 웨이브가 바뀌어도 유지되고, 게임이 끝난 뒤 새 게임을 시작하면 초기화됩니다.</p>
      <div id="lw98EquipmentSummary" class="lw98-equipment-summary">기본 방어구 효과</div>
      <div id="lw98EquipmentSlots" class="lw98-equipment-grid"></div>
      <div id="lw98ArmorCatalog" class="lw98-armor-catalog"></div>`;
    meleeGrid.insertAdjacentElement("afterend",section);
    renderEquipment();
  }

  const baseStartRun=startRun;
  startRun=function(...args){
    const result=baseStartRun(...args);
    resetEquipment(player);
    player.meleeWeapon="wornSword";
    player.ownedMelee=["wornSword"];
    renderEquipment();
    return result;
  };

  const baseOpenShop=openShop;
  openShop=function(...args){
    const result=baseOpenShop(...args);
    renderEquipment();
    return result;
  };

  const baseReturnToMenu=returnToMenu;
  returnToMenu=function(...args){
    document.getElementById("lw98EquipmentMenuButton")?.remove();
    document.getElementById("lw98EquipmentOverlay")?.remove();
    return baseReturnToMenu(...args);
  };

  const baseDamagePlayer=damagePlayer;
  damagePlayer=function(target,amount,...rest){
    if(target?.lw97Dodge>0&&runRandom()<target.lw97Dodge){
      if(target.local)addFloatingText(target.x,target.y-22,"회피","#76f5ff",13);
      target.invincible=Math.max(target.invincible||0,.12);
      return;
    }
    return baseDamagePlayer(target,amount,...rest);
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

  const baseSanitizeMultiplayerLoadout=sanitizeMultiplayerLoadout;
  sanitizeMultiplayerLoadout=function(payload,target=null){
    const clean=baseSanitizeMultiplayerLoadout(payload,target);
    clean.equipment=sanitizeEquipment(payload?.equipment||target?.equipment);
    clean.ownedArmor=sanitizeOwnedArmor(payload?.ownedArmor||target?.ownedArmor);
    return clean;
  };

  const baseApplyMultiplayerLoadout=applyMultiplayerLoadout;
  applyMultiplayerLoadout=function(target,payload){
    const applied=baseApplyMultiplayerLoadout(target,payload);
    if(!applied||!target)return applied;
    const cleanEquipment=sanitizeEquipment(payload?.equipment||target.equipment);
    const cleanOwned=sanitizeOwnedArmor(payload?.ownedArmor||target.ownedArmor);
    target.equipment=cleanEquipment;
    target.ownedArmor=cleanOwned;
    applyEquipment(target);
    const cached=multiplayer.loadoutByPlayerId.get(target.id);
    if(cached){
      cached.equipment={...cleanEquipment};
      cached.ownedArmor=[...cleanOwned];
    }
    return applied;
  };

  const baseMakeMultiplayerLoadoutPayload=makeMultiplayerLoadoutPayload;
  makeMultiplayerLoadoutPayload=function(){
    const payload=baseMakeMultiplayerLoadoutPayload();
    if(!payload||!player)return payload;
    payload.equipment=sanitizeEquipment(player.equipment);
    payload.ownedArmor=sanitizeOwnedArmor(player.ownedArmor);
    return payload;
  };

  const baseMakeLoadoutRoster=makeLoadoutRoster;
  makeLoadoutRoster=function(){
    const roster=baseMakeLoadoutRoster();
    for(const entry of roster?.players||[]){
      const member=players.get(entry.playerId);
      entry.equipment=sanitizeEquipment(member?.equipment);
      entry.ownedArmor=sanitizeOwnedArmor(member?.ownedArmor);
    }
    return roster;
  };

  const baseRenderWeapons=renderWeapons;
  renderWeapons=function(){
    baseRenderWeapons();
    const visible=Object.entries(WEAPONS).filter(([id,weapon])=>!weapon.admin&&(!weapon.fusion||player?.weaponSlots?.includes(id)));
    [...document.querySelectorAll("#weaponGrid .card")].forEach((card,index)=>{
      const weapon=visible[index]?.[1];
      if(!weapon||card.querySelector(".lw98-dps"))return;
      const badge=document.createElement("span");
      badge.className="lw98-dps";
      badge.textContent=`지속 DPS ${formatNumber(directDps(weapon))}`;
      card.querySelector("p")?.append(badge);
    });
  };

  const baseRenderMelee=renderMelee;
  renderMelee=function(){
    baseRenderMelee();
    const entries=Object.entries(MELEE_WEAPONS);
    [...document.querySelectorAll("#meleeGrid .card")].forEach((card,index)=>{
      const weapon=entries[index]?.[1];
      if(!weapon||card.querySelector(".lw98-dps"))return;
      const badge=document.createElement("span");
      badge.className="lw98-dps";
      badge.textContent=`지속 DPS ${formatNumber(meleeDps(weapon))}`;
      card.querySelector("p")?.append(badge);
    });
  };

  installEquipmentUi();
  window.__lastWaveV98={
    version:98,
    ARMOR,
    slotNames,
    defaults,
    directDps,
    meleeDps,
    resetEquipment,
    applyEquipment,
    renderEquipment
  };
})();
