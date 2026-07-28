import assert from "node:assert/strict";

const baseUrl=String(process.env.LW_CLOUDFLARE_TEST_URL||"http://127.0.0.1:8787").replace(/\/+$/,"");
const roomCode=`T${Math.random().toString(36).slice(2,7)}`.toUpperCase().padEnd(6,"0").slice(0,6);

function waitFor(socket,predicate,timeout=5000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      socket.removeEventListener("message",onMessage);
      reject(new Error("WebSocket message timeout"));
    },timeout);
    const onMessage=event=>{
      let data;
      try{data=JSON.parse(String(event.data));}catch{return;}
      if(!predicate(data))return;
      clearTimeout(timer);
      socket.removeEventListener("message",onMessage);
      resolve(data);
    };
    socket.addEventListener("message",onMessage);
  });
}

function connect(index){
  const url=new URL(baseUrl);
  url.protocol=url.protocol==="https:"?"wss:":"ws:";
  url.pathname=`/rooms/${roomCode}/connect`;
  url.searchParams.set("connection_id",`test-${index}-${Date.now()}`);
  url.searchParams.set("presence_key",`presence-${index}`);

  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url);
    const timer=setTimeout(()=>reject(new Error(`client ${index} connect timeout`)),5000);
    socket.addEventListener("open",()=>{
      clearTimeout(timer);
      resolve(socket);
    },{once:true});
    socket.addEventListener("error",event=>{
      clearTimeout(timer);
      reject(event.error||new Error(`client ${index} connection error`));
    },{once:true});
  });
}

function waitForEventCount(socket,eventName,target,timeout=5000){
  return new Promise((resolve,reject)=>{
    let count=0;
    const timer=setTimeout(()=>{
      socket.removeEventListener("message",onMessage);
      reject(new Error(`${eventName} throughput timeout: ${count}/${target}`));
    },timeout);
    const onMessage=event=>{
      let data;
      try{data=JSON.parse(String(event.data));}catch{return;}
      if(data.op!=="batch"||!Array.isArray(data.messages))return;
      count+=data.messages.filter(item=>item?.event===eventName).length;
      if(count<target)return;
      clearTimeout(timer);
      socket.removeEventListener("message",onMessage);
      resolve(count);
    };
    socket.addEventListener("message",onMessage);
  });
}

const health=await fetch(`${baseUrl}/health`);
assert.equal(health.status,200);
assert.equal((await health.json()).transport,"cloudflare-durable-objects");

const clients=[];
try{
  for(let index=0;index<4;index+=1){
    const socket=await connect(index);
    clients.push(socket);
    const presenceUpdate=waitFor(
      socket,
      message=>
        message.op==="presence" &&
        Object.keys(message.state||{}).length===index+1
    );
    socket.send(JSON.stringify({
      op:"track",
      presence:{
        playerId:`player-${index}`,
        sessionId:`session-${index}`,
        nickname:`Player ${index}`,
        joinedAt:Date.now()+index
      }
    }));
    await presenceUpdate;
  }

  const relayed=clients.slice(1).map(socket=>
    waitFor(
      socket,
      message=>
        message.op==="batch" &&
        message.messages?.[0]?.event==="input" &&
        message.messages?.[0]?.payload?.marker==="cloudflare-test"
    )
  );
  clients[0].send(JSON.stringify({
    op:"batch",
    messages:[{
      event:"input",
      payload:{marker:"cloudflare-test"}
    }]
  }));
  await Promise.all(relayed);

  const throughputTarget=90;
  const throughputChecks=clients.slice(1).map(socket=>
    waitForEventCount(socket,"world_frame",throughputTarget)
  );
  const throughputStarted=performance.now();
  for(let index=0;index<throughputTarget;index+=1){
    clients[0].send(JSON.stringify({
      op:"batch",
      messages:[{
        event:"world_frame",
        payload:{frameSeq:index+1,x:index,y:index}
      }]
    }));
  }
  await Promise.all(throughputChecks);
  const throughputMs=performance.now()-throughputStarted;
  assert.ok(throughputMs<5000);

  const remainingPresence=waitFor(
    clients[0],
    message=>
      message.op==="presence" &&
      Object.keys(message.state||{}).length===3
  );
  clients[3].close(1000,"test_leave");
  await remainingPresence;
  clients.pop();

  const fifth=await connect(5);
  const fifthRejected=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("fifth player was not rejected")),5000);
    fifth.addEventListener("close",event=>{
      clearTimeout(timer);
      resolve(event.code);
    },{once:true});
  });
  fifth.send(JSON.stringify({
    op:"track",
    presence:{
      playerId:"player-5",
      sessionId:"session-5",
      joinedAt:Date.now()
    }
  }));
  // One slot is available after client 4 leaves, so the replacement must succeed.
  await waitFor(
    clients[0],
    message=>
      message.op==="presence" &&
      Object.values(message.state||{})
        .flat()
        .some(member=>member.playerId==="player-5")
  );
  fifth.close(1000,"replacement_ok");
  assert.equal(await fifthRejected,1000);

  console.log(
    "Cloudflare multiplayer test passed:",
    `health, 4 players, relay, 90-frame burst in ${throughputMs.toFixed(1)}ms, leave, replacement.`
  );
}finally{
  for(const socket of clients){
    if(socket.readyState<2)socket.close(1000,"test_done");
  }
}
