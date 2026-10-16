/* Last Wave v113: one price-based combat model, transparent supply draws. */
(() => {
  "use strict";
  const DRAW_COST=900;
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
  function odds(owner=player){
    const pool=Object.entries(WEAPONS).filter(([id,w])=>!w.admin&&!w.replica&&!w.fusion&&w.cost>0&&!owner?.weaponSlots?.includes(id))
      .map(([id,w])=>({id,name:w.name,dps:combatDps(baseOwner(),id),weight:Math.pow(targetDps(w.cost),-3)}));
    const sum=pool.reduce((n,x)=>n+x.weight,0);
    return pool.map(x=>({...x,probability:x.weight/sum}));
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
      if(!owner.weaponSlots.includes(result.id))owner.weaponSlots.push(result.id);
      owner.activeSlot=owner.weaponSlots.indexOf(result.id);
      owner.weaponLevels[result.id]??=0;
      lastResult=result.name+" 획득! · 확률 "+(result.probability*100).toFixed(3)+"%";
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
    section.innerHTML='<div class="lw113-draw-art"></div><div><small>SUPPLY DROP</small><h3>무기 보급 상자</h3><p>게임 돈 '+formatNumber(DRAW_COST)+' · 강한 총일수록 낮은 확률 · 미보유 일반 총기만 등장</p><p aria-live="polite">'+lastResult+'</p><button id="lw113DrawButton" class="btn gold-btn">보급 상자 열기</button><details><summary>총기별 확률 · 남은 '+pool.length+'종</summary><p>기본 DPS의 세제곱에 반비례합니다. 획득한 총은 제외하고 확률을 다시 계산합니다. 합체·관리자 무기는 나오지 않습니다.</p><div class="lw113-odds"></div></details></div>';
    const list=section.querySelector(".lw113-odds");
    for(const entry of pool){
      const row=document.createElement("div");
      row.textContent=entry.name+" · 기본 DPS "+entry.dps.toFixed(1)+" · "+(entry.probability*100).toFixed(3)+"%";list.append(row);
    }
    const button=document.getElementById("lw113DrawButton");
    button.disabled=pending||state!=="waveComplete"||money<DRAW_COST||!pool.length;
    button.textContent=pending?"보급 승인 중…":!pool.length?"일반 총기 수집 완료":formatNumber(DRAW_COST)+" 보급 상자 열기";
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
  window.__lastWaveV113={version:113,totalCost,targetDps,combatDps,odds,select,drawGun,renderDraw,baseOwner};
})();

