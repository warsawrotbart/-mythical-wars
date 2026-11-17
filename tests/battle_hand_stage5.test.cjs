'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
global.window=global;require('../card-catalog.js');
const E=require('../battle-engine.js'),R=require('../battle-replay.js'),P=require('../battle-presentation.js'),M=require('../battle-hand-motion.js');
const catalog=new Map(MW_CANONICAL_CARDS.map(c=>[c.cardId,c])),d=MW_APPROVED_EXAMPLE_DECKS[0];
function game(first=0){const s=E.makeGame(d,d,catalog,{seed:758,firstPlayer:first,hour:5});E.confirmMulligan(s,[]);return s;}
function give(s,id='KNZ-002'){const h={uid:'test-'+(++s.serial),cardId:id};s.players[0].hand.push(h);s.players[0].mana=10;return h;}
test('insertion uses live centers and creates only n+1 temporary gaps below seven',()=>{
 const b={left:0,top:0,width:900,height:180};
 for(let n=0;n<=7;n++){
  const rs=Array.from({length:n},(_,i)=>({left:100+i*132,right:220+i*132,width:120}));
  assert.equal(M.slots(rs,b).length,n===7?0:n+1);
  for(let i=0;i<=n;i++)assert.equal(M.insertionIndex(rs,i===n?10000:rs[i].left-1),i);
 }
 assert.equal(M.slots([],b)[0].x,450);
});
test('grab point preserves fractional offset at several arena scales, clamped at edges',()=>{
 for(const scale of [.5,.711,1,1.5]){
  const r={left:100,top:200,width:120*scale,height:180*scale};
  const offset=M.grabOffset(r,{x:r.left+r.width*.2,y:r.top+r.height*.8},190,285);assert.ok(Math.abs(offset.x-38)<1e-9&&Math.abs(offset.y-228)<1e-9);
  assert.deepEqual(M.grabOffset(r,{x:-999,y:99999},190,285),{x:0,y:285});
 }
});
test('inserts before/between/after physical instances, charges once; replay accepts optional position',()=>{
 for(const pos of [0,1,2]){
  const s=game();for(let i=0;i<2;i++){const h=give(s);assert.equal(E.playCard(s,0,h.uid).ok,true);}
  const prior=s.players[0].board.map(m=>m.uid),h=give(s);R.capture(s);
  const session=P.createSession(E,s,{battleId:'position-'+pos});
  const cmd={commandId:'p',type:'playCard',args:[0,h.uid,null,null,pos],expectedRevision:0};
  assert.equal(session.execute(cmd).ok,true);const result=JSON.stringify(R.snapshot(s));
  session.execute(cmd);assert.equal(JSON.stringify(R.snapshot(s)),result);assert.equal(s.players[0].mana,9);
  const ids=s.players[0].board.map(m=>m.uid);assert.equal(ids[pos],s.players[0].board[pos].uid);
  assert.deepEqual(ids.filter(x=>prior.includes(x)),prior);assert.ok(!prior.includes(ids[pos]));
  assert.equal(R.verify(R.exportReplay(s)).ok,true);
 }
});
test('invalid/capacity placement never pays, consumes a UID or changes RNG/state',()=>{
 const s=game(),h=give(s);for(const pos of [-1,1,1.5,'0']){
  const state=JSON.stringify(s);assert.equal(E.playCard(s,0,h.uid,null,null,pos).ok,false);assert.equal(JSON.stringify(s),state);
 }
 for(let i=0;i<7;i++){const c=give(s);assert.equal(E.playCard(s,0,c.uid,null,null,i).ok,true);}
 const c=give(s),before=JSON.stringify(s);assert.equal(E.playCard(s,0,c.uid,null,null,7).ok,false);assert.equal(JSON.stringify(s),before);
});
test('capture gives exact sequential draw instances/counts without writing saved state',()=>{
 const s=game(),baseline=E.importBattle(E.exportBattle(s));s.players[0].hand=[];baseline.players[0].hand=[];
 const capture=E.captureCardMovements(s),deck=s.players[0].deck.slice();
 for(let i=0;i<3;i++){E.draw(s,0);E.draw(baseline,0);}capture.close();
 assert.deepEqual(R.snapshot(s),R.snapshot(baseline));assert.equal(capture.items.length,3);
 assert.deepEqual(capture.items.map(m=>m.cardId),deck.slice(0,3));
 assert.deepEqual(capture.items.map(m=>m.handCount),[1,2,3]);assert.deepEqual(capture.items.map(m=>m.index),[0,1,2]);
 assert.equal(new Set(capture.items.map(m=>m.uid)).size,3);E.draw(s,0);assert.equal(capture.items.length,3);
});
test('opponent draw stream hides physical IDs and faces, own draws expose only the moved card',()=>{
 const s=game(),session=P.createSession(E,s,{battleId:'hidden'});
 const result=session.execute({commandId:'end',type:'endTurn',args:[0],expectedRevision:0});
 const draw=result.events.find(e=>e.type==='cardDrawn');assert.ok(draw);assert.equal(draw.visibility,'hidden');
 for(const key of ['uid','cardId','card'])assert.equal(draw.payload[key],undefined);assert.equal(draw.sourceInstanceId,null);
 assert.equal(draw.payload.source,'deck');assert.equal(draw.payload.handCount,s.players[1].hand.length);
});
test('opening 3 versus 4 plus protected coin; confirm duplicate cannot draw twice',()=>{
 for(const first of [0,1]){
  const s=E.makeGame(d,d,catalog,{seed:31,firstPlayer:first,hour:5});
  assert.equal(s.players[0].hand.length,first===0?3:5);
  const coin=s.players[0].hand.find(h=>h.cardId==='__coin__'),replace=s.players[0].hand[0];
  const session=P.createSession(E,s,{battleId:'opening-'+first});
  const cmd={commandId:'confirm',type:'confirmMulligan',args:[[replace.uid,...(coin?[coin.uid]:[])]],expectedRevision:0};
  assert.equal(session.execute(cmd).ok,true);const after=JSON.stringify(s);session.execute(cmd);assert.equal(JSON.stringify(s),after);
  assert.equal(s.players[0].hand.some(h=>h.uid===replace.uid),false);
  if(coin)assert.equal(s.players[0].hand.find(h=>h.uid===coin.uid).cardId,'__coin__');
 }
});
test('hand overflow emits no arrival and fatigue emits no invented card',()=>{
 const s=game();while(s.players[0].hand.length<10)give(s);
 const cap=E.captureCardMovements(s);assert.equal(E.draw(s,0),false);assert.equal(cap.items.length,0);
 s.players[0].deck=[];assert.equal(E.draw(s,0),false);assert.equal(cap.items.length,0);cap.close();
});
test('preview avoids hero portraits while remaining inside the viewport',()=>{
 const H=require('../battle-hand-v05S14.js');
 const b={left:300,top:100,width:355,height:532},heroes=[{left:600,right:750,top:480,bottom:650}];
 const safe=H.avoidHeroes(b,heroes,1363);assert.ok(safe.left+safe.width<600);assert.ok(safe.left>=6);
 for(const left of [6,900]){const safe=H.avoidHeroes({...b,left},heroes,1363);assert.ok(safe.left>=6&&safe.left+safe.width<=1357);}
});
test('effect-created cards have a distinct source and never pretend to leave the deck',()=>{
 const s=game();s.cards['ZAV-002']=catalog.get('ZAV-002');
 const h=give(s,'ZAV-002'),deck=s.players[0].deck.length;
 const session=P.createSession(E,s,{battleId:'copy'});
 const result=session.execute({commandId:'create',type:'playCard',args:[0,h.uid],expectedRevision:0});assert.equal(result.ok,true);
 const created=result.events.find(e=>e.type==='cardCreated');assert.ok(created);assert.equal(created.payload.source,'created');
 assert.equal(created.payload.deckCount,deck);assert.equal(s.players[0].deck.length,deck);
 assert.ok(s.players[0].hand.some(h=>h.uid===created.payload.uid));
});
test('choice sidecar retains valid placement and rejects invalid restored indices',()=>{
 const s=game();s.cards['NEU-001']=catalog.get('NEU-001');const h=give(s,'NEU-001');
 const input=P.captureInput(s,{pendingChoice:{uid:h.uid,cardId:h.cardId,position:0},choiceDraft:{}});
 const restored=P.restoreInput(s,input,E);assert.ok(restored);assert.equal(restored.pendingChoice.position,0);
 input.position=9;assert.equal(P.restoreInput(s,input,E).pendingChoice.position,null);
});
test('accepted drag continues from the release point with the original grab offset',()=>{
 const r={left:100,top:200,width:120,height:180};
 const release=M.releaseRect(r,{x:130,y:245},{x:600,y:500});
 assert.equal(release.left,570);assert.equal(release.top,455);assert.equal(release.width,r.width);
});
