/* Last Wave v99
 * - Supabase Edge Function 기반 관리자 비밀번호 인증
 * - 플레이어 중심 마우스 조준 영점 벡터 방지
 */
(() => {
  "use strict";

  const ADMIN_AUTH_URL=
    `${SUPABASE_URL}/functions/v1/admin-auth`;
  const AIM_DEAD_ZONE=14;
  let lastAimX=1;
  let lastAimY=0;

  openAdminLogin=function(){
    pauseForAdminAccess();
    adminMode=false;
    const input=document.getElementById("adminPasswordInput");
    const status=document.getElementById("adminLoginStatus");
    if(input)input.value="";
    if(status)status.textContent="";
    hideOverlay(ui.adminPanel);
    showOverlay(ui.adminLogin);
    setTimeout(()=>input?.focus(),30);
  };

  loginAdmin=async function(){
    const input=document.getElementById("adminPasswordInput");
    const status=document.getElementById("adminLoginStatus");
    const button=document.getElementById("adminLoginButton");
    if(!input||!status)return;

    button.disabled=true;
    status.textContent="확인 중...";

    try{
      const response=await fetch(ADMIN_AUTH_URL,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":SUPABASE_PUBLISHABLE_KEY
        },
        body:JSON.stringify({
          password:input.value
        })
      });

      if(response.status===429){
        const retryAfter=Math.max(1,Number(response.headers.get("Retry-After"))||60);
        status.textContent=`입력 횟수가 너무 많습니다. ${Math.ceil(retryAfter/60)}분 후 다시 시도하세요.`;
        return;
      }

      const result=await response.json().catch(()=>({ok:false}));
      if(!response.ok||result.ok!==true){
        status.textContent="비밀번호가 틀렸습니다.";
        input.select();
        return;
      }

      unlockAdminAccessForCurrentAccount();
      adminMode=true;
      updateAdminButton();
      hideOverlay(ui.adminLogin);
      openAdminPanel();
      showMessage("ADMIN MODE","관리자 인증이 완료되었습니다.");
    }catch(error){
      console.warn("관리자 비밀번호 확인 실패",error);
      status.textContent="관리자 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.";
    }finally{
      button.disabled=false;
    }
  };

  const adminButton=document.getElementById("adminLoginButton");
  if(adminButton)adminButton.onclick=()=>loginAdmin();

  const adminInput=document.getElementById("adminPasswordInput");
  if(adminInput){
    adminInput.addEventListener("keydown",event=>{
      if(event.isComposing||event.key!=="Enter")return;
      event.preventDefault();
      loginAdmin();
    });
  }

  function validAim(x,y){
    return Number.isFinite(x)&&Number.isFinite(y)&&Math.hypot(x,y)>.0001;
  }

  function normalizedAim(x,y,fallbackAngle=0){
    if(!validAim(x,y)){
      if(validAim(lastAimX,lastAimY))return{x:lastAimX,y:lastAimY};
      return{x:Math.cos(fallbackAngle),y:Math.sin(fallbackAngle)};
    }
    const length=Math.hypot(x,y);
    return{x:x/length,y:y/length};
  }

  canvas.addEventListener("pointermove",event=>{
    if(IS_MOBILE||!player)return;
    const world=screenToWorld(event.clientX,event.clientY);
    const dx=world.x-player.x;
    const dy=world.y-player.y;
    const distanceToPlayer=Math.hypot(dx,dy);

    if(distanceToPlayer<AIM_DEAD_ZONE){
      input.aimX=lastAimX;
      input.aimY=lastAimY;
      return;
    }

    const aim=normalizedAim(dx,dy,player.angle||0);
    lastAimX=aim.x;
    lastAimY=aim.y;
    input.aimX=aim.x;
    input.aimY=aim.y;
  });

  const baseFireWeapon=fireWeapon;
  fireWeapon=function(owner,aimX,aimY){
    const fallbackAngle=Number.isFinite(owner?.angle)?owner.angle:0;
    let safeAim=normalizedAim(aimX,aimY,fallbackAngle);

    if(owner?.local){
      lastAimX=safeAim.x;
      lastAimY=safeAim.y;
      input.aimX=safeAim.x;
      input.aimY=safeAim.y;
    }

    return baseFireWeapon(owner,safeAim.x,safeAim.y);
  };

  const baseStartRun=startRun;
  startRun=function(...args){
    const result=baseStartRun(...args);
    if(player){
      const aim=normalizedAim(input.aimX,input.aimY,player.angle||0);
      lastAimX=aim.x;
      lastAimY=aim.y;
      input.aimX=aim.x;
      input.aimY=aim.y;
    }
    return result;
  };

  /* 참가자의 입력 변경을 다음 저주기 틱까지 기다리지 않고 즉시 전송한다.
     포인터 이동은 짧게 합쳐 과도한 Broadcast를 방지한다. */
  let fastInputTimer=0;
  let lastFastInputAt=0;
  function queueFastMultiplayerInput(delay=0){
    if(!multiplayer.active||multiplayer.isHost||state!=="playing")return;
    const elapsed=performance.now()-lastFastInputAt;
    const wait=Math.max(delay,36-elapsed);
    clearTimeout(fastInputTimer);
    fastInputTimer=setTimeout(()=>{
      fastInputTimer=0;
      if(!multiplayer.active||multiplayer.isHost||state!=="playing")return;
      lastFastInputAt=performance.now();
      sendMultiplayerInput(true);
    },Math.max(0,wait));
  }
  for(const eventName of ["keydown","keyup","pointerdown","pointerup"]){
    addEventListener(eventName,()=>queueFastMultiplayerInput(0),{passive:true});
  }
  canvas.addEventListener("pointermove",()=>{
    if(input.firing)queueFastMultiplayerInput(54);
  },{passive:true});

  /* 끊긴 참가자의 마지막 이동/사격 입력이 방장에서 오래 재생되지 않게 한다. */
  const baseGetPlayerControl=getPlayerControl;
  getPlayerControl=function(owner){
    if(owner&&!owner.local){
      const remote=multiplayer.remoteInputs.get(owner.id);
      const age=typeof getRemoteInputAge==="function"
        ? getRemoteInputAge(remote)
        : Infinity;
      if(age>1400){
        if(age>5000)multiplayer.remoteInputs.delete(owner.id);
        return{
          x:0,
          y:0,
          aimX:Number.isFinite(owner.angle)?Math.cos(owner.angle):1,
          aimY:Number.isFinite(owner.angle)?Math.sin(owner.angle):0,
          firing:false,
          auto:false
        };
      }
    }
    return baseGetPlayerControl(owner);
  };

  /* 패킷 간격이 벌어진 짧은 구간만 속도 기반으로 조금 더 예측한다.
     0.95초가 넘으면 폭주 이동을 막기 위해 예측을 중단하고 재동기화를 요청한다. */
  const baseUpdateClientNetworkVisuals=updateClientNetworkVisuals;
  updateClientNetworkVisuals=function(dt){
    const result=baseUpdateClientNetworkVisuals(dt);
    if(!multiplayer.active||multiplayer.isHost)return result;

    const time=performance.now();
    const frameAge=time-(multiplayer.lastSnapshotAt||time);
    if(frameAge>950){
      window.__lastWaveV97?.requestResync?.("v99-frame-gap");
      return result;
    }

    const visualDt=Math.min(.05,Math.max(0,dt));
    const blend=1-Math.pow(.012,visualDt);
    const extend=(entity,maxHorizon)=>{
      const sampleAge=Math.max(0,(time-(entity._netSampleAt||time))/1000);
      if(sampleAge<.18||sampleAge>.95||!Number.isFinite(entity._netTargetX)||!Number.isFinite(entity._netTargetY))return;
      const horizon=Math.min(maxHorizon,sampleAge);
      const targetX=entity._netTargetX+(Number(entity._netVelocityX)||0)*horizon;
      const targetY=entity._netTargetY+(Number(entity._netVelocityY)||0)*horizon;
      if(Number.isFinite(targetX))entity.x=lerp(entity.x,targetX,blend);
      if(Number.isFinite(targetY))entity.y=lerp(entity.y,targetY,blend);
    };

    for(const member of players.values()){
      if(member.id!==save.playerId)extend(member,.42);
    }
    for(const enemy of enemies)extend(enemy,.38);
    return result;
  };

  /* 지연이 커졌을 때 기존 혼잡 배수가 프레임을 지나치게 늦추지 않도록
     위치 프레임만 완만하게 보정하고 무거운 스냅샷 주기는 그대로 둔다. */
  const baseGetMultiplayerSyncProfile=getMultiplayerSyncProfile;
  getMultiplayerSyncProfile=function(){
    const base=baseGetMultiplayerSyncProfile();
    if(!multiplayer.active)return base;
    const degraded=multiplayer.latencyMs>180||multiplayer.jitterMs>75;
    if(!degraded)return base;
    return{
      ...base,
      inputActive:Math.max(.065,base.inputActive*.78),
      frame:Math.max(.085,base.frame*.72)
    };
  };

  setInterval(()=>{
    if(!multiplayer.active)return;
    const time=Date.now();
    if(multiplayer.isHost){
      for(const [id,remote] of multiplayer.remoteInputs){
        const sentAt=Number(remote?.__lw?.sentAt)||0;
        if(sentAt&&time-sentAt>1800)multiplayer.remoteInputs.delete(id);
      }
    }else if(state==="playing"){
      const frameAge=performance.now()-(multiplayer.lastSnapshotAt||performance.now());
      if(frameAge>800)window.__lastWaveV97?.requestResync?.("v99-watchdog");
    }
  },500);

  window.__lastWaveV99={
    version:99,
    aimDeadZone:AIM_DEAD_ZONE,
    normalizedAim,
    queueFastMultiplayerInput
  };
})();
