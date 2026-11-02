
/* =========================================================
   LAST WAVE v84
   관리자 강화 · 관리자 버프 · 업적 확장 · 일일 도전 버프
========================================================= */

/* ---------- v82 자동 이미지 장식 기능 완전 비활성화 ---------- */
function v84StripAutoImages(root=document){
  for(const node of root.querySelectorAll?.(".v82-feature-art,.v82-card-art")||[]){
    node.remove();
  }
  for(const button of root.querySelectorAll?.(".v82-iconized")||[]){
    button.classList.remove("v82-iconized");
    button.style.removeProperty("--v82-icon");
  }
}

v84StripAutoImages(document);

if(typeof v82DecorateButtons==="function"){
  v82DecorateButtons=function(){};
}
if(typeof v82DecorateCards==="function"){
  v82DecorateCards=function(){};
}

/* 기존 v82 렌더러가 카드 이미지를 다시 만들더라도 즉시 제거 */
for(const name of [
  "v82RenderAchievements",
  "v82RenderSkins",
  "v82RenderPermanent",
  "v82RenderExchange",
  "v82RenderTalents",
  "v82RenderMastery"
]){
  const original=globalThis[name];
  if(typeof original!=="function") continue;

  globalThis[name]=function(...args){
    const result=original.apply(this,args);
    v84StripAutoImages(document);
    return result;
  };
}

/* ---------- 업적 확장 ---------- */
function v84TotalTalentLevels(){
  let total=0;

  for(const levels of Object.values(save.jobTalentsV82||{})){
    if(!levels||typeof levels!=="object") continue;

    for(const value of Object.values(levels)){
      total+=Math.max(
        0,
        Math.floor(Number(value)||0)
      );
    }
  }

  return total;
}

function v84HighestMastery(){
  let highest=0;

  for(const xp of Object.values(save.weaponMasteryV82||{})){
    highest=Math.max(
      highest,
      v82MasteryLevel(xp)
    );
  }

  return highest;
}

function v84AddAchievement(definition){
  if(
    !V82_ACHIEVEMENTS.some(
      item=>item.id===definition.id
    )
  ){
    V82_ACHIEVEMENTS.push(definition);
  }
}

[
  {id:"kills100",name:"거리 청소부",desc:"누적 100킬",target:100,get:()=>save.totalKills,reward:{credits:900}},
  {id:"kills5000",name:"감염체 학살자",desc:"누적 5,000킬",target:5000,get:()=>save.totalKills,reward:{credits:9000,prism:5,relics:2}},
  {id:"kills20000",name:"도시의 마지막 사신",desc:"누적 20,000킬",target:20000,get:()=>save.totalKills,reward:{credits:25000,prism:10,relics:5,talentTokens:4}},
  {id:"wave50",name:"새벽을 거부한 자",desc:"웨이브 50",target:50,get:()=>Math.max(save.bestWave,wave),reward:{credits:8000,prism:5,relics:2}},
  {id:"wave100",name:"백 번째 파동",desc:"웨이브 100",target:100,get:()=>Math.max(save.bestWave,wave),reward:{credits:25000,prism:12,relics:6,talentTokens:5}},
  {id:"boss25",name:"보스 처형인",desc:"보스 25킬",target:25,get:()=>save.bossKillsV82,reward:{credits:8000,relics:5,talentTokens:3}},
  {id:"boss50",name:"거인의 종말",desc:"보스 50킬",target:50,get:()=>save.bossKillsV82,reward:{credits:18000,prism:8,relics:8,talentTokens:5}},
  {id:"events50",name:"특수작전 베테랑",desc:"작전 이벤트 50회",target:50,get:()=>save.eventsCompletedV82,reward:{credits:9000,relics:4}},
  {id:"events100",name:"모든 상황의 생존자",desc:"작전 이벤트 100회",target:100,get:()=>save.eventsCompletedV82,reward:{credits:20000,prism:8,relics:7}},
  {id:"master10weapons",name:"병기고의 주인",desc:"10개 무기 숙련도 5",target:10,get:()=>v82CountMastered(5),reward:{credits:10000,prism:7,talentTokens:3}},
  {id:"mastery10",name:"익숙한 손",desc:"무기 하나 숙련도 10",target:10,get:v84HighestMastery,reward:{credits:4000,prism:3}},
  {id:"mastery25",name:"완전한 숙련",desc:"무기 하나 숙련도 25",target:25,get:v84HighestMastery,reward:{credits:18000,prism:10,relics:5}},
  {id:"allSkins",name:"모든 얼굴의 생존자",desc:"모든 스킨 보유",target:Object.keys(V82_SKINS).length,get:()=>save.ownedSkinsV82.length,reward:{prism:8,relics:5}},
  {id:"talent12",name:"전술 연구원",desc:"직업 특성 총 12레벨 투자",target:12,get:v84TotalTalentLevels,reward:{credits:6000,talentTokens:3}},
  {id:"talent36",name:"특성 전문가",desc:"직업 특성 총 36레벨 투자",target:36,get:v84TotalTalentLevels,reward:{credits:18000,relics:5,talentTokens:6}},
  {id:"extinction10",name:"멸종 생존 시험",desc:"멸종 난이도 웨이브 10",target:10,get:()=>Number(save.difficultyBestV82.extinction||0),reward:{credits:6000,relics:3}},
  {id:"extinction30",name:"멸종을 넘어",desc:"멸종 난이도 웨이브 30",target:30,get:()=>Number(save.difficultyBestV82.extinction||0),reward:{credits:20000,prism:10,relics:8,talentTokens:5}},
  {id:"credits50000",name:"재건 자금",desc:"크레딧 50,000 보유",target:50000,get:()=>save.credits,reward:{prism:7,relics:2}},
  {id:"prestige5",name:"다섯 번째 귀환",desc:"환생 5회",target:5,get:()=>save.prestige,reward:{credits:15000,relics:8,talentTokens:6}},
  {id:"runs100",name:"백 번의 출격",desc:"100회 플레이",target:100,get:()=>save.totalRuns,reward:{credits:12000,prism:8,relics:3}}
].forEach(v84AddAchievement);

/* ---------- 일일 도전 랜덤 버프 ---------- */
const V84_DAILY_BUFFS=[
  {id:"power",name:"화력 지원",desc:"공격력 +20%",apply:o=>{o.damageMult*=1.20;}},
  {id:"vitality",name:"강화 체질",desc:"최대 체력 +25%",apply:o=>{const gain=o.maxHp*.25;o.maxHp+=gain;o.hp+=gain;}},
  {id:"haste",name:"신속 기동",desc:"이동속도 +15%",apply:o=>{o.speed*=1.15;}},
  {id:"regen",name:"응급 재생",desc:"초당 체력 재생 +1.5",apply:o=>{o.regen=(o.regen||0)+1.5;}},
  {id:"shield",name:"보호막 보급",desc:"시작 보호막 +40",apply:o=>{o.maxShield=(o.maxShield||0)+40;o.shield=(o.shield||0)+40;}},
  {id:"crit",name:"정밀 사격",desc:"치명타 확률 +15%",apply:o=>{o.buffs.crit=(o.buffs.crit||0)+.15;}},
  {id:"rate",name:"고속 장전",desc:"연사 보너스 +20%",apply:o=>{o.buffs.rate=(o.buffs.rate||0)+.20;}}
];

function v84GetDailyChallengeBuff(){
  const key=
    typeof v73TodayKey==="function"
      ?
      v73TodayKey()
      :
      rankingDailyDateKey();

  const randomSource=
    seededRandom(
      stringHash(
        `LAST_WAVE_V84_DAILY_BUFF|${key}`
      )
    );

  /*
    65% 확률로 버프 발생.
    같은 날짜에는 모든 접속에서 동일한 버프가 유지된다.
  */
  if(randomSource()>.65){
    return null;
  }

  return V84_DAILY_BUFFS[
    Math.floor(
      randomSource()*
      V84_DAILY_BUFFS.length
    )
  ]||null;
}

function v84ApplyDailyBuff(){
  if(
    gameMode!=="daily" ||
    !player ||
    player._v84DailyBuffApplied
  ){
    return;
  }

  player._v84DailyBuffApplied=true;

  const buff=
    v84GetDailyChallengeBuff();

  if(!buff){
    showMessage(
      "오늘의 일일 도전",
      "오늘은 추가 버프가 없습니다."
    );
    return;
  }

  buff.apply(player);

  showMessage(
    `일일 도전 버프 · ${buff.name}`,
    buff.desc
  );
}

const v84BaseStartRun=startRun;
startRun=function(mode){
  const result=
    v84BaseStartRun(mode);

  setTimeout(
    v84ApplyDailyBuff,
    0
  );

  return result;
};

const v84BaseDailyPreview=
  v56RenderDailyPreview;

v56RenderDailyPreview=function(
  announce=false
){
  const result=
    v84BaseDailyPreview(
      announce
    );

  const card=
    $("v56DailyCard");

  if(card){
    card
      .querySelector(
        ".v84-daily-buff-info"
      )
      ?.remove();

    const buff=
      v84GetDailyChallengeBuff();

    const info=
      document.createElement(
        "p"
      );

    info.className=
      "v84-daily-buff-info";

    info.innerHTML=
      buff
        ?
        `<b>오늘의 추가 버프:</b> ${buff.name} · ${buff.desc}`
        :
        `<b>오늘의 추가 버프:</b> 없음 · 날짜별 확률로 보너스 버프가 등장합니다.`;

    card.append(info);
  }

  return result;
};

/* ---------- 관리자 버프 시스템 ---------- */
const adminBuffsV84=
  new Set();

const V84_ADMIN_BUFF_NAMES={
  damage:"광폭 화력",
  rate:"초고속 연사",
  speed:"초고속 이동",
  tank:"타이탄",
  regen:"초재생",
  crit:"치명타 집중",
  shield:"무한 보호막"
};

function v84UpdateAdminBuffStatus(){
  const status=
    $("adminV84BuffStatus");

  if(status){
    const names=
      [
        ...adminBuffsV84
      ].map(
        id=>
          V84_ADMIN_BUFF_NAMES[id]||
          id
      );

    status.textContent=
      names.length
        ?
        `활성: ${names.join(" · ")}`
        :
        "활성 버프 없음";
  }
}

function v84EnableAdminBuff(
  id
){
  if(
    !adminRequireRun() ||
    adminBuffsV84.has(id)
  ){
    v84UpdateAdminBuffStatus();
    return;
  }

  adminBuffsV84.add(id);

  if(id==="speed"){
    player.speed*=1.5;
  }else if(id==="tank"){
    player.maxHp*=2;
    player.hp*=2;
    player.armor=
      clamp(
        (player.armor||0)+.25,
        0,
        .8
      );
  }else if(id==="regen"){
    player.regen=
      (player.regen||0)+
      10;
  }else if(id==="crit"){
    player.buffs.crit=
      (player.buffs.crit||0)+
      .5;
  }else if(id==="shield"){
    player.maxShield=
      (player.maxShield||0)+
      500;

    player.shield=
      player.maxShield;
  }

  v84UpdateAdminBuffStatus();

  showMessage(
    `관리자 버프 · ${V84_ADMIN_BUFF_NAMES[id]}`,
    "현재 게임에서만 적용됩니다."
  );
}

function v84ClearAdminBuffs(){
  if(
    !adminRequireRun()
  ){
    return;
  }

  if(adminBuffsV84.has("speed")){
    player.speed/=1.5;
  }

  if(adminBuffsV84.has("tank")){
    player.maxHp=
      Math.max(
        1,
        player.maxHp/2
      );

    player.hp=
      Math.min(
        player.hp,
        player.maxHp
      );

    player.armor=
      clamp(
        (player.armor||0)-.25,
        0,
        .8
      );
  }

  if(adminBuffsV84.has("regen")){
    player.regen=
      Math.max(
        0,
        (player.regen||0)-10
      );
  }

  if(adminBuffsV84.has("crit")){
    player.buffs.crit=
      Math.max(
        0,
        (player.buffs.crit||0)-.5
      );
  }

  if(adminBuffsV84.has("shield")){
    player.maxShield=
      Math.max(
        0,
        (player.maxShield||0)-500
      );

    player.shield=
      Math.min(
        player.shield||0,
        player.maxShield
      );
  }

  adminBuffsV84.clear();
  v84UpdateAdminBuffStatus();

  showMessage(
    "관리자 버프 전체 해제"
  );
}

const v84BaseGetWeaponStats=
  getWeaponStats;

getWeaponStats=function(
  owner,
  id
){
  const stats=
    v84BaseGetWeaponStats(
      owner,
      id
    );

  if(owner?.local){
    if(
      adminBuffsV84.has(
        "damage"
      )
    ){
      stats.damage*=3;
    }

    if(
      adminBuffsV84.has(
        "rate"
      )
    ){
      stats.rate*=2;
    }
  }

  return stats;
};

const v84BaseUpdatePlayer=
  updatePlayer;

updatePlayer=function(
  owner,
  dt
){
  if(
    owner?.local &&
    adminBuffsV84.has(
      "shield"
    ) &&
    !owner.dead
  ){
    owner.maxShield=
      Math.max(
        owner.maxShield||0,
        500
      );

    owner.shield=
      owner.maxShield;
  }

  return v84BaseUpdatePlayer(
    owner,
    dt
  );
};

/* ---------- 관리자 패널 v84 메타 기능 ---------- */
function v84AdminRefreshMeta(){
  persist();
  refreshProfileSummary();

  if(
    typeof v82RefreshCurrencyUi===
      "function"
  ){
    v82RefreshCurrencyUi();
  }

  if(
    typeof v82CheckAchievements===
      "function"
  ){
    v82CheckAchievements();
  }
}

$("adminV84CreditsButton").onclick=
  () => {
    save.credits+=100000;
    v84AdminRefreshMeta();
  };

$("adminV84RelicsButton").onclick=
  () => {
    save.relics+=50;
    v84AdminRefreshMeta();
  };

$("adminV84TalentTokensButton").onclick=
  () => {
    save.talentTokens+=50;
    v84AdminRefreshMeta();
  };

$("adminV84AllCurrencyButton").onclick=
  () => {
    save.credits+=500000;
    save.prism+=500;
    save.relics+=100;
    save.talentTokens+=100;

    v84AdminRefreshMeta();

    showMessage(
      "모든 재화 대량 지급 완료"
    );
  };

$("adminV84UnlockSkinsButton").onclick=
  () => {
    save.ownedSkinsV82=[
      ...Object.keys(
        V82_SKINS
      )
    ];

    persist();

    showMessage(
      "모든 스킨 해제 완료"
    );
  };

$("adminV84MaxPermanentButton").onclick=
  () => {
    for(
      const [
        id,
        upgrade
      ]
      of Object.entries(
        V82_PERMANENT_UPGRADES
      )
    ){
      save.permanentUpgradesV82[id]=
        upgrade.max;
    }

    persist();

    showMessage(
      "영구 능력 최대 완료",
      "다음 새 게임부터 완전히 반영됩니다."
    );
  };

$("adminV84MaxMasteryButton").onclick=
  () => {
    for(
      const [
        id,
        weapon
      ]
      of Object.entries(
        WEAPONS
      )
    ){
      if(weapon.admin){
        continue;
      }

      save.weaponMasteryV82[id]=
        25*
        25*
        10;
    }

    persist();

    showMessage(
      "모든 무기 숙련도 MAX"
    );
  };

$("adminV84MaxTalentsButton").onclick=
  () => {
    for(
      const [
        jobId,
        list
      ]
      of Object.entries(
        V82_JOB_TALENT_NAMES
      )
    ){
      save.jobTalentsV82[jobId]=
        save.jobTalentsV82[jobId]||
        {};

      list.forEach(
        (
          _,
          index
        ) => {
          save.jobTalentsV82[jobId][
            "t"+
            index
          ]=
            3;
        }
      );
    }

    persist();

    showMessage(
      "모든 직업 특성 MAX",
      "다음 새 게임부터 완전히 반영됩니다."
    );
  };

$("adminV84AchievementsButton").onclick=
  () => {
    for(
      const achievement
      of V82_ACHIEVEMENTS
    ){
      if(
        !save.achievementsV82[
          achievement.id
        ]
      ){
        save.achievementsV82[
          achievement.id
        ]=
          Date.now();
      }
    }

    persist();

    showMessage(
      "모든 업적 달성 처리 완료"
    );
  };

/* ---------- 관리자 버프 버튼 ---------- */
$("adminV84BuffDamage").onclick=
  () =>
    v84EnableAdminBuff(
      "damage"
    );

$("adminV84BuffRate").onclick=
  () =>
    v84EnableAdminBuff(
      "rate"
    );

$("adminV84BuffSpeed").onclick=
  () =>
    v84EnableAdminBuff(
      "speed"
    );

$("adminV84BuffTank").onclick=
  () =>
    v84EnableAdminBuff(
      "tank"
    );

$("adminV84BuffRegen").onclick=
  () =>
    v84EnableAdminBuff(
      "regen"
    );

$("adminV84BuffCrit").onclick=
  () =>
    v84EnableAdminBuff(
      "crit"
    );

$("adminV84BuffShield").onclick=
  () =>
    v84EnableAdminBuff(
      "shield"
    );

$("adminV84BuffAll").onclick=
  () => {
    for(
      const id
      of Object.keys(
        V84_ADMIN_BUFF_NAMES
      )
    ){
      v84EnableAdminBuff(
        id
      );
    }
  };

$("adminV84BuffClear").onclick=
  v84ClearAdminBuffs;

/* ---------- 관리자 작전 / 보스 제어 ---------- */
const adminV84EventSelect=
  $("adminV84EventSelect");

for(
  const event
  of V82_EVENTS
){
  const option=
    document.createElement(
      "option"
    );

  option.value=
    event.id;

  option.textContent=
    `${event.name} · ${event.desc}`;

  adminV84EventSelect.append(
    option
  );
}

function v84ForceEvent(
  eventId
){
  if(
    !adminRequireRun()
  ){
    return;
  }

  const event=
    V82_EVENTS.find(
      item=>
        item.id===
        eventId
    );

  if(!event){
    v82CurrentEvent=
      null;

    v82PreviousEvent=
      null;

    $("v82EventHud")
      ?.classList.remove(
        "show"
      );

    showMessage(
      "작전 이벤트 해제"
    );

    return;
  }

  v82CurrentEvent={
    ...event,
    wave
  };

  v82PreviousEvent=
    v82CurrentEvent;

  if(event.count){
    spawnRemaining=
      Math.min(
        getActiveEnemyCap()-
        5,
        Math.round(
          spawnRemaining*
          event.count
        )
      );
  }

  if(event.money){
    money+=
      event.money;

    if(
      multiplayer.active &&
      multiplayer.isHost &&
      typeof broadcastSharedMoney===
        "function"
    ){
      broadcastSharedMoney(
        "admin_v84_event"
      );
    }
  }

  if(
    event.heal ||
    event.shield
  ){
    for(
      const member
      of players.values()
    ){
      if(
        !member ||
        member.dead
      ){
        continue;
      }

      if(event.heal){
        member.hp=
          Math.min(
            member.maxHp,
            member.hp+
            member.maxHp*
            event.heal
          );
      }

      if(event.shield){
        member.maxShield=
          Math.max(
            member.maxShield||0,
            (member.shield||0)+
            event.shield
          );

        member.shield=
          Math.min(
            member.maxShield,
            (member.shield||0)+
            event.shield
          );
      }
    }
  }

  for(
    const enemy
    of enemies
  ){
    if(
      enemy &&
      !enemy.dead &&
      typeof v82ApplyEventEnemy===
        "function"
    ){
      v82ApplyEventEnemy(
        enemy
      );
    }
  }

  if(
    typeof v82ShowEvent===
      "function"
  ){
    v82ShowEvent(
      event
    );
  }else{
    showMessage(
      event.name,
      event.desc
    );
  }
}

$("adminV84ApplyEventButton").onclick=
  () => {
    v84ForceEvent(
      adminV84EventSelect.value
    );
  };

$("adminV84BossButton").onclick=
  () => {
    if(
      !adminRequireRun()
    ){
      return;
    }

    spawnBoss();

    showMessage(
      "관리자 보스 소환",
      "현재 웨이브 기준 보스를 즉시 소환했습니다."
    );
  };

$("adminV84ClearProjectilesButton").onclick=
  () => {
    if(
      !adminRequireRun()
    ){
      return;
    }

    bullets.length=
      0;

    enemyBullets.length=
      0;

    particles.length=
      0;

    showMessage(
      "모든 투사체 제거 완료"
    );
  };

/* ---------- 관리자 패널 컨텍스트에 신규 섹션 연결 ---------- */
const v84BaseRefreshAdminPanelContext=
  refreshAdminPanelContext;

refreshAdminPanelContext=function(){
  const result=
    v84BaseRefreshAdminPanelContext();

  const runActive=
    adminRunActive();

  const restricted=
    runActive &&
    multiplayer.active &&
    !multiplayer.isHost;

  const meta=
    $("adminV84MetaSection");

  const combat=
    $("adminV84CombatExtraSection");

  if(meta){
    meta.style.display=
      runActive
        ?
        "none"
        :
        "grid";
  }

  if(combat){
    combat.style.display=
      runActive &&
      !restricted
        ?
        "grid"
        :
        "none";
  }

  v84UpdateAdminBuffStatus();

  return result;
};

const v84BaseOpenAdminPanel=
  openAdminPanel;

openAdminPanel=function(){
  const result=
    v84BaseOpenAdminPanel();

  v84UpdateAdminBuffStatus();

  return result;
};

/*
  새 게임에서는 이전 관리자 임시 버프 상태만 초기화한다.
  실제 player 객체는 새로 생성되므로 수치 복구가 별도로 필요 없다.
*/
const v84AdminBaseStartRun=
  startRun;

startRun=function(
  mode
){
  adminBuffsV84.clear();
  v84UpdateAdminBuffStatus();

  return v84AdminBaseStartRun(
    mode
  );
};

v84StripAutoImages(document);
v84UpdateAdminBuffStatus();

if(
  typeof v82CheckAchievements===
    "function"
){
  v82CheckAchievements();
}
