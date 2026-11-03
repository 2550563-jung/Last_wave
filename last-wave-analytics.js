/* Anonymous visit statistics: a random id in this browser, no IP or nickname. */
(() => {
  "use strict";
  const ID_KEY="lw_visitor_id",OFF_KEY="lw_analytics_off",FORCE_KEY="lw_analytics_force",SOURCE_KEY="lw_visit_source",DAY_KEY="lw_visit_day";
  const read=(store,key)=>{try{return store.getItem(key);}catch{return null;}};
  const write=(store,key,value)=>{try{store.setItem(key,value);}catch{}};
  const params=new URLSearchParams(location.search);
  if(params.get("analytics")==="off")write(localStorage,OFF_KEY,"1");
  if(params.get("analytics")==="on")try{localStorage.removeItem(OFF_KEY);}catch{}

  const enabled=read(localStorage,FORCE_KEY)==="1"||(
    location.hostname.endsWith("github.io")&&read(localStorage,OFF_KEY)!=="1"
  );

  function cleanSource(value){
    const text=String(value||"").trim().toLowerCase().replace(/^www\./,"");
    return /^[a-z0-9._-]{1,64}$/.test(text)?text:"";
  }
  function detectSource(){
    const kept=read(sessionStorage,SOURCE_KEY);
    if(kept)return kept;
    let referrer="";
    try{
      const url=document.referrer?new URL(document.referrer):null;
      if(url&&url.hostname!==location.hostname)referrer=url.hostname;
      else if(url&&url.pathname.includes("/about"))referrer="about";
    }catch{}
    const source=cleanSource(params.get("ref")||params.get("utm_source"))||cleanSource(referrer)||"direct";
    write(sessionStorage,SOURCE_KEY,source);
    return source;
  }
  function detectDevice(){
    if(/Electron/i.test(navigator.userAgent))return"windows_app";
    if(/iPad|Tablet/i.test(navigator.userAgent))return"tablet";
    if(/Mobi|Android|iPhone/i.test(navigator.userAgent))return"mobile";
    return"desktop";
  }

  let visitorId=read(localStorage,ID_KEY);
  const firstVisit=!visitorId&&getProfileStats().runs===0;
  if(!visitorId){
    visitorId=crypto.randomUUID?.()||"";
    if(visitorId)write(localStorage,ID_KEY,visitorId);
  }
  const source=detectSource(),device=detectDevice();

  function track(event,extra={}){
    if(!enabled||!visitorId)return;
    fetch(SUPABASE_URL+"/functions/v1/analytics",{
      method:"POST",
      headers:{"Content-Type":"application/json",apikey:SUPABASE_PUBLISHABLE_KEY},
      body:JSON.stringify({visitorId,event,source,device,firstVisit,version:GAME_VERSION,...extra}),
      keepalive:true
    }).catch(()=>{});
  }

  const today=v56KstDateKey();
  if(read(localStorage,DAY_KEY)!==today){
    write(localStorage,DAY_KEY,today);
    track("visit");
  }

  const previousStartRun=startRun;
  startRun=function(...args){
    const result=previousStartRun(...args);
    track("run_start",{mode:String(args[0]||gameMode||"normal")});
    return result;
  };
  const previousFinishRun=finishRun;
  finishRun=function(...args){
    if(!runEnded)track("run_end",{mode:String(gameMode||"normal"),wave});
    return previousFinishRun(...args);
  };

  window.__lastWaveAnalytics={track,source,firstVisit,enabled};
})();
