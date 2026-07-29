/* Last Wave v104
 * - 난이도별 점수 배율을 표시하고 실제 점수에 적용합니다.
 * - 정비 화면의 방어구 목록을 접거나 다시 열 수 있습니다.
 */
(() => {
  "use strict";

  document.getElementById("gameVersion")?.replaceChildren("v104");

  window.__lastWaveV104={
    version:104,
    getDifficultyScoreMultiplier:()=>
      typeof getDifficultyScoreMultiplier==="function"
        ? getDifficultyScoreMultiplier()
        : 1,
    getDifficultyAdjustedScore:(score)=>
      typeof getDifficultyAdjustedScore==="function"
        ? getDifficultyAdjustedScore(score)
        : Math.max(0,Math.floor(Number(score)||0)),
    setEquipmentCollapsed:(collapsed)=>
      window.__lastWaveV98?.setEquipmentCollapsed?.(collapsed)
  };
})();
