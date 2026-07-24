/* =========================================================
   LAST WAVE v93
   navigation · ready check · network telemetry · secure room RPC v2
   quick pings · reconnect resume · team results · adaptive quality
========================================================= */
(() => {
  "use strict";

  const V88_ROOM_KEY="lastWaveV88RoomResume";
  const v88={
    ready:new Map(),
    stats:new Map(),
    packetReceived:0,
    packetMissing:0,
    lastFrameSeq:0,
    lastStatsSentAt:0,
    listeners:new WeakSet(),
    overlayStack:[],
    allowExit:false,
    historyArmed:false,
    roomToken:"",
    pingCooldownUntil:0,
    rankingRunId:"",
    rankingSubmittedRunId:"",
    rankingSubmission:null
  };

  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);
  const visible=el=>Boolean(el&&getComputedStyle(el).display!=="none");
  const activeOverlays=()=>[...document.querySelectorAll(".overlay")]
    .filter(el=>visible(el)&&el.id!=="menu"&&el.id!=="errorOverlay"&&el.id!=="lw88ExitDialog")
    .map((element,index)=>({
      element,index,
      zIndex:Number.parseInt(getComputedStyle(element).zIndex,10)||0
    }))
    .sort((a,b)=>a.zIndex-b.zIndex||a.index-b.index)
    .map(entry=>entry.element);

  function ensureV88Ui(){
    if(!byId("lw88NetworkHud")){
      document.body.insertAdjacentHTML("beforeend",`
        <div id="lw88NetworkHud" aria-live="polite">
          <div class="lw88-net-title"><span>NETWORK</span><i class="lw88-net-dot"></i></div>
          <div id="lw88NetworkText">연결 대기</div>
          <div id="lw88QuickPings">
            <button class="btn" data-ping="danger">⚠ 위험</button>
            <button class="btn" data-ping="gather">⌖ 집결</button>
            <button class="btn" data-ping="boss">◎ 보스</button>
          </div>
        </div>
        <div id="lw88ReconnectBanner" role="status">연결 복구 중 · 게임 상태를 유지합니다</div>
        <div id="lw88ExitDialog" class="overlay">
          <div class="panel" style="max-width:420px">
            <div class="eyebrow">EXIT LAST WAVE</div>
            <h2>게임을 종료할까요?</h2>
            <p>진행 중인 게임은 먼저 저장됩니다.</p>
            <div class="actions">
              <button id="lw88ExitCancel" class="btn" type="button">계속 플레이</button>
              <button id="lw88ExitConfirm" class="btn primary" type="button">종료</button>
            </div>
          </div>
        </div>`);
    }

    const lobbyPlayers=byId("lobbyPlayers");
    if(lobbyPlayers&&!byId("lw88LobbyTools")){
      lobbyPlayers.insertAdjacentHTML("afterend",`
        <div id="lw88LobbyTools" class="lw88-lobby-tools">
          <div class="lw88-lobby-row">
            <b>출격 준비</b>
            <button id="lw88ReadyButton" class="btn" type="button">준비 완료</button>
          </div>
          <div id="lw88LoadoutPreview" class="lw88-loadout">장비 정보를 불러오는 중...</div>
          <div class="lw88-lobby-row">
            <button id="lw88InviteButton" class="btn" type="button">초대 링크 복사</button>
            <small>전원이 준비되면 방장이 시작할 수 있습니다.</small>
          </div>
        </div>`);
    }

    byId("lw88ExitCancel")?.addEventListener("click",()=>{
      hideOverlay(byId("lw88ExitDialog"));
      armHistoryGuard();
    });
    byId("lw88ExitConfirm")?.addEventListener("click",()=>{
      v88.allowExit=true;
      try{syncPersistentRunKills?.({persistNow:true});}catch{}
      try{persist?.();}catch{}
      history.back();
    });
    byId("lw88ReadyButton")?.addEventListener("click",toggleReady);
    byId("lw88InviteButton")?.addEventListener("click",copyInviteLink);
    byId("lw88QuickPings")?.addEventListener("click",event=>{
      const type=event.target?.closest?.("[data-ping]")?.dataset?.ping;
      if(type) sendTeamPing(type);
    });
  }

  /* One browser-history guard gives mobile hardware Back and desktop Back
     the same UI-first behavior without trapping a confirmed exit. */
  function armHistoryGuard(){
    if(v88.allowExit) return;
    const url=location.pathname+location.search+location.hash;
    if(!history.state?.lwRoot&&!history.state?.lwGuard){
      history.replaceState({...history.state,lwRoot:true},document.title,url);
    }
    history.pushState({lwGuard:true},document.title,url);
    v88.historyArmed=true;
  }

  function goToMainScreen(){
    /*
      returnToMenu is the game's authoritative cleanup path: it releases
      multiplayer locks, clears paused/input state and hides phase overlays.
      Using it avoids the frozen, empty battlefield caused by DOM-only hiding.
    */
    hideOverlay(ui.levelUp);
    hideOverlay(ui.shop);
    hideOverlay(ui.pauseMenu);
    hideOverlay(ui.gameOver);
    if(typeof pendingLevelUps!=="undefined") pendingLevelUps=0;
    if(multiplayer?.levelUpPauseOwners) multiplayer.levelUpPauseOwners.clear();
    if(multiplayer) multiplayer.levelUpPaused=false;
    returnToMenu();
    hideOverlay(byId("lw88ExitDialog"));
    showOverlay(ui.menu);
  }

  /* ---------- terminal-only ranking submission ---------- */
  const baseSubmitRankingV91=submitRanking;
  queueRankingSync=function(){
    /* v91: rankings are intentionally not synchronized during a live run. */
    return Promise.resolve({skipped:true,reason:"terminal_only"});
  };
  submitRanking=function(options={}){
    const runId=v88.rankingRunId;
    if(!runId){
      return baseSubmitRankingV91(options);
    }
    if(v88.rankingSubmittedRunId===runId){
      return Promise.resolve({
        ok:true,
        duplicatePrevented:true,
        message:"현재 판의 랭킹은 이미 등록되었습니다."
      });
    }
    if(v88.rankingSubmission?.runId===runId){
      return v88.rankingSubmission.promise;
    }

    /* Reserve the run before starting fetch so pagehide/back/death cannot race. */
    v88.rankingSubmittedRunId=runId;
    const promise=Promise.resolve(baseSubmitRankingV91(options))
      .catch(error=>{
        if(v88.rankingSubmittedRunId===runId) v88.rankingSubmittedRunId="";
        throw error;
      })
      .finally(()=>{
        if(v88.rankingSubmission?.runId===runId) v88.rankingSubmission=null;
      });
    v88.rankingSubmission={runId,promise};
    return promise;
  };

  function submitCurrentRunAtExit(reason="menu"){
    if(
      !v88.rankingRunId||
      !["playing","waveComplete","gameOver"].includes(state)
    ){
      return Promise.resolve({skipped:true});
    }
    try{syncPersistentRunKills({persistNow:true});}catch{}
    return submitRanking({
      silent:true,
      keepalive:reason==="pagehide"||reason==="unload"
    });
  }

  const baseStartRunV91=startRun;
  startRun=function(...args){
    v88.rankingRunId=`${save.playerId}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
    v88.rankingSubmittedRunId="";
    v88.rankingSubmission=null;
    return baseStartRunV91(...args);
  };

  const baseReturnToMenuV91=returnToMenu;
  returnToMenu=function(...args){
    const rankingPromise=submitCurrentRunAtExit("menu");
    const result=baseReturnToMenuV91(...args);
    rankingPromise.catch(error=>console.warn("메인 화면 이동 랭킹 등록 지연",error));
    return result;
  };

  /* Existing onclick properties captured the old function value. */
  if(byId("quitButton")) byId("quitButton").onclick=()=>returnToMenu();
  if(byId("restartButton")) byId("restartButton").onclick=()=>returnToMenu();

  function closeOverlaySemantically(element){
    if(!element) return false;

    /*
      Combat-phase screens own mandatory pause/state locks. Back now uses the
      full menu cleanup path instead of merely hiding the visible element.
    */
    if(["levelUp","shop","pauseMenu","gameOver"].includes(element.id)){
      goToMainScreen();
      return true;
    }

    const closeButtonByOverlay={
      help:"helpCloseButton",
      rankings:"rankingCloseButton",
      resetDataOverlay:"resetCancelButton",
      accountDeleteOverlay:"accountDeleteCancelButton",
      guestNicknameOverlay:"guestNicknameCancelButton",
      v82AchievementsOverlay:"v82AchievementsClose",
      v82MetaShopOverlay:"v82MetaShopClose",
      v82TalentOverlay:"v82TalentClose",
      v82MasteryOverlay:"v82MasteryClose"
    };

    if(element.id==="multiMenu"){
      byId("multiBackButton")?.click();
      return true;
    }
    if(element.id==="lobby"){
      byId("leaveRoomButton")?.click();
      return true;
    }
    if(element.id==="adminLogin"){
      closeAdminLogin();
      return true;
    }
    if(element.id==="adminPanel"){
      closeAdminPanel();
      return true;
    }

    const buttonId=closeButtonByOverlay[element.id];
    if(buttonId&&byId(buttonId)){
      byId(buttonId).click();
      return true;
    }

    /*
      Future overlays also get semantic close behavior automatically. Calling
      click() preserves any save, validation, resume or cleanup handler wired
      to the popup's own close/cancel button.
    */
    const semanticCloseButton=element.querySelector([
      "button[data-close]",
      "button[id$='CloseButton']",
      "button[id$='Close']",
      "button[id$='CancelButton']",
      "button[id$='Cancel']"
    ].join(","));
    if(semanticCloseButton&&!semanticCloseButton.disabled){
      semanticCloseButton.click();
      return true;
    }

    hideOverlay(element);
    return true;
  }

  function closeTopUi(){
    const overlays=activeOverlays();
    const top=overlays.at(-1);
    if(top){
      return closeOverlaySemantically(top);
    }
    if(typeof state!=="undefined"&&(state==="playing"||state==="waveComplete")){
      goToMainScreen();
      return true;
    }
    if(typeof ui!=="undefined"&&ui.multiMenu&&visible(ui.multiMenu)){
      hideOverlay(ui.multiMenu);
      showOverlay(ui.menu);
      return true;
    }
    return false;
  }

  addEventListener("popstate",()=>{
    if(v88.allowExit) return;
    if(closeTopUi()){
      armHistoryGuard();
      return;
    }
    showOverlay(byId("lw88ExitDialog"));
  });

  addEventListener("keydown",event=>{
    if(event.key!=="Escape") return;

    /*
      Escape is a pause key during an active fight. Browser/mobile Back keeps
      using closeTopUi(), so the existing "return to main screen" Back rule is
      unchanged. When the pause menu is already open, Escape resumes instead
      of treating that menu as a terminal combat overlay.
    */
    if(typeof state!=="undefined"&&state==="playing"){
      const overlays=activeOverlays();
      const top=overlays.at(-1);
      if(!top||top.id==="pauseMenu"){
        togglePause();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }

    if(closeTopUi()){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  function makeRoomToken(){
    if(crypto?.randomUUID) return crypto.randomUUID()+crypto.randomUUID();
    const bytes=new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return [...bytes].map(v=>v.toString(16).padStart(2,"0")).join("");
  }

  function saveResumeRoom(){
    if(!multiplayer?.active||!multiplayer.roomCode||!v88.roomToken) return;
    localStorage.setItem(V88_ROOM_KEY,JSON.stringify({
      roomCode:multiplayer.roomCode,
      token:v88.roomToken,
      isPublic:Boolean(multiplayer.publicRoom),
      savedAt:Date.now()
    }));
  }

  function clearResumeRoom(){
    localStorage.removeItem(V88_ROOM_KEY);
    v88.roomToken="";
  }

  function getResumeRoom(){
    try{
      const data=JSON.parse(localStorage.getItem(V88_ROOM_KEY)||"null");
      if(!data||Date.now()-Number(data.savedAt)>30*60*1000) return null;
      return data;
    }catch{return null}
  }

  async function rpcV2(name,args){
    const {data,error}=await sbClient.rpc(name,args);
    if(error) throw error;
    return data;
  }

  createOnlineRoom=async function(isPublic){
    requireNickname();
    requireOnline();
    v88.roomToken=makeRoomToken();
    const data=await rpcV2("lw_create_room_v2",{
      p_player_id:save.playerId,
      p_nickname:save.nickname,
      p_job:save.selectedJob,
      p_is_public:Boolean(isPublic),
      p_max_players:MULTIPLAYER_MAX_PLAYERS,
      p_session_token:v88.roomToken
    });
    const code=normalizeRoomCode(Array.isArray(data)?data[0]:data);
    await connectRealtimeRoom(code,{isPublic:Boolean(isPublic),forceHost:true});
    saveResumeRoom();
  };

  joinOnlineRoom=async function(code,{isPublic=false,resumeToken=""}={}){
    requireNickname();
    requireOnline();
    const cleanCode=normalizeRoomCode(code);
    if(cleanCode.length!==6) throw new Error("방 코드는 영문·숫자 6자리로 입력하세요.");
    v88.roomToken=resumeToken||makeRoomToken();
    const data=await rpcV2("lw_join_room_v2",{
      p_room_code:cleanCode,
      p_player_id:save.playerId,
      p_nickname:save.nickname,
      p_job:save.selectedJob,
      p_session_token:v88.roomToken
    });
    await connectRealtimeRoom(normalizeRoomCode(data||cleanCode),{isPublic});
    saveResumeRoom();
  };

  randomMatch=async function(){
    requireNickname();
    requireOnline();
    ui.publicRoomStatus.textContent="랜덤 매칭 중...";
    v88.roomToken=makeRoomToken();
    const data=await rpcV2("lw_random_match_v2",{
      p_player_id:save.playerId,
      p_nickname:save.nickname,
      p_job:save.selectedJob,
      p_session_token:v88.roomToken
    });
    const result=Array.isArray(data)?data[0]:data;
    const code=normalizeRoomCode(result?.room_code||result);
    await connectRealtimeRoom(code,{isPublic:true,forceHost:Boolean(result?.created)});
    saveResumeRoom();
    showMessage(result?.created?"새 공개 방 생성":"공개 방 매칭",code);
  };

  roomHeartbeat=async function(){
    if(!multiplayer.active||!multiplayer.roomCode||!sbClient||!v88.roomToken) return;
    try{
      await rpcV2("lw_room_heartbeat_v2",{
        p_room_code:multiplayer.roomCode,
        p_player_id:save.playerId,
        p_session_token:v88.roomToken
      });
      saveResumeRoom();
    }catch(error){console.warn("secure heartbeat 오류",error)}
  };

  const baseLeaveMultiplayer=leaveMultiplayer;
  leaveMultiplayer=async function(){
    const roomCode=multiplayer.roomCode;
    const token=v88.roomToken;
    if(sbClient&&roomCode&&token){
      try{
        await rpcV2("lw_leave_room_v2",{
          p_room_code:roomCode,p_player_id:save.playerId,p_session_token:token
        });
      }catch(error){console.warn("secure leave 오류",error)}
    }
    /* Prevent the legacy unauthenticated mutation inside the original function. */
    const oldClient=sbClient;
    try{
      sbClient=null;
      await baseLeaveMultiplayer();
    }finally{sbClient=oldClient}
    clearResumeRoom();
    v88.ready.clear();
    v88.stats.clear();
  };

  const baseStartMultiplayerGame=startMultiplayerGame;
  startMultiplayerGame=async function(){
    const members=[...multiplayer.members.keys()];
    const unready=members.filter(id=>!v88.ready.get(id));
    if(unready.length){
      showMessage("아직 준비하지 않은 플레이어가 있습니다",`${unready.length}명 대기 중`);
      return;
    }
    if(sbClient&&v88.roomToken){
      try{
        await rpcV2("lw_set_room_status_v2",{
          p_room_code:multiplayer.roomCode,
          p_player_id:save.playerId,
          p_status:"playing",
          p_session_token:v88.roomToken
        });
      }catch(error){reportRuntimeError(error,"게임 시작 권한 확인");return}
    }
    const oldClient=sbClient;
    try{
      /* The secure RPC above replaces the legacy status mutation. */
      sbClient=null;
      return await baseStartMultiplayerGame();
    }finally{sbClient=oldClient}
  };
  const startBtn=byId("roomStartButton");
  if(startBtn) startBtn.onclick=()=>startMultiplayerGame();

  function toggleReady(){
    if(!multiplayer?.active) return;
    const ready=!v88.ready.get(save.playerId);
    v88.ready.set(save.playerId,ready);
    sendCriticalRoomEvent("player_ready",{playerId:save.playerId,ready});
    renderLobby();
  }

  function renderV88Lobby(){
    const button=byId("lw88ReadyButton");
    const mine=Boolean(v88.ready.get(save.playerId));
    if(button){
      button.textContent=mine?"준비 취소":"준비 완료";
      button.classList.toggle("primary",!mine);
    }
    for(const row of byId("lobbyPlayers")?.children||[]){
      const name=row.querySelector("b")?.textContent||"";
      const member=[...multiplayer.members.values()].find(m=>name.includes(m.nickname||""));
      if(!member) continue;
      const mark=document.createElement("span");
      const ready=Boolean(v88.ready.get(member.playerId));
      mark.className=ready?"lw88-ready":"lw88-not-ready";
      mark.textContent=ready?" · 준비":" · 대기";
      row.querySelector(".lobby-player-meta")?.append(mark);
    }
    const local=player||players?.get?.(save.playerId);
    const weaponId=local?getWeaponId(local):"";
    const preview=byId("lw88LoadoutPreview");
    if(preview) preview.textContent=
      `내 장비 · ${JOBS[save.selectedJob]?.name||save.selectedJob} · ${WEAPONS[weaponId]?.name||weaponId||"기본 무기"} · 색상 ${local?.weaponColors?.[weaponId]||"기본"}`;
    const members=[...multiplayer.members.keys()];
    const allReady=members.length>0&&members.every(id=>v88.ready.get(id));
    const roomStart=byId("roomStartButton");
    if(roomStart){
      roomStart.disabled=!multiplayer.isHost||multiplayer.starting||!allReady;
      if(multiplayer.isHost&&!allReady) roomStart.textContent="전원 준비 대기";
    }
  }

  const baseRenderLobby=renderLobby;
  renderLobby=function(){
    const result=baseRenderLobby();
    renderV88Lobby();
    return result;
  };

  function installChannelListeners(channel){
    if(!channel||v88.listeners.has(channel)) return;
    v88.listeners.add(channel);
    channel.on("broadcast",{event:"player_ready"},({payload})=>{
      if(!payload?.playerId||payload.playerId!==payload?.__lw?.sender) return;
      v88.ready.set(payload.playerId,Boolean(payload.ready));
      renderLobby();
    });
    channel.on("broadcast",{event:"team_ping"},({payload})=>{
      if(!payload?.kind) return;
      showTeamPing(payload.kind,multiplayer.members.get(payload?.__lw?.sender)?.nickname);
    });
    channel.on("broadcast",{event:"player_stats"},({payload})=>{
      if(!payload?.playerId||payload.playerId!==payload?.__lw?.sender) return;
      v88.stats.set(payload.playerId,payload);
    });
    channel.on("broadcast",{event:"ready_roster"},({payload})=>{
      if(!isCurrentHostPayload(payload)||!payload?.ready) return;
      for(const [id,value] of Object.entries(payload.ready)) v88.ready.set(id,Boolean(value));
      renderLobby();
    });
  }

  const baseConnectRealtimeRoom=connectRealtimeRoom;
  connectRealtimeRoom=async function(code,options={}){
    const result=await baseConnectRealtimeRoom(code,options);
    installChannelListeners(multiplayer.channel);
    if(!v88.ready.has(save.playerId)) v88.ready.set(save.playerId,false);
    saveResumeRoom();
    renderLobby();
    return result;
  };

  function sendTeamPing(kind){
    if(!multiplayer?.active||performance.now()<v88.pingCooldownUntil) return;
    v88.pingCooldownUntil=performance.now()+1800;
    sendRoomEvent("team_ping",{kind},{silent:true});
    showTeamPing(kind,save.nickname);
  }

  function showTeamPing(kind,nickname="SURVIVOR"){
    const label={danger:"⚠ 위험",gather:"⌖ 여기로 집결",boss:"◎ 보스 집중"}[kind]||"신호";
    const node=document.createElement("div");
    node.className="lw88-team-ping";
    node.textContent=`${nickname||"SURVIVOR"} · ${label}`;
    document.body.append(node);
    setTimeout(()=>node.remove(),2500);
  }

  async function copyInviteLink(){
    if(!multiplayer?.roomCode) return;
    const url=new URL(location.href);
    url.searchParams.set("room",multiplayer.roomCode);
    try{
      await navigator.clipboard.writeText(url.toString());
      showMessage("초대 링크 복사 완료",multiplayer.roomCode);
    }catch{showMessage("방 코드",multiplayer.roomCode)}
  }

  function attemptDeepLinkJoin(){
    const code=normalizeRoomCode(new URL(location.href).searchParams.get("room"));
    if(code.length!==6) return;
    const input=byId("roomCodeInput");
    if(input) input.value=code;
    showOverlay(ui.multiMenu);
    showMessage("초대 방 코드가 입력되었습니다","참가 버튼을 눌러 입장하세요.");
  }

  function attemptRoomResume(){
    const data=getResumeRoom();
    if(!data||multiplayer?.active||!sbClient) return;
    const button=document.createElement("button");
    button.id="lw88ResumeButton";
    button.className="btn primary";
    button.textContent=`${data.roomCode} 방 재입장`;
    button.onclick=async()=>{
      button.disabled=true;
      try{
        await joinOnlineRoom(data.roomCode,{isPublic:data.isPublic,resumeToken:data.token});
        button.remove();
      }catch(error){
        clearResumeRoom();
        button.remove();
        reportRuntimeError(error,"방 재입장");
      }
    };
    const actions=byId("multiMenu")?.querySelector(".actions");
    actions?.prepend(button);
  }

  const baseApplyWorldFrame=applyWorldFrame;
  applyWorldFrame=function(payload){
    const seq=Number(payload?.frameSeq)||0;
    if(seq){
      v88.packetReceived++;
      if(v88.lastFrameSeq&&seq>v88.lastFrameSeq+1) v88.packetMissing+=seq-v88.lastFrameSeq-1;
      v88.lastFrameSeq=Math.max(v88.lastFrameSeq,seq);
    }
    return baseApplyWorldFrame(payload);
  };

  function updateNetworkHud(){
    const hud=byId("lw88NetworkHud");
    const banner=byId("lw88ReconnectBanner");
    if(!hud) return;
    const active=Boolean(multiplayer?.active);
    hud.classList.toggle("show",active);
    if(!active){banner?.classList.remove("show");return}
    const total=v88.packetReceived+v88.packetMissing;
    const loss=total?Math.min(99,v88.packetMissing/total*100):0;
    const latency=Math.round(multiplayer.latencyMs||0);
    const jitter=Math.round(multiplayer.jitterMs||0);
    const reconnecting=multiplayer.reconnecting||/재연결|끊김|오류|초과/.test(multiplayer.connectionState||"");
    const bad=reconnecting||latency>280||jitter>130||loss>12;
    const warn=!bad&&(latency>150||jitter>70||loss>5);
    hud.dataset.quality=bad?"bad":warn?"warn":"good";
    byId("lw88NetworkText").textContent=
      `${multiplayer.connectionState||"안정"} · ${latency}ms · 지터 ${jitter} · 손실 ${loss.toFixed(1)}%`;
    banner?.classList.toggle("show",reconnecting);
    document.documentElement.classList.toggle("lw88-low-network",bad);
    if(typeof graphicsMode!=="undefined"&&bad&&graphicsMode==="ultra") graphicsMode="normal";
  }

  function sendStats(){
    if(!multiplayer?.active||!player) return;
    const stats={
      playerId:save.playerId,
      nickname:save.nickname,
      kills:Math.max(0,Math.floor(Number(player.kills)||0)),
      hp:Math.max(0,Math.round(Number(player.hp)||0)),
      maxHp:Math.max(1,Math.round(Number(player.maxHp)||1)),
      downed:Boolean(player.downed||player.dead),
      wave:Math.max(0,Math.floor(Number(wave)||0))
    };
    v88.stats.set(save.playerId,stats);
    sendRoomEvent("player_stats",stats,{silent:true});
  }

  function renderScoreboard(){
    const root=byId("gameOver")?.querySelector(".panel");
    if(!root) return;
    root.querySelector(".lw88-scoreboard")?.remove();
    const box=document.createElement("div");
    box.className="lw88-scoreboard";
    box.innerHTML="<b>팀 전투 기록</b>";
    const stats=[...v88.stats.values()].sort((a,b)=>(b.kills||0)-(a.kills||0));
    for(const stat of stats){
      const row=document.createElement("div");
      row.className="lw88-score-row";
      row.innerHTML=`<span>${esc(stat.nickname||"SURVIVOR")}</span><span>처치 ${formatNumber(stat.kills||0)}</span><span>W${stat.wave||0}</span><span>${stat.downed?"전투 불능":"생존"}</span>`;
      box.append(row);
    }
    root.append(box);
  }

  const baseFinishRun=finishRun;
  finishRun=async function(){
    sendStats();
    const result=await baseFinishRun();
    setTimeout(renderScoreboard,0);
    return result;
  };

  /* Player-count scaling: more enemies and health, with a smaller money bonus.
     Host remains authoritative, so clients never apply this independently. */
  const baseStartWave=startWave;
  startWave=function(){
    const result=baseStartWave();
    if(multiplayer.active&&multiplayer.isHost){
      const count=getMultiplayerPlayerCount();
      const factor=[1,1,1.28,1.52,1.72][count]||1;
      spawnRemaining=Math.min(getActiveEnemyCap()-3,Math.round(spawnRemaining*factor));
      if(count>1){
        money+=Math.round(45*(count-1)+wave*6*(count-1));
        broadcastSharedMoney?.("player_scaling");
      }
    }
    return result;
  };

  const baseSpawnEnemy=spawnEnemy;
  spawnEnemy=function(){
    const before=enemies.length;
    const result=baseSpawnEnemy();
    if(multiplayer.active&&multiplayer.isHost){
      const count=getMultiplayerPlayerCount();
      const hpFactor=[1,1,1.16,1.28,1.38][count]||1;
      for(let i=before;i<enemies.length;i++){
        const enemy=enemies[i];
        if(enemy?._lw88Scaled) continue;
        enemy._lw88Scaled=true;
        enemy.maxHp*=hpFactor;
        enemy.hp*=hpFactor;
      }
    }
    return result;
  };

  setInterval(()=>{
    updateNetworkHud();
    if(multiplayer?.active){
      const now=performance.now();
      if(now-v88.lastStatsSentAt>4000){
        v88.lastStatsSentAt=now;
        sendStats();
      }
      if(multiplayer.isHost){
        sendRoomEvent("ready_roster",{ready:Object.fromEntries(v88.ready)},{silent:true});
      }
    }
  },1000);

  addEventListener("online",()=>{
    if(multiplayer?.active) scheduleRealtimeReconnect("인터넷 연결 복구");
  });
  addEventListener("offline",()=>{
    if(multiplayer?.active){
      multiplayer.connectionState="오프라인";
      updateNetworkHud();
    }
  });

  /* Public builds no longer contain an administrator credential. */
  loginAdmin=function(){
    byId("adminLoginStatus").textContent="관리자 인증은 공개 게임에서 비활성화되었습니다.";
  };
  openAdminLogin=function(){
    showMessage("관리자 기능 비활성화","보안을 위해 서버 인증 전용으로 전환되었습니다.");
  };

  ensureV88Ui();
  armHistoryGuard();
  attemptDeepLinkJoin();
  setTimeout(attemptRoomResume,900);
  if(typeof attachDraggablePopup==="function") attachDraggablePopup(byId("lw88ExitDialog"));
})();
