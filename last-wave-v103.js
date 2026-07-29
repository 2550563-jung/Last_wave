/* Last Wave v103
 * - 호스트와 참가자 모두 자신의 레벨업 강화를 선택합니다.
 * - 멀티플레이 레벨업 선택 중 전투는 계속되고 선택 중인 플레이어만 무적입니다.
 * - 함께 플레이하던 방에 한 명만 남으면 진행 상태를 유지한 채 싱글플레이로 전환합니다.
 */
(() => {
  "use strict";

  const attachedChannels=new WeakSet();
  const RANKING_OUTBOX_KEY="lastWaveRankingOutboxV103";
  const RANKING_CONFIRMED_KEY="lastWaveRankingConfirmedV103";
  let soloFallbackTimer=0;
  let soloFallbackRunning=false;
  let rankingRunId="";
  const rankingRequests=new Map();
  const rankingCompletedRunIds=new Set();

  multiplayer.hadMultiplePlayers=Boolean(multiplayer.hadMultiplePlayers);
  multiplayer.levelUpPaused=false;

  function localPlayerId(){
    return player?.id||save.playerId;
  }

  function readStoredJson(key,fallback){
    try{
      const value=JSON.parse(localStorage.getItem(key)||"null");
      return value??fallback;
    }catch{
      return fallback;
    }
  }

  function writeStoredJson(key,value){
    try{
      localStorage.setItem(key,JSON.stringify(value));
      return true;
    }catch{
      return false;
    }
  }

  function rankingOutbox(){
    const entries=readStoredJson(RANKING_OUTBOX_KEY,[]);
    return Array.isArray(entries)
      ? entries.filter(entry=>entry&&entry.id&&entry.payload).slice(-20)
      : [];
  }

  function saveRankingOutbox(entries){
    writeStoredJson(RANKING_OUTBOX_KEY,entries.slice(-20));
  }

  function ensureRankingIdentity(){
    if(
      typeof guestModeActive!=="undefined"&&
      guestModeActive&&
      !currentAccountUser?.id&&
      typeof getGuestPlayerId==="function"
    ){
      save.playerId=getGuestPlayerId();
    }else if(currentAccountUser?.id){
      save.playerId=currentAccountUser.id;
    }else if(!isValidUuid(save.playerId)){
      save.playerId=isValidUuid(save.localPlayerId)
        ? save.localPlayerId
        : createId();
      save.localPlayerId=save.playerId;
    }
    return save.playerId;
  }

  function rankingModeKey(payload){
    return [
      payload.playerId,
      payload.mode||"normal",
      payload.mode==="daily"?(payload.dailyDate||""):"all"
    ].join("|");
  }

  function rankingSpecialModeSkip(){
    const modeState=window.__lastWaveV92?.state;
    if(
      modeState?.training||
      modeState?.spectator||
      ["weekly","training"].includes(modeState?.runType)
    ){
      return modeState?.training||modeState?.runType==="training"
        ? "training"
        : "separate_verified_mode";
    }
    return "";
  }

  function rankingSkipReason(){
    const special=rankingSpecialModeSkip();
    if(special)return special;
    return rankingSkipMessage();
  }

  function createRankingEntry(){
    ensureRankingIdentity();
    const payload=rankingPayload();
    const id=rankingRunId||
      `${payload.playerId}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
    const entries=rankingOutbox();
    const existing=entries.find(entry=>entry.id===id);
    if(existing)return existing;
    const entry={
      id,
      payload,
      createdAt:Date.now(),
      attempts:0
    };
    entries.push(entry);
    saveRankingOutbox(entries);
    return entry;
  }

  function confirmRankingEntry(entry,data){
    const all=readStoredJson(RANKING_CONFIRMED_KEY,{});
    const confirmed=all&&typeof all==="object"?all:{};
    const key=rankingModeKey(entry.payload);
    const previous=confirmed[key];
    if(
      !previous||
      Number(entry.payload.score)>Number(previous.score)||
      (
        Number(entry.payload.score)===Number(previous.score)&&
        Number(entry.payload.wave)>Number(previous.wave)
      )
    ){
      confirmed[key]={
        ...entry.payload,
        confirmedAt:Date.now(),
        serverMessage:String(data?.message||"")
      };
      writeStoredJson(RANKING_CONFIRMED_KEY,confirmed);
    }
  }

  function removeRankingEntry(id){
    saveRankingOutbox(rankingOutbox().filter(entry=>entry.id!==id));
  }

  async function postRankingEntry(entry,options={}){
    if(rankingRequests.has(entry.id)){
      return rankingRequests.get(entry.id);
    }

    const request=(async()=>{
      entry.attempts=Math.max(0,Number(entry.attempts)||0)+1;
      entry.lastAttemptAt=Date.now();
      const entries=rankingOutbox();
      const index=entries.findIndex(item=>item.id===entry.id);
      if(index>=0){
        entries[index]=entry;
        saveRankingOutbox(entries);
      }

      const response=await rankingFetch(RANKINGS_URL,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Accept":"application/json",
          apikey:SUPABASE_PUBLISHABLE_KEY
        },
        body:JSON.stringify(entry.payload),
        cache:"no-store",
        keepalive:Boolean(options.keepalive)
      });
      const data=await readRankingResponse(response);
      if(!response.ok||data?.ok===false){
        throw new Error(rankingErrorMessage(data,response));
      }

      removeRankingEntry(entry.id);
      confirmRankingEntry(entry,data);
      rankingCompletedRunIds.add(entry.id);
      lastRankingSyncError="";
      return{
        ok:true,
        ...(data&&typeof data==="object"?data:{}),
        message:data?.message||"랭킹 등록 완료"
      };
    })()
      .catch(error=>{
        lastRankingSyncError=error?.message||"랭킹 등록 실패";
        throw error;
      })
      .finally(()=>rankingRequests.delete(entry.id));

    rankingRequests.set(entry.id,request);
    return request;
  }

  async function flushRankingOutbox(){
    if(!navigator.onLine)return{ok:false,offline:true};
    const pending=rankingOutbox();
    let completed=0;
    for(const entry of pending){
      try{
        await postRankingEntry(entry);
        completed++;
      }catch(error){
        console.warn("보류된 랭킹 등록 재시도 실패",error);
        break;
      }
    }
    return{ok:true,completed,pending:rankingOutbox().length};
  }

  submitRanking=function(options={}){
    const reason=rankingSkipReason();
    if(reason){
      return Promise.resolve({
        ok:false,
        skipped:true,
        reason,
        message:reason
      });
    }
    if(rankingRunId&&rankingCompletedRunIds.has(rankingRunId)){
      return Promise.resolve({
        ok:true,
        duplicatePrevented:true,
        message:"현재 판의 랭킹은 이미 등록되었습니다."
      });
    }
    const entry=createRankingEntry();
    return postRankingEntry(entry,options);
  };

  function confirmedRanking(mode){
    ensureRankingIdentity();
    const dailyDate=mode==="daily"?rankingDailyDateKey():"";
    const all=readStoredJson(RANKING_CONFIRMED_KEY,{});
    return all?.[[save.playerId,mode,dailyDate||"all"].join("|")]||null;
  }

  function appendOwnRanking(mode){
    const own=confirmedRanking(mode);
    if(!own||!ui.rankingList)return;
    const rows=[...ui.rankingList.querySelectorAll(".rank-row")];
    const alreadyVisible=rows.some(row=>{
      const values=[...row.querySelectorAll("span")].map(cell=>cell.textContent);
      return values[1]===own.nickname&&
        Number(String(values[2]||"").replaceAll(",",""))===Number(own.score);
    });
    if(alreadyVisible)return;

    ui.rankingList.querySelector(".lw103-own-ranking")?.remove();
    const row=document.createElement("div");
    row.className="rank-row lw103-own-ranking";
    const values=[
      "내 기록",
      own.nickname||"GUEST",
      formatNumber(own.score||0),
      own.wave||1,
      own.job||"-"
    ];
    for(const value of values){
      const cell=document.createElement("span");
      cell.textContent=String(value);
      row.append(cell);
    }
    row.title="서버 등록이 확인된 내 최고 기록";
    ui.rankingList.append(row);
  }

  const previousLoadRankings=loadRankings;
  loadRankings=async function(mode,...args){
    await flushRankingOutbox();
    const result=await previousLoadRankings(mode,...args);
    appendOwnRanking(mode);
    return result;
  };

  function removeSkinFeature(){
    save.selectedSkinV82="default";
    save.ownedSkinsV82=["default"];
    if(player)player.v82Skin="default";
    for(const member of players.values()){
      if(member)member.v82Skin="default";
    }

    if(typeof v82DrawSkinAura==="function"){
      v82DrawSkinAura=function(){};
    }
    if(typeof v82RenderSkins==="function"){
      v82RenderSkins=function(){};
    }
    if(
      typeof V82_ACHIEVEMENTS!=="undefined"&&
      Array.isArray(V82_ACHIEVEMENTS)
    ){
      for(let index=V82_ACHIEVEMENTS.length-1;index>=0;index--){
        if(V82_ACHIEVEMENTS[index]?.id==="allSkins"){
          V82_ACHIEVEMENTS.splice(index,1);
        }
      }
    }

    const grid=document.getElementById("v82SkinGrid");
    if(grid?.previousElementSibling?.classList.contains("section-title")){
      grid.previousElementSibling.remove();
    }
    grid?.remove();
    document.getElementById("adminV84UnlockSkinsButton")?.remove();
  }

  function isSelectingLevelUp(target){
    if(!target||!multiplayer.active)return false;
    return Boolean(
      target._lw103LevelUpSelecting||
      multiplayer.levelUpPauseOwners.has(target.id)
    );
  }

  updatePausedFromMultiplayerLocks=function(){
    const multiplayerPause=
      multiplayer.active&&multiplayer.adminPaused;
    const localOverlayPause=
      ui.pauseMenu?.style.display==="flex"||
      ui.adminPanel?.style.display==="flex"||
      ui.adminLogin?.style.display==="flex"||
      (!multiplayer.active&&ui.levelUp?.style.display==="flex");

    multiplayer.levelUpPaused=false;
    if(state==="playing"){
      paused=Boolean(multiplayerPause||localOverlayPause);
    }
  };

  broadcastLevelUpPauseState=function(){
    if(!multiplayer.active||!multiplayer.isHost)return;
    multiplayer.levelUpPaused=false;
    sendRoomEvent("levelup_pause",{
      owners:[...multiplayer.levelUpPauseOwners],
      paused:false,
      protectionOnly:true
    },{silent:true});
    updatePausedFromMultiplayerLocks();
  };

  setMultiplayerLevelUpPauseOwner=function(playerId,enabled){
    const id=String(playerId||"");
    if(!id)return;
    const target=players.get(id);
    if(target)target._lw103LevelUpSelecting=Boolean(enabled);
    if(id===localPlayerId()&&player){
      player._lw103LevelUpSelecting=Boolean(enabled);
    }

    if(!multiplayer.active){
      multiplayer.levelUpPauseOwners.delete(id);
      multiplayer.levelUpPaused=false;
      updatePausedFromMultiplayerLocks();
      return;
    }

    if(multiplayer.isHost){
      if(enabled)multiplayer.levelUpPauseOwners.add(id);
      else multiplayer.levelUpPauseOwners.delete(id);
      broadcastLevelUpPauseState();
      return;
    }

    if(enabled)multiplayer.levelUpPauseOwners.add(id);
    else multiplayer.levelUpPauseOwners.delete(id);
    multiplayer.levelUpPaused=false;
    sendRoomEvent("levelup_pause_request",{
      playerId:id,
      paused:Boolean(enabled),
      protectionOnly:true
    },{silent:true});
    updatePausedFromMultiplayerLocks();
  };

  const previousDamagePlayer=damagePlayer;
  damagePlayer=function(target,amount,...rest){
    if(isSelectingLevelUp(target))return;
    return previousDamagePlayer(target,amount,...rest);
  };

  const previousOpenLevelUp=openLevelUp;
  openLevelUp=function(...args){
    const result=previousOpenLevelUp(...args);
    if(multiplayer.active&&ui.levelUp?.style.display==="flex"){
      setMultiplayerLevelUpPauseOwner(localPlayerId(),true);
      paused=false;
      updatePausedFromMultiplayerLocks();
    }
    return result;
  };

  ui.levelChoices?.addEventListener("click",()=>{
    setTimeout(()=>{
      if(!multiplayer.active)return;
      paused=false;
      updatePausedFromMultiplayerLocks();
    },0);
  },true);

  const previousFinishLocalLevelUpPause=finishLocalLevelUpPause;
  finishLocalLevelUpPause=function(...args){
    const result=previousFinishLocalLevelUpPause(...args);
    if(player)player._lw103LevelUpSelecting=false;
    multiplayer.levelUpPaused=false;
    updatePausedFromMultiplayerLocks();
    return result;
  };

  function receiveParticipantLevelUpOffer(payload){
    if(
      !payload||
      !acceptCriticalPayload(payload)||
      !isCurrentHostPayload(payload)||
      payload.to!==localPlayerId()
    )return;

    const count=Math.max(1,Math.floor(Number(payload.count)||1));
    pendingLevelUps+=count;
    setMultiplayerLevelUpPauseOwner(localPlayerId(),true);
    paused=false;
    openLevelUp();
  }

  function attachMultiplayerChannel(channel){
    if(!channel||attachedChannels.has(channel))return;
    attachedChannels.add(channel);
    channel.on("broadcast",{event:"level_up_offer_v103"},({payload})=>{
      receiveParticipantLevelUpOffer(payload);
    });
  }

  const previousConnectRealtimeRoom=connectRealtimeRoom;
  connectRealtimeRoom=async function(...args){
    const result=await previousConnectRealtimeRoom(...args);
    attachMultiplayerChannel(multiplayer.channel);
    return result;
  };

  const previousGainXp=gainXp;
  gainXp=function(owner,amount){
    const beforeLevel=Number(owner?.level)||0;
    let capturedOffer=null;
    const realSendCriticalRoomEvent=sendCriticalRoomEvent;

    sendCriticalRoomEvent=function(event,payload={}){
      if(event==="level_up_offer"){
        capturedOffer={...payload};
        return;
      }
      return realSendCriticalRoomEvent(event,payload);
    };

    let result;
    try{
      result=previousGainXp(owner,amount);
    }finally{
      sendCriticalRoomEvent=realSendCriticalRoomEvent;
    }

    const gainedLevels=Math.max(0,(Number(owner?.level)||0)-beforeLevel);
    if(
      capturedOffer&&
      gainedLevels>0&&
      multiplayer.active&&
      multiplayer.isHost&&
      owner&&!owner.local
    ){
      realSendCriticalRoomEvent("level_up_offer_v103",{
        to:owner.id,
        count:gainedLevels,
        level:owner.level
      });
    }
    return result;
  };

  async function switchRemainingPlayerToSolo(){
    clearTimeout(soloFallbackTimer);
    soloFallbackTimer=0;
    if(
      soloFallbackRunning||
      !multiplayer.active||
      !multiplayer.hadMultiplePlayers||
      multiplayer.members.size>1||
      (state!=="playing"&&state!=="waveComplete")
    )return;

    soloFallbackRunning=true;
    const local=player;
    try{
      await leaveMultiplayer();
      players.clear();
      if(local){
        local.local=true;
        local._lw103LevelUpSelecting=false;
        player=local;
        players.set(local.id,local);
      }
      gameMode="normal";
      multiplayer.levelUpPauseOwners.clear();
      multiplayer.levelUpPaused=false;
      multiplayer.hadMultiplePlayers=false;
      paused=false;
      updatePausedFromMultiplayerLocks();
      showMessage(
        "싱글플레이로 자동 전환",
        "다른 플레이어가 모두 나가 현재 진행 상태를 혼자 이어갑니다.",
        2.4
      );
    }catch(error){
      console.warn("싱글플레이 자동 전환 실패",error);
    }finally{
      soloFallbackRunning=false;
    }
  }

  function scheduleSoloFallback(){
    clearTimeout(soloFallbackTimer);
    soloFallbackTimer=setTimeout(()=>{
      soloFallbackTimer=0;
      switchRemainingPlayerToSolo();
    },900);
  }

  const previousSyncMembers=syncMembers;
  syncMembers=function(...args){
    const result=previousSyncMembers(...args);
    if(!multiplayer.active)return result;
    const count=multiplayer.members.size;
    if(count>=2){
      multiplayer.hadMultiplePlayers=true;
      clearTimeout(soloFallbackTimer);
      soloFallbackTimer=0;
    }else if(
      multiplayer.hadMultiplePlayers&&
      (state==="playing"||state==="waveComplete")
    ){
      scheduleSoloFallback();
    }
    return result;
  };

  const previousLeaveMultiplayer=leaveMultiplayer;
  leaveMultiplayer=async function(...args){
    clearTimeout(soloFallbackTimer);
    soloFallbackTimer=0;
    const result=await previousLeaveMultiplayer(...args);
    multiplayer.hadMultiplePlayers=false;
    multiplayer.levelUpPauseOwners.clear();
    multiplayer.levelUpPaused=false;
    return result;
  };

  const previousStartRun=startRun;
  startRun=function(...args){
    ensureRankingIdentity();
    rankingRunId=
      `${save.playerId}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
    multiplayer.hadMultiplePlayers=
      multiplayer.active&&multiplayer.members.size>=2;
    const result=previousStartRun(...args);
    if(player){
      player._lw103LevelUpSelecting=false;
      player.v82Skin="default";
    }
    return result;
  };

  const style=document.createElement("style");
  style.textContent=`
    .lw103-own-ranking{
      margin-top:8px;
      border:1px solid rgba(90,231,255,.55);
      background:rgba(38,179,214,.12);
      color:#dffaff;
    }
  `;
  document.head.append(style);

  removeSkinFeature();
  attachMultiplayerChannel(multiplayer.channel);
  updatePausedFromMultiplayerLocks();
  addEventListener("online",()=>flushRankingOutbox());
  addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible")flushRankingOutbox();
  });
  setTimeout(()=>flushRankingOutbox(),1400);

  window.__lastWaveV103={
    version:103,
    isSelectingLevelUp,
    receiveParticipantLevelUpOffer,
    attachMultiplayerChannel,
    switchRemainingPlayerToSolo,
    getMoneyMultiplier:()=>getMultiplayerMoneyMultiplier(),
    flushRankingOutbox,
    rankingOutbox,
    confirmedRanking,
    appendOwnRanking,
    skinsRemoved:()=>!document.getElementById("v82SkinGrid")
  };

  document.getElementById("gameVersion").textContent="v103";
})();
