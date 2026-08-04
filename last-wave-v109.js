/* Last Wave v109: remove the guest-mode choice and allow nickname-only local play. */
(() => {
  "use strict";

  const VERSION = 109;
  const localNickname = () => safeText(
    save.nickname || localStorage.getItem(GUEST_NICKNAME_KEY) || "",
    16
  );

  function enableNicknameOnlyProfile({ restore = false } = {}) {
    if (currentAccountUser?.id) return false;
    const wasActive = guestModeActive;
    guestModeActive = true;
    localStorage.setItem(GUEST_MODE_PREF_KEY, "1");
    if (restore && !wasActive) restoreGuestProfileSnapshot();
    save.playerId = getGuestPlayerId();
    return true;
  }

  function rewriteGuestCopy() {
    document.getElementById("guestModeButton")?.setAttribute("aria-hidden", "true");
    document.getElementById("guestModeStatus")?.setAttribute("aria-hidden", "true");
    document.getElementById("guestNicknameOverlay")?.setAttribute("aria-hidden", "true");

    const accountBox = document.querySelector(".account-box");
    const intro = accountBox?.querySelector("p.account-status");
    if (intro) {
      intro.innerHTML = "계정과 닉네임은 모두 선택 사항입니다. <b>아무것도 입력하지 않아도 바로 플레이</b>할 수 있습니다.<br>계정으로 로그인하면 진행도를 서버에 저장하고 다른 기기에서 이어서 플레이할 수 있습니다.";
    }

    const accountStatus = document.getElementById("accountStatus");
    if (accountStatus && !currentAccountUser?.id) {
      accountStatus.textContent = "계정과 닉네임은 선택 사항 · 바로 플레이할 수 있습니다.";
      accountStatus.dataset.state = "offline";
    }

    document.querySelectorAll("#helpOverlay p, #helpOverlay h3").forEach(element => {
      if (element.textContent.includes("게스트")) element.remove();
    });
  }

  const baseRankingSkipMessage = rankingSkipMessage;
  rankingSkipMessage = function skipRankingWithoutNickname() {
    if (!safeText(save.nickname || "", 16)) return "닉네임 미입력으로 랭킹 제외";
    return baseRankingSkipMessage();
  };

  if (sbClient && typeof sbClient.rpc === "function" && !sbClient.__lw109BlankRankingGuard) {
    const baseRpc = sbClient.rpc.bind(sbClient);
    sbClient.rpc = function guardBlankWeeklyRanking(name, args, options) {
      if (String(name) === "lw_finish_verified_run_v1" && !safeText(save.nickname || "", 16)) {
        return Promise.resolve({ data: false, error: null });
      }
      return baseRpc(name, args, options);
    };
    Object.defineProperty(sbClient, "__lw109BlankRankingGuard", { value: true });
  }

  const baseUpdateAccountIdentityUi = updateAccountIdentityUi;
  updateAccountIdentityUi = function updateNicknameFirstIdentityUi() {
    if (currentAccountUser?.id) return baseUpdateAccountIdentityUi();

    enableNicknameOnlyProfile({ restore: true });
    const nickname = localNickname();
    save.nickname = nickname.length >= 2 ? nickname : "";
    save.playerId = getGuestPlayerId();
    ui.nicknameInput.value = save.nickname;
    ui.nicknameHud.textContent = save.nickname;
    ui.nicknameStatus.textContent = save.nickname
      ? `닉네임: ${save.nickname} · 이 기기에 저장됩니다.`
      : "닉네임은 선택 사항입니다. 입력하지 않으면 공백으로 시작합니다.";
    ui.nicknameInput.readOnly = Boolean(IS_MOBILE);
    document.getElementById("nicknameSaveButton").disabled = false;

    const syncButton = document.getElementById("accountSyncButton");
    const signOutButton = document.getElementById("accountSignOutButton");
    const deleteButton = document.getElementById("accountDeleteButton");
    if (syncButton) syncButton.disabled = true;
    if (signOutButton) signOutButton.disabled = true;
    if (deleteButton) deleteButton.disabled = true;
    persist({ cloud: false });
    rewriteGuestCopy();
  };

  const baseSaveNickname = saveNickname;
  saveNickname = async function saveNicknameWithoutGuestMode() {
    if (currentAccountUser?.id) return baseSaveNickname();
    enableNicknameOnlyProfile();
    const nickname = safeText(ui.nicknameInput.value, 16);
    if (!nickname) {
      save.nickname = "";
      localStorage.removeItem(GUEST_NICKNAME_KEY);
      persist({ cloud: false });
      updateAccountIdentityUi();
      ui.nicknameStatus.textContent = "닉네임 없이 공백으로 바로 시작할 수 있습니다.";
      return true;
    }
    if (nickname.length < 2) {
      ui.nicknameStatus.textContent = "닉네임을 사용할 경우 2~16자로 입력하세요.";
      return false;
    }

    const previousNickname = save.nickname;
    save.nickname = nickname;
    save.playerId = getGuestPlayerId();
    localStorage.setItem(GUEST_NICKNAME_KEY, nickname);
    persist({ cloud: false });
    writeGuestProfileSnapshotNow();
    updateAccountIdentityUi();
    ui.nicknameStatus.textContent = `닉네임 저장 완료: ${nickname} · 바로 플레이할 수 있습니다.`;
    if (previousNickname && previousNickname !== nickname) {
      syncRankingNicknameChange(previousNickname, nickname).catch(() => {});
    }
    return true;
  };

  requireNickname = function requireNicknameOnly() {
    if (!currentAccountUser?.id) enableNicknameOnlyProfile();
    return true;
  };

  const baseOpenMobileTextPortal = openMobileTextPortal;
  openMobileTextPortal = function openNicknameFirstMobilePortal(target) {
    if (target?.id === "nicknameInput" && !currentAccountUser?.id) enableNicknameOnlyProfile();
    return baseOpenMobileTextPortal(target);
  };

  const teammateColors = ["#67dcff", "#8df0b2", "#ffd166", "#d89cff"];

  function teammateLabel(member, joinOrder) {
    const nickname = safeText(member?.nickname || "", 16);
    return nickname || `플레이어 ${Math.max(1, Number(joinOrder) || 1)}`;
  }

  function edgePlacement(point, width = WIDTH, height = HEIGHT, margin = 58) {
    if (!point || (point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height)) return null;
    const dx = point.x - width / 2;
    const dy = point.y - height / 2;
    const length = Math.hypot(dx, dy) || 1;
    const nx = dx / length;
    const ny = dy / length;
    const scale = Math.min(
      (width / 2 - margin) / Math.max(Math.abs(nx), .0001),
      (height / 2 - margin) / Math.max(Math.abs(ny), .0001)
    );
    return {
      x: width / 2 + nx * scale,
      y: height / 2 + ny * scale,
      nx,
      ny,
      angle: Math.atan2(ny, nx)
    };
  }

  function drawTeammateEdgeIndicators() {
    if (state !== "playing" || !multiplayer.active || !player) return;
    const orderedMembers = [...multiplayer.members.values()];

    orderedMembers.forEach((member, index) => {
      if (!member?.playerId || member.playerId === save.playerId) return;
      const teammate = players.get(member.playerId);
      if (!teammate || teammate.dead) return;
      const edge = edgePlacement(project(teammate.x, teammate.y));
      if (!edge) return;

      const color = teammate.downed ? "#ff6b82" : teammateColors[index % teammateColors.length];
      const label = teammateLabel(member, index + 1);
      ctx.save();
      ctx.translate(edge.x, edge.y);
      ctx.rotate(edge.angle);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.font = "700 12px system-ui, sans-serif";
      const labelWidth = Math.ceil(ctx.measureText(label).width) + 16;
      const labelX = Math.max(labelWidth / 2 + 6, Math.min(WIDTH - labelWidth / 2 - 6, edge.x - edge.nx * 38));
      const labelY = Math.max(16, Math.min(HEIGHT - 16, edge.y - edge.ny * 38));
      ctx.globalAlpha = .94;
      ctx.fillStyle = "rgba(5, 14, 20, .86)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(labelX - labelWidth / 2, labelY - 12, labelWidth, 24, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f6fbff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, labelX, labelY + .5);
      ctx.restore();
    });
  }

  const baseDrawEnemyEdgeIndicators = drawEnemyEdgeIndicators;
  drawEnemyEdgeIndicators = function drawAllEdgeIndicators() {
    const result = baseDrawEnemyEdgeIndicators();
    drawTeammateEdgeIndicators();
    return result;
  };

  enableNicknameOnlyProfile({ restore: true });
  updateAccountIdentityUi();
  rewriteGuestCopy();
  document.getElementById("gameVersion")?.replaceChildren("v109");

  window.__lastWaveV109 = Object.freeze({
    version: VERSION,
    nicknameOnly: true,
    nicknameOptional: true,
    rankingsEnabled: true,
    blankNicknameRankingEligible: false,
    guestModeVisible: false,
    enableNicknameOnlyProfile,
    teammateLabel,
    edgePlacement,
    drawTeammateEdgeIndicators
  });
})();
