/* Last Wave v107
 * 초반 난이도를 낮추고 웨이브가 진행될수록 적 능력과 수량이 더 크게 증가합니다.
 * 게임 중 AUTO 사용을 모든 입력 경로에서 차단합니다.
 */
(() => {
  "use strict";

  function getWaveDifficultyCurve(waveNumber=wave){
    const currentWave=Math.max(1,Math.floor(Number(waveNumber)||1));
    const progress=currentWave-1;

    return{
      wave:currentWave,
      hp:Math.min(
        5,
        .64+
        progress*.035+
        progress*progress*.00065
      ),
      damage:Math.min(
        3.2,
        .68+
        progress*.024+
        progress*progress*.00038
      ),
      speed:Math.min(
        1.28,
        .90+
        progress*.0065
      ),
      count:Math.min(
        1.9,
        .68+
        progress*.032
      )
    };
  }

  function applyWaveDifficulty(enemy,waveNumber=wave){
    if(
      !enemy ||
      enemy.dead ||
      enemy.v107WaveDifficultyApplied
    ){
      return enemy;
    }

    const curve=getWaveDifficultyCurve(waveNumber);
    enemy.v107WaveDifficultyApplied=true;
    enemy.v107DifficultyWave=curve.wave;
    enemy.maxHp=Math.max(1,(Number(enemy.maxHp)||1)*curve.hp);
    enemy.hp=Math.max(1,(Number(enemy.hp)||1)*curve.hp);
    enemy.damage=Math.max(0,(Number(enemy.damage)||0)*curve.damage);
    enemy.speed=Math.max(0,(Number(enemy.speed)||0)*curve.speed);
    return enemy;
  }

  function applyNewEnemies(before,waveNumber){
    for(
      let index=before;
      index<enemies.length;
      index++
    ){
      applyWaveDifficulty(
        enemies[index],
        waveNumber
      );
    }
  }

  const v107BaseStartWave=startWave;
  startWave=function(){
    const result=v107BaseStartWave();

    if(
      state==="playing" &&
      (
        !multiplayer.active ||
        multiplayer.isHost
      )
    ){
      const curve=getWaveDifficultyCurve(wave);
      const cap=Math.max(
        0,
        getActiveEnemyCap()-5
      );
      spawnRemaining=Math.min(
        cap,
        Math.max(
          0,
          Math.round(
            spawnRemaining*
            curve.count
          )
        )
      );
    }

    return result;
  };

  const v107BaseSpawnEnemy=spawnEnemy;
  spawnEnemy=function(){
    const before=enemies.length;
    const spawnedWave=wave;
    const result=v107BaseSpawnEnemy();
    applyNewEnemies(
      before,
      spawnedWave
    );
    return result;
  };

  const v107BaseSpawnBoss=spawnBoss;
  spawnBoss=function(){
    const before=enemies.length;
    const spawnedWave=wave;
    const result=v107BaseSpawnBoss();
    applyNewEnemies(
      before,
      spawnedWave
    );
    return result;
  };

  /*
    구버전 참가자가 auto:true를 보내거나 저장값이 남아 있어도
    v107 전투에서는 AUTO 상태를 항상 제거한다.
  */
  const v107BaseGetPlayerControl=getPlayerControl;
  getPlayerControl=function(owner){
    const control=v107BaseGetPlayerControl(owner);
    if(
      control &&
      typeof control==="object"
    ){
      control.auto=false;
    }
    return control;
  };

  const hadStoredAuto=
    Boolean(
      autoMode ||
      save.autoMode
    );
  autoMode=false;
  save.autoMode=false;
  updateAutoUI();
  if(
    hadStoredAuto
  ){
    persist();
  }

  document.getElementById("gameVersion")?.replaceChildren("v107");
  window.__lastWaveV107={
    version:107,
    getWaveDifficultyCurve,
    applyWaveDifficulty
  };
})();
