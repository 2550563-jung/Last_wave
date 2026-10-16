/* Last Wave v113: one price-based combat model, transparent supply draws. */
(() => {
  "use strict";
  const DRAW_COST=2500;
  const DRAW_TIERS=[
    {id:"common",name:"일반",chance:.60},
    {id:"uncommon",name:"고급",chance:.25},
    {id:"rare",name:"희귀",chance:.12},
    {id:"legendary",name:"전설",chance:.03}
  ];
  const totalCost=id=>{
    const w=WEAPONS[id], recipe=FUSIONS.find(r=>r.id===id);
    return recipe ? recipe.cost+recipe.requires.reduce((n,key)=>n+(WEAPONS[key]?.cost||0),0) : w.cost;
  };
  const targetDps=cost=>63+Math.sqrt(Math.max(0,cost))*1.7;
  for(const [id,w] of Object.entries(WEAPONS)){
    if(w.admin||w.replica)continue;
    w.lw113Cost=totalCost(id);
    w.damage=targetDps(w.lw113Cost)/(w.rate*Math.max(1,w.pellets||1)*GLOBAL_WEAPON_DAMAGE_MULTIPLIER);
    if(w.fusion){
      w.pierce=Math.min(4,w.pierce||0);
      w.chain=Math.min(2,w.chain||0);
      w.blast=Math.min(100,w.blast||0);
    }
  }
  const ordered=Object.entries(WEAPONS).sort((a,b)=>
    Number(!!a[1].admin)-Number(!!b[1].admin)||
    Number(!!a[1].fusion)-Number(!!b[1].fusion)||
    (a[1].lw113Cost??a[1].cost)-(b[1].lw113Cost??b[1].cost)||a[0].localeCompare(b[0]));
  for(const key of Object.keys(WEAPONS))delete WEAPONS[key];
  for(const [id,w]of ordered)WEAPONS[id]=w;
  FUSIONS.sort((a,b)=>totalCost(a.id)-totalCost(b.id));

  function combatDps(owner,id){
    const s=getWeaponStats(owner,id),buff=owner?.buffs||{};
    const power=(owner?.weaponColors?.[id]||"power")==="power"?1.1:1;
    return s.damage*s.rate*s.pellets*(owner?.damageMult??1)*(1+(buff.damage||0))*
      (1+(buff.rate||0))*power*(1+Math.max(0,Math.min(1,.05+(buff.crit||0)))*.55);
  }
  const baseOwner=()=>({weaponLevels:{},unlockedEvolutions:{},weaponColors:{},buffs:{rate:0,damage:0,crit:0},damageMult:1});
  function odds(){
    const pool=Object.entries(WEAPONS).filter(([,w])=>!w.admin&&!w.replica&&!w.fusion&&w.cost>0)
      .map(([id,w])=>({id,name:w.name,dps:combatDps(baseOwner(),id)}))
      .sort((a,b)=>a.dps-b.dps||a.id.localeCompare(b.id));
    const tierWeights=DRAW_TIERS.map(()=>0);
    const weighted=pool.map((entry,index)=>{
      const tierIndex=Math.min(3,Math.floor(index*4/pool.length)),weight=1/entry.dps;
      tierWeights[tierIndex]+=weight;
      return {...entry,tierIndex,weight,tier:DRAW_TIERS[tierIndex].id,tierName:DRAW_TIERS[tierIndex].name};
    });
    const chanceSum=DRAW_TIERS.reduce((sum,tier,index)=>sum+(tierWeights[index]>0?tier.chance:0),0);
    return weighted.map(entry=>({...entry,probability:DRAW_TIERS[entry.tierIndex].chance/chanceSum*entry.weight/tierWeights[entry.tierIndex]}));
  }
  function select(pool,u){
    let remaining=Math.max(0,Math.min(.999999999999,u));
    for(const entry of pool){remaining-=entry.probability;if(remaining<0)return entry;}
    return pool[pool.length-1];
  }
  let pending=false,lastResult="아직 보급 상자를 열지 않았습니다.";
  function drawGun(){
    if(pending||!player||state!=="waveComplete")return false;
    const owner=player,pool=odds(owner);
    if(!pool.length)return false;
    pending=true;renderDraw();
    const denied=message=>{pending=false;lastResult=message||"돈이 부족합니다.";renderDraw();};
    return spendSharedRunMoney(DRAW_COST,"lw113:weapon-draw",()=>{
      pending=false;
      const randomValues=new Uint32Array(1);crypto.getRandomValues(randomValues);
      const result=select(pool,randomValues[0]/4294967296);
      const duplicate=owner.weaponSlots.includes(result.id);
      if(!duplicate)owner.weaponSlots.push(result.id);
      owner.activeSlot=owner.weaponSlots.indexOf(result.id);
      owner.weaponLevels[result.id]??=0;
      let upgradeText="";
      if(duplicate){
        const before=Math.max(0,Math.floor(Number(owner.weaponLevels[result.id])||0));
        const maxLevel=10+Math.max(0,Math.floor(Number(save.prestige)||0))*2;
        if(before<maxLevel){
          owner.weaponLevels[result.id]=before+1;
          upgradeText=" · 확정 강화 +"+before+" → +"+(before+1);
        }else upgradeText=" · 최대 강화 +"+before+" 유지";
      }
      lastResult=(duplicate?"중복 획득 · ":"새 무기 획득 · ")+result.name+" ["+result.tierName+"] · 확률 "+(result.probability*100).toFixed(3)+"%"+
        upgradeText;
      if(player===owner){
        notifyMultiplayerLoadoutChanged();playSfx("buy");
        syncShopEconomyUI({clearUpgradeResult:true});renderColors();
      }
      renderDraw();
    },denied);
  }
  function renderDraw(){
    let section=document.getElementById("lw113Draw");
    const grid=document.getElementById("weaponGrid");
    if(!grid)return;
    if(!section){
      section=document.createElement("section");section.id="lw113Draw";section.className="lw113-draw";
      grid.before(section);
    }
    const pool=odds();
    section.innerHTML='<div class="lw113-draw-art"></div><div><small>SUPPLY DROP</small><h3>무기 보급 상자</h3><p>게임 돈 '+formatNumber(DRAW_COST)+' · 중복 시 확정 +1 강화 · 강한 총일수록 낮은 확률</p><p>일반 60% · 고급 25% · 희귀 12% · 전설 3%</p><p aria-live="polite">'+lastResult+'</p><button id="lw113DrawButton" class="btn gold-btn">보급 상자 열기</button><details><summary>총기별 확률 · 전체 '+pool.length+'종 · 중복 포함</summary><p>기본 DPS 순으로 4개 등급을 나누며 같은 등급에서는 DPS에 반비례합니다. 보유 여부에 따라 확률이 바뀌지 않습니다. 중복은 해당 총을 확정 +1 강화하고 장착하며 색상과 슬롯 수를 유지합니다. 상점과 같은 최대 강화에 도달하면 추가 강화·환급은 없습니다. 합체·관리자 무기는 나오지 않습니다.</p><div class="lw113-odds"></div></details></div>';
    const list=section.querySelector(".lw113-odds");
    for(const entry of pool){
      const row=document.createElement("div");
      row.textContent="["+entry.tierName+"] "+entry.name+" · 기본 DPS "+entry.dps.toFixed(1)+" · "+(entry.probability*100).toFixed(3)+"%";list.append(row);
    }
    const button=document.getElementById("lw113DrawButton");
    button.disabled=pending||state!=="waveComplete"||money<DRAW_COST||!pool.length;
    button.textContent=pending?"보급 승인 중…":!pool.length?"뽑기 대상 없음":formatNumber(DRAW_COST)+" 보급 상자 열기";
    button.onclick=drawGun;
  }
  const baseRenderWeapons=renderWeapons;
  renderWeapons=function(){
    baseRenderWeapons();
    const entries=Object.entries(WEAPONS).filter(([id,w])=>!w.admin&&(!w.fusion||player?.weaponSlots?.includes(id)));
    document.querySelectorAll("#weaponGrid > .card").forEach((card,index)=>{
      const [id,w]=entries[index]||[];if(!w)return;
      card.dataset.weaponId=id;
      card.querySelectorAll(".lw98-dps").forEach(el=>el.remove());
      const badge=document.createElement("p");badge.className="lw113-dps";
      badge.textContent="기본 DPS "+combatDps(baseOwner(),id).toFixed(1)+" · 현재 DPS "+combatDps(player,id).toFixed(1);
      badge.title="현재 전투 계산의 피해·연사·산탄 수·강화·색상·치명타 기대값. 모든 탄이 한 표적에 명중하는 기준이며 헤드샷·보스 감쇠·상태이상·광역 추가 피해는 별도입니다.";
      card.querySelector("p")?.after(badge);
      const art=document.createElement("div");art.className="lw113-weapon-art";card.prepend(art);
      if(w.fusion){
        const cost=document.createElement("p");cost.textContent="총 제작비 "+formatNumber(totalCost(id))+" · 재료값 + 합체 비용";card.append(cost);
      }
    });
    renderDraw();
  };
  const baseRenderFusions=renderFusions;
  renderFusions=function(){
    baseRenderFusions();
    document.querySelectorAll("#fusionGrid > .card").forEach((card,index)=>{
      const recipe=FUSIONS[index];if(!recipe)return;
      const note=document.createElement("p");note.className="lw113-dps";
      note.textContent="총 제작비 "+formatNumber(totalCost(recipe.id))+" · 기본 DPS "+combatDps(baseOwner(),recipe.id).toFixed(1);
      card.append(note);
    });
  };
  document.getElementById("gameVersion").textContent="v113";
  if(window.__lastWaveCloudflare)window.__lastWaveCloudflare.releaseVersion=113;
  window.__lastWaveV113={version:113,totalCost,targetDps,combatDps,odds,select,drawGun,renderDraw,baseOwner,drawCost:DRAW_COST,drawTiers:DRAW_TIERS};
})();

