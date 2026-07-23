/* =========================================================
   LAST WAVE v92
   operations hub · revive · weekly verification · missions
   training · codex · build sharing · accessibility
========================================================= */
(() => {
  "use strict";

  const META_KEY="lastWaveV92Meta";
  const MOBILE_KEY="lastWaveV92MobileLayout";
  const WEEK_MS=7*24*60*60*1000;
  const REVIVE_RANGE=92;
  const REVIVE_TIME=2.8;
  const MAX_HISTORY=10;
  const DEFAULT_KEYS={
    auto:"KeyE",
    ultimate:"KeyQ",
    melee:"KeyF",
    dash:"ShiftLeft",
    revive:"KeyR"
  };
  const MODIFIERS={
    normal:{name:"표준 작전",desc:"기본 규칙으로 진행합니다."},
    horde:{name:"대규모 감염",desc:"적 수가 65% 증가하지만 처치 보상이 늘어납니다."},
    bossRush:{name:"보스 러시",desc:"모든 웨이브에 보스가 출현합니다."},
    noHeal:{name:"의료품 고갈",desc:"자연 회복이 사라지고 팀 부활만 가능합니다."},
    overdrive:{name:"오버드라이브",desc:"적 이동 속도와 점수 획득량이 증가합니다."}
  };

  const initialMeta={
    history:[],
    codex:{},
    bossCodex:{},
    missions:{daily:{key:"",items:[]},weekly:{key:"",items:[]}},
    claimed:{},
    accessibility:{colorMode:"default",effectOpacity:100,bossTelegraphs:true},
    keybinds:{...DEFAULT_KEYS},
    selectedModifier:"normal",
    desiredBuild:null
  };

  const lw92={
    meta:loadMeta(),
    runType:"normal",
    training:false,
    runRecorded:false,
    roomModifier:"normal",
    reviveTarget:null,
    verified:null,
    checkpointTimer:0,
    synergySignature:"",
    fps:60,
    frames:0,
    fpsAt:performance.now(),
    reconnects:0,
    spectator:false,
    spectatorChannel:null,
    overlayTab:"operations",
    lastKillCount:0,
    rankingDecision:null
  };
  let metaPersistTimer=0;

  const byId=id=>document.getElementById(id);
  const safe=value=>String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  const clamp92=(value,min,max)=>Math.max(min,Math.min(max,value));
  const nowIso=()=>new Date().toISOString();

  function loadMeta(){
    try{
      const stored=JSON.parse(localStorage.getItem(META_KEY)||"null")||{};
      return {
        ...initialMeta,
        ...stored,
        history:Array.isArray(stored.history)?stored.history.slice(0,MAX_HISTORY):[],
        codex:stored.codex&&typeof stored.codex==="object"?stored.codex:{},
        bossCodex:stored.bossCodex&&typeof stored.bossCodex==="object"?stored.bossCodex:{},
        missions:{...initialMeta.missions,...(stored.missions||{})},
        claimed:stored.claimed&&typeof stored.claimed==="object"?stored.claimed:{},
        accessibility:{...initialMeta.accessibility,...(stored.accessibility||{})},
        keybinds:{...DEFAULT_KEYS,...(stored.keybinds||{})}
      };
    }catch{
      return structuredClone(initialMeta);
    }
  }

  function persistMeta(immediate=false){
    const write=()=>{
      metaPersistTimer=0;
      try{localStorage.setItem(META_KEY,JSON.stringify(lw92.meta));}catch{}
    };
    if(immediate){
      clearTimeout(metaPersistTimer);
      write();
      return;
    }
    clearTimeout(metaPersistTimer);
    metaPersistTimer=setTimeout(write,120);
  }

  function koreaDayKey(date=new Date()){
    return new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"
    }).format(date);
  }

  function weekKey(date=new Date()){
    const kst=new Date(date.toLocaleString("en-US",{timeZone:"Asia/Seoul"}));
    const day=(kst.getDay()+6)%7;
    kst.setHours(0,0,0,0);
    kst.setDate(kst.getDate()-day);
    return koreaDayKey(kst);
  }

  function makeMissions(){
    const dailyKey=koreaDayKey();
    const weeklyKey=weekKey();
    if(lw92.meta.missions.daily?.key!==dailyKey){
      lw92.meta.missions.daily={
        key:dailyKey,
        items:[
          {id:"d_kills",label:"감염체 80마리 처치",type:"kills",goal:80,value:0,reward:1},
          {id:"d_wave",label:"웨이브 8 도달",type:"wave",goal:8,value:0,reward:1},
          {id:"d_revive",label:"팀원 1회 구조",type:"revives",goal:1,value:0,reward:1}
        ]
      };
    }
    if(lw92.meta.missions.weekly?.key!==weeklyKey){
      lw92.meta.missions.weekly={
        key:weeklyKey,
        items:[
          {id:"w_kills",label:"감염체 700마리 처치",type:"kills",goal:700,value:0,reward:4},
          {id:"w_boss",label:"보스 5마리 처치",type:"bossKills",goal:5,value:0,reward:4},
          {id:"w_runs",label:"작전 5회 종료",type:"runs",goal:5,value:0,reward:4}
        ]
      };
    }
    persistMeta();
  }

  function advanceMission(type,amount=1,absolute=false){
    for(const group of ["daily","weekly"]){
      for(const mission of lw92.meta.missions[group]?.items||[]){
        if(mission.type!==type) continue;
        mission.value=absolute
          ?Math.max(Number(mission.value)||0,Number(amount)||0)
          :Math.min(mission.goal,(Number(mission.value)||0)+(Number(amount)||0));
      }
    }
    persistMeta();
  }

  function claimMission(group,id){
    const bundle=lw92.meta.missions[group];
    const mission=bundle?.items?.find(item=>item.id===id);
    const claimKey=`${group}:${bundle?.key}:${id}`;
    if(!mission||mission.value<mission.goal||lw92.meta.claimed[claimKey]) return;
    lw92.meta.claimed[claimKey]=true;
    save.prism=(Number(save.prism)||0)+mission.reward;
    persist?.();
    persistMeta();
    renderMissions();
    showMessage("임무 보상 획득",`프리즘 +${mission.reward}`);
  }

  function ensureUi(){
    if(!byId("lw92OperationsButton")){
      const button=document.createElement("button");
      button.id="lw92OperationsButton";
      button.className="btn";
      button.type="button";
      button.textContent="작전 본부";
      const target=document.querySelector("#menu .menu-buttons");
      target?.insertBefore(button,byId("helpButton")||null);
    }

    if(!byId("lw92OperationsOverlay")){
      document.body.insertAdjacentHTML("beforeend",`
        <div id="lw92OperationsOverlay" class="overlay" aria-hidden="true">
          <div class="panel hero">
            <div class="eyebrow">LAST WAVE OPERATIONS</div>
            <h2>작전 본부</h2>
            <div class="lw92-tabs" role="tablist">
              <button class="btn active" data-lw92-tab="operations">작전</button>
              <button class="btn" data-lw92-tab="history">최근 기록</button>
              <button class="btn" data-lw92-tab="missions">임무</button>
              <button class="btn" data-lw92-tab="codex">도감</button>
              <button class="btn" data-lw92-tab="build">빌드 코드</button>
              <button class="btn" data-lw92-tab="settings">접근성·조작</button>
            </div>
            <section class="lw92-section active" data-lw92-section="operations">
              <div class="lw92-grid">
                <article class="lw92-card">
                  <h3>주간 고정 시드</h3>
                  <p>이번 주 모든 생존자가 같은 적 배치와 날씨 순서로 도전합니다.</p>
                  <small id="lw92WeekLabel"></small>
                  <div class="lw92-card-actions">
                    <button id="lw92WeeklyStart" class="btn gold-btn">주간 도전 시작</button>
                    <button id="lw92WeeklyRefresh" class="btn">주간 랭킹 새로고침</button>
                  </div>
                </article>
                <article class="lw92-card">
                  <h3>훈련장</h3>
                  <p>랭킹과 보상에 반영되지 않는 안전한 실험 공간입니다.</p>
                  <button id="lw92TrainingStart" class="btn primary">훈련 시작</button>
                </article>
                <article class="lw92-card">
                  <h3>방 규칙</h3>
                  <p>멀티플레이 방장이 선택하며 전원에게 동기화됩니다.</p>
                  <select id="lw92ModifierSelect"></select>
                  <small id="lw92ModifierDesc"></small>
                </article>
              </div>
              <div class="section-title">검증된 주간 랭킹</div>
              <div id="lw92WeeklyRanking" class="lw92-grid"></div>
            </section>
            <section class="lw92-section" data-lw92-section="history">
              <div id="lw92History" class="lw92-grid"></div>
            </section>
            <section class="lw92-section" data-lw92-section="missions">
              <div id="lw92Missions" class="lw92-grid"></div>
            </section>
            <section class="lw92-section" data-lw92-section="codex">
              <div id="lw92Codex" class="lw92-grid"></div>
            </section>
            <section class="lw92-section" data-lw92-section="build">
              <div class="lw92-card">
                <h3>현재 빌드 공유</h3>
                <p>코드를 복사하면 직업, 주무기, 보조무기와 궁극기 구성을 공유할 수 있습니다.</p>
                <textarea id="lw92BuildCode" class="lw92-code" spellcheck="false"></textarea>
                <div class="lw92-card-actions">
                  <button id="lw92ExportBuild" class="btn primary">현재 빌드 코드 만들기</button>
                  <button id="lw92CopyBuild" class="btn">복사</button>
                  <button id="lw92ImportBuild" class="btn gold-btn">코드 불러오기</button>
                </div>
                <small>불러온 빌드는 다음 작전의 직업 선택과 빌드 목표에 반영되며, 무기를 공짜로 지급하지 않습니다.</small>
              </div>
            </section>
            <section class="lw92-section" data-lw92-section="settings">
              <div id="lw92Settings"></div>
            </section>
            <div class="actions">
              <button id="lw92OperationsClose" class="btn">닫기</button>
            </div>
          </div>
        </div>
        <div id="lw92ReviveHud" aria-live="polite">
          <b id="lw92ReviveText">구조 중</b>
          <div class="lw92-progress"><i id="lw92ReviveFill"></i></div>
        </div>
        <div id="lw92TrainingBar">
          <b>훈련장 · 랭킹 제외</b>
          <button id="lw92TrainingDummy" class="btn">표적 추가</button>
          <button id="lw92TrainingBoss" class="btn">보스 추가</button>
          <button id="lw92TrainingExit" class="btn">훈련 종료</button>
        </div>`);
    }

    const modifier=byId("lw92ModifierSelect");
    if(modifier&&!modifier.options.length){
      for(const [id,item] of Object.entries(MODIFIERS)){
        modifier.add(new Option(item.name,id));
      }
    }

    const lobbyTools=byId("lw88LobbyTools");
    if(lobbyTools&&!byId("lw92RoomModifier")){
      lobbyTools.insertAdjacentHTML("beforeend",`
        <label class="lw92-setting-row">
          <span><b>방 변형 규칙</b><br><small id="lw92LobbyModifierDesc"></small></span>
          <select id="lw92RoomModifier"></select>
        </label>`);
      const select=byId("lw92RoomModifier");
      for(const [id,item] of Object.entries(MODIFIERS)) select.add(new Option(item.name,id));
    }

    bindUi();
    restoreMobileLayout();
    applyAccessibility();
    renderAll();
  }

  function bindUi(){
    if(document.body.dataset.lw92Bound) return;
    document.body.dataset.lw92Bound="1";
    byId("lw92OperationsButton")?.addEventListener("click",openOperations);
    byId("lw92OperationsClose")?.addEventListener("click",closeOperations);
    byId("lw92OperationsOverlay")?.addEventListener("click",event=>{
      if(event.target===byId("lw92OperationsOverlay")) closeOperations();
      const tab=event.target.closest?.("[data-lw92-tab]")?.dataset?.lw92Tab;
      if(tab) switchTab(tab);
      const claim=event.target.closest?.("[data-lw92-claim]");
      if(claim) claimMission(claim.dataset.group,claim.dataset.lw92Claim);
      const history=event.target.closest?.("[data-lw92-history]");
      if(history) useHistoryBuild(Number(history.dataset.lw92History));
      const copy=event.target.closest?.("[data-lw92-copy-history]");
      if(copy) copyHistoryBuild(Number(copy.dataset.lw92CopyHistory));
    });
    byId("lw92WeeklyStart")?.addEventListener("click",startWeekly);
    byId("lw92WeeklyRefresh")?.addEventListener("click",loadWeeklyRanking);
    byId("lw92TrainingStart")?.addEventListener("click",startTraining);
    byId("lw92TrainingDummy")?.addEventListener("click",()=>spawnTrainingTarget(false));
    byId("lw92TrainingBoss")?.addEventListener("click",()=>spawnTrainingTarget(true));
    byId("lw92TrainingExit")?.addEventListener("click",()=>returnToMenu());
    byId("lw92ExportBuild")?.addEventListener("click",()=>{
      byId("lw92BuildCode").value=encodeBuild(captureBuild());
    });
    byId("lw92CopyBuild")?.addEventListener("click",async()=>{
      const field=byId("lw92BuildCode");
      if(!field.value) field.value=encodeBuild(captureBuild());
      await navigator.clipboard?.writeText(field.value);
      showMessage("빌드 코드 복사","클립보드에 저장했습니다.");
    });
    byId("lw92ImportBuild")?.addEventListener("click",()=>importBuild(byId("lw92BuildCode").value));
    byId("lw92ModifierSelect")?.addEventListener("change",event=>setModifier(event.target.value,true));
    byId("lw92RoomModifier")?.addEventListener("change",event=>setModifier(event.target.value,true));

    addEventListener("pointerup",saveMobileLayout,{passive:true});
    addEventListener("resize",()=>restoreMobileLayout(),{passive:true});
  }

  function openOperations(){
    makeMissions();
    renderAll();
    showOverlay(byId("lw92OperationsOverlay"));
    byId("lw92OperationsOverlay")?.setAttribute("aria-hidden","false");
    loadWeeklyRanking();
  }

  function closeOperations(){
    hideOverlay(byId("lw92OperationsOverlay"));
    byId("lw92OperationsOverlay")?.setAttribute("aria-hidden","true");
  }

  function switchTab(tab){
    lw92.overlayTab=tab;
    document.querySelectorAll("[data-lw92-tab]").forEach(button=>{
      button.classList.toggle("active",button.dataset.lw92Tab===tab);
    });
    document.querySelectorAll("[data-lw92-section]").forEach(section=>{
      section.classList.toggle("active",section.dataset.lw92Section===tab);
    });
  }

  function renderAll(){
    byId("lw92WeekLabel")&&(byId("lw92WeekLabel").textContent=`주간 시드 ${weekKey()} · 월요일 00:00 KST 갱신`);
    const selected=lw92.meta.selectedModifier||"normal";
    if(byId("lw92ModifierSelect")) byId("lw92ModifierSelect").value=selected;
    if(byId("lw92RoomModifier")) byId("lw92RoomModifier").value=lw92.roomModifier||selected;
    updateModifierText();
    renderHistory();
    renderMissions();
    renderCodex();
    renderSettings();
  }

  function renderHistory(){
    const root=byId("lw92History");
    if(!root) return;
    if(!lw92.meta.history.length){
      root.innerHTML='<article class="lw92-card"><h3>아직 기록이 없습니다.</h3><p>작전을 종료하면 최근 10개의 빌드가 저장됩니다.</p></article>';
      return;
    }
    root.innerHTML=lw92.meta.history.map((entry,index)=>`
      <article class="lw92-card">
        <h3>${safe(entry.modeLabel)} · W${entry.wave}</h3>
        <p>${safe(entry.jobName)} · ${safe(entry.weaponName)}</p>
        <small>${Number(entry.score||0).toLocaleString()}점 · ${Number(entry.kills||0)} 처치 · ${new Date(entry.at).toLocaleString("ko-KR")}</small>
        <div class="lw92-card-actions">
          <button class="btn" data-lw92-history="${index}">이 빌드 목표로 사용</button>
          <button class="btn" data-lw92-copy-history="${index}">코드 복사</button>
        </div>
      </article>`).join("");
  }

  function renderMissions(){
    const root=byId("lw92Missions");
    if(!root) return;
    makeMissions();
    root.innerHTML=["daily","weekly"].map(group=>{
      const bundle=lw92.meta.missions[group];
      const title=group==="daily"?"일일 임무":"주간 임무";
      return `<article class="lw92-card"><h3>${title}</h3>${
        bundle.items.map(mission=>{
          const claimKey=`${group}:${bundle.key}:${mission.id}`;
          const done=mission.value>=mission.goal;
          const claimed=Boolean(lw92.meta.claimed[claimKey]);
          const percent=clamp92((mission.value/mission.goal)*100,0,100);
          return `<div class="lw92-setting-row"><div><b>${safe(mission.label)}</b>
            <div class="lw92-progress"><i style="width:${percent}%"></i></div>
            <small>${mission.value}/${mission.goal} · 프리즘 ${mission.reward}</small></div>
            <button class="btn" data-group="${group}" data-lw92-claim="${mission.id}" ${!done||claimed?"disabled":""}>${claimed?"수령 완료":"받기"}</button></div>`;
        }).join("")
      }</article>`;
    }).join("");
  }

  function renderCodex(){
    const root=byId("lw92Codex");
    if(!root) return;
    const entries=[
      ...Object.entries(lw92.meta.bossCodex).map(([id,item])=>({id,...item,boss:true})),
      ...Object.entries(lw92.meta.codex).map(([id,item])=>({id,...item,boss:false}))
    ].sort((a,b)=>Number(b.boss)-Number(a.boss)||b.kills-a.kills);
    root.innerHTML=entries.length?entries.map(item=>`
      <article class="lw92-card">
        <h3>${item.boss?"☠ ":""}${safe(item.name||item.id)}</h3>
        <p>${item.boss?"보스 개체":"감염 개체"} · 처치 ${Number(item.kills)||0}</p>
        <small>최초 발견 ${new Date(item.firstSeen).toLocaleDateString("ko-KR")}</small>
      </article>`).join(""):'<article class="lw92-card"><h3>도감이 비어 있습니다.</h3><p>적을 만나고 처치하면 정보가 기록됩니다.</p></article>';
  }

  function renderSettings(){
    const root=byId("lw92Settings");
    if(!root) return;
    const acc=lw92.meta.accessibility;
    root.innerHTML=`
      <article class="lw92-card">
        <h3>시각 접근성</h3>
        <label class="lw92-setting-row"><span>색각 모드</span><select id="lw92ColorMode">
          <option value="default">기본</option><option value="deuteranopia">적록 보정 1</option>
          <option value="protanopia">적록 보정 2</option><option value="tritanopia">청황 보정</option>
        </select></label>
        <label class="lw92-setting-row"><span>전투 효과 투명도</span><input id="lw92EffectOpacity" type="range" min="20" max="100" value="${Number(acc.effectOpacity)||100}"><b id="lw92EffectValue">${Number(acc.effectOpacity)||100}%</b></label>
        <label class="lw92-setting-row"><span>보스 공격 예고선</span><input id="lw92BossTelegraphs" type="checkbox" ${acc.bossTelegraphs!==false?"checked":""}></label>
      </article>
      <article class="lw92-card">
        <h3>키 설정</h3>
        ${Object.entries({auto:"자동 사격",ultimate:"궁극기",melee:"근접 공격",dash:"대시",revive:"팀원 구조"}).map(([id,label])=>`
          <label class="lw92-setting-row"><span>${label}</span><button class="btn" data-lw92-key="${id}">${safe(lw92.meta.keybinds[id]||DEFAULT_KEYS[id])}</button></label>`).join("")}
        <div class="lw92-card-actions"><button id="lw92ResetKeys" class="btn">기본 키로 복원</button><button id="lw92ResetMobile" class="btn">모바일 버튼 위치 초기화</button></div>
      </article>`;
    byId("lw92ColorMode").value=acc.colorMode||"default";
    byId("lw92ColorMode").onchange=event=>{
      lw92.meta.accessibility.colorMode=event.target.value;persistMeta();applyAccessibility();
    };
    byId("lw92EffectOpacity").oninput=event=>{
      lw92.meta.accessibility.effectOpacity=Number(event.target.value);
      byId("lw92EffectValue").textContent=`${event.target.value}%`;
      persistMeta();applyAccessibility();
    };
    byId("lw92BossTelegraphs").onchange=event=>{
      lw92.meta.accessibility.bossTelegraphs=event.target.checked;persistMeta();
    };
    root.querySelectorAll("[data-lw92-key]").forEach(button=>{
      button.onclick=()=>captureKey(button.dataset.lw92Key,button);
    });
    byId("lw92ResetKeys").onclick=()=>{lw92.meta.keybinds={...DEFAULT_KEYS};persistMeta();renderSettings();};
    byId("lw92ResetMobile").onclick=()=>{localStorage.removeItem(MOBILE_KEY);location.reload();};
  }

  function captureKey(action,button){
    button.textContent="키를 누르세요…";
    const listener=event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      lw92.meta.keybinds[action]=event.code;
      persistMeta();
      renderSettings();
    };
    addEventListener("keydown",listener,{capture:true,once:true});
  }

  function applyAccessibility(){
    const acc=lw92.meta.accessibility;
    document.body.classList.remove("lw92-color-deuteranopia","lw92-color-protanopia","lw92-color-tritanopia","lw92-reduced-effects");
    if(acc.colorMode&&acc.colorMode!=="default") document.body.classList.add(`lw92-color-${acc.colorMode}`);
    if(Number(acc.effectOpacity)<55) document.body.classList.add("lw92-reduced-effects");
    document.documentElement.style.setProperty("--lw92-effect-opacity",String(clamp92(Number(acc.effectOpacity)||100,20,100)/100));
  }

  function saveMobileLayout(){
    if(!IS_MOBILE) return;
    const ids=["moveStick","aimStick","dashButton","meleeButton","ultimateButton","autoMobileButton"];
    const result={};
    for(const id of ids){
      const el=byId(id);
      if(!el) continue;
      result[id]={
        left:el.style.left,right:el.style.right,top:el.style.top,bottom:el.style.bottom,
        transform:el.style.transform
      };
    }
    try{localStorage.setItem(MOBILE_KEY,JSON.stringify(result));}catch{}
  }

  function restoreMobileLayout(){
    if(!IS_MOBILE) return;
    try{
      const layout=JSON.parse(localStorage.getItem(MOBILE_KEY)||"{}");
      for(const [id,style] of Object.entries(layout)){
        const el=byId(id);
        if(!el) continue;
        for(const key of ["left","right","top","bottom","transform"]){
          if(typeof style[key]==="string") el.style[key]=style[key];
        }
      }
    }catch{}
  }

  function actionForCode(code){
    return Object.entries(lw92.meta.keybinds).find(([,value])=>value===code)?.[0]||"";
  }

  function executeAction(action){
    if(action==="auto") setAuto(!autoMode);
    else if(action==="ultimate") useUltimate();
    else if(action==="melee") useMelee();
    else if(action==="dash") dash();
  }

  addEventListener("keydown",event=>{
    if(event.repeat||isEditableInputTarget(event.target)) return;
    const action=actionForCode(event.code);
    if(!action||action==="revive") return;
    const original=DEFAULT_KEYS[action];
    if(event.code!==original){
      event.preventDefault();
      executeAction(action);
    }
  },{capture:true});

  function setModifier(id,broadcast=false){
    if(!MODIFIERS[id]) id="normal";
    lw92.meta.selectedModifier=id;
    if(!multiplayer?.active||multiplayer.isHost) lw92.roomModifier=id;
    persistMeta();
    updateModifierText();
    if(broadcast&&multiplayer?.active&&multiplayer.isHost&&multiplayer.channel){
      sendRoomEvent("lw92_modifier",{modifier:id},{silent:true});
    }
  }

  function updateModifierText(){
    const menuItem=MODIFIERS[lw92.meta.selectedModifier]||MODIFIERS.normal;
    const roomItem=MODIFIERS[lw92.roomModifier]||MODIFIERS.normal;
    if(byId("lw92ModifierDesc")) byId("lw92ModifierDesc").textContent=menuItem.desc;
    if(byId("lw92LobbyModifierDesc")) byId("lw92LobbyModifierDesc").textContent=roomItem.desc;
  }

  function applyModifierAtWave(){
    const id=lw92.roomModifier;
    if(id==="horde") spawnRemaining=Math.min(MAX_ENEMIES-5,Math.ceil(spawnRemaining*1.65));
    if(id==="bossRush"&&wave%10!==0) spawnBoss();
    if(id==="noHeal"){
      for(const member of players.values()) member.regen=0;
    }
    if(id==="overdrive") spawnRemaining=Math.min(MAX_ENEMIES-5,Math.ceil(spawnRemaining*1.18));
  }

  function applySynergy(){
    if(!multiplayer?.active) return;
    const living=[...players.values()].filter(member=>!member.dead);
    const jobs=new Set(living.map(member=>member.jobId||member.job||"soldier"));
    const signature=[...jobs].sort().join("|");
    if(signature===lw92.synergySignature) return;
    lw92.synergySignature=signature;
    const active=[];
    if(jobs.has("medic")&&jobs.has("guard")){
      active.push("의무병+경비원: 구조 속도 +35%");
    }
    if(jobs.has("engineer")&&jobs.has("scientist")){
      active.push("기술 연구망: 공격 속도 +8%");
      for(const member of living){
        if(member.lw92ResearchNetwork) continue;
        member.lw92ResearchNetwork=true;
        member.fireRateMult=(member.fireRateMult||1)*1.08;
      }
    }
    if(jobs.has("soldier")&&jobs.has("courier")){
      active.push("기동 타격대: 이동 속도 +7%");
      for(const member of living){
        if(member.lw92StrikeTeam) continue;
        member.lw92StrikeTeam=true;
        member.speed*=1.07;
      }
    }
    if(active.length) showMessage("팀 시너지 활성화",active.join(" · "));
  }

  function livingMembers(){
    return [...players.values()].filter(member=>member&&!member.dead&&!member.downed);
  }

  function updateRevive(dt){
    if(!multiplayer?.active||!multiplayer.isHost) return;
    const living=livingMembers();
    let localTarget=null;
    for(const downed of players.values()){
      if(!downed?.downed||downed.dead) continue;
      downed.downTimer=Math.max(0,(Number(downed.downTimer)||12)-dt);
      const rescuers=living.filter(member=>distance(member,downed)<=REVIVE_RANGE);
      const hasMedicGuard=[...players.values()].some(p=>(p.jobId||p.job)==="medic")&&[...players.values()].some(p=>(p.jobId||p.job)==="guard");
      const rate=rescuers.length*(hasMedicGuard?1.35:1);
      if(rate>0){
        downed.reviveProgress=Math.min(REVIVE_TIME,(Number(downed.reviveProgress)||0)+dt*rate);
        if(rescuers.some(member=>member.local)) localTarget=downed;
      }else{
        downed.reviveProgress=Math.max(0,(Number(downed.reviveProgress)||0)-dt*.2);
      }
      if(downed.reviveProgress>=REVIVE_TIME){
        downed.downed=false;
        downed.dead=false;
        downed.downTimer=0;
        downed.reviveProgress=0;
        downed.hp=Math.max(1,downed.maxHp*.45);
        downed.invincible=2;
        advanceMission("revives",1);
        showMessage("팀원 구조 완료",`${downed.nickname||"생존자"}가 전선에 복귀했습니다.`);
      }else if(downed.downTimer<=0){
        downed.downed=false;
        downed.dead=true;
        downed.hp=0;
      }
    }
    lw92.reviveTarget=localTarget;
    const hud=byId("lw92ReviveHud");
    if(localTarget){
      const percent=clamp92((localTarget.reviveProgress/REVIVE_TIME)*100,0,100);
      hud?.classList.add("show");
      if(byId("lw92ReviveText")) byId("lw92ReviveText").textContent=`${localTarget.nickname||"팀원"} 구조 중 · ${localTarget.downTimer.toFixed(1)}초`;
      if(byId("lw92ReviveFill")) byId("lw92ReviveFill").style.width=`${percent}%`;
    }else{
      hud?.classList.remove("show");
    }
    if(players.size&&[...players.values()].every(member=>member.dead)){
      finishRun();
    }
  }

  function captureBuild(source=player){
    const weapons=Array.isArray(source?.weapons)?source.weapons.map(item=>item.id||item.weaponId||item).filter(Boolean):[];
    return {
      v:1,
      job:source?.jobId||source?.job||save.selectedJob,
      weapon:source?.weaponId||source?.weapon?.id||weapons[0]||"pistol",
      weapons,
      melee:source?.meleeWeapon||"knife",
      ultimate:source?.selectedUltimate||source?.ultimateId||"",
      pets:Array.isArray(source?.petIds)?source.petIds:[],
      difficulty:typeof v82Difficulty!=="undefined"?v82Difficulty:"survivor"
    };
  }

  function encodeBuild(build){
    const bytes=new TextEncoder().encode(JSON.stringify(build));
    let binary="";
    bytes.forEach(byte=>binary+=String.fromCharCode(byte));
    return `LW1-${btoa(binary).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}`;
  }

  function decodeBuild(code){
    const clean=String(code||"").trim();
    if(!clean.startsWith("LW1-")) throw new Error("지원하지 않는 빌드 코드입니다.");
    const body=clean.slice(4).replaceAll("-","+").replaceAll("_","/");
    const binary=atob(body.padEnd(Math.ceil(body.length/4)*4,"="));
    const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
    const build=JSON.parse(new TextDecoder().decode(bytes));
    if(!build||build.v!==1||!JOBS[build.job]) throw new Error("빌드 코드가 손상되었습니다.");
    return build;
  }

  function importBuild(code){
    try{
      const build=decodeBuild(code);
      lw92.meta.desiredBuild=build;
      if(save.ownedJobs?.includes(build.job)){
        save.selectedJob=build.job;
        persist?.();
        renderJobs?.();
      }
      persistMeta();
      showMessage("빌드 불러오기 완료",`${JOBS[build.job]?.name||build.job} 구성을 다음 작전 목표로 설정했습니다.`);
    }catch(error){
      showMessage("빌드 코드 오류",error.message);
    }
  }

  function useHistoryBuild(index){
    const entry=lw92.meta.history[index];
    if(!entry) return;
    importBuild(encodeBuild(entry.build));
  }

  async function copyHistoryBuild(index){
    const entry=lw92.meta.history[index];
    if(!entry) return;
    await navigator.clipboard?.writeText(encodeBuild(entry.build));
    showMessage("빌드 코드 복사","최근 작전 빌드를 복사했습니다.");
  }

  function recordRun(reason){
    if(lw92.runRecorded||!player||lw92.training||wave<1) return;
    lw92.runRecorded=true;
    const build=captureBuild(player);
    const item={
      id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      at:nowIso(),
      reason,
      mode:lw92.runType,
      modeLabel:lw92.runType==="weekly"?"주간 도전":gameMode==="multi"?"멀티플레이":"일반 작전",
      wave:Number(wave)||0,
      score:Number(score)||0,
      kills:Number(player.kills)||0,
      jobName:JOBS[build.job]?.name||build.job,
      weaponName:WEAPONS?.[build.weapon]?.name||build.weapon,
      build
    };
    lw92.meta.history.unshift(item);
    lw92.meta.history=lw92.meta.history.slice(0,MAX_HISTORY);
    advanceMission("runs",1);
    persistMeta();
    if(lw92.runType==="weekly") finishVerifiedRun(item);
  }

  function discoverEnemy(enemy,killed=false){
    if(!enemy) return;
    const id=String(enemy.type||enemy.enemyType||enemy.kind||(enemy.boss?"boss":"unknown"));
    const target=enemy.boss?lw92.meta.bossCodex:lw92.meta.codex;
    target[id]??={name:enemy.name||ENEMY_TYPES?.[id]?.name||(enemy.boss?"감염 보스":id),kills:0,firstSeen:nowIso()};
    if(killed) target[id].kills=(Number(target[id].kills)||0)+1;
    persistMeta();
  }

  function startWeekly(){
    closeOperations();
    lw92.runType="weekly";
    lw92.training=false;
    lw92.roomModifier="normal";
    beginVerifiedRun();
    startRun("normal");
  }

  function startTraining(){
    closeOperations();
    lw92.runType="training";
    lw92.training=true;
    lw92.roomModifier="normal";
    startRun("normal");
    adminInvincible=true;
    money=99999;
    if(player){
      player.invincible=999999;
      player.maxHp=Math.max(player.maxHp,9999);
      player.hp=player.maxHp;
    }
    enemies.length=0;
    spawnRemaining=0;
    byId("lw92TrainingBar")?.classList.add("show");
    showMessage("훈련장 입장","피해와 랭킹이 비활성화되었습니다.");
    spawnTrainingTarget(false);
  }

  function spawnTrainingTarget(boss){
    if(!lw92.training||!player) return;
    const before=enemies.length;
    if(boss) spawnBoss(); else spawnEnemy();
    for(let i=before;i<enemies.length;i++){
      const enemy=enemies[i];
      enemy.x=player.x+260+(i-before)*55;
      enemy.y=player.y;
      enemy.speed=0;
      enemy.damage=0;
      enemy.maxHp=Math.max(Number(enemy.maxHp)||100,boss?100000:25000);
      enemy.hp=enemy.maxHp;
      enemy.trainingTarget=true;
      if(boss) enemy.boss=true;
    }
  }

  async function beginVerifiedRun(){
    if(!sbClient) return;
    try{
      const token=crypto.randomUUID()+crypto.randomUUID();
      const {data,error}=await sbClient.rpc("lw_begin_verified_run_v1",{
        p_player_id:save.playerId,
        p_mode:"weekly",
        p_seed_key:weekKey(),
        p_token:token
      });
      if(error) throw error;
      lw92.verified={id:Array.isArray(data)?data[0]:data,token,lastWave:0};
      lw92.checkpointTimer=0;
    }catch(error){
      console.warn("검증 세션 시작 실패",error);
      showMessage("검증 연결 지연","기록은 저장되지만 서버 검증 배지가 붙지 않을 수 있습니다.");
    }
  }

  async function checkpointVerified(){
    if(!lw92.verified||!sbClient||lw92.training) return;
    try{
      const {error}=await sbClient.rpc("lw_checkpoint_verified_run_v1",{
        p_run_id:lw92.verified.id,
        p_token:lw92.verified.token,
        p_wave:Math.max(1,Number(wave)||1),
        p_score:Math.max(0,Math.floor(Number(score)||0)),
        p_kills:Math.max(0,Math.floor(Number(player?.kills)||0))
      });
      if(error) throw error;
      lw92.verified.lastWave=wave;
    }catch(error){
      console.warn("검증 체크포인트 실패",error);
    }
  }

  async function finishVerifiedRun(entry){
    if(!lw92.verified||!sbClient) return;
    const verified=lw92.verified;
    lw92.verified=null;
    try{
      const {data,error}=await sbClient.rpc("lw_finish_verified_run_v1",{
        p_run_id:verified.id,
        p_token:verified.token,
        p_nickname:String(save.nickname||"SURVIVOR").slice(0,16),
        p_score:Math.max(0,Math.floor(entry.score)),
        p_wave:Math.max(1,Math.floor(entry.wave)),
        p_kills:Math.max(0,Math.floor(entry.kills)),
        p_job:String(entry.build.job||"soldier").slice(0,32),
        p_weapon:String(entry.build.weapon||"pistol").slice(0,32)
      });
      if(error) throw error;
      if(data===true) showMessage("검증된 주간 기록","서버 검증을 통과해 주간 랭킹에 등록했습니다.");
    }catch(error){
      console.warn("주간 기록 검증 실패",error);
      showMessage("주간 기록 보류","서버 검증 조건을 통과하지 못했거나 연결이 끊겼습니다.");
    }
  }

  async function loadWeeklyRanking(){
    const root=byId("lw92WeeklyRanking");
    if(!root||!sbClient) return;
    root.innerHTML='<article class="lw92-card">랭킹 불러오는 중…</article>';
    try{
      const {data,error}=await sbClient.rpc("lw_list_weekly_rankings_v1",{p_seed_key:weekKey(),p_limit:20});
      if(error) throw error;
      const rows=Array.isArray(data)?data:[];
      root.innerHTML=rows.length?rows.map((row,index)=>`
        <article class="lw92-card"><h3>#${index+1} ${safe(row.nickname)}</h3>
          <p>${Number(row.score).toLocaleString()}점 · W${row.wave} · ${row.kills} 처치</p>
          <small>${safe(row.job)} · ${safe(row.weapon)} <span class="lw92-verified">서버 검증</span></small>
        </article>`).join(""):'<article class="lw92-card">이번 주 등록된 기록이 없습니다.</article>';
    }catch(error){
      root.innerHTML=`<article class="lw92-card">주간 랭킹을 불러오지 못했습니다.<br><small>${safe(error.message)}</small></article>`;
    }
  }

  async function loadSpectatableRooms(){
    if(!sbClient) return [];
    const {data,error}=await sbClient.rpc("lw_list_spectatable_rooms_v1");
    if(error) throw error;
    return Array.isArray(data)?data:[];
  }

  async function connectSpectator(code){
    requireOnline();
    const clean=normalizeRoomCode(code);
    if(clean.length!==6) throw new Error("올바른 방 코드가 아닙니다.");
    await leaveMultiplayer();
    lw92.spectator=true;
    multiplayer.active=true;
    multiplayer.roomCode=clean;
    multiplayer.isHost=false;
    multiplayer.publicRoom=true;
    const channel=sbClient.channel(`last-wave-room-${clean}`,{
      config:{presence:{key:`spectator-${createId()}`},broadcast:{self:false,ack:false}}
    });
    lw92.spectatorChannel=channel;
    multiplayer.channel=channel;
    const acceptFrame=payload=>{
      if(!payload) return;
      try{
        multiplayer.hostId=payload?.__lw?.sender||multiplayer.hostId;
        if(payload.frameSeq!=null) applyWorldFrame(payload);
        else applyWorldSnapshot(payload);
        state="playing";
        paused=false;
        hideOverlay(ui.menu);hideOverlay(ui.multiMenu);hideOverlay(ui.lobby);
        byId("v82SpectatorHud")?.setAttribute("aria-hidden","false");
      }catch(error){console.warn("관전 프레임 적용 오류",error);}
    };
    channel.on("broadcast",{event:"world_frame"},({payload})=>acceptFrame(payload));
    channel.on("broadcast",{event:"snapshot"},({payload})=>acceptFrame(payload));
    channel.on("broadcast",{event:"projectiles"},({payload})=>{try{applyProjectileFrame(payload);}catch{}});
    channel.on("broadcast",{event:"loadout_roster"},({payload})=>{try{applyLoadoutRoster(payload);}catch{}});
    await new Promise((resolve,reject)=>{
      channel.subscribe(async status=>{
        if(status==="SUBSCRIBED"){
          await channel.track({spectator:true,nickname:save.nickname||"SPECTATOR",joinedAt:Date.now()});
          resolve();
        }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT") reject(new Error("관전 연결에 실패했습니다."));
      });
    });
    hideOverlay(ui.multiMenu);hideOverlay(ui.menu);hideOverlay(ui.lobby);
    state="playing";
    showMessage("관전 모드",`${clean} 방의 실시간 전투를 불러오는 중입니다.`);
  }

  async function addSpectatorRows(){
    const root=ui?.publicRoomList;
    if(!root) return;
    try{
      const rooms=await loadSpectatableRooms();
      if(!rooms.length) return;
      const heading=document.createElement("div");
      heading.className="section-title";
      heading.textContent="진행 중 공개 방 관전";
      root.append(heading);
      for(const room of rooms){
        const row=document.createElement("div");
        row.className="public-room-row";
        row.innerHTML=`<div><b>${safe(room.host_nickname||"HOST")}</b><br><small>${safe(room.room_code)} · W${Number(room.current_wave)||"?"}</small></div><span class="lw92-spectate-badge">LIVE</span>`;
        const button=document.createElement("button");
        button.className="btn";
        button.textContent="관전";
        button.onclick=()=>connectSpectator(room.room_code).catch(error=>reportRuntimeError(error,"공개 방 관전"));
        row.append(button);
        root.append(row);
      }
    }catch(error){
      console.warn("관전 방 목록 오류",error);
    }
  }

  function installRoomListeners(){
    const channel=multiplayer?.channel;
    if(!channel||channel.__lw92Bound) return;
    channel.__lw92Bound=true;
    channel.on("broadcast",{event:"lw92_modifier"},({payload})=>{
      if(!payload?.modifier||multiplayer.isHost) return;
      lw92.roomModifier=MODIFIERS[payload.modifier]?payload.modifier:"normal";
      updateModifierText();
      showMessage("방 규칙 동기화",MODIFIERS[lw92.roomModifier].name);
    });
    channel.on("broadcast",{event:"start_game"},({payload})=>{
      if(multiplayer.isHost||!payload?.lw92Modifier) return;
      lw92.roomModifier=MODIFIERS[payload.lw92Modifier]?payload.lw92Modifier:"normal";
      updateModifierText();
    });
  }

  function drawBossTelegraph(enemy){
    if(!enemy?.boss||lw92.meta.accessibility.bossTelegraphs===false) return;
    const opacity=clamp92(Number(lw92.meta.accessibility.effectOpacity)||100,20,100)/100;
    ctx.save();
    ctx.globalAlpha=.22*opacity;
    ctx.strokeStyle=enemy.phase===2?"#ffb23e":"#ff5470";
    ctx.lineWidth=5;
    ctx.setLineDash([14,10]);
    if(Number(enemy.skillTimer)<=1.2){
      const radius=enemy.phase===2?240:190;
      ctx.beginPath();
      ctx.arc(enemy.x,enemy.y,radius,0,Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha=.08*opacity;
      ctx.fillStyle=ctx.strokeStyle;
      ctx.fill();
    }
    if(Number(enemy.shootTimer)<=.65){
      const angle=Number(enemy.angle)||0;
      ctx.globalAlpha=.34*opacity;
      ctx.beginPath();
      ctx.moveTo(enemy.x,enemy.y);
      ctx.lineTo(enemy.x+Math.cos(angle)*520,enemy.y+Math.sin(angle)*520);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateDiagnostics(){
    lw92.frames++;
    const now=performance.now();
    if(now-lw92.fpsAt>=1000){
      lw92.fps=Math.round(lw92.frames*1000/(now-lw92.fpsAt));
      lw92.frames=0;
      lw92.fpsAt=now;
      const text=byId("lw88NetworkText");
      if(text&&!text.querySelector(".lw92-network-detail")){
        text.insertAdjacentHTML("beforeend",'<small class="lw92-network-detail"></small>');
      }
      const detail=text?.querySelector(".lw92-network-detail");
      if(detail){
        const stale=multiplayer?.lastPacketAt?Math.max(0,(performance.now()-multiplayer.lastPacketAt)/1000):0;
        const received=Number(window.__lw88Debug?.packetReceived||0);
        detail.textContent=`FPS ${lw92.fps} · 마지막 패킷 ${stale.toFixed(1)}초 · 재연결 ${lw92.reconnects}회${received?` · 수신 ${received}`:""}`;
      }
    }
  }

  const baseStartRun92=startRun;
  startRun=function(mode,...args){
    lw92.runRecorded=false;
    lw92.synergySignature="";
    lw92.lastKillCount=0;
    if(lw92.runType!=="weekly"&&lw92.runType!=="training") lw92.runType=mode==="multi"?"multi":"normal";
    if(mode==="multi") lw92.roomModifier=multiplayer.isHost?(lw92.meta.selectedModifier||"normal"):lw92.roomModifier;
    else if(lw92.runType!=="training") lw92.roomModifier=lw92.meta.selectedModifier||"normal";
    const result=baseStartRun92(mode,...args);
    if(lw92.runType==="weekly"&&wave===1){
      showMessage("주간 고정 시드",`${weekKey()} 시드로 시작했습니다.`);
    }
    byId("lw92TrainingBar")?.classList.toggle("show",lw92.training);
    return result;
  };

  const baseStartWave92=startWave;
  startWave=function(...args){
    if(wave===0&&lw92.runType==="weekly"){
      runRandom=seededRandom(stringHash(`LAST_WAVE_WEEKLY_${weekKey()}`));
    }
    const result=baseStartWave92(...args);
    applyModifierAtWave();
    advanceMission("wave",wave,true);
    applySynergy();
    return result;
  };

  const baseSpawnEnemy92=spawnEnemy;
  spawnEnemy=function(...args){
    const before=enemies.length;
    const result=baseSpawnEnemy92(...args);
    for(let index=before;index<enemies.length;index++){
      const enemy=enemies[index];
      discoverEnemy(enemy,false);
      if(lw92.roomModifier==="overdrive") enemy.speed*=1.22;
      if(lw92.training){enemy.speed=0;enemy.damage=0;}
    }
    return result;
  };

  const baseSpawnBoss92=spawnBoss;
  spawnBoss=function(...args){
    const before=enemies.length;
    const result=baseSpawnBoss92(...args);
    for(let index=before;index<enemies.length;index++) discoverEnemy(enemies[index],false);
    return result;
  };

  const baseKillEnemy92=killEnemy;
  killEnemy=function(enemy,owner,...args){
    const wasAlive=Boolean(enemy&&!enemy.dead);
    const result=baseKillEnemy92(enemy,owner,...args);
    if(wasAlive&&enemy?.dead){
      discoverEnemy(enemy,true);
      advanceMission("kills",1);
      if(enemy.boss) advanceMission("bossKills",1);
      if(lw92.roomModifier==="horde") score+=Math.max(1,Math.floor((Number(enemy.score)||10)*.2));
      if(lw92.roomModifier==="overdrive") score+=Math.max(1,Math.floor((Number(enemy.score)||10)*.35));
    }
    return result;
  };

  const baseUpdatePlayer92=updatePlayer;
  updatePlayer=function(owner,dt,...args){
    if(owner?.downed){
      owner.motion=0;
      owner.fireTimer=Math.max(owner.fireTimer||0,.25);
      owner.meleeCooldown=Math.max(owner.meleeCooldown||0,.25);
      if(owner.local) input.firing=false;
      return;
    }
    const beforeHp=Number(owner?.hp)||0;
    const result=baseUpdatePlayer92(owner,dt,...args);
    if(owner&&lw92.roomModifier==="noHeal"&&owner.hp>beforeHp&&!owner.invincible){
      owner.hp=beforeHp;
    }
    return result;
  };

  const baseDrawEnemy92=drawEnemy;
  drawEnemy=function(enemy,...args){
    drawBossTelegraph(enemy);
    return baseDrawEnemy92(enemy,...args);
  };

  const baseUpdate92=update;
  update=function(dt,...args){
    const result=baseUpdate92(dt,...args);
    if(state==="playing"){
      updateRevive(dt);
      applySynergy();
      installRoomListeners();
      if(lw92.verified){
        lw92.checkpointTimer+=dt;
        if(lw92.checkpointTimer>=45){
          lw92.checkpointTimer=0;
          checkpointVerified();
        }
      }
    }
    return result;
  };

  const baseDraw92=draw;
  draw=function(...args){
    const result=baseDraw92(...args);
    updateDiagnostics();
    return result;
  };

  const baseFinishRun92=finishRun;
  finishRun=function(...args){
    recordRun("finish");
    return baseFinishRun92(...args);
  };

  const baseReturnToMenu92=returnToMenu;
  returnToMenu=function(...args){
    recordRun("menu");
    const previousRunType=lw92.runType;
    lw92.training=false;
    lw92.verified=null;
    lw92.spectator=false;
    byId("lw92TrainingBar")?.classList.remove("show");
    byId("lw92ReviveHud")?.classList.remove("show");
    byId("v82SpectatorHud")?.setAttribute("aria-hidden","true");
    /*
      v91's menu cleanup submits terminal rankings synchronously before it
      returns. Keep the special mode visible during that call so training,
      weekly challenges and spectators cannot leak into the normal board.
    */
    lw92.runType=previousRunType;
    const result=baseReturnToMenu92(...args);
    lw92.runType="normal";
    return result;
  };

  const baseSubmitRanking92=submitRanking;
  submitRanking=function(options={}){
    lw92.rankingDecision={
      training:lw92.training,
      runType:lw92.runType,
      spectator:lw92.spectator,
      at:Date.now()
    };
    if(lw92.training||["weekly","training"].includes(lw92.runType)||lw92.spectator){
      lw92.rankingDecision.skipped=true;
      return Promise.resolve({
        skipped:true,
        reason:lw92.training||lw92.runType==="training"?"training":"separate_verified_mode"
      });
    }
    lw92.rankingDecision.skipped=false;
    return baseSubmitRanking92(options);
  };

  const baseLoadPublicRooms92=loadPublicRooms;
  loadPublicRooms=async function(...args){
    const result=await baseLoadPublicRooms92(...args);
    await addSpectatorRows();
    return result;
  };

  const baseConnectRealtime92=connectRealtimeRoom;
  connectRealtimeRoom=async function(...args){
    const result=await baseConnectRealtime92(...args);
    installRoomListeners();
    if(multiplayer.isHost) setModifier(lw92.meta.selectedModifier||"normal",true);
    return result;
  };

  const baseSendCriticalRoomEvent92=sendCriticalRoomEvent;
  sendCriticalRoomEvent=function(event,payload={},...args){
    if(event==="start_game"){
      baseSendCriticalRoomEvent92(
        "lw92_modifier",
        {modifier:lw92.roomModifier||"normal"}
      );
      payload={...payload,lw92Modifier:lw92.roomModifier||"normal"};
    }
    return baseSendCriticalRoomEvent92(event,payload,...args);
  };

  const baseScheduleReconnect92=typeof scheduleRealtimeReconnect==="function"?scheduleRealtimeReconnect:null;
  if(baseScheduleReconnect92){
    scheduleRealtimeReconnect=function(...args){
      lw92.reconnects++;
      return baseScheduleReconnect92(...args);
    };
  }

  addEventListener("DOMContentLoaded",ensureUi,{once:true});
  addEventListener("pagehide",()=>{
    recordRun("pagehide");
    persistMeta(true);
  });
  if(document.readyState!=="loading") ensureUi();
  makeMissions();

  window.__lastWaveV92={
    state:lw92,
    weekKey,
    encodeBuild,
    decodeBuild,
    connectSpectator,
    loadSpectatableRooms,
    recordRun,
    updateRevive,
    setModifier,
    captureBuild
  };
})();
