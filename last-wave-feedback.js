/* Player feedback form. The server stores it and emails the developer. */
(() => {
  "use strict";
  const URL_PATH="/functions/v1/feedback";
  const byId=id=>document.getElementById(id);
  const overlay=document.createElement("div");
  overlay.id="lw122Feedback";overlay.className="overlay";overlay.setAttribute("aria-hidden","true");
  overlay.innerHTML=`<div class="panel lw122-panel">
    <h2>의견 보내기</h2>
    <p id="lw122FeedbackIntro">버그, 건의, 감상을 자유롭게 적어 주세요. 개인정보는 적지 말아 주세요.</p>
    <textarea id="lw122FeedbackText" class="lw122-feedback-text" maxlength="2000" rows="6" placeholder="의견을 입력하세요"></textarea>
    <small id="lw122FeedbackStatus" role="status"></small>
    <div class="actions">
      <button id="lw122FeedbackSend" class="btn primary" type="button">보내기</button>
      <button id="lw122FeedbackClose" class="btn" type="button">닫기</button>
    </div></div>`;
  document.body.append(overlay);
  const button=document.createElement("button");
  button.id="lw122FeedbackButton";button.className="btn";button.type="button";button.textContent="💬 의견 보내기";
  document.querySelector("#menu .menu-buttons")?.insertBefore(button,byId("helpButton")||null);
  const status=text=>{byId("lw122FeedbackStatus").textContent=text;};
  const open=intro=>{
    status("");
    byId("lw122FeedbackIntro").textContent=intro||"버그, 건의, 감상을 자유롭게 적어 주세요. 개인정보는 적지 말아 주세요.";
    showOverlay(overlay);
  };
  window.__lastWaveFeedback={open};
  button.onclick=()=>open();
  byId("lw122FeedbackClose").onclick=()=>hideOverlay(overlay);
  byId("lw122FeedbackSend").onclick=async()=>{
    const input=byId("lw122FeedbackText"),send=byId("lw122FeedbackSend"),message=input.value.trim();
    if(message.length<2){status("두 글자 이상 입력해 주세요.");return;}
    send.disabled=true;status("보내는 중입니다…");
    try{
      const response=await fetch(SUPABASE_URL+URL_PATH,{
        method:"POST",
        headers:{"Content-Type":"application/json",apikey:SUPABASE_PUBLISHABLE_KEY},
        body:JSON.stringify({
          message,nickname:String(save.nickname||""),version:GAME_VERSION,
          plays:getProfileStats().runs,source:window.__lastWaveAnalytics?.source||""
        })
      });
      if(response.status===429)status("잠시 후 다시 보내 주세요.");
      else if(!response.ok)status("보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
      else{input.value="";status("보냈습니다. 고맙습니다!");window.__lastWaveAnalytics?.track("feedback");}
    }catch{
      status("인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
    }finally{
      send.disabled=false;
    }
  };
})();
