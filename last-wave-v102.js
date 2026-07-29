/* Last Wave v102
 * - 모든 전투 카탈로그를 기본/약한 장비부터 강한 장비 순서로 표시합니다.
 * - 총기, 근접 무기, 방어구, 직업의 등급색과 가격 상태 표시를 통일합니다.
 * - 화폐는 기존 규칙을 유지합니다: 전투 장비는 게임 돈, 직업은 프리즘입니다.
 */
(() => {
  "use strict";

  const tierNames={
    basic:"기본",
    common:"일반",
    uncommon:"고급",
    rare:"희귀",
    epic:"특급",
    legendary:"전설",
    fusion:"합체",
    special:"특수"
  };
  const armorDefaults={
    helmet:"wornHelmet",
    chest:"wornChest",
    legs:"wornLegs",
    boots:"wornBoots"
  };

  function number(value){
    return Number.isFinite(Number(value))?Number(value):0;
  }

  function formatPrice(cost,currency){
    const amount=formatNumber(Math.max(0,Math.round(number(cost))));
    return currency==="prism" ? `${amount} 프리즘` : `₩${amount}`;
  }

  function rangedPower(item){
    if(window.__lastWaveV98?.directDps)return window.__lastWaveV98.directDps(item);
    return number(item.damage)*Math.max(.05,number(item.rate))*Math.max(1,number(item.pellets)||1);
  }

  function meleePower(item){
    if(window.__lastWaveV98?.meleeDps)return window.__lastWaveV98.meleeDps(item);
    return number(item.damage)/Math.max(.05,number(item.cooldown)||1);
  }

  function armorPower(item){
    const stats=item?.stats||{};
    return (
      number(stats.maxHp)+
      number(stats.shield)*.62+
      number(stats.armor)*400+
      number(stats.speed)*180+
      number(stats.damage)*280+
      number(stats.rate)*220+
      number(stats.crit)*210+
      number(stats.dodge)*300+
      number(stats.pickup)*28+
      number(stats.skillCooldown)*180+
      number(stats.dashCooldown)*150
    );
  }

  function reorderObject(object,defaultId,score){
    if(!object)return;
    const entries=Object.entries(object);
    const first=entries.find(([id])=>id===defaultId);
    const rest=entries
      .filter(([id])=>id!==defaultId)
      .sort((a,b)=>score(a[1])-score(b[1])||number(a[1].cost)-number(b[1].cost)||a[1].name.localeCompare(b[1].name,"ko"));
    for(const key of Object.keys(object))delete object[key];
    if(first)object[first[0]]=first[1];
    for(const [id,item] of rest)object[id]=item;
  }

  function reorderArmor(){
    const armor=window.__lastWaveV98?.ARMOR;
    if(!armor)return;
    for(const [slot,items] of Object.entries(armor)){
      const defaultId=armorDefaults[slot];
      items.sort((a,b)=>{
        if(a.id===defaultId)return-1;
        if(b.id===defaultId)return 1;
        return armorPower(a)-armorPower(b)||number(a.cost)-number(b.cost)||a.name.localeCompare(b.name,"ko");
      });
    }
  }

  function tierByRank(index,total,item={}){
    if(item.admin||item.replica)return"special";
    if(item.fusion)return"fusion";
    if(item.rarity==="basic")return"basic";
    if(number(item.cost)<=0)return"basic";
    const ratio=total<=1?0:index/(total-1);
    if(ratio<=.18)return"common";
    if(ratio<=.38)return"uncommon";
    if(ratio<=.62)return"rare";
    if(ratio<=.84)return"epic";
    return"legendary";
  }

  function priceState({owned,equipped,cost,balance,currency}){
    const affordable=number(balance)>=number(cost);
    if(owned){
      return {
        className:"owned",
        text:equipped?"현재 장착 중":"보유 중"
      };
    }
    return affordable
      ? {className:"can-buy",text:`구매 가능 · ${formatPrice(cost,currency)}`}
      : {className:"cannot-buy",text:`구매 불가 · ${formatPrice(number(cost)-number(balance),currency)} 부족`};
  }

  function decorateCard(card,{tier,owned,equipped,cost,balance,currency="money",allowPurchase=true}){
    if(!card)return;
    card.classList.add("catalog-card",`catalog-tier-${tier}`);
    card.querySelector(":scope > .catalog-rarity-badge")?.remove();

    const badge=document.createElement("span");
    badge.className="catalog-rarity-badge";
    badge.textContent=tierNames[tier]||tierNames.common;
    const title=card.querySelector("h3,h4");
    if(title)title.insertAdjacentElement("beforebegin",badge);
    else card.prepend(badge);

    const state=priceState({owned,equipped,cost,balance,currency});
    let stateNode=card.querySelector(".weapon-price-state");
    if(!stateNode){
      stateNode=document.createElement("span");
      (card.querySelector("p")||title||card).append(stateNode);
    }
    stateNode.className=`weapon-price-state ${state.className}`;
    stateNode.textContent=state.text;

    const button=card.querySelector("button");
    if(!button)return;
    if(owned){
      button.className="btn";
      button.textContent=equipped?"장착 중":"장착";
      button.disabled=Boolean(equipped)||!allowPurchase;
    }else{
      button.className="btn primary";
      button.textContent=`${formatPrice(cost,currency)} 구매`;
      button.disabled=number(balance)<number(cost)||!allowPurchase;
    }
  }

  function decorateWeapons(){
    const entries=Object.entries(WEAPONS)
      .filter(([id,item])=>!item.admin&&(!item.fusion||player?.weaponSlots?.includes(id)))
      .map(([id,item])=>({id,item}));
    const cards=[...document.querySelectorAll("#weaponGrid > .card")];
    cards.forEach((card,index)=>{
      const entry=entries[index];
      if(!entry)return;
      const owned=Boolean(player?.weaponSlots?.includes(entry.id));
      decorateCard(card,{
        tier:tierByRank(index,entries.length,entry.item),
        owned,
        equipped:owned&&getWeaponId()===entry.id,
        cost:entry.item.cost,
        balance:money
      });
    });
  }

  function decorateMelee(){
    const entries=Object.entries(MELEE_WEAPONS);
    const cards=[...document.querySelectorAll("#meleeGrid > .card")];
    cards.forEach((card,index)=>{
      const [id,item]=entries[index]||[];
      if(!item)return;
      const owned=Boolean(player?.ownedMelee?.includes(id));
      decorateCard(card,{
        tier:tierByRank(index,entries.length,item),
        owned,
        equipped:owned&&player?.meleeWeapon===id,
        cost:item.cost,
        balance:money
      });
    });
  }

  function decorateJobs(){
    const entries=Object.entries(JOBS);
    const cards=[...ui.jobGrid.querySelectorAll(".job-card")];
    cards.forEach((card,index)=>{
      const [id,job]=entries[index]||[];
      if(!job)return;
      const owned=save.ownedJobs.includes(id);
      decorateCard(card,{
        tier:tierByRank(index,entries.length,job),
        owned,
        equipped:owned&&save.selectedJob===id,
        cost:job.cost,
        balance:save.prism,
        currency:"prism"
      });
      card.dataset.jobId=id;
    });
  }

  function decorateArmor(catalog=document.getElementById("lw98ArmorCatalog")){
    const armor=window.__lastWaveV98?.ARMOR;
    if(!catalog||!armor||!player)return;
    const equipment=player.equipment||{};
    const ownedArmor=Array.isArray(player.ownedArmor)?player.ownedArmor:[];
    const allowPurchase=state==="waveComplete";

    [...catalog.querySelectorAll(".lw98-armor-group")].forEach((group,groupIndex)=>{
      const [slot,items]=Object.entries(armor)[groupIndex]||[];
      if(!slot||!items)return;
      const cards=[...group.querySelectorAll(".lw98-armor-card")];
      cards.forEach((card,index)=>{
        const item=items[index];
        if(!item)return;
        const owned=ownedArmor.includes(item.id)||number(item.cost)<=0;
        const equipped=equipment[slot]===item.id;
        const tier=tierByRank(index,items.length,item);
        card.className=`lw98-armor-card catalog-card catalog-tier-${tier}${equipped?" equipped":""}`;
        card.querySelector(".lw98-rarity")?.remove();
        decorateCard(card,{
          tier,
          owned,
          equipped,
          cost:item.cost,
          balance:money,
          allowPurchase
        });
      });
    });
  }

  reorderObject(WEAPONS,"pistol",rangedPower);
  reorderObject(MELEE_WEAPONS,"wornSword",meleePower);
  reorderObject(JOBS,"soldier",item=>number(item.cost));
  reorderArmor();

  const previousRenderWeapons=renderWeapons;
  renderWeapons=function(...args){
    const result=previousRenderWeapons(...args);
    decorateWeapons();
    return result;
  };

  const previousRenderMelee=renderMelee;
  renderMelee=function(...args){
    const result=previousRenderMelee(...args);
    decorateMelee();
    return result;
  };

  const previousRenderJobs=renderJobs;
  renderJobs=function(...args){
    const result=previousRenderJobs(...args);
    decorateJobs();
    return result;
  };

  const previousSyncShopEconomyUI=syncShopEconomyUI;
  syncShopEconomyUI=function(...args){
    const result=previousSyncShopEconomyUI(...args);
    window.__lastWaveV98?.renderEquipment?.();
    decorateArmor();
    return result;
  };

  window.__lastWaveV102={
    version:102,
    rangedPower,
    meleePower,
    armorPower,
    formatPrice,
    priceState,
    tierByRank,
    decorateArmor
  };

  if(document.getElementById("gameVersion"))document.getElementById("gameVersion").textContent="v102";
  if(player){
    renderWeapons();
    renderMelee();
    window.__lastWaveV98?.renderEquipment?.();
  }
  renderJobs();
})();
