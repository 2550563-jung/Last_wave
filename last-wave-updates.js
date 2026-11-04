/* Release notes shown once to each player after an update. Add one entry per release. */
(() => {
  "use strict";
  const UPDATES={
    v126:[
      "영어 버전을 추가했습니다. 메인 화면의 언어 버튼으로 바꿀 수 있고, 한국어가 아닌 브라우저에서는 영어로 시작합니다. 자세한 게임 설명은 아직 한국어입니다."
    ],
    v125:[
      "메인 화면 맨 위의 '바로 시작'으로 곧장 플레이할 수 있습니다. 닉네임과 계정 칸은 접어 두었습니다.",
      "처음 두 판은 초반 적이 약하게 나오고, 조작법을 차례로 알려 줍니다.",
      "크리에이티브 모드: 적, 보스, 플레이어, 자금, 게임 속도까지 직접 조정합니다. 관리자 체험도 할 수 있습니다. 랭킹과 보상에는 반영되지 않습니다.",
      "25웨이브마다 구역이 바뀝니다: 지하철, 연구소, 폭풍 항구, 붕괴 지대. 구역마다 위험 요소가 다릅니다.",
      "보스 10종에 전용 패턴과 전리품이 생겼습니다.",
      "기록을 공유하면 친구가 같은 출발 조건으로 도전하는 링크가 만들어집니다. 멀티플레이 방에도 초대 링크가 생겼습니다.",
      "게임이 끝나면 다음 목표를 보여 주고, 바로 다시 할 수 있습니다."
    ],
    v124:[
      "게임이 끝난 화면에서 기록 이미지를 친구에게 공유할 수 있습니다.",
      "게임이 끝난 화면에서 바로 의견을 보낼 수 있습니다.",
      "안 본 업데이트가 여러 개면 이 안내에 한 번에 모아서 보여 줍니다.",
      "게임 개선을 위해 방문과 플레이 횟수를 익명으로 집계합니다. IP 주소와 닉네임은 저장하지 않습니다."
    ],
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
  const versionNumber=version=>Number(/^v(\d+)$/.exec(version||"")?.[1])||0;
  // Every release the player has not seen, newest first. A player with no
  // history only gets the current release, not the whole changelog.
  function pendingVersions(lastSeen){
    const current=versionNumber(GAME_VERSION),last=versionNumber(lastSeen);
    if(!UPDATES[GAME_VERSION]||last>=current)return[];
    if(!last)return[GAME_VERSION];
    return Object.keys(UPDATES)
      .filter(version=>versionNumber(version)>last&&versionNumber(version)<=current)
      .sort((a,b)=>versionNumber(b)-versionNumber(a));
  }
  function show(){
    const versions=pendingVersions(seen());
    if(!versions.length||document.getElementById("lw122Updates"))return;
    const overlay=document.createElement("div");
    overlay.id="lw122Updates";overlay.className="overlay";
    overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");
    const list=notes=>`<ul class="lw121-notes">${notes.map(note=>`<li>${note}</li>`).join("")}</ul>`;
    const body=versions.length===1
      ? list(UPDATES[versions[0]])
      : versions.map(version=>`<h3 class="lw124-update-version">${version}</h3>${list(UPDATES[version])}`).join("");
    overlay.innerHTML=`<div class="panel lw122-panel"><div class="eyebrow">UPDATE</div>
      <h2>${GAME_VERSION} 업데이트 내용</h2>${body}
      <div class="actions"><button id="lw122UpdatesClose" class="btn primary" type="button">확인</button></div></div>`;
    document.body.append(overlay);
    document.getElementById("lw122UpdatesClose").onclick=()=>{markSeen();hideOverlay(overlay);overlay.remove();};
    showOverlay(overlay);
  }
  window.__lastWaveUpdates={UPDATES,show,pendingVersions};
  if(document.readyState==="complete")show();else addEventListener("load",show,{once:true});
})();
