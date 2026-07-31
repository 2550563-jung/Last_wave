import assert from "node:assert/strict";
import { chromium } from "file:///C:/Users/commo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
import { startTestServer } from "./test-server.mjs";

const cloudflareUrl=
  process.env.LW_CLOUDFLARE_TEST_URL ||
  "http://127.0.0.1:8787";
const testServer=await startTestServer();
const browser=await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"
});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on("pageerror",error=>errors.push(String(error.stack||error)));
page.on("console",message=>{
  const text=message.text();
  if(
    message.type()==="error" &&
    !text.includes("ERR_NETWORK_ACCESS_DENIED") &&
    !text.includes("Failed to load resource")
  ){
    errors.push(text);
  }
});

await page.addInitScript(url=>{
  localStorage.setItem("lw_cloudflare_game_server",url);
},cloudflareUrl);
await page.goto(`${testServer.baseUrl}/index.html`,{
  waitUntil:"commit",
  timeout:30000
});
await page.waitForFunction(()=>window.__lastWaveCloudflare?.configured===true,{timeout:60000});

const result=await page.evaluate(async()=>{
  const room=`B${Math.random().toString(36).slice(2,7)}`.toUpperCase().padEnd(6,"0").slice(0,6);
  const connect=(channel,presence)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("client subscribe timeout")),5000);
    channel.subscribe(async status=>{
      if(status==="SUBSCRIBED"){
        const tracked=await channel.track(presence);
        clearTimeout(timer);
        resolve(tracked);
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
        clearTimeout(timer);
        reject(new Error(status));
      }
    });
  });

  const first=createLastWaveRealtimeChannel(`last-wave-room-${room}`,{
    config:{presence:{key:"browser-first"},broadcast:{self:false,ack:false}}
  });
  const second=createLastWaveRealtimeChannel(`last-wave-room-${room}`,{
    config:{presence:{key:"browser-second"},broadcast:{self:false,ack:false}}
  });
  const third=createLastWaveRealtimeChannel(`last-wave-room-${room}`,{
    config:{presence:{key:"browser-third"},broadcast:{self:false,ack:false}}
  });
  const fourth=createLastWaveRealtimeChannel(`last-wave-room-${room}`,{
    config:{presence:{key:"browser-fourth"},broadcast:{self:false,ack:false}}
  });

  const received=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("client relay timeout")),5000);
    second.on("broadcast",{event:"input"},({payload})=>{
      clearTimeout(timer);
      resolve(payload);
    });
  });

  await connect(first,{
    playerId:"browser-player-1",
    sessionId:"browser-session-1",
    joinedAt:Date.now()
  });
  await connect(second,{
    playerId:"browser-player-2",
    sessionId:"browser-session-2",
    joinedAt:Date.now()+1
  });
  await connect(third,{
    playerId:"browser-player-3",
    sessionId:"browser-session-3",
    joinedAt:Date.now()+2
  });
  await connect(fourth,{
    playerId:"browser-player-4",
    sessionId:"browser-session-4",
    joinedAt:Date.now()+3
  });

  await first.send({
    type:"broadcast",
    event:"input",
    payload:{marker:"browser-adapter",__lw:{seq:1}}
  });
  const payload=await received;
  const participantInputs=new Promise((resolve,reject)=>{
    const markers=new Set();
    const timer=setTimeout(()=>reject(new Error("four-player input relay timeout")),5000);
    first.on("broadcast",{event:"input"},({payload:inputPayload})=>{
      if(!inputPayload?.participantIndex)return;
      markers.add(inputPayload.participantIndex);
      if(markers.size===3){
        clearTimeout(timer);
        resolve([...markers].sort((a,b)=>a-b));
      }
    });
  });
  await Promise.all([
    second.send({type:"broadcast",event:"input",payload:{participantIndex:2,x:1}}),
    third.send({type:"broadcast",event:"input",payload:{participantIndex:3,y:-1}}),
    fourth.send({type:"broadcast",event:"input",payload:{participantIndex:4,firing:true}})
  ]);
  const participantMarkers=await participantInputs;
  await removeLastWaveRealtimeChannel(first);
  await removeLastWaveRealtimeChannel(second);
  await removeLastWaveRealtimeChannel(third);
  await removeLastWaveRealtimeChannel(fourth);

  return {
    marker:payload.marker,
    firstTransport:first.transportName,
    secondTransport:second.transportName,
    configured:window.__lastWaveCloudflare.configured,
    releaseVersion:window.__lastWaveCloudflare.releaseVersion,
    displayVersion:document.getElementById("gameVersion")?.textContent?.trim(),
    participantMarkers
  };
});

await browser.close();
await testServer.close();

assert.equal(result.marker,"browser-adapter");
assert.equal(result.firstTransport,"cloudflare");
assert.equal(result.secondTransport,"cloudflare");
assert.equal(result.configured,true);
assert.equal(result.releaseVersion,107);
assert.equal(result.displayVersion,"v107");
assert.deepEqual(result.participantMarkers,[2,3,4]);
assert.deepEqual(errors,[]);
console.log("Cloudflare browser adapter test passed.",result);
