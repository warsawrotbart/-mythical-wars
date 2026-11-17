'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
global.window=global;require('../card-catalog.js');
const E=require('../battle-engine.js'),R=require('../battle-replay.js'),P=require('../battle-presentation.js');
function fixture(){
 const catalog=new Map(MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
 const d=MW_APPROVED_EXAMPLE_DECKS[0],game=E.makeGame(d,d,catalog,{seed:106,firstPlayer:0,hour:12});
 E.confirmMulligan(game,[]);
 game.players[0].hand=[{uid:'own-visible',cardId:'KNZ-002'}];game.players[0].mana=10;
 R.capture(game);
 const session=P.createSession(E,game,{battleId:'test-battle'});
 const command={commandId:'c1',type:'playCard',args:[0,'own-visible'],expectedRevision:0};
 return {game,session,command};
}
test('accepted command pays once and emits cause before summon; replay remains deterministic',()=>{
 const {game,session,command}=fixture(),before=game.players[0].mana;
 const first=session.execute(command),state=JSON.stringify(game),again=session.execute(command);
 assert.equal(first.ok,true);assert.equal(game.players[0].mana,before-1);
 assert.deepEqual(again,first);assert.equal(JSON.stringify(game),state);
 assert.deepEqual(first.events.map(e=>e.type),['commandAccepted','cardPlayDeclared','creatureSummoned','combatStep','stateCommitted','commandResolved']);
 assert.equal(first.events[1].sourceInstanceId,'own-visible');
 assert.equal(first.events[2].targetInstanceIds[0],game.players[0].board[0].uid);
 assert.equal(R.verify(R.exportReplay(game)).ok,true);
});
test('rejected and stale commands do not spend resources or emit successful scenes',()=>{
 const {game,session,command}=fixture();game.players[0].mana=0;
 const before=JSON.stringify(game),r=session.execute(command);
 assert.equal(r.ok,false);assert.deepEqual(r.events,[]);assert.equal(session.revision,0);
 assert.equal(JSON.stringify(game),before);
 assert.equal(session.execute({...command,commandId:'stale',expectedRevision:99}).ok,false);
 assert.equal(JSON.stringify(game),before);
});
test('command ID collision is rejected, history limit never evicts paid IDs',()=>{
 const {game,command}=fixture(),session=P.createSession(E,game,{battleId:'bounded',limit:1});
 const first=session.execute(command),state=JSON.stringify(game);
 assert.equal(session.execute({...command,args:[0,'different']}).ok,false);
 assert.equal(session.execute({...command,commandId:'new',expectedRevision:1}).ok,false);
 assert.deepEqual(session.execute(command),first);assert.equal(JSON.stringify(game),state);
});
test('public view and stream omit hidden hand IDs, deck order, choices, RNG and replay',()=>{
 const {game,session,command}=fixture();
 game.players[1].hand=[{uid:'HIDDEN-UID',cardId:'SECRET-CARD'}];
 game.players[1].deck=['SECRET-DECK'];game.discoveryOffers={hidden:'SECRET-CHOICE'};
 const text=JSON.stringify({view:session.view(),events:session.execute(command).events});
 for(const marker of ['HIDDEN-UID','SECRET-CARD','SECRET-DECK','SECRET-CHOICE','randomState','battleReplay'])assert.equal(text.includes(marker),false);
 assert.equal(session.view().players[1].hand,null);
});
test('projection waits for commit, preserves instance UID, ignores duplicates and refuses gaps',()=>{
 const {session,command}=fixture(),initial=session.view();
 const projection=P.createProjection({battleId:session.battleId,view:initial});
 const events=session.execute(command).events;
 for(const e of events.slice(0,3))projection.apply(e);
 assert.deepEqual(projection.view,initial);
 const commit=events.find(e=>e.type==='stateCommitted');projection.apply(commit);
 assert.equal(projection.view.players[0].board[0].uid,events[2].payload.instance.uid);
 assert.equal(projection.apply(commit),false);assert.equal(projection.revision,1);
 assert.equal(projection.apply({...commit,battleId:'other'}),false);
 assert.throws(()=>projection.apply({...commit,eventId:'gap',revision:3}),/gap/);
 const returned=projection.view;returned.players[0].health=999;
 assert.notEqual(projection.view.players[0].health,999);
});
test('queue serializes async handlers and deduplicates batches',async()=>{
 const {session,command}=fixture(),events=session.execute(command).events,order=[];
 const queue=P.createQueue({handle:async e=>{order.push('start:'+e.eventId);await Promise.resolve();order.push('end:'+e.eventId);},apply:e=>order.push('apply:'+e.eventId)});
 const done=queue.enqueue(events);queue.enqueue(events);assert.equal(queue.busy,true);await done;
 assert.equal(queue.busy,false);assert.equal(order.length,events.length*3);
 for(let i=0;i<events.length;i++)assert.deepEqual(order.slice(i*3,i*3+3),['start:','end:','apply:'].map(x=>x+events[i].eventId));
 assert.throws(()=>queue.enqueue([{...events[0],payload:{changed:true}}]),/conflict/);
});
test('timeout or throwing VFX still applies committed model and unlocks',async()=>{
 const {session,command}=fixture(),events=session.execute(command).events,errors=[];
 const projection=P.createProjection({battleId:session.battleId,view:events.find(e=>e.type==='stateCommitted').payload.before});
 const queue=P.createQueue({timeoutMs:10,handle:e=>e.type==='cardPlayDeclared'?new Promise(()=>{}):Promise.resolve(),apply:e=>projection.apply(e),onError:err=>errors.push(err.message)});
 await queue.enqueue(events);assert.equal(queue.busy,false);assert.equal(projection.revision,1);
 assert.equal(errors.length,1);assert.match(errors[0],/timeout/);
 const q=P.createQueue({handle(){throw Error('VFX unavailable');},onError(){throw Error('diagnostics unavailable');}});
 await q.enqueue(events);assert.equal(q.busy,false);
});
test('reset aborts current scene and prevents stale commits after switching battle',async()=>{
 const {session,command}=fixture(),events=session.execute(command).events,applied=[];
 let started;const ready=new Promise(resolve=>started=resolve);
 const queue=P.createQueue({handle:(e,signal)=>{started();return new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));},apply:e=>applied.push(e)});
 const old=queue.enqueue(events);await ready;queue.reset();await old;
 assert.equal(queue.busy,false);assert.deepEqual(applied,[]);
});
test('queue validates whole batch before scheduling and does not silently evict events',async()=>{
 const {session,command}=fixture(),events=session.execute(command).events,applied=[];
 const queue=P.createQueue({limit:events.length,apply:e=>applied.push(e)});
 assert.throws(()=>queue.enqueue([events[0],{bad:true}]),/Invalid/);
 await queue.idle();assert.deepEqual(applied,[]);
 await queue.enqueue(events);
 assert.throws(()=>queue.enqueue([{...events[0],eventId:'new'}]),/capacity/);
 await queue.enqueue(events);assert.equal(applied.length,events.length);
});

test('throwing engine command is never executed again under the same or a fresh ID',()=>{
 const {game,command}=fixture();let calls=0;
 const session=P.createSession({...E,playCard(){calls++;game.players[0].mana--;throw Error('engine failure');}},game,{battleId:'engine-failure'});
 const failed=session.execute(command);
 assert.equal(failed.ok,false);assert.deepEqual(session.execute(command),failed);
 assert.equal(session.execute({...command,commandId:'another'}).ok,false);assert.equal(calls,1);
});
test('animation and fast-forward yield identical logic and recover from an accepted save',async()=>{
 const {game,session,command}=fixture(),envelope=session.execute(command);
 const accepted=R.checksum(R.snapshot(game)),saved=E.exportBattle(game);
 let release,started;const ready=new Promise(resolve=>started=resolve);
 const queue=P.createQueue({handle:e=>e.type==='cardPlayDeclared'?new Promise(resolve=>{release=resolve;started();}):Promise.resolve()});
 const done=queue.enqueue(envelope.events);await ready;
 const restored=E.importBattle(saved);
 assert.equal(restored.players[0].hand.length,0);assert.equal(restored.players[0].board.length,1);
 assert.equal(restored.players[0].mana,9);
 release();await done;
 assert.equal(R.checksum(R.snapshot(game)),accepted);assert.equal(R.verify(R.exportReplay(game)).ok,true);
 const fast=P.createQueue();await fast.enqueue(envelope.events);
 assert.equal(R.checksum(R.snapshot(game)),accepted);
});
test('same card definitions remain addressed as separate played and board instances',()=>{
 const {game,session,command}=fixture();
 game.players[0].hand.push({uid:'second-copy',cardId:'KNZ-002'});
 const first=session.execute(command),second=session.execute({...command,commandId:'c2',args:[0,'second-copy'],expectedRevision:1});
 assert.notEqual(first.events[1].sourceInstanceId,second.events[1].sourceInstanceId);
 assert.notEqual(first.events[2].targetInstanceIds[0],second.events[2].targetInstanceIds[0]);
 assert.equal(game.players[0].board.length,2);assert.equal(game.players[0].mana,8);
});
