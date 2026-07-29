/* Last Wave v105
 * 상황마다 다른 선율·리듬·음색을 사용하고, 같은 상황에서도 편곡이 순환합니다.
 */
(() => {
  "use strict";

  const TRACKS={
    menu:[
      {id:"neon-signal",root:110,notes:[0,7,12,14,12,7,5,7],leadEvery:4,leadType:"sine",bass:55,bassPattern:[0,8],chord:[0,7,12],counter:[19,14,12,7],counterEvery:16,drums:"soft"},
      {id:"quiet-network",root:98,notes:[0,5,9,12,9,5,7,2],leadEvery:4,leadType:"triangle",bass:49,bassPattern:[0,12],chord:[0,5,9],counter:[12,16,19,16],counterEvery:16,drums:"none"},
      {id:"last-beacon",root:123.47,notes:[0,4,7,11,7,4,2,7],leadEvery:3,leadType:"sine",bass:61.74,bassPattern:[0,8],chord:[0,4,7],counter:[19,16,14,11],counterEvery:12,drums:"glitch"}
    ],
    shop:[
      {id:"safe-room",root:130.81,notes:[0,4,7,12,11,7,4,2],leadEvery:4,leadType:"triangle",bass:65.41,bassPattern:[0,8],chord:[0,4,7],counter:[16,19,23,19],counterEvery:16,drums:"soft"},
      {id:"field-repair",root:146.83,notes:[0,7,9,12,9,7,4,7],leadEvery:3,leadType:"sine",bass:73.42,bassPattern:[0,10],chord:[0,7,9],counter:[12,16,19,16],counterEvery:12,drums:"glitch"},
      {id:"supply-light",root:123.47,notes:[0,2,4,7,9,7,4,2],leadEvery:2,leadType:"triangle",bass:61.74,bassPattern:[0,6,12],chord:[0,4,9],counter:[16,14,12,9],counterEvery:16,drums:"soft"}
    ],
    dawn:[
      {id:"first-light",root:92.5,notes:[0,5,7,12,10,7,5,3],leadEvery:4,leadType:"sine",bass:46.25,bassPattern:[0,8],chord:[0,5,12],counter:[19,17,12,10],counterEvery:16,drums:"none"},
      {id:"empty-streets",root:98,notes:[0,3,7,10,12,10,7,3],leadEvery:3,leadType:"triangle",bass:49,bassPattern:[0,10],chord:[0,3,7],counter:[15,19,22,19],counterEvery:12,drums:"soft"},
      {id:"new-watch",root:110,notes:[0,4,7,9,12,9,7,4],leadEvery:2,leadType:"sine",bass:55,bassPattern:[0,8,14],chord:[0,4,9],counter:[16,14,12,9],counterEvery:16,drums:"glitch"}
    ],
    day:[
      {id:"forward-line",root:87.31,notes:[0,4,7,12,9,7,4,2],leadEvery:2,leadType:"triangle",bass:43.65,bassPattern:[0,6,8,14],chord:[0,7,12],counter:[16,19,14,12],counterEvery:8,drums:"drive"},
      {id:"broken-highway",root:82.41,notes:[0,3,7,10,7,3,5,10],leadEvery:2,leadType:"square",bass:41.2,bassPattern:[0,4,10,12],chord:[0,3,7],counter:[15,12,10,7],counterEvery:12,drums:"glitch"},
      {id:"clear-sector",root:98,notes:[0,7,9,12,16,12,9,7],leadEvery:3,leadType:"sine",bass:49,bassPattern:[0,8,12],chord:[0,7,9],counter:[19,16,14,12],counterEvery:8,drums:"drive"}
    ],
    evening:[
      {id:"falling-sun",root:77.78,notes:[0,3,7,12,10,7,5,3],leadEvery:3,leadType:"triangle",bass:38.89,bassPattern:[0,8],chord:[0,3,7],counter:[15,19,17,12],counterEvery:12,drums:"soft"},
      {id:"red-sky",root:73.42,notes:[0,5,8,12,8,5,3,5],leadEvery:3,leadType:"sine",bass:36.7,bassPattern:[0,6,12],chord:[0,5,8],counter:[17,15,12,8],counterEvery:16,drums:"drive"},
      {id:"long-shadows",root:69.3,notes:[0,3,7,10,14,10,7,3],leadEvery:4,leadType:"triangle",bass:34.65,bassPattern:[0,10],chord:[0,3,10],counter:[19,17,14,10],counterEvery:12,drums:"glitch"}
    ],
    night:[
      {id:"cold-patrol",root:73.42,notes:[0,5,7,12,10,7,5,3],leadEvery:4,leadType:"sine",bass:36.7,bassPattern:[0,8],chord:[0,5,12],counter:[19,17,15,12],counterEvery:16,drums:"none"},
      {id:"dark-grid",root:69.3,notes:[0,3,6,10,8,6,3,1],leadEvery:3,leadType:"triangle",bass:34.65,bassPattern:[0,10,14],chord:[0,3,6],counter:[18,15,13,10],counterEvery:12,drums:"glitch"},
      {id:"distant-horde",root:65.41,notes:[0,1,5,8,12,8,5,1],leadEvery:2,leadType:"square",bass:32.7,bassPattern:[0,6,8,14],chord:[0,5,8],counter:[13,17,20,17],counterEvery:8,drums:"drive"}
    ],
    danger:[
      {id:"low-pulse",root:65.41,notes:[0,1,6,8,6,1,3,6],leadEvery:2,leadType:"sawtooth",bass:32.7,bassPattern:[0,4,8,12],chord:[0,1,6],counter:[12,13,18,15],counterEvery:8,drums:"heavy"},
      {id:"surrounded",root:58.27,notes:[0,6,1,8,6,10,1,6],leadEvery:2,leadType:"square",bass:29.14,bassPattern:[0,3,6,8,11,14],chord:[0,6,10],counter:[13,10,18,13],counterEvery:6,drums:"heavy"},
      {id:"one-heart",root:55,notes:[0,1,3,6,8,6,3,1],leadEvery:1,leadType:"triangle",bass:27.5,bassPattern:[0,4,7,8,12,15],chord:[0,3,6],counter:[12,15,18,13],counterEvery:8,drums:"drive"}
    ],
    boss:[
      {id:"heavy-arrival",root:65.41,notes:[0,1,6,1,0,8,6,1],leadEvery:2,leadType:"sawtooth",bass:32.7,bassPattern:[0,4,8,12],chord:[0,1,6],counter:[12,13,18,13],counterEvery:8,drums:"heavy"},
      {id:"siege-engine",root:58.27,notes:[0,6,1,8,0,6,10,1],leadEvery:2,leadType:"square",bass:29.14,bassPattern:[0,3,6,8,11,14],chord:[0,6,10],counter:[13,18,10,13],counterEvery:6,drums:"heavy"},
      {id:"final-protocol",root:55,notes:[0,1,7,6,1,10,7,3],leadEvery:1,leadType:"sawtooth",bass:27.5,bassPattern:[0,4,6,8,12,14],chord:[0,1,7],counter:[12,19,18,13],counterEvery:8,drums:"heavy"}
    ]
  };

  function livingEnemyCount(){
    if(typeof enemies==="undefined"||!Array.isArray(enemies))return 0;
    let count=0;
    for(const enemy of enemies){
      if(enemy&&!enemy.dead)count++;
    }
    return count;
  }

  function v105BgmTheme(){
    if(state==="menu")return "menu";
    if(state==="waveComplete")return "shop";
    if(currentBoss&&!currentBoss.dead)return "boss";

    const hpRatio=player
      ? (Number(player.hp)||0)/Math.max(1,Number(player.maxHp)||1)
      : 1;
    const enemyCap=typeof getActiveEnemyCap==="function"
      ? getActiveEnemyCap()
      : 24;
    const crowded=livingEnemyCount()>=Math.max(12,Math.floor(enemyCap*.7));
    if(hpRatio<=.35||crowded)return "danger";
    if(timeOfDay==="dawn")return "dawn";
    if(timeOfDay==="morning"||timeOfDay==="noon")return "day";
    if(timeOfDay==="evening")return "evening";
    return "night";
  }

  function playDrums(style,step){
    const beat=step%16;
    if(style==="none")return;

    if(
      (style==="soft"&&beat===8)||
      (style==="glitch"&&(beat===4||beat===12))||
      (style==="drive"&&(beat===0||beat===8))||
      (style==="heavy"&&(beat===0||beat===4||beat===8||beat===12))
    ){
      audioTone({
        frequency:style==="heavy"?72:86,
        endFrequency:style==="heavy"?34:48,
        duration:style==="heavy"?.13:.085,
        volume:style==="heavy"?.027:.014,
        type:"sine",
        destination:"music",
        release:.06
      });
    }

    if(
      (style==="soft"&&beat===12)||
      (style==="glitch"&&(beat===2||beat===7||beat===14))||
      (style==="drive"&&(beat===4||beat===12))||
      (style==="heavy"&&(beat===2||beat===6||beat===10||beat===14))
    ){
      audioNoise({
        duration:style==="heavy"?.055:.032,
        volume:style==="heavy"?.010:.0055,
        destination:"music",
        highpass:style==="glitch"?4800:2300,
        lowpass:style==="heavy"?6800:9800,
        playbackRate:style==="glitch"?1.7:1.35
      });
    }
  }

  function playArrangementStep(cfg,theme,step){
    if(step%cfg.leadEvery===0){
      const note=cfg.notes[Math.floor(step/cfg.leadEvery)%cfg.notes.length];
      if(Number.isFinite(note)){
        const frequency=cfg.root*Math.pow(2,note/12);
        audioTone({
          frequency,
          endFrequency:frequency*(cfg.leadType==="sawtooth"?.985:1.002),
          duration:theme==="boss"||theme==="danger"?.20:.38,
          volume:theme==="boss"?.032:theme==="danger"?.025:.019,
          type:cfg.leadType,
          destination:"music",
          attack:cfg.leadType==="sine"?.025:.006,
          release:theme==="night"?.42:.24
        });
      }
    }

    if(cfg.bassPattern.includes(step%16)){
      audioTone({
        frequency:cfg.bass,
        endFrequency:cfg.bass*.92,
        duration:theme==="boss"||theme==="danger"?.28:.42,
        volume:theme==="boss"?.031:theme==="danger"?.027:.016,
        type:theme==="boss"?"triangle":"sine",
        destination:"music",
        release:.2
      });
    }

    if(step%32===0&&audioSystem.activeVoices<audioSystem.maxVoices-4){
      for(const interval of cfg.chord){
        const frequency=cfg.root*.5*Math.pow(2,interval/12);
        audioTone({
          frequency,
          endFrequency:frequency*1.002,
          duration:theme==="boss"?1.15:1.8,
          volume:theme==="boss"?.009:.007,
          type:"sine",
          destination:"music",
          attack:.16,
          release:.75,
          detune:interval===0?-5:5
        });
      }
    }

    if(cfg.counter&&step%cfg.counterEvery===cfg.counterEvery-2){
      const note=cfg.counter[Math.floor(step/cfg.counterEvery)%cfg.counter.length];
      const frequency=cfg.root*Math.pow(2,note/12);
      audioTone({
        frequency,
        endFrequency:frequency*1.004,
        duration:.22,
        volume:theme==="boss"?.013:.009,
        type:cfg.leadType==="sine"?"triangle":"sine",
        destination:"music",
        release:.26
      });
    }

    playDrums(cfg.drums,step);

    if((weather==="rain"||weather==="heavyRain")&&step%16===6){
      audioNoise({
        duration:.22,
        volume:weather==="heavyRain"?.0035:.002,
        destination:"music",
        highpass:5200,
        lowpass:12000,
        playbackRate:1.2
      });
    }
  }

  currentBgmTheme=v105BgmTheme;
  startBgm=function(){
    if(audioSystem.bgmTimer||!audioSystem.ctx)return;

    let previousTheme="";
    let themeStep=0;
    let variantIndex=0;
    const tick=()=>{
      if(!audioSystem.unlocked||save.soundEnabled===false)return;

      const theme=v105BgmTheme();
      const variants=TRACKS[theme]||TRACKS.day;
      if(theme!==previousTheme){
        previousTheme=theme;
        themeStep=0;
        variantIndex=Math.abs((typeof wave==="undefined"?0:Number(wave)||0)+theme.length)%variants.length;
      }else if(themeStep>0&&themeStep%160===0){
        variantIndex=(variantIndex+1)%variants.length;
      }

      const cfg=variants[variantIndex%variants.length];
      audioSystem.theme=theme;
      audioSystem.bgmArrangement={
        theme,
        id:cfg.id,
        variant:variantIndex%variants.length,
        count:variants.length
      };
      playArrangementStep(cfg,theme,themeStep%64);
      themeStep++;
      audioSystem.bgmStep++;
    };

    tick();
    audioSystem.bgmTimer=setInterval(tick,200);
  };

  document.getElementById("gameVersion")?.replaceChildren("v105");
  window.__lastWaveV105={
    version:105,
    themes:Object.fromEntries(
      Object.entries(TRACKS).map(([theme,tracks])=>[
        theme,
        tracks.map(track=>track.id)
      ])
    ),
    getTheme:v105BgmTheme,
    getArrangement:()=>audioSystem.bgmArrangement||null
  };
})();
