/* MW T03: command boundary and public presentation stream.
 * This is an incremental contract, not a replay of historic text logs.
 * Engine state/RNG and the existing replay format remain unchanged. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MW_BATTLE_PRESENTATION=api;
})(typeof window==='object'?window:globalThis,function(){
'use strict';
const VERSION=1,COMMANDS=new Set(['playCard','attack','useHeroPower','endTurn','confirmMulligan']);
const copy=x=>JSON.parse(JSON.stringify(x));
function publicView(game,viewer=0){
 if(![0,1].includes(viewer))throw new Error('Invalid viewer');
 const visible=new Set();
 const players=game.players.map((p,owner)=>{
  for(const m of p.board)visible.add(m.cardId);
  if(owner===viewer)for(const h of p.hand)visible.add(h.cardId);
  if(p.weapon)visible.add(p.weapon.cardId);
  // Never copy decks, hidden hand instance IDs, RNG, logs, or private choices.
  return {owner,health:p.health,armor:p.armor,mana:p.mana,maxMana:p.maxMana,
   handCount:p.hand.length,deckCount:p.deck.length,board:copy(p.board),
   hand:owner===viewer?copy(p.hand):null,weapon:copy(p.weapon),
   heroPowerUsed:p.heroPowerUsed,heroAttacked:p.heroAttacked};
 });
 const cards={};for(const id of visible)if(game.cards[id])cards[id]=copy(game.cards[id]);
 return {phase:game.phase,turn:game.turn,turns:game.turns,hour:game.time,
  winner:game.winner,viewer,players,cards};
}
function createSession(engine,game,{battleId,viewer=0,limit=1024}={}){
 if(typeof battleId!=='string'||!battleId)throw new Error('battleId required');
 let revision=0,serial=0,faulted=false;const commands=new Map();
 const view=()=>publicView(game,viewer);
 function execute(command){
  if(!command||typeof command.commandId!=='string'||!command.commandId||
     !COMMANDS.has(command.type)||!Array.isArray(command.args))
   return {ok:false,reason:'Invalid presentation command',events:[]};
  const request=copy(command),key=request.commandId,fingerprint=JSON.stringify(request);
  if(commands.has(key)){
   const old=commands.get(key);
   return old.fingerprint===fingerprint?copy(old.result):
    {ok:false,reason:'commandId already used with another payload',events:[]};
  }
  if(faulted)return {ok:false,reason:"Engine command failed; restore the last accepted save",events:[]};
  if(request.expectedRevision!==revision)
   return {ok:false,reason:'Stale presentation revision',events:[]};
  // Refuse capacity overflow instead of forgetting IDs and allowing re-payment.
  if(commands.size>=limit)return {ok:false,reason:'Presentation command capacity reached',events:[]};
  const before=view(),owner=request.args[0];
  const hand=request.type==='playCard'?game.players[owner]?.hand.find(h=>h.uid===request.args[1]):null;
  const played=hand?{uid:hand.uid,cardId:hand.cardId,card:copy(game.cards[hand.cardId]||null)}:null;
  // Reserve before invoking engine: even a throwing command cannot be paid twice.
  commands.set(key,{fingerprint,result:{ok:false,reason:'Command in progress',events:[]}});
  let result;const movement=engine.captureCardMovements?.(game),combat=engine.captureCombat?.(game,{kind:request.type,owner:Number.isInteger(owner)?owner:null,uid:played?.uid||(request.type==='attack'?request.args[1]||null:null),cardId:played?.cardId||null});
  try{result=engine[request.type](game,...request.args);}
  catch(_){
   faulted=true;
   const failed={ok:false,reason:'Engine command failed; restore the last accepted save',battleId,revision,events:[]};
   commands.set(key,{fingerprint,result:copy(failed)});return failed;
  }finally{movement?.close();combat?.close();}
  const events=[];
  if(result?.ok){
   revision++;
   const event=(type,payload={},extra={})=>events.push({schemaVersion:VERSION,battleId,
    revision,eventId:battleId+':'+(++serial),commandId:key,parentEventId:events[0]?.eventId||null,
    sourceInstanceId:played?.uid||null,targetInstanceIds:[],batchId:key,
    visibility:'viewer',viewer,blocking:true,type,payload,...extra});
   event('commandAccepted',{commandType:request.type});
   if(request.type==='attack'){
    const target=request.args[2];
    event('attackDeclared',{owner,attackerUid:request.args[1],hero:!!request.args[3],target},
     {sourceInstanceId:request.args[3]?'hero:'+owner:request.args[1],targetInstanceIds:target?[target.kind==='hero'?'hero:'+target.owner:target.uid]:[],visibility:'public'});
   }
   if(request.type==='endTurn')event('turnEnding',{owner,hour:before.hour},{visibility:'public'});
   if(request.type==='useHeroPower')event('heroPowerDeclared',{owner,target:request.args[1]||null},{sourceInstanceId:'hero:'+owner,visibility:'public'});
   if(played)event('cardPlayDeclared',{owner,...played,target:request.args[2]||null},{visibility:'public'});
   const after=view();
   // Explicitly scoped to the card's direct, single resulting creature. Other effects
   // reconcile at stateCommitted until their engine events are instrumented.
   if(played){
    const prior=new Set(before.players[owner].board.map(m=>m.uid));
    const added=after.players[owner].board.filter(m=>!prior.has(m.uid)&&m.cardId===played.cardId);
    if(added.length===1)event('creatureSummoned',{owner,instance:added[0],
      index:after.players[owner].board.findIndex(m=>m.uid===added[0].uid)},
      {targetInstanceIds:[added[0].uid],visibility:'public'});
   }
   for(const captured of combat?.items||[]){
    const step=copy(captured);if(step.type==='cardDiscarded'&&step.owner!==viewer)delete step.cardId;
    event("combatStep",step,{visibility:"public",sourceInstanceId:step.source?.uid||null});
   }
   for(const move of movement?.items||[]){
    const own=move.owner===viewer;
    const payload={owner:move.owner,source:move.source,index:move.index,
     handCount:move.handCount,deckCount:move.deckCount};
    if(own){payload.uid=move.uid;payload.cardId=move.cardId;payload.card=copy(game.cards[move.cardId]||null);
     const received=game.players[move.owner].hand.find(h=>h.uid===move.uid);
     if(received&&engine.currentCost)payload.cost=engine.currentCost(game,move.owner,received);}
    event(move.source==='deck'?'cardDrawn':'cardCreated',payload,
     {sourceInstanceId:own?move.uid:null,visibility:own?'viewer':'hidden'});
   }
   event('stateCommitted',{before,after});
   event('commandResolved',{});
  }
  const envelope={...result,battleId,revision,events};
  commands.set(key,{fingerprint,result:copy(envelope)});
  return copy(envelope);
 }
 return {execute,get revision(){return revision;},get battleId(){return battleId;},view};
}
function createProjection({battleId,view,revision=0}){
 let current=copy(view),version=revision;const seen=new Set();
 return {get view(){return copy(current);},get revision(){return version;},apply(e){
  if(e.battleId!==battleId||e.revision<version||seen.has(e.eventId))return false;
  if(e.type==='stateCommitted'){
   if(e.revision!==version+1)throw new Error('Presentation revision gap');
   current=copy(e.payload.after);version=e.revision;
  }
  seen.add(e.eventId);return true;
 }};
}
function createQueue({handle=()=>{},apply=()=>{},onError=()=>{},timeoutMs=2500,limit=20000}={}){
 let tail=Promise.resolve(),generation=0,pending=0,active=null;
 const seen=new Map();
 const error=(err,event)=>{try{onError(err,event);}catch(_){/* diagnostics cannot lock input */}};
 async function run(event,epoch){
  if(epoch!==generation)return;
  const controller=new AbortController();active=controller;
  let timer;
  try{
   await Promise.race([
    Promise.resolve().then(()=>handle(copy(event),controller.signal)),
    new Promise((resolve,reject)=>{
     controller.signal.addEventListener('abort',()=>resolve(),{once:true});
     timer=setTimeout(()=>{reject(new Error('Presentation event timeout'));controller.abort();},timeoutMs);
    })
   ]);
  }catch(err){error(err,event);}
  finally{
   clearTimeout(timer);
   if(epoch===generation)try{apply(copy(event));}catch(err){error(err,event);}
   if(active===controller)active=null;
  }
 }
 return {enqueue(events){
  // Validate the whole batch before scheduling any event.
  const fresh=[],batch=new Map();
  for(const event of events){
   if(event.schemaVersion!==VERSION||!event.battleId||!event.eventId||!Number.isInteger(event.revision))
    throw new Error('Invalid presentation event');
   const key=event.battleId+'|'+event.eventId,fingerprint=JSON.stringify(event);
   const previous=batch.get(key)||seen.get(key);
   if(previous&&previous!==fingerprint)throw new Error('eventId payload conflict');
   if(!previous){batch.set(key,fingerprint);fresh.push(copy(event));}
  }
  if(seen.size+batch.size>limit)throw new Error('Presentation event capacity reached');
  for(const [key,value]of batch)seen.set(key,value);
  const epoch=generation;pending+=fresh.length;
  for(const event of fresh)tail=tail.then(()=>run(event,epoch)).finally(()=>{if(epoch===generation)pending--;});
  return tail;
 },get busy(){return pending>0;},idle(){return tail;},reset(){
  generation++;active?.abort();active=null;pending=0;seen.clear();tail=Promise.resolve();
 }};
}
function captureInput(game,{pendingChoice,choiceDraft}={}){
 if(!pendingChoice||game.phase!=='battle'||game.turn!==0||
    !game.players[0].hand.some(h=>h.uid===pendingChoice.uid&&h.cardId===pendingChoice.cardId))return null;
 return {version:1,requestId:pendingChoice.requestId||'choice:'+pendingChoice.uid,uid:pendingChoice.uid,
  cardId:pendingChoice.cardId,position:pendingChoice.position??null,draft:copy(choiceDraft||{})};
}
function restoreInput(game,input,engine){
 if(!input||input.version!==1||typeof input.uid!=='string'||typeof input.requestId!=='string'||
    game.phase!=='battle'||game.turn!==0||!game.players[0].hand.some(h=>h.uid===input.uid&&h.cardId===input.cardId))return null;
 // Validation runs on a disposable copy: a bad sidecar cannot consume real RNG.
 const checked=engine.actionStatus(copy(game),0,input.uid),spec=checked.choice;
 if(!checked.ok||!spec||spec.blocked)return null;
 const choiceDraft={};
 for(const step of spec.steps){
  const offered=new Set(step.options.map(x=>x.id)),raw=input.draft?.[step.key];
  choiceDraft[step.key]=step.locked?step.options.map(x=>x.id):
   Array.isArray(raw)?[...new Set(raw.filter(x=>typeof x==='string'&&offered.has(x)))].slice(0,step.max):[];
 }
 return {pendingChoice:{uid:input.uid,cardId:input.cardId,requestId:input.requestId,position:Number.isInteger(input.position)&&input.position>=0&&input.position<=game.players[0].board.length?input.position:null},choiceDraft};
}
return {VERSION,publicView,createSession,createProjection,createQueue,captureInput,restoreInput};
});
