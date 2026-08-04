import assert from "node:assert/strict";
import { chromium } from "file:///C:/Users/commo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
import { startTestServer } from "./test-server.mjs";

const testServer = await startTestServer();
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", error => errors.push(String(error.stack || error)));
page.on("console", message => {
  if (message.type() === "error" && !message.text().includes("ERR_NETWORK_ACCESS_DENIED") && !message.text().includes("Failed to load resource")) errors.push(message.text());
});
await page.route("**/*", route => route.request().url().startsWith(testServer.baseUrl) ? route.continue() : route.abort());
await page.goto(`${testServer.baseUrl}/index.html`, { waitUntil: "commit", timeout: 30000 });
await page.waitForFunction(() => window.__lastWaveV109?.version === 109, { timeout: 60000 });

const result = await page.evaluate(async () => {
  const guestButton = document.getElementById("guestModeButton");
  const guestOverlay = document.getElementById("guestNicknameOverlay");
  const rankButton = document.getElementById("rankButton");
  const nickname = document.getElementById("nicknameInput");
  nickname.value = "";
  const saved = await saveNickname();
  let required = true;
  try { requireNickname(); } catch { required = false; }
  const blankRankingSkip = rankingSkipMessage();
  save.nickname = "랭커";
  const namedRankingSkip = rankingSkipMessage();
  save.nickname = "";
  const namedTeammate = window.__lastWaveV109.teammateLabel({ nickname: "파도친구" }, 2);
  const blankTeammate = window.__lastWaveV109.teammateLabel({ nickname: "" }, 3);
  const rightEdge = window.__lastWaveV109.edgePlacement({ x: WIDTH + 500, y: HEIGHT / 2 });
  const onscreenEdge = window.__lastWaveV109.edgePlacement({ x: WIDTH / 2, y: HEIGHT / 2 });
  const remoteId = "22222222-2222-4222-8222-222222222222";
  state = "playing";
  multiplayer.active = true;
  player = { id: save.playerId, x: 0, y: 0, dead: false };
  players.set(save.playerId, player);
  players.set(remoteId, { id: remoteId, x: 5000, y: 0, dead: false, downed: false });
  multiplayer.members.clear();
  multiplayer.members.set(save.playerId, { playerId: save.playerId, nickname: "", joinedAt: 1 });
  multiplayer.members.set(remoteId, { playerId: remoteId, nickname: "", joinedAt: 2 });
  const drawnLabels = [];
  const baseFillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, ...args) => { drawnLabels.push(String(text)); return baseFillText(text, ...args); };
  window.__lastWaveV109.drawTeammateEdgeIndicators();
  ctx.fillText = baseFillText;
  return {
    version: document.getElementById("gameVersion")?.textContent?.trim(),
    release: window.__lastWaveCloudflare?.releaseVersion,
    api: window.__lastWaveV109,
    guestButtonDisplay: getComputedStyle(guestButton).display,
    guestOverlayDisplay: getComputedStyle(guestOverlay).display,
    rankButtonDisplay: getComputedStyle(rankButton).display,
    blankRankingSkip,
    namedRankingSkip,
    namedTeammate,
    blankTeammate,
    rightEdge,
    onscreenEdge,
    drawnLabels,
    saved,
    required,
    nickname: save.nickname,
    playerId: save.playerId,
    inputDisabled: nickname.disabled,
    status: document.getElementById("nicknameStatus")?.textContent,
    accountCopy: document.querySelector(".account-box p.account-status")?.textContent
  };
});

assert.equal(result.version, "v109");
assert.equal(result.release, 109);
assert.equal(result.api.nicknameOnly, true);
assert.equal(result.api.nicknameOptional, true);
assert.equal(result.api.rankingsEnabled, true);
assert.equal(result.api.blankNicknameRankingEligible, false);
assert.equal(result.guestButtonDisplay, "none");
assert.equal(result.guestOverlayDisplay, "none");
assert.notEqual(result.rankButtonDisplay, "none");
assert.match(result.blankRankingSkip, /닉네임 미입력/);
assert.equal(result.namedRankingSkip, "");
assert.equal(result.namedTeammate, "파도친구");
assert.equal(result.blankTeammate, "플레이어 3");
assert.ok(result.rightEdge.x > 0);
assert.ok(Math.abs(result.rightEdge.angle) < .01);
assert.equal(result.onscreenEdge, null);
assert.ok(result.drawnLabels.includes("플레이어 2"));
assert.equal(result.saved, true);
assert.equal(result.required, true);
assert.equal(result.nickname, "");
assert.match(result.playerId, /^[0-9a-f-]{36}$/i);
assert.equal(result.inputDisabled, false);
assert.match(result.status, /닉네임 없이|공백/);
assert.match(result.accountCopy, /아무것도 입력하지 않아도/);
assert.deepEqual(errors, []);

console.log("v109 nickname-only flow test passed.", result);
await browser.close();
await testServer.close();
