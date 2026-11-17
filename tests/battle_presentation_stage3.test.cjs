'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
global.window=global;require('../card-catalog.js');
const E=require('../battle-engine.js'),R=require('../battle-replay.js'),P=require('../battle-presentation.js');
const catalog=new Map(MW_CANONICAL_CARDS.map(c=>[c.cardId,c])),decks=MW_APPROVED_EXAMPLE_DECKS;
const clone=x=>JSON.parse(JSON.stringify(x));
function game(seed=7){const s=E.makeGame(decks[0],decks[0],catalog,{seed,firstPlayer:0,hour:12});E.confirmMulligan(s,[]);return s;}
test('attack and endTurn declare causes before commit; repeated endTurn advances one hour',()=>{
 const s=game();s.players[0].hand=[{uid:'u-creature',cardId:'KNZ-002'}];s.players[0].mana=10;
 E.playCard(s,0,'u-creature');s.players[0].board[0].ready=true;
 const session=P.createSession(E,s,{battleId:'actions'}),m=s.players[0].board[0];
 const attack=session.execute({commandId:'attack',type:'attack',args:[0,m.uid,{kind:'hero',owner:1}],expectedRevision:0});
 assert.equal(attack.ok,true);assert.equal(attack.events[1].type,'attackDeclared');
 assert.equal(attack.events[1].sourceInstanceId,m.uid);assert.deepEqual(attack.events[1].targetInstanceIds,['hero:1']);
 const cmd={commandId:'end',type:'endTurn',args:[0],expectedRevision:1},hour=s.time;
 const end=session.execute(cmd);session.execute(cmd);assert.equal(s.time,(hour+1)%24);assert.equal(s.turn,1);
 assert.equal(end.events[1].type,'turnEnding');
});
test('queued bot decisions are identical to original policy and aggregate replay verifies',async()=>{
 for(let seed=1;seed<=6;seed++)for(let i=0;i<3;i++){
  const s=E.makeGame(decks[i],decks[(i+1)%3],catalog,{seed,firstPlayer:1,hour:12});
  E.confirmMulligan(s,[]);R.capture(s);
  const original=E.importBattle(E.exportBattle(s));
  const expected=R.botEngine.runBotTurn(original,1);
  const session=P.createSession(R.botEngine,s,{battleId:'bot-'+seed+'-'+i});let id=0,actions=0;
  const queue=P.createQueue();
  const frames=R.recordedBotFrames(s,1,(type,args)=>{
   const result=session.execute({commandId:'a'+(++id),type,args,expectedRevision:session.revision});
   if(result.ok){actions++;queue.enqueue(result.events);}return result;
  });
  let step=frames.next();while(!step.done){await queue.idle();step=frames.next();}await queue.idle();
  assert.equal(step.value.ok,expected.ok);assert.ok(actions>=1);
  assert.deepEqual(R.snapshot(s),R.snapshot(original));
  assert.equal(R.verify(R.exportReplay(s)).ok,true,'replay seed '+seed+' class '+i);
 }
});
test('choice draft round-trips without payment, hidden reroll, or trusting stale options',()=>{
 const s=game();s.players[0].hand=[{uid:'discover',cardId:'NEU-001'}];s.players[0].mana=10;
 s.cards['NEU-001']=clone(catalog.get('NEU-001'));
 const status=E.actionStatus(s,0,'discover');assert.ok(status.choice);
 const first=status.choice.steps[0].options[0].id;
 const sidecar=P.captureInput(s,{pendingChoice:{uid:'discover',cardId:'NEU-001'},choiceDraft:{zav:[first,'forged']}});
 const before=JSON.stringify(s),restored=P.restoreInput(s,sidecar,E);
 assert.equal(JSON.stringify(s),before);assert.deepEqual(restored.choiceDraft.zav,[first]);assert.equal(s.players[0].mana,10);
 const loaded=E.importBattle(E.exportBattle(s)),session=P.createSession(E,loaded,{battleId:'restored'});
 const command={commandId:'confirm',type:'playCard',args:[0,'discover',null,restored.choiceDraft],expectedRevision:0};
 const result=session.execute(command);assert.equal(result.ok,true);const mana=loaded.players[0].mana;
 session.execute(command);assert.equal(loaded.players[0].mana,mana);assert.equal(loaded.players[0].hand.some(h=>h.uid==='discover'),false);
 assert.equal(P.restoreInput(loaded,sidecar,E),null);
 assert.equal(P.restoreInput(s,{...sidecar,uid:'stale'},E),null);
 assert.equal(P.restoreInput(s,{...sidecar,version:99},E),null);
});
test('incomplete mandatory choices refuse payment and can be cancelled/reopened',()=>{
 const s=game();s.players[0].hand=[{uid:'discover',cardId:'NEU-001'}];s.players[0].mana=10;
 s.cards['NEU-001']=clone(catalog.get('NEU-001'));
 E.actionStatus(s,0,'discover');const session=P.createSession(E,s,{battleId:'choice'});
 const before=JSON.stringify(s),result=session.execute({commandId:'incomplete',type:'playCard',args:[0,'discover',null,{zav:[]}],expectedRevision:0});
 assert.equal(result.ok,false);assert.equal(JSON.stringify(s),before);
 assert.equal(P.captureInput(s,{}),null);
 assert.ok(P.restoreInput(s,P.captureInput(s,{pendingChoice:{uid:'discover',cardId:'NEU-001'},choiceDraft:{}}),E));
});
test('checkpoint inside a bot turn resumes from gameplay state without replaying prior payments',()=>{
 const s=game();E.endTurn(s,0);
 const frames=E.botTurnFrames(s,1);frames.next();
 const save=E.exportBattle(s);delete save.game.battleReplay;
 const restored=E.importBattle(save);R.ensureCapture(restored);
 assert.deepEqual(R.snapshot(restored),R.snapshot(s));
 assert.equal(R.verify(R.exportReplay(restored)).ok,true);
});
