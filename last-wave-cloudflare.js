/* Last Wave Cloudflare multiplayer transport
 * Supabase remains responsible for accounts, rankings and the room directory.
 * High-frequency room traffic uses a Cloudflare Durable Object WebSocket.
 */
(() => {
  "use strict";

  const CONFIG_KEY="lw_cloudflare_game_server";
  const DEFAULT_BATCH_DELAY=12;
  const FAST_EVENTS=new Set(["input","world_frame","projectiles"]);

  function supabaseClient(){
    return typeof sbClient!=="undefined"?sbClient:null;
  }

  function configuredEndpoint(){
    const explicit=
      String(
        window.LAST_WAVE_CLOUDFLARE_URL ||
        localStorage.getItem(CONFIG_KEY) ||
        document.querySelector('meta[name="last-wave-game-server"]')?.content ||
        ""
      ).trim();
    return explicit.replace(/\/+$/,"");
  }

  function websocketEndpoint(baseUrl,roomCode,presenceKey){
    const url=new URL(baseUrl,location.href);
    url.protocol=url.protocol==="http:"?"ws:":"wss:";
    url.pathname=`${url.pathname.replace(/\/+$/,"")}/rooms/${encodeURIComponent(roomCode)}/connect`;
    url.search="";
    url.searchParams.set("connection_id",`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`);
    url.searchParams.set("presence_key",presenceKey);
    return url.href;
  }

  class LastWaveCloudflareChannel{
    constructor(topic,options,baseUrl){
      this.topic=topic;
      this.options=options||{};
      this.baseUrl=baseUrl;
      this.transportName="cloudflare";
      this.__lwCloudflare=true;
      this.handlers=[];
      this.statusHandler=null;
      this.socket=null;
      this.closedByClient=false;
      this.presence={};
      this.pending=[];
      this.flushTimer=0;
      this.connectTimer=0;
      this.presenceKey=
        String(
          this.options?.config?.presence?.key ||
          `lw-${Math.random().toString(36).slice(2)}`
        ).slice(0,96);
      const match=/([A-Z0-9]{6})$/i.exec(topic);
      this.roomCode=match?.[1]?.toUpperCase()||"";
    }

    on(type,filter,handler){
      this.handlers.push({
        type,
        event:filter?.event,
        handler
      });
      return this;
    }

    subscribe(handler){
      this.statusHandler=typeof handler==="function"?handler:null;
      this.closedByClient=false;
      if(!this.roomCode){
        queueMicrotask(()=>this.emitStatus("CHANNEL_ERROR"));
        return this;
      }

      try{
        this.socket=new WebSocket(
          websocketEndpoint(this.baseUrl,this.roomCode,this.presenceKey)
        );
      }catch(error){
        console.warn("Cloudflare 멀티플레이 연결 생성 실패",error);
        queueMicrotask(()=>this.emitStatus("CHANNEL_ERROR"));
        return this;
      }

      this.connectTimer=setTimeout(()=>{
        if(this.socket?.readyState!==WebSocket.OPEN){
          this.emitStatus("TIMED_OUT");
          try{this.socket?.close(4000,"connect_timeout");}catch{}
        }
      },10000);

      this.socket.addEventListener("open",()=>{
        clearTimeout(this.connectTimer);
        this.emitStatus("SUBSCRIBED");
      });

      this.socket.addEventListener("message",event=>this.receive(event.data));
      this.socket.addEventListener("error",()=>this.emitStatus("CHANNEL_ERROR"));
      this.socket.addEventListener("close",event=>{
        clearTimeout(this.connectTimer);
        clearTimeout(this.flushTimer);
        this.flushTimer=0;
        if(event.code===4004){
          this.emitStatus("CHANNEL_ERROR");
        }else if(!this.closedByClient){
          this.emitStatus("CLOSED");
        }
      });
      return this;
    }

    async track(presence){
      return this.sendRaw({
        op:"track",
        presence
      });
    }

    presenceState(){
      return this.presence;
    }

    async send(message){
      if(
        !message ||
        message.type!=="broadcast" ||
        typeof message.event!=="string"
      ){
        return "error";
      }
      if(this.socket?.readyState!==WebSocket.OPEN)return "error";

      this.pending.push({
        event:message.event,
        payload:message.payload
      });

      const critical=Boolean(message.payload?.__lw?.criticalId);
      if(
        critical ||
        !FAST_EVENTS.has(message.event) ||
        this.pending.length>=12
      ){
        this.flush();
      }else if(!this.flushTimer){
        this.flushTimer=setTimeout(()=>this.flush(),DEFAULT_BATCH_DELAY);
      }
      return "ok";
    }

    async unsubscribe(){
      this.closedByClient=true;
      clearTimeout(this.connectTimer);
      clearTimeout(this.flushTimer);
      this.flushTimer=0;
      this.flush();
      if(this.socket&&this.socket.readyState<2){
        this.socket.close(1000,"client_leave");
      }
      this.socket=null;
      return "ok";
    }

    flush(){
      clearTimeout(this.flushTimer);
      this.flushTimer=0;
      if(!this.pending.length)return;
      const messages=this.pending.splice(0,32);
      if(this.socket?.readyState!==WebSocket.OPEN)return;
      try{
        this.socket.send(JSON.stringify({
          op:"batch",
          messages
        }));
      }catch(error){
        console.warn("Cloudflare 멀티 패킷 전송 실패",error);
      }
    }

    sendRaw(message){
      if(this.socket?.readyState!==WebSocket.OPEN)return Promise.resolve("error");
      try{
        this.socket.send(JSON.stringify(message));
        return Promise.resolve("ok");
      }catch{
        return Promise.resolve("error");
      }
    }

    receive(raw){
      let message;
      try{
        message=JSON.parse(String(raw));
      }catch{
        return;
      }

      if(message.op==="presence"&&message.state&&typeof message.state==="object"){
        const previous=this.presence;
        this.presence=message.state;
        this.dispatch("presence","sync",{});
        const previousKeys=new Set(Object.keys(previous));
        const nextKeys=new Set(Object.keys(this.presence));
        if([...nextKeys].some(key=>!previousKeys.has(key))){
          this.dispatch("presence","join",{});
        }
        if([...previousKeys].some(key=>!nextKeys.has(key))){
          this.dispatch("presence","leave",{});
        }
        return;
      }

      if(message.op==="error"){
        if(message.code==="room_full")this.emitStatus("CHANNEL_ERROR");
        return;
      }

      if(message.op==="batch"&&Array.isArray(message.messages)){
        for(const item of message.messages){
          if(!item||typeof item.event!=="string")continue;
          this.dispatch("broadcast",item.event,{payload:item.payload});
        }
        return;
      }

      if(message.op==="broadcast"&&typeof message.event==="string"){
        this.dispatch("broadcast",message.event,{payload:message.payload});
      }
    }

    dispatch(type,event,payload){
      for(const entry of this.handlers){
        if(entry.type!==type||entry.event!==event)continue;
        try{entry.handler(payload);}catch(error){
          console.warn(`Cloudflare ${type}:${event} 처리 실패`,error);
        }
      }
    }

    emitStatus(status){
      try{this.statusHandler?.(status);}catch(error){
        console.warn("Cloudflare 연결 상태 처리 실패",error);
      }
    }
  }

  window.createLastWaveRealtimeChannel=function(topic,options){
    const endpoint=configuredEndpoint();
    if(endpoint){
      return new LastWaveCloudflareChannel(topic,options,endpoint);
    }
    const client=supabaseClient();
    if(!client)throw new Error("멀티플레이 서버를 사용할 수 없습니다.");
    console.warn("Cloudflare 서버 주소가 없어 Supabase Realtime으로 임시 연결합니다.");
    return client.channel(topic,options);
  };

  window.removeLastWaveRealtimeChannel=async function(channel){
    if(!channel)return;
    if(channel.__lwCloudflare){
      await channel.unsubscribe();
      return;
    }
    const client=supabaseClient();
    if(client)await client.removeChannel(channel);
  };

  window.setLastWaveCloudflareEndpoint=function(url){
    const value=String(url||"").trim().replace(/\/+$/,"");
    if(value)localStorage.setItem(CONFIG_KEY,value);
    else localStorage.removeItem(CONFIG_KEY);
    return value;
  };

  const baseGetProfile=
    typeof window.getMultiplayerSyncProfile==="function"
      ? window.getMultiplayerSyncProfile
      : null;
  if(baseGetProfile){
    window.getMultiplayerSyncProfile=function(){
      const base=baseGetProfile();
      if(multiplayer?.channel?.transportName!=="cloudflare")return base;
      const count=getMultiplayerPlayerCount();
      const cloudflareProfiles={
        2:{inputActive:.05,inputIdle:.55,frame:.075,projectile:.24,fullSnapshot:10,loadoutRoster:8},
        3:{inputActive:.06,inputIdle:.65,frame:.09,projectile:.28,fullSnapshot:12,loadoutRoster:10},
        4:{inputActive:.075,inputIdle:.75,frame:.11,projectile:.34,fullSnapshot:14,loadoutRoster:12}
      };
      return cloudflareProfiles[count>=4?4:count===3?3:2];
    };
  }

  window.__lastWaveCloudflare={
    version:1,
    releaseVersion:106,
    configured:Boolean(configuredEndpoint()),
    endpoint:configuredEndpoint(),
    transport:"durable-objects"
  };
})();
