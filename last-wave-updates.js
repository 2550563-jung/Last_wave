/* Release notes shown once to each player after an update. Add one entry per release. */
(() => {
  "use strict";
  const UPDATES={
    v123:[
      "일일 랭킹이 이제 매일 새로 시작합니다. 한국 시간 자정마다 새 순위표가 열립니다.",
      "랭킹 화면에서 어느 날짜의 일일 랭킹인지 볼 수 있습니다."
    ],
    v122:[
      "변이 적, 웨이브 이벤트, 보급 상자, 위험 계약을 멀티플레이에서도 함께 즐길 수 있습니다.",
      "일일 미션과 업적의 팀 진행도가 모든 플레이어에게 반영됩니다.",
      "메인 화면의 설정 버튼을 하나로 합쳤습니다.",
      "메인 화면에서 개발자에게 의견을 보낼 수 있습니다.",
      "업데이트 뒤 처음 들어오면 이 안내가 나옵니다."
    ],
    v121:[
      "새 변이 적: 돌격체, 분열체, 치유체",
      "웨이브 이벤트: 보급 낙하, 황금 습격, 핏빛 달",
      "상점에서 고르는 위험 계약과 보스 보급 상자",
      "일일 미션, 새 업적 6개, 첫 판 안내"
    ]
  };
  const STORE_KEY="lw_seen_update";
  function seen(){
    try{return localStorage.getItem(STORE_KEY);}catch{return GAME_VERSION;}
  }
  function markSeen(){
    try{localStorage.setItem(STORE_KEY,GAME_VERSION);}catch{}
  }
  function show(){
    const notes=UPDATES[GAME_VERSION];
    if(!notes||seen()===GAME_VERSION||document.getElementById("lw122Updates"))return;
    const overlay=document.createElement("div");
    overlay.id="lw122Updates";overlay.className="overlay";
    overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");
    const items=notes.map(note=>`<li>${note}</li>`).join("");
    overlay.innerHTML=`<div class="panel lw122-panel"><div class="eyebrow">UPDATE</div>
      <h2>${GAME_VERSION} 업데이트 내용</h2><ul class="lw121-notes">${items}</ul>
      <div class="actions"><button id="lw122UpdatesClose" class="btn primary" type="button">확인</button></div></div>`;
    document.body.append(overlay);
    document.getElementById("lw122UpdatesClose").onclick=()=>{markSeen();hideOverlay(overlay);overlay.remove();};
    showOverlay(overlay);
  }
  window.__lastWaveUpdates={UPDATES,show};
  if(document.readyState==="complete")show();else addEventListener("load",show,{once:true});
})();
