/* LAST WAVE v129: calm screens, HUD collision layout, and exit protection. */
(() => {
  "use strict";
  const byId=id=>document.getElementById(id);
  const liveRun=()=>state!=="menu"&&!runEnded;
  const shown=el=>{
    if(!el)return false;
    const style=getComputedStyle(el);
    return style.display!=="none"&&style.visibility!=="hidden";
  };
  const modalOpen=()=>[...document.querySelectorAll(".overlay")].some(el=>el.id!=="lw88ExitDialog"&&shown(el));

  /* ---------- Combat HUD only while actually fighting ---------- */
  // Fixed anchors are placed first and never moved; the rest give way to them.
  const ANCHORS=["moveStick","aimStick","ultimateButton","dashButton","meleeButton","pauseButton","adminFloatingButton"];
  const FLOATING=["stats","weaponHud","bossHud","missionHud","dangerHud","lw88NetworkHud","networkHud","effects","timeHud",
    "lw97SkillDock","v56EventHud","lw108DirectorHud","lw108ComboHud","message","lw121Hint","lw125Tip"];
  // When there is truly no room, these are the ones that step aside.
  const OPTIONAL=new Set(["lw108DirectorHud","lw108ComboHud","v56EventHud","lw121Hint","lw125Tip","message"]);
  let calm=null;
  function updateCalm(){
    const next=state==="menu"||runEnded||paused||state!=="playing"||modalOpen();
    if(next===calm)return;
    calm=next;
    document.body.classList.toggle("lw129-calm",calm);
    if(!calm)layout();
  }

  /* ---------- Collision layout ---------- */
  const GAP=4;
  const hits=(a,b)=>a.left<b.right+GAP&&a.right>b.left-GAP&&a.top<b.bottom+GAP&&a.bottom>b.top-GAP;
  function natural(el){
    const r=el.getBoundingClientRect(),dx=Number(el.dataset.lw129x)||0,dy=Number(el.dataset.lw129y)||0;
    return {left:r.left-dx,right:r.right-dx,top:r.top-dy,bottom:r.bottom-dy,width:r.width,height:r.height};
  }
  // Sliding into place would make the next measurement read a half-way position.
  function noSlide(el){
    if(el.dataset.lw129slide)return;
    el.dataset.lw129slide="1";
    const list=getComputedStyle(el).transitionProperty.split(",").map(s=>s.trim());
    const kept=list.flatMap(name=>name==="all"?["opacity","transform","scale","background-color","color","border-color","box-shadow","filter"]:name==="translate"?[]:[name]);
    el.style.transitionProperty=kept.join(",")||"none";
  }
  function place(el,dx,dy){
    if((Number(el.dataset.lw129x)||0)===dx&&(Number(el.dataset.lw129y)||0)===dy)return;
    el.dataset.lw129x=dx;el.dataset.lw129y=dy;
    el.style.translate=dx||dy?`${dx}px ${dy}px`:"";
  }
  function layout(){
    if(calm)return;
    const W=innerWidth,H=innerHeight,placed=[];
    for(const id of ANCHORS){
      const el=byId(id);
      if(shown(el)){const r=el.getBoundingClientRect();if(r.width>2&&r.height>2)placed.push(r);}
    }
    for(const id of FLOATING){
      const el=byId(id);
      if(!el)continue;
      el.classList.remove("lw129-nofit");
      if(!shown(el)){place(el,0,0);continue;}
      noSlide(el);
      const r=natural(el);
      if(r.width<2||r.height<2){place(el,0,0);continue;}
      // Keep inside the screen sideways.
      let dx=0;
      if(r.right>W-2)dx=W-2-r.right;
      if(r.left+dx<2)dx=2-r.left;
      const box=(y)=>({left:r.left+dx,right:r.right+dx,top:r.top+y,bottom:r.bottom+y});
      const fits=y=>{const b=box(y);return b.top>=0&&b.bottom<=H&&!placed.some(o=>hits(b,o));};
      // Try the natural spot, then the nearest free spot below or above.
      let best=null;
      const candidates=[0];
      for(const o of placed){candidates.push(o.bottom+GAP+1-r.top,o.top-GAP-1-r.bottom);}
      candidates.sort((a,b)=>Math.abs(a)-Math.abs(b));
      for(const y of candidates){if(fits(y)){best=y;break;}}
      if(best===null){
        if(OPTIONAL.has(id)){el.classList.add("lw129-nofit");place(el,0,0);continue;}
        best=0;
      }
      place(el,Math.round(dx),Math.round(best));
      const b=box(best);placed.push(b);
    }
  }
  let layoutTimer=0;
  const schedule=()=>{cancelAnimationFrame(layoutTimer);layoutTimer=requestAnimationFrame(layout);};
  addEventListener("resize",schedule,{passive:true});
  addEventListener("orientationchange",()=>setTimeout(schedule,250),{passive:true});
  setInterval(()=>{updateCalm();if(!calm)layout();},150);

  /* ---------- Closing the tab during a run asks first ---------- */
  addEventListener("beforeunload",event=>{
    if(!liveRun())return;
    event.preventDefault();
    event.returnValue="";
    return "";
  });

  updateCalm();
  window.__lastWaveV129={layout,updateCalm,get calm(){return calm;}};
})();
