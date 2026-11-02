
// The page release is authoritative, including when an older addon is cached.
document.getElementById("gameVersion").textContent=GAME_VERSION;
if(window.__lastWaveCloudflare)window.__lastWaveCloudflare.releaseVersion=Number(GAME_VERSION.slice(1));
