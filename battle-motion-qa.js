/* Explicit QA harness; no campaign progress or card-definition edits. */
document.addEventListener('DOMContentLoaded',()=>{
 const output=document.getElementById('results'),holder=document.getElementById('frameHolder'),report={};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async fn=>{for(let i=0;i<150;i++){if(fn())return;await wait(100);}throw Error('QA readiness timeout: '+String(fn).slice(0,180));};
 const show=(key,value)=>{report[key]=value;output.textContent=JSON.stringify(report,null,2);};
 function prepare({handCount=null,remainingMs=90000}={}){
  const E=MW_GAME_ENGINE,s=MW_COMBAT_QA.build(E,MW_BATTLE_REPLAY,MW_CANONICAL_CARDS,MW_APPROVED_EXAMPLE_DECKS);
  if(handCount!==null){s.players[0].hand=s.players[0].hand.slice(0,handCount);while(s.players[0].hand.length<handCount)E.debugAction(s,{type:'give',owner:0,cardId:'KNZ-002'});for(const owner of [0,1])while(s.players[owner].board.length<7)E.debugAction(s,{type:'summon',owner,cardId:'KNZ-002'});delete s.battleReplay;}
  const saved=E.exportBattle(s);saved.turnTimer={version:1,durationMs:90000,remainingMs,token:s.turns+':'+s.turn,expired:false};
  if(!sessionStorage.getItem('mw-qa-original-backed-up')){const old=localStorage.getItem('mw-active-battle-v2.0');if(old)localStorage.setItem('mw-previous-battle-v2.0',old);sessionStorage.setItem('mw-qa-original-backed-up','true');}
  localStorage.setItem('mw-active-battle-v2.0',JSON.stringify(saved));return s;
 }
 async function fixture(width=1280,height=720,options={}){
  holder.replaceChildren();await wait(100);prepare(options);const frame=document.createElement('iframe');frame.title='Проверяемое поле '+width+'×'+height;frame.width=width;frame.height=height;frame.src='index.html';holder.append(frame);
  await until(()=>frame.contentWindow.MW_DECK_TEST);const w=frame.contentWindow,d=w.document;w.MW_DECK_TEST.setMode('battle');d.getElementById('battleResumeBtn').click();await until(()=>w.MW_DECK_TEST.game()?.phase==='battle');await wait(200);return {frame,w,d,s:w.MW_DECK_TEST.game()};
 }
 const semantic=g=>JSON.stringify({players:g.players,time:g.time,turn:g.turn,turns:g.turns,randomState:g.randomState,serial:g.serial,phase:g.phase});
 const transientCount=d=>d.querySelectorAll('.mw-card-flight,.mw6-actor,.mw6-number,.mw-command-ghost,.mw-placement-slot').length;
 function run(id,fn){document.getElementById(id).onclick=async()=>{const buttons=[...document.querySelectorAll('body>button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){show(id,{FAIL:e.message});}finally{buttons.forEach(b=>b.disabled=false);}};}
 run('prepare',async()=>{holder.replaceChildren();await wait(100);prepare();show('prepared','Бой готов. В игре нажмите «Тестовый бой» → «Меню» → «Параметры» → «Продолжить».');});
 run('viewports',async()=>{const rows=[];for(const [width,height]of [[1280,720],[1366,768],[1600,900],[1920,1080],[2560,1440]])for(const handCount of [1,3,7,10]){
  const {w,d,s}=await fixture(width,height,{handCount});if(s.players[0].hand.length!==handCount)throw Error('Fixture occupancy mismatch');
  const h=s.players[0].hand[0],node=d.querySelector('[data-battle-hand="'+h.uid+'"]');node.focus();await wait(300);const preview=d.getElementById('mw14HandPreview'),r=preview?.getBoundingClientRect();
  const previewInside=!!r&&!preview.hidden&&r.left>=0&&r.top>=0&&r.right<=width+.5&&r.bottom<=height+.5;
  w.MW_BATTLE_VIEW_BRIDGE.inspect(0,'hand',h.uid);d.getElementById('battleInspectEffect').textContent=(d.getElementById('battleInspectEffect').textContent+' Длинная тестовая локализация ').repeat(30);
  const rect=d.querySelector('.battle-inspect-panel').getBoundingClientRect(),focus=d.activeElement.id==='battleInspectClose',fullTextInside=rect.left>=0&&rect.right<=width+.5&&rect.top>=0&&rect.bottom<=height+.5;
  d.getElementById('battleInspectClose').click();rows.push({width,height,handCount,actualHand:s.players[0].hand.length,boards:s.players.map(p=>p.board.length),previewInside,fullTextInside,focus,restored:d.activeElement===node});show('viewports',rows);
 }});
 run('recovery',async()=>{const rows=[];for(const mode of ['normal','reduced','resize','VFX-error','image-error']){
  const {frame,w,d,s}=await fixture();w.MW_MOTION_RUNTIME.setReduced(mode==='reduced');const a=s.players[0].board[0],b=s.players[1].board[0],reference=w.MW_GAME_ENGINE.importBattle(w.MW_GAME_ENGINE.exportBattle(s));
  if(mode==='VFX-error')w.Element.prototype.animate=()=>{throw Error('QA injected VFX failure');};
  if(mode==='image-error'){
   w.MW_BATTLE_CARD_RENDERER.request=()=>Promise.reject(Error('QA injected image failure'));const h=s.players[0].hand.find(h=>h.cardId==='KNZ-002');w.MW_GAME_ENGINE.playCard(reference,0,h.uid,null,null,0);w.MW_BATTLE_VIEW_BRIDGE.dispatch({type:'hand',uid:h.uid});d.querySelector('[data-placement-index="0"]').click();
  }else{w.MW_GAME_ENGINE.attack(reference,0,a.uid,{kind:'minion',owner:1,uid:b.uid});w.MW_BATTLE_VIEW_BRIDGE.dispatch({type:'minion',owner:0,uid:a.uid});w.MW_BATTLE_VIEW_BRIDGE.dispatch({type:'minion',owner:1,uid:b.uid});}
  if(mode==='resize'){frame.width=1366;w.dispatchEvent(new w.Event('resize'));}
  await until(()=>!w.MW_BATTLE_VIEW_BRIDGE.ui().busy);await wait(250);rows.push({mode,sameOutcome:semantic(reference)===semantic(s),transients:transientCount(d),activeAnimations:w.MW_MOTION_RUNTIME.metrics().active,inputReleased:!d.getElementById('battleWorkspace').hasAttribute('aria-busy')});show('recovery',rows);
 }});
 run('timerTest',async()=>{
  let f=await fixture(1280,720,{remainingMs:7000});const first=f.s.players[0].hand.find(h=>h.cardId==='KNZ-002'),count=f.s.players[0].hand.length,turns=f.s.turns;
  f.w.MW_BATTLE_VIEW_BRIDGE.dispatch({type:'hand',uid:first.uid});await wait(1600);const stored=JSON.parse(localStorage.getItem('mw-active-battle-v2.0')),saved=stored.turnTimer.remainingMs;
  if(!(saved<6500&&saved>0))throw Error('Timer did not periodically save remaining time');
  await new Promise(resolve=>{f.frame.addEventListener('load',resolve,{once:true});f.frame.contentWindow.location.reload();});await until(()=>f.frame.contentWindow.MW_DECK_TEST&&f.frame.contentDocument.readyState==='complete');await wait(250);const w=f.frame.contentWindow,d=w.document;w.MW_DECK_TEST.setMode('battle');d.getElementById('battleResumeBtn').click();await until(()=>w.MW_DECK_TEST.game()?.phase==='battle');
  const resumed=JSON.parse(localStorage.getItem('mw-active-battle-v2.0')).turnTimer.remainingMs;await until(()=>w.MW_DECK_TEST.game().turns>turns);const g=w.MW_DECK_TEST.game();
  show('timer',{savedMs:saved,resumedMs:resumed,reloadPreserved:resumed<=saved+100,handNotPaid:g.players[0].hand.some(h=>h.uid===first.uid),choiceCanceled:!w.MW_BATTLE_VIEW_BRIDGE.ui().pending,turnAdvanced:g.turns>turns,oldHand:count});
 });
 run('botTest',async()=>{
  const {w,d,s}=await fixture(),reference=w.MW_GAME_ENGINE.importBattle(w.MW_GAME_ENGINE.exportBattle(s));w.MW_GAME_ENGINE.endTurn(reference,0);w.MW_GAME_ENGINE.runBotTurn(reference,1);
  w.MW_MOTION_RUNTIME.setReduced(true);w.MW_BATTLE_VIEW_BRIDGE.dispatch({type:'endTurn'});await until(()=>s.turn===1);w.dispatchEvent(new w.Event('offline'));const paused=semantic(s);await wait(1200);const unchanged=semantic(s)===paused;w.dispatchEvent(new w.Event('online'));await until(()=>s.turn===0&&!w.MW_BATTLE_VIEW_BRIDGE.ui().busy);
  show('bot',{pausedUnchanged:unchanged,sameOutcome:semantic(reference)===semantic(s),replay:w.MW_BATTLE_REPLAY.verify(w.MW_BATTLE_REPLAY.exportReplay(s)).ok,transients:transientCount(d)});
 });
 run('background',async()=>{
  const {w,d,s}=await fixture(),reference=w.MW_GAME_ENGINE.importBattle(w.MW_GAME_ENGINE.exportBattle(s));w.MW_GAME_ENGINE.endTurn(reference,0);w.MW_GAME_ENGINE.runBotTurn(reference,1);
  w.MW_BATTLE_VIEW_BRIDGE.dispatch({type:'endTurn'});const serial=s.eventSerial;await until(()=>s.turn===1&&s.eventSerial>serial);
  // Explicit visibility simulation for deterministic QA. Never called by runtime.
  let hidden=true;Object.defineProperty(d,'hidden',{configurable:true,get:()=>hidden});
  try{d.dispatchEvent(new w.Event('visibilitychange'));const before=semantic(s);await wait(1200);const unchanged=semantic(s)===before;
   hidden=false;d.dispatchEvent(new w.Event('visibilitychange'));await until(()=>s.turn===0&&!w.MW_BATTLE_VIEW_BRIDGE.ui().busy);
   show('background',{simulatedVisibility:true,pausedUnchanged:unchanged,sameOutcome:semantic(reference)===semantic(s),replay:w.MW_BATTLE_REPLAY.verify(w.MW_BATTLE_REPLAY.exportReplay(s)).ok,transients:transientCount(d),inputReleased:!d.getElementById('battleWorkspace').hasAttribute('aria-busy')});
  }finally{delete d.hidden;}
 });
 run('benchmark',async()=>{
  const {w,d,s}=await fixture(1280,720),intervals=[];holder.scrollIntoView({block:'start'});await wait(200);let previous=performance.now(),end=previous+3500;
  const attacker=s.players[0].board[0],victim=s.players[1].board[0];w.MW_BATTLE_VIEW_BRIDGE.dispatch({type:'minion',owner:0,uid:attacker.uid});w.MW_BATTLE_VIEW_BRIDGE.dispatch({type:'minion',owner:1,uid:victim.uid});
  while(performance.now()<end){await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-previous);previous=now;}
  await until(()=>!w.MW_BATTLE_VIEW_BRIDGE.ui().busy);const sorted=intervals.slice().sort((a,b)=>a-b),latency=[];for(let i=0;i<100;i++){const x=MW_COMBAT_QA.build(MW_GAME_ENGINE,MW_BATTLE_REPLAY,MW_CANONICAL_CARDS,MW_APPROVED_EXAMPLE_DECKS),a=performance.now();MW_GAME_ENGINE.endTurn(x,x.turn);latency.push(performance.now()-a);}latency.sort((a,b)=>a-b);
  show('benchmark',{scope:'requestAnimationFrame cadence, on-screen 1280x720 Chrome iframe battle: one minion exchange plus idle, 3.5 seconds; not GPU FPS or target-hardware acceptance',userAgent:navigator.userAgent,DPR:devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency,frames:intervals.length,meanFPS:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),frameP95ms:sorted[Math.floor(sorted.length*.95)],frameMaxMs:sorted.at(-1),endTurnP95ms:latency[95],transients:transientCount(d),runtime:w.MW_MOTION_RUNTIME.metrics()});
 });
});
