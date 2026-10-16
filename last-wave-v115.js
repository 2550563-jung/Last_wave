/* LAST WAVE v115: credit-funded modular illustrated wardrobe. */
(() => {
  "use strict";
  const groups={
    hair:{name:"머리 모양",items:[["크롭 컷",0],["사이드 파트",600],["단발",900],["포니테일",1200]]},
    top:{name:"윗옷",items:[["전술 재킷",0],["메디컬 코트",1300],["오렌지 후드",1800],["블랙 아머",2300]]},
    pants:{name:"바지",items:[["카고 팬츠",0],["슬림 팬츠",800],["택티컬 팬츠",1200]]},
    accessory:{name:"액세서리",items:[["없음",0],["골드 고글",900],["아이스 고글",1200],["블랙 고글",1400]]},
    skin:{name:"피부색",items:[["아이보리",0],["라이트",0],["내추럴",0],["웜",0],["브라운",0],["딥",0]]},
    hairColor:{name:"머리카락 색",items:[["검정",0],["갈색",0],["금색",0],["은색",0],["파랑",0],["분홍",0]]}
  };
  const skinColors=["#f6d8c1","#eec09c","#d49a70","#b77d56","#895237","#563322"];
  const hairColors=["#211e26","#65422e","#e5be56","#c3d2df","#3c86d7","#e878a8"];
  const defaults={hair:0,top:0,pants:0,accessory:0,skin:2,hairColor:0};
  function sanitize(value){
    const result={};
    for(const [key,g]of Object.entries(groups)){
      const n=value?.[key];result[key]=Number.isInteger(n)&&n>=0&&n<g.items.length?n:defaults[key];
    }
    return result;
  }
  function ownedDefaults(){return Object.entries(groups).flatMap(([key,g])=>g.items.flatMap((item,i)=>item[1]===0?[key+":"+i]:[]));}
  function ensure(){
    const valid=new Set(Object.entries(groups).flatMap(([key,g])=>g.items.map((_,i)=>key+":"+i)));
    save.ownedStyleV115=[...new Set([...ownedDefaults(),...(Array.isArray(save.ownedStyleV115)?save.ownedStyleV115.filter(x=>valid.has(x)):[])])];
    save.styleV115=sanitize(save.styleV115);
    for(const key of Object.keys(groups))if(!save.ownedStyleV115.includes(key+":"+save.styleV115[key]))save.styleV115[key]=defaults[key];
  }
  ensure();let draft={...save.styleV115};
  function price(style=draft){
    return Object.entries(sanitize(style)).reduce((n,[key,i])=>n+(save.ownedStyleV115.includes(key+":"+i)?0:groups[key].items[i][1]),0);
  }
  function apply(){
    ensure();const style=sanitize(draft),cost=price(style);
    if((Number(save.credits)||0)<cost){showMessage("크레딧 부족","게임 플레이와 업적으로 크레딧을 모을 수 있습니다.");return false;}
    save.credits-=cost;
    for(const [key,i]of Object.entries(style))if(!save.ownedStyleV115.includes(key+":"+i))save.ownedStyleV115.push(key+":"+i);
    save.styleV115=style;
    if(player){player.styleV115={...style};notifyMultiplayerLoadoutChanged();}
    persist();refreshProfileSummary();render();return true;
  }
  function open(){ensure();draft={...save.styleV115};render();showOverlay(document.getElementById("lw115Wardrobe"));}
  function render(){
    const panel=document.getElementById("lw115Wardrobe");if(!panel)return;
    panel.querySelector(".lw115-balance").textContent="보유 크레딧 "+formatNumber(save.credits||0);
    const grid=panel.querySelector(".lw115-groups");grid.innerHTML="";
    for(const [key,g]of Object.entries(groups)){
      const section=document.createElement("section"),title=document.createElement("h3"),row=document.createElement("div");
      title.textContent=g.name;row.className="lw115-options";
      g.items.forEach(([name,cost],i)=>{
        const button=document.createElement("button"),owned=save.ownedStyleV115.includes(key+":"+i);
        button.className="lw115-option"+(draft[key]===i?" selected":"");button.type="button";
        button.setAttribute("aria-pressed",String(draft[key]===i));
        button.textContent=name+" · "+(owned?"보유":formatNumber(cost)+" C");
        if(key==="skin"||key==="hairColor")button.style.borderBottomColor=(key==="skin"?skinColors:hairColors)[i];
        button.onclick=()=>{draft[key]=i;render();};row.append(button);
      });
      section.append(title,row);grid.append(section);
    }
    const cost=price(),button=panel.querySelector(".lw115-apply");
    button.textContent=cost?formatNumber(cost)+" 크레딧 · 구매하고 적용":"선택한 스타일 적용";
    button.disabled=(save.credits||0)<cost;button.onclick=apply;
    const canvas=panel.querySelector("canvas"),g=canvas.getContext("2d");
    g.clearRect(0,0,canvas.width,canvas.height);
    if(atlasReady)compose(g,draft,120,210,2.1,save.gender==="female");
    else{g.fillStyle="#bce9ff";g.textAlign="center";g.font="15px sans-serif";g.fillText("의상 이미지 준비 중…",120,150);}
  }
  document.body.insertAdjacentHTML("beforeend",'<div class="overlay" id="lw115Wardrobe"><div class="panel hero lw115-panel"><div class="eyebrow">SURVIVOR STUDIO</div><h2>캐릭터 꾸미기</h2><p>부품을 미리 입어보고 크레딧으로 구매하세요. 구매한 부품은 영구 보유하며 능력치는 바뀌지 않습니다.</p><div class="lw115-balance"></div><div class="lw115-layout"><div class="lw115-preview"><canvas width="240" height="300"></canvas><small>현재 선택 미리보기</small></div><div class="lw115-groups"></div></div><div class="actions"><button class="btn gold-btn lw115-apply"></button><button class="btn lw115-close">닫기</button></div></div></div>');
  document.querySelector("#lw115Wardrobe .lw115-close").onclick=()=>hideOverlay(document.getElementById("lw115Wardrobe"));
  const button=document.createElement("button");button.id="lw115WardrobeButton";button.className="btn";button.textContent="캐릭터 꾸미기";button.onclick=open;
  document.querySelector("#menu .menu-buttons")?.prepend(button);
  const oldCloudPayload=cloudProfilePayload;
  cloudProfilePayload=function(){return {...oldCloudPayload(),styleV115:{...save.styleV115},ownedStyleV115:[...save.ownedStyleV115]};};
  const oldApplyCloud=applyCloudProfile;
  applyCloudProfile=function(profile){const r=oldApplyCloud(profile);if(r){
    if(profile.styleV115!==undefined)save.styleV115=sanitize(profile.styleV115);
    if(Array.isArray(profile.ownedStyleV115))save.ownedStyleV115=profile.ownedStyleV115;
    ensure();draft={...save.styleV115};render();
  }return r;};
  const oldCreatePlayer=createPlayer;
  createPlayer=function(...args){const p=oldCreatePlayer(...args);p.styleV115={...save.styleV115};return p;};
  const oldPayload=makeMultiplayerLoadoutPayload;
  makeMultiplayerLoadoutPayload=function(){const p=oldPayload();if(p)p.styleV115=sanitize(player?.styleV115||save.styleV115);return p;};
  const oldSanitize=sanitizeMultiplayerLoadout;
  sanitizeMultiplayerLoadout=function(payload,target){return {...oldSanitize(payload,target),styleV115:sanitize(payload?.styleV115||target?.styleV115)};};
  const oldApply=applyMultiplayerLoadout;
  applyMultiplayerLoadout=function(target,payload){const r=oldApply(target,payload);if(r){target.styleV115=sanitize(payload?.styleV115||target.styleV115);const cached=multiplayer.loadoutByPlayerId.get(target.id);if(cached)cached.styleV115={...target.styleV115};}return r;};
  const oldRoster=makeLoadoutRoster;
  makeLoadoutRoster=function(){const r=oldRoster();for(const entry of r.players||[])entry.styleV115=sanitize(players.get(entry.playerId)?.styleV115);return r;};

  let atlasReady=false,baseReady=false;const pieces=[],cache=new Map(),outfits=[[],[]],hairs=[];
  function tinted(index,color,skinOnly=false){
    const key=(typeof index==="number"?index:index.key)+":"+color+":"+skinOnly;if(cache.has(key))return cache.get(key);
    const source=typeof index==="number"?pieces[index]:index.canvas;if(!source)return null;
    const c=document.createElement("canvas");c.width=source.width;c.height=source.height;
    const g=c.getContext("2d",{willReadFrequently:true});g.drawImage(source,0,0);
    const data=g.getImageData(0,0,c.width,c.height),d=data.data;
    const rgb=color.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16));
    for(let i=0;i<d.length;i+=4){
      if(!d[i+3])continue;
      if(skinOnly){
        const px=(i/4)%c.width,py=Math.floor(i/4/c.width),female=index.key?.includes("female");
        const exposed=py<c.height*.20||
          (py>c.height*(female?.44:.49)&&py<c.height*(female?.57:.62)&&(px<c.width*.24||px>c.width*.76));
        const skinHue=d[i]>d[i+1]*1.12&&d[i]>d[i+2]*1.22&&d[i+2]>d[i+1]*.52&&d[i]<d[i+1]*1.85;
        if(!exposed||!skinHue)continue;
      }
      const light=(d[i]*.3+d[i+1]*.59+d[i+2]*.11)/170;
      d[i]=Math.min(255,rgb[0]*light);d[i+1]=Math.min(255,rgb[1]*light);d[i+2]=Math.min(255,rgb[2]*light);
    }
    g.putImageData(data,0,0);cache.set(key,c);return c;
  }
  function compose(g,raw,x,y,scale=1,female=false){
    if(!atlasReady)return;
    const s=sanitize(raw);g.save();g.translate(x,y);g.scale(scale,scale);
    const outfit=outfits[female?1:0][s.pants*4+s.top],factor=108/outfit.canvas.height;
    const width=outfit.canvas.width*factor,left=-width/2,top=-83;
    g.drawImage(tinted(outfit,skinColors[s.skin],true),left,top,width,108);
    const head=outfit.head,headWidth=(head.right-head.left)*factor,headHeight=(head.bottom-head.top)*factor;
    const foreheadX=left+(head.right-(head.right-head.left)*.12)*factor;
    const foreheadY=top+(head.top+(head.bottom-head.top)*.30)*factor;
    const hair=hairs[s.hair],attachment=[[.70,.40,.55],[.72,.37,.55],[.72,.39,.54],[.83,.38,.52]][s.hair];
    const hairScale=headWidth/(hair.canvas.width*attachment[2]);
    const hairImage=tinted(hair,hairColors[s.hairColor]);
    g.drawImage(hairImage,foreheadX-hair.canvas.width*attachment[0]*hairScale,
      foreheadY-hair.canvas.height*attachment[1]*hairScale,hair.canvas.width*hairScale,hair.canvas.height*hairScale);
    if(s.accessory){
      const goggles=tinted(15,["","#d9ad50","#62d4ee","#343845"][s.accessory]);
      const eyeX=left+(head.left+(head.right-head.left)*.64)*factor,eyeY=top+(head.top+(head.bottom-head.top)*.50)*factor;
      const w=headWidth*1.05,h=headHeight*.30;
      g.drawImage(goggles,eyeX-w/2,eyeY-h/2,w,h);
    }
    g.restore();
  }
  function refreshReady(){
    atlasReady=baseReady&&outfits.every(sheet=>sheet.length===12)&&hairs.length===4;
    if(atlasReady)render();
  }
  function extractFrame(image,col,row,cols,rows,trim=true){
    const c=document.createElement("canvas");c.width=Math.floor(image.width/cols);c.height=Math.floor(image.height/rows);
    const g=c.getContext("2d",{willReadFrequently:true});
    g.drawImage(image,Math.floor(image.width*col/cols),Math.floor(image.height*row/rows),c.width,c.height,0,0,c.width,c.height);
    const data=g.getImageData(0,0,c.width,c.height),d=data.data;
    let left=c.width,top=c.height,right=-1,bottom=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4;
      if(d[i]>130&&d[i+2]>110&&d[i+1]<120&&d[i]+d[i+2]>d[i+1]*3.4)d[i+3]=0;
      if(d[i+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    }
    g.putImageData(data,0,0);
    if(!trim)return c;
    const result=document.createElement("canvas");result.width=Math.max(1,right-left+1);result.height=Math.max(1,bottom-top+1);
    result.getContext("2d").drawImage(c,left,top,result.width,result.height,0,0,result.width,result.height);
    return result;
  }
  function measureHead(canvas){
    const g=canvas.getContext("2d"),d=g.getImageData(0,0,canvas.width,canvas.height).data;
    let left=canvas.width,right=0,top=canvas.height,bottom=0;
    for(let y=0;y<canvas.height*.12;y++)for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4;
      if(d[i+3]>100&&d[i]>d[i+1]*1.12&&d[i]>d[i+2]*1.22){
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
    }
    if(right<=left)return {left:canvas.width*.4,right:canvas.width*.65,top:0,bottom:canvas.height*.12};
    return {left,right,top,bottom};
  }
  ["male","female"].forEach((gender,genderIndex)=>{
    const sheet=new Image();sheet.onload=()=>{
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){
        const canvas=extractFrame(sheet,col,row,4,3),index=row*4+col;
        outfits[genderIndex].push({canvas,key:"outfit:"+gender+":"+index,head:measureHead(canvas)});
      }
      refreshReady();
    };sheet.src="./assets/outfits-"+gender+"-v1151.webp";
  });
  const hairSheet=new Image();hairSheet.onload=()=>{
    for(let col=0;col<4;col++){
      const canvas=extractFrame(hairSheet,col,0,4,1,false);
      if(col===2)canvas.getContext("2d").clearRect(canvas.width*.88,0,canvas.width*.12,canvas.height);
      hairs.push({canvas,key:"hair:"+col});
    }
    refreshReady();
  };hairSheet.src="./assets/hair-v1151.webp";
  const image=new Image();image.onload=()=>{
    const rows=[0,.30,.51,.715,1];
    for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const c=document.createElement("canvas");c.width=Math.floor(image.width/4)-8;c.height=Math.floor(image.height*(rows[row+1]-rows[row]))-8;
      const g=c.getContext("2d",{willReadFrequently:true});
      g.drawImage(image,Math.floor(image.width*col/4)+4,Math.floor(image.height*rows[row])+4,c.width,c.height,0,0,c.width,c.height);
      const data=g.getImageData(0,0,c.width,c.height),d=data.data;let minX=c.width,minY=c.height,maxX=0,maxY=0;
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;
        if(d[i]>130&&d[i+2]>110&&d[i+1]<120&&d[i]+d[i+2]>d[i+1]*3.4)d[i+3]=0;
        if(d[i+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      }
      g.putImageData(data,0,0);const trimmed=document.createElement("canvas");
      trimmed.width=Math.max(1,maxX-minX+1);trimmed.height=Math.max(1,maxY-minY+1);
      trimmed.getContext("2d").drawImage(c,minX,minY,trimmed.width,trimmed.height,0,0,trimmed.width,trimmed.height);pieces.push(trimmed);
    }
    baseReady=true;refreshReady();
  };image.src="./assets/comic-wardrobe-v115.webp";
  function drawCharacter(owner){
    if(!atlasReady||!owner||owner.dead)return false;
    const p=project(owner.x,owner.y),angle=owner.angle||0,bob=Math.sin(performance.now()*.012)*(owner.motion||0)*1.4;
    ctx.save();ctx.translate(p.x,p.y+bob);if(Math.cos(angle)<0)ctx.scale(-1,1);if(owner.downed)ctx.rotate(Math.PI/2);
    compose(ctx,owner.local?save.styleV115:owner.styleV115,0,0,1,owner.gender==="female");ctx.restore();
    const art=window.__lastWaveArtV113;
    if(art?.ready)art.sprite(1,art.gunIndex(getWeaponId(owner)),p.x+Math.cos(angle)*20,p.y-24+Math.sin(angle)*10,56,32,false,angle);
    drawPet(owner);return true;
  }
  window.__lastWaveSkinsV115={groups,sanitize,price,apply,open,render,compose,drawCharacter,get ready(){return atlasReady;},setDraft(value){draft=sanitize(value);}};
  document.getElementById("gameVersion").textContent="v115.1";
  if(window.__lastWaveCloudflare)window.__lastWaveCloudflare.releaseVersion="115.1";
})();

