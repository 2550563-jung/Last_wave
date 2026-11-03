/* Game over actions: share the run as an image, and ask for an honest opinion. */
(() => {
  "use strict";
  const GAME_URL="https://2550563-jung.github.io/Last_wave/?ref=share";
  const NEWCOMER_RUNS=3;
  const byId=id=>document.getElementById(id);
  const actions=byId("gameOver")?.querySelector(".actions");
  if(!actions)return;

  const box=document.createElement("div");
  box.id="lw124GameOverActions";
  box.innerHTML=`<p id="lw124FeedbackAsk"></p>
    <div class="lw124-buttons">
      <button id="lw124ShareButton" class="btn primary" type="button">기록 공유하기</button>
      <button id="lw124FeedbackButton" class="btn" type="button">의견 보내기</button>
    </div>
    <small id="lw124ShareStatus" role="status"></small>`;
  actions.before(box);

  function runSummary(){
    return{
      score:Math.max(0,Math.floor(Number(score)||0)),
      wave:Math.max(1,Math.floor(Number(wave)||1)),
      kills:Math.max(0,Math.floor(Number(player?.kills)||0)),
      job:JOBS[player?.job]?.name||"생존자",
      daily:gameMode==="daily"
    };
  }

  function loadIcon(){
    return new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>resolve(null);
      image.src="./icons/last-wave-192.png?v=108";
    });
  }

  async function drawCard(run){
    const canvas=document.createElement("canvas");
    canvas.width=1200;canvas.height=630;
    const ctx=canvas.getContext("2d");
    const font=(weight,size)=>`${weight} ${size}px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif`;
    ctx.fillStyle="#1b232c";ctx.fillRect(0,0,1200,630);
    // Crosswalk on the right edge and a double lane line, as on the game's road.
    ctx.fillStyle="#2a3540";
    for(let y=0;y<630;y+=90)ctx.fillRect(960,y,240,45);
    ctx.fillStyle="#f2b92c";ctx.fillRect(48,48,6,534);ctx.fillRect(62,48,6,534);
    const icon=await loadIcon();
    if(icon)ctx.drawImage(icon,104,52,84,84);
    ctx.fillStyle="#eef1f3";ctx.font=font(800,50);ctx.textBaseline="middle";
    ctx.fillText("Last Wave",206,96);
    ctx.fillStyle="#b4bfc9";ctx.font=font(600,32);ctx.textBaseline="alphabetic";
    ctx.fillText(run.daily?`${v56KstDateKey()} 일일 도전`:`${run.job}의 기록`,104,206);
    ctx.fillStyle="#f2b92c";ctx.font=font(900,136);
    ctx.fillText(`웨이브 ${formatNumber(run.wave)}`,100,340);
    ctx.fillStyle="#eef1f3";ctx.font=font(700,46);
    ctx.fillText(`점수 ${formatNumber(run.score)}  ·  처치 ${formatNumber(run.kills)}`,104,422);
    ctx.fillStyle="#b4bfc9";ctx.font=font(600,30);
    ctx.fillText("설치 없이 브라우저에서 바로 플레이",104,516);
    ctx.fillStyle="#eef1f3";ctx.font=font(700,28);
    ctx.fillText("2550563-jung.github.io/Last_wave",104,560);
    return canvas;
  }

  const status=text=>{byId("lw124ShareStatus").textContent=text;};

  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true;}catch{return false;}
  }

  async function share(){
    const button=byId("lw124ShareButton"),run=runSummary();
    const text=`Last Wave ${run.daily?"일일 도전 ":""}웨이브 ${run.wave}, 점수 ${formatNumber(run.score)} 기록! 나보다 오래 버틸 수 있어?`;
    button.disabled=true;status("");
    try{
      const canvas=await drawCard(run);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
      const file=blob&&new File([blob],`last-wave-wave-${run.wave}.png`,{type:"image/png"});
      if(file&&navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],text:`${text}\n${GAME_URL}`});
      }else if(navigator.share&&/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)){
        await navigator.share({text,url:GAME_URL});
      }else{
        if(blob){
          const link=document.createElement("a");
          link.href=URL.createObjectURL(blob);link.download=file.name;link.click();
          setTimeout(()=>URL.revokeObjectURL(link.href),10000);
        }
        const copied=await copyText(`${text}\n${GAME_URL}`);
        status(copied?"이미지를 저장하고 공유 문구를 복사했습니다. 붙여 넣어 공유하세요.":"이미지를 저장했습니다. 게임 링크와 함께 공유하세요.");
      }
      window.__lastWaveAnalytics?.track("share",{wave:run.wave,mode:run.daily?"daily":"normal"});
    }catch(error){
      if(error?.name!=="AbortError")status("공유하지 못했습니다. 다시 시도해 주세요.");
    }finally{
      button.disabled=false;
    }
  }

  const isNewcomer=()=>getProfileStats().runs<=NEWCOMER_RUNS;
  const askText="처음 해 본 소감을 들려주세요. 어디서 막혔는지, 뭐가 재미있었는지 한 줄이면 충분합니다.";
  function refresh(){
    const ask=byId("lw124FeedbackAsk");
    ask.textContent=isNewcomer()?askText:"";
    ask.hidden=!isNewcomer();
    status("");
  }

  byId("lw124ShareButton").onclick=share;
  byId("lw124FeedbackButton").onclick=()=>window.__lastWaveFeedback?.open(isNewcomer()?`${askText} 개인정보는 적지 말아 주세요.`:undefined);
  const previousFinishRun=finishRun;
  finishRun=function(...args){refresh();return previousFinishRun(...args);};
  refresh();
  window.__lastWaveShare={drawCard,runSummary,refresh};
})();
