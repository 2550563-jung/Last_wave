import assert from "node:assert/strict";
import { chromium } from "file:///C:/Users/commo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
import { startTestServer } from "./test-server.mjs";

const testServer=await startTestServer();
const browser=await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"
});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];

page.on("pageerror",error=>errors.push(String(error.stack||error)));
page.on("console",message=>{
  if(
    message.type()==="error"&&
    !message.text().includes("ERR_NETWORK_ACCESS_DENIED")&&
    !message.text().includes("Failed to load resource")
  ){
    errors.push(message.text());
  }
});
await page.route("**/*",route=>{
  if(route.request().url().startsWith(testServer.baseUrl)){
    return route.continue();
  }
  return route.abort();
});

await page.goto(`${testServer.baseUrl}/index.html`,{
  waitUntil:"commit",
  timeout:30000
});
await page.waitForFunction(()=>window.__lastWaveV106?.version===106,{timeout:60000});

const result=await page.evaluate(()=>{
  const api=window.__lastWaveV106;
  const originalHost=multiplayer.isHost;
  const originalPlayerId=save.playerId;
  multiplayer.isHost=true;
  save.playerId="clock-skew-host";
  multiplayer.lastInputSeq.clear();
  const remote=createPlayer("clock-skew-player","CLOCK TEST","soldier",false,0);
  const behind={
    playerId:remote.id,
    x:1,
    y:0,
    aimX:1,
    aimY:0,
    firing:false,
    __lw:{
      sender:remote.id,
      sessionId:"behind-clock",
      seq:1,
      sentAt:Date.now()-60*60*1000
    }
  };
  const firstAccepted=api.acceptRemoteInputPacket(behind);
  const behindControl=api.getRemotePlayerControl(remote);

  const ahead={
    playerId:remote.id,
    x:0,
    y:-1,
    aimX:0,
    aimY:-1,
    firing:true,
    __lw:{
      sender:remote.id,
      sessionId:"ahead-clock",
      seq:1,
      sentAt:Date.now()+60*60*1000
    }
  };
  const reconnectAccepted=api.acceptRemoteInputPacket(ahead);
  const aheadControl=api.getRemotePlayerControl(remote);
  const duplicateRejected=!api.acceptRemoteInputPacket({...ahead});
  const mismatchedSenderRejected=!api.acceptRemoteInputPacket({
    ...ahead,
    __lw:{...ahead.__lw,sender:"different-player",seq:2}
  });

  behind._lwReceivedAt=performance.now()-1500;
  multiplayer.remoteInputs.set(remote.id,behind);
  const expiredControl=api.getRemotePlayerControl(remote);
  multiplayer.isHost=originalHost;
  save.playerId=originalPlayerId;

  return{
    version:document.getElementById("gameVersion")?.textContent?.trim(),
    addon:api.version,
    behindAge:api.getRemoteInputAge(ahead),
    firstAccepted,
    reconnectAccepted,
    duplicateRejected,
    mismatchedSenderRejected,
    behindControl:{x:behindControl.x,y:behindControl.y},
    aheadControl:{
      x:aheadControl.x,
      y:aheadControl.y,
      firing:aheadControl.firing
    },
    expiredControl:{
      x:expiredControl.x,
      y:expiredControl.y,
      firing:expiredControl.firing
    }
  };
});

assert.equal(result.version,"v109");
assert.equal(result.addon,106);
assert.ok(result.behindAge>=0&&result.behindAge<1400);
assert.equal(result.firstAccepted,true);
assert.equal(result.reconnectAccepted,true);
assert.equal(result.duplicateRejected,true);
assert.equal(result.mismatchedSenderRejected,true);
assert.deepEqual(result.behindControl,{x:1,y:0});
assert.deepEqual(result.aheadControl,{x:0,y:-1,firing:true});
assert.deepEqual(result.expiredControl,{x:0,y:0,firing:false});
assert.deepEqual(errors,[]);

console.log("v106 clock-skew input test passed.",result);
await browser.close();
await testServer.close();
