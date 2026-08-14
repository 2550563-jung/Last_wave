/* LAST WAVE v111 · boss overhaul and advanced settings */
(() => {
  "use strict";
  const SETTINGS_KEY="lastWaveAdvancedSettingsV111";
  const defaults={uiScale:100,shake:100,overlayAlpha:88,compactHud:false,showNetwork:true,showPings:true,showBossHud:true,showMissionHud:true,reducedFlash:false,colorMode:"normal",focusPause:true,layoutPreset:"default"};
  let advanced={...defaults};
  try{advanced={...defaults,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")};}catch{}
  const byId=id=>document.getElementById(id);
  const persistAdvanced=()=>localStorage.setItem(SETTINGS_KEY,JSON.stringify(advanced));

  function applyAdvanced(){
    document.body.style.setProperty("--lw111-ui-scale",String(Math.max(.8,Math.min(1.25,advanced.uiScale/100))));
    document.body.style.setProperty("--lw111-overlay-alpha",String(advanced.overlayAlpha/100));
    document.body.classList.toggle("lw111-compact-hud",advanced.compactHud);
    document.body.classList.toggle("lw111-hide-network",!advanced.showNetwork);
    document.body.classList.toggle("lw111-hide-pings",!advanced.showPings);
    document.body.classList.toggle("lw111-hide-boss-hud",!advanced.showBossHud);
    document.body.classList.toggle("lw111-hide-mission-hud",!advanced.showMissionHud);
    document.body.classList.toggle("lw111-reduced-flash",advanced.reducedFlash);
    for(const mode of["protanopia","deuteranopia","tritanopia"])document.body.classList.toggle(`lw111-color-${mode}`,advanced.colorMode===mode);
    document.body.dataset.lw111Layout=advanced.layoutPreset;
    persistAdvanced();
  }

  function settingCard(label,control,help=""){return `<div class="lw111-setting"><label>${label}</label>${control}${help?`<small>${help}</small>`:""}</div>`;}
  function toggle(id,label,help){return settingCard(label,`<label class="lw111-switch"><span>${label}</span><input id="${id}" type="checkbox"></label>`,help);}
  function ensureSettings(){
    if(byId("lw111SettingsOverlay"))return;
    document.body.insertAdjacentHTML("beforeend",`<div id="lw111SettingsOverlay" class="overlay"><div class="panel hero lw111-settings-panel"><div class="eyebrow">LAST WAVE CONTROL CENTER</div><h2>설정</h2><p>그래픽·사운드·화면 표시와 위치 조정을 한곳에서 관리합니다.</p><div class="section-title">기본 설정</div><div class="lw111-settings-existing"></div><div class="section-title">화면 · 접근성</div><div class="lw111-settings-grid">
      ${settingCard("HUD 크기",'<input id="lw111UiScale" type="range" min="80" max="125" step="1"><span id="lw111UiScaleText" class="audio-value"></span>')}
      ${settingCard("화면 흔들림",'<input id="lw111Shake" type="range" min="0" max="100" step="5"><span id="lw111ShakeText" class="audio-value"></span>')}
      ${settingCard("색각 보정",'<select id="lw111ColorMode"><option value="normal">기본</option><option value="protanopia">적색 보정</option><option value="deuteranopia">녹색 보정</option><option value="tritanopia">청황색 보정</option></select>')}
      ${settingCard("HUD 배치",'<select id="lw111LayoutPreset"><option value="default">기본</option><option value="compact">컴팩트</option><option value="wide">넓게</option></select>')}
      ${toggle("lw111CompactHud","HUD 작게 표시")}
      ${toggle("lw111ShowNetwork","네트워크 상태 표시")}
      ${toggle("lw111ShowPings","소집·위험·보스 글씨 표시")}
      ${toggle("lw111ShowBossHud","보스 체력 표시")}
      ${toggle("lw111ShowMissionHud","임무 표시")}
      ${toggle("lw111ReducedFlash","번쩍임 줄이기")}
      ${toggle("lw111FocusPause","창을 벗어나면 자동 일시정지","솔로 플레이에서만 적용됩니다.")}
    </div><div class="section-title">팝업 · HUD 위치</div><p>평소에는 팝업과 HUD를 끌어 움직일 수 없습니다. 아래 버튼으로 위치 조정 모드에 들어간 동안만 이동할 수 있습니다.</p><div class="actions"><button id="lw111EditLayout" class="btn gold-btn">위치 조정 모드</button><button id="lw111ResetLayout" class="btn">모든 위치 초기화</button><button id="lw111Fullscreen" class="btn">전체 화면 전환</button></div><div class="actions"><button id="lw111SettingsClose" class="btn primary">설정 저장하고 닫기</button></div></div></div>`);
    const existing=document.querySelector("#menu .menu-settings");
    if(existing)byId("lw111SettingsOverlay").querySelector(".lw111-settings-existing").append(existing);
    const menuButtons=document.querySelector("#menu .menu-buttons");
    if(menuButtons&&!byId("lw111SettingsButton")){const b=document.createElement("button");b.id="lw111SettingsButton";b.className="btn";b.textContent="⚙ 설정";menuButtons.prepend(b);b.onclick=openSettings;}
    bindSettings();
  }

  function bindSettings(){
    const pairs=[
      ["lw111CompactHud","compactHud"],["lw111ShowNetwork","showNetwork"],["lw111ShowPings","showPings"],["lw111ShowBossHud","showBossHud"],["lw111ShowMissionHud","showMissionHud"],["lw111ReducedFlash","reducedFlash"],["lw111FocusPause","focusPause"]
    ];
    for(const[id,key]of pairs){const el=byId(id);el.checked=Boolean(advanced[key]);el.onchange=()=>{advanced[key]=el.checked;applyAdvanced();};}
    const ranges=[["lw111UiScale","uiScale","lw111UiScaleText","%"],["lw111Shake","shake","lw111ShakeText","%"]];
    for(const[id,key,textId,suffix]of ranges){const el=byId(id);el.value=advanced[key];const update=()=>{advanced[key]=Number(el.value);byId(textId).textContent=el.value+suffix;applyAdvanced();};el.oninput=update;update();}
    byId("lw111ColorMode").value=advanced.colorMode;byId("lw111ColorMode").onchange=e=>{advanced.colorMode=e.target.value;applyAdvanced();};
    byId("lw111LayoutPreset").value=advanced.layoutPreset;byId("lw111LayoutPreset").onchange=e=>{advanced.layoutPreset=e.target.value;applyAdvanced();};
    byId("lw111SettingsClose").onclick=()=>{endLayoutEdit();hideOverlay(byId("lw111SettingsOverlay"));};
    byId("lw111EditLayout").onclick=startLayoutEdit;
    byId("lw111ResetLayout").onclick=()=>{document.querySelectorAll(".popup-draggable-panel").forEach(p=>setPopupPanelOffset(p,0,0));document.querySelectorAll(".game-ui-movable").forEach(resetMovableGameUi);showMessage("화면 위치 초기화","모든 팝업과 HUD를 기본 위치로 되돌렸습니다.");};
    byId("lw111Fullscreen").onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{showMessage("전체 화면","이 기기에서는 전체 화면을 사용할 수 없습니다.");}};
  }
  function openSettings(){endLayoutEdit();showOverlay(byId("lw111SettingsOverlay"));}
  function startLayoutEdit(){hideOverlay(byId("lw111SettingsOverlay"));document.body.classList.add("lw111-layout-edit");if(!byId("lw111LayoutBanner")){const b=document.createElement("div");b.id="lw111LayoutBanner";b.innerHTML='<span>위치 조정 중 · HUD/팝업 위쪽을 끌어 이동</span><button class="btn gold-btn" type="button">완료</button>';document.body.append(b);b.querySelector("button").onclick=()=>{endLayoutEdit();openSettings();};}}
  function endLayoutEdit(){document.body.classList.remove("lw111-layout-edit");byId("lw111LayoutBanner")?.remove();}

  /* 보스는 일반 좀비와 완전히 다른 10개 실루엣을 가진다. */
  function drawDistinctBoss(enemy){
    const p=project(enemy.x,enemy.y),index=Math.max(0,Number(enemy.bossIndex)||0)%10,t=performance.now()*.003,flash=enemy.hitFlash>0;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(1.28,1.28);ctx.rotate(Math.sin(t+(enemy.gait||0))*.025);ctx.lineCap="round";ctx.lineJoin="round";
    ctx.shadowBlur=18;ctx.shadowColor=enemy.color;ctx.strokeStyle=flash?"#fff":enemy.color;ctx.fillStyle=flash?"#fff":enemy.color;ctx.lineWidth=4;
    ctx.globalAlpha=.23;ctx.beginPath();ctx.ellipse(0,30,46,14,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    const eye=()=>{ctx.fillStyle="#fff07a";ctx.shadowColor="#fff07a";ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,-13,5,0,Math.PI*2);ctx.fill();};
    if(index===0){ctx.fillRect(-24,-30,48,55);ctx.fillStyle="#e3d4b0";ctx.fillRect(-17,-4,34,27);ctx.beginPath();ctx.arc(0,-40,15,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#d6e6ea";ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(22,-15);ctx.lineTo(45,-33);ctx.lineTo(50,-16);ctx.stroke();eye();}
    else if(index===1){ctx.beginPath();ctx.ellipse(0,-2,38,42,0,0,Math.PI*2);ctx.fill();for(const s of[-1,1])for(const y of[-22,8]){ctx.beginPath();ctx.moveTo(s*24,y);ctx.lineTo(s*(52+Math.sin(t+y)*5),y+12);ctx.stroke();}for(let i=0;i<6;i++){ctx.fillStyle=i%2?"#b56cff":"#ff7599";ctx.beginPath();ctx.arc(Math.cos(i)*23,-5+Math.sin(i*2)*25,5,0,7);ctx.fill();}eye();}
    else if(index===2){ctx.beginPath();ctx.ellipse(0,4,34,47,0,0,7);ctx.fill();ctx.fillStyle="#9cff79";for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(-22+i*11,8+Math.sin(i)*16,8,0,7);ctx.fill();}ctx.strokeStyle="#74d65f";for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-25+i*13,25);ctx.quadraticCurveTo(-40+i*20,45,-32+i*16,58);ctx.stroke();}eye();}
    else if(index===3){ctx.fillStyle="#485761";ctx.fillRect(-31,-35,62,65);ctx.strokeStyle="#b7d5e6";ctx.strokeRect(-31,-35,62,65);ctx.fillStyle="#718896";ctx.fillRect(-38,-25,14,42);ctx.fillRect(24,-25,14,42);ctx.fillRect(-22,-48,44,17);ctx.fillStyle="#ff4949";ctx.fillRect(-12,-42,24,4);}
    else if(index===4){ctx.rotate(-.15);ctx.beginPath();ctx.ellipse(0,2,42,25,0,0,7);ctx.fill();ctx.strokeStyle="#d8735d";ctx.lineWidth=10;for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(s*22,12);ctx.lineTo(s*38,38);ctx.stroke();}ctx.beginPath();ctx.moveTo(-18,-12);ctx.lineTo(-35,-34);ctx.moveTo(18,-12);ctx.lineTo(35,-34);ctx.stroke();eye();}
    else if(index===5){ctx.beginPath();ctx.ellipse(0,8,30,44,0,0,7);ctx.fill();ctx.strokeStyle="#d8bd63";for(let i=0;i<8;i++){const a=i/8*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*25,Math.sin(a)*30);ctx.lineTo(Math.cos(a)*48,Math.sin(a)*48);ctx.stroke();}ctx.fillStyle="#e6c85b";ctx.beginPath();ctx.moveTo(-18,-38);ctx.lineTo(-8,-58);ctx.lineTo(0,-41);ctx.lineTo(10,-60);ctx.lineTo(20,-37);ctx.closePath();ctx.fill();eye();}
    else if(index===6){ctx.globalAlpha=.8;ctx.fillStyle="#312553";ctx.beginPath();ctx.moveTo(0,-58);ctx.lineTo(30,-20);ctx.lineTo(19,36);ctx.lineTo(0,58);ctx.lineTo(-20,35);ctx.lineTo(-30,-20);ctx.closePath();ctx.fill();ctx.strokeStyle="#9c78ff";for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(Math.sin(t+i)*55,-30+i*13,Math.cos(i)*55,-34+i*15);ctx.stroke();}eye();}
    else if(index===7){ctx.strokeStyle="#e7dfc5";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,-45);ctx.lineTo(0,30);for(let i=0;i<5;i++){ctx.moveTo(0,-25+i*12);ctx.lineTo(-25,-18+i*12);ctx.moveTo(0,-25+i*12);ctx.lineTo(25,-18+i*12);}ctx.stroke();ctx.fillStyle="#dcd3b9";ctx.beginPath();ctx.arc(0,-50,17,0,7);ctx.fill();ctx.strokeStyle="#cabf9e";ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(18,-4);ctx.lineTo(48,26);ctx.stroke();eye();}
    else if(index===8){ctx.rotate(t*.18);ctx.strokeStyle="#75d9ff";ctx.lineWidth=5;for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(0,0,17+i*10,i*.7,Math.PI*1.35+i*.7);ctx.stroke();}ctx.rotate(-t*.18);ctx.fillStyle="#d9fbff";ctx.beginPath();ctx.arc(0,0,17,0,7);ctx.fill();ctx.strokeStyle="#8de7ff";for(let i=0;i<6;i++){const a=i/6*Math.PI*2+t;ctx.beginPath();ctx.moveTo(Math.cos(a)*28,Math.sin(a)*28);ctx.lineTo(Math.cos(a+.25)*53,Math.sin(a+.25)*53);ctx.stroke();}}
    else{ctx.rotate(t*.12);for(let i=0;i<9;i++){const a=i/9*Math.PI*2,r=16+(i%3)*9;ctx.fillStyle=i%2?"#b13f9a":"#5b214f";ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a+.35)*(r+27),Math.sin(a+.35)*(r+27));ctx.lineTo(Math.cos(a-.35)*(r+19),Math.sin(a-.35)*(r+19));ctx.closePath();ctx.fill();}ctx.rotate(-t*.12);eye();}
    if(!enemy.weakBroken){ctx.fillStyle="#fff36d";ctx.shadowBlur=22;ctx.shadowColor="#fff36d";ctx.beginPath();ctx.arc(14,-5,6+Math.sin(t*4)*1.5,0,7);ctx.fill();}
    ctx.restore();
  }

  const baseDrawEnemy=drawEnemy;
  drawEnemy=function(enemy){if(enemy?.boss&&!enemy.dead){drawDistinctBoss(enemy);return;}return baseDrawEnemy(enemy);};
  const baseSpawnBoss=spawnBoss;
  spawnBoss=function(){const before=enemies.length,result=baseSpawnBoss();for(let i=before;i<enemies.length;i++){const boss=enemies[i];if(!boss?.boss||boss._v111Boosted)continue;boss._v111Boosted=true;boss.maxHp*=2.45;boss.hp=boss.maxHp;boss.damage*=1.75;boss.speed*=1.16;boss.radius=Math.max(boss.radius,58);}return result;};
  const baseUpdate=update;
  update=function(dt){const result=baseUpdate(dt);if(advanced.shake<100&&camera)camera.shake*=advanced.shake/100;return result;};
  document.addEventListener("visibilitychange",()=>{if(!document.hidden||!advanced.focusPause||multiplayer?.active||state!=="playing")return;byId("pauseButton")?.click();});
  ensureSettings();applyAdvanced();
})();
