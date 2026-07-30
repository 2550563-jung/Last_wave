/* Last Wave v106
 * 참가자 입력의 유효 시간을 발신 기기 시계가 아닌 방장 수신 시각으로 판정합니다.
 */
(() => {
  "use strict";

  document.getElementById("gameVersion")?.replaceChildren("v106");
  window.__lastWaveV106={
    version:106,
    markRemoteInputReceived,
    getRemoteInputAge,
    acceptRemoteInputPacket,
    getRemotePlayerControl:getPlayerControl
  };
})();
