'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
global.window=global;require('../card-catalog.js');
const E=require('../battle-engine.js'),R=require('../battle-replay.js'),P=require('../battle-presentation.js'),M=require('../battle-combat-motion.js');
const C=new Map(MW_CANONICAL_CARDS.map(c=>[c.cardId,c])),d=MW_APPROVED_EXAMPLE_DECKS[0];
function game(){const s=E.makeGame(d,d,C,{seed:106,firstPlayer:0,hour:12,heroProfiles:['demo-unlocked','demo-unlocked']});E.confirmMulligan(s,[]);return s;}
function play(s,o,id,target=null){s.cards[id]=C.get(id);s.turn=o;s.players[o].mana=10;const uid='fixture'+(++s.serial);s.players[o].hand.push({uid,cardId:id});const result=E.playCard(s,o,uid,target);assert.equal(result.ok,true,result.reason);return s.players[o].board.at(-1);}
function pair(){const s=game();s.players.forEach(p=>p.board=[]);const a=play(s,0,'KNZ-002'),b=play(s,1,'KNZ-002');s.turn=0;a.ready=true;return {s,a,b};}
function attack(s,a,target){const capture=E.captureCombat(s);const result=E.attack(s,0,a.uid,target);capture.close();assert.equal(result.ok,true,result.reason);return capture.items;}
test('combat damage is one simultaneous batch before removal, followed by consumed attack',()=>{
 const {s,a,b}=pair();a.attack=5;b.attack=3;a.health=2;b.health=2;
 const events=attack(s,a,{kind:'minion',owner:1,uid:b.uid}),impact=events.find(x=>x.type==='impactBatch');
 assert.equal(impact.kind,'combat');assert.equal(impact.changes.length,2);
 assert.deepEqual(impact.changes.map(x=>x.actual),[2,2]);assert.deepEqual(impact.changes.map(x=>x.packet),[5,3]);
 assert.equal(impact.snapshot.players[0].board[0].health,-1);assert.equal(impact.snapshot.players[1].board[0].health,-3);
 const deaths=events.find(x=>x.type==='creaturesDied');assert.equal(deaths.instances.length,2);
 assert.equal(deaths.snapshot.players.flatMap(p=>p.board).length,0);
 assert.ok(events.indexOf(deaths)>events.indexOf(impact));assert.equal(events.at(-1).type,'attackConsumed');
});
test('hero actual damage separates armor and HP and excludes overkill',()=>{
 const {s,a}=pair();a.attack=12;s.players[1].health=3;s.players[1].armor=2;
 const hit=attack(s,a,{kind:'hero',owner:1}).find(x=>x.type==='impactBatch').changes[0];
 assert.deepEqual([hit.packet,hit.actual,hit.armorLoss,hit.healthLoss],[12,5,2,3]);assert.equal(s.winner,0);
 assert.equal(M.damageLabel(hit),'−5 урон');assert.equal(M.damageDetail(hit),'Броня −2 · HP −3');
});
test('shield absorbs damage, consumes the attack and removes only the shield',()=>{
 const {s,a,b}=pair();b.divineShield=true;const hp=b.health;
 const e=attack(s,a,{kind:'minion',owner:1,uid:b.uid}),hit=e.find(x=>x.type==='impactBatch').changes[0];
 assert.equal(hit.actual,0);assert.equal(hit.blocked,'Божественный щит');assert.equal(b.health,hp);assert.equal(b.divineShield,false);assert.equal(a.attacked,true);
 assert.equal(M.damageLabel(hit),'Божественный щит');
});
test('invulnerability precedes shield and armor; zero attack cannot declare',()=>{
 const {s,a,b}=pair();b.invulnerable=true;b.divineShield=true;b.armor=2;
 const hit=attack(s,a,{kind:'minion',owner:1,uid:b.uid}).find(x=>x.type==='impactBatch').changes[0];
 assert.equal(hit.blocked,'Неуязвимость');assert.equal(b.armor,2);assert.equal(b.divineShield,true);
 a.attacked=false;a.attack=0;const before=JSON.stringify(R.snapshot(s));assert.equal(E.attack(s,0,a.uid,{kind:'hero',owner:1}).ok,false);assert.equal(JSON.stringify(R.snapshot(s)),before);
});
test('minion armor is consumed before HP, after incoming time multiplier',()=>{
 const {s,a,b}=pair();s.timeMode='floor';s.time=0;a.attack=3;a.affinity='Ноч';b.affinity='Дзень';b.armor=2;b.health=6;
 const hit=attack(s,a,{kind:'minion',owner:1,uid:b.uid}).find(x=>x.type==='impactBatch').changes[0];
 assert.deepEqual([hit.packet,hit.actual,hit.armorLoss,hit.healthLoss],[6,6,2,4]);assert.equal(b.health,2);
});
test('disappeared or newly taunt-protected target rejects without a replacement or resource use',()=>{
 const {s,a,b}=pair();s.players[1].board=[];const before=JSON.stringify(R.snapshot(s));
 assert.equal(E.attack(s,0,a.uid,{kind:'minion',owner:1,uid:b.uid}).ok,false);assert.equal(JSON.stringify(R.snapshot(s)),before);
 const taunt=play(s,1,'KNZ-039');s.turn=0;const state=JSON.stringify(R.snapshot(s));
 assert.equal(E.attack(s,0,a.uid,{kind:'hero',owner:1}).ok,false);assert.equal(JSON.stringify(R.snapshot(s)),state);assert.ok(taunt.taunt);
});
test('area damage is one batch; deaths and deathrattles are active-side first in board order',()=>{
 const s=game();s.players.forEach(p=>p.board=[]);
 const a=play(s,0,'CHR-002'),b=play(s,1,'CHR-002');a.health=b.health=1;s.turn=1;
 const cap=E.captureCombat(s);play(s,1,'NEU-043');cap.close();
 const batch=cap.items.find(x=>x.type==='impactBatch'&&x.kind==='area');assert.equal(batch.changes.length,3);
 const deaths=cap.items.find(x=>x.type==='creaturesDied');assert.deepEqual(deaths.instances.filter(x=>x.instance.cardId==='CHR-002').map(x=>x.owner),[1,0]);
 assert.deepEqual(cap.items.filter(x=>x.type==='deathrattleTriggered').map(x=>x.owner),[1,0]);
 assert.ok(cap.items.indexOf(deaths)>cap.items.indexOf(batch));
});
test('death chain preserves source UID/card even after the source left the board',()=>{
 const s=game();s.players.forEach(p=>p.board=[]);const death=play(s,1,'CHR-002');death.health=1;
 const a=play(s,0,'KNZ-002');a.ready=true;
 const events=attack(s,a,{kind:'minion',owner:1,uid:death.uid});
 const post=events.find(x=>x.type==='damage'&&x.target.kind==='hero');assert.equal(post.source.uid,death.uid);assert.equal(post.source.cardId,'CHR-002');
 assert.equal(post.snapshot.players[1].board.some(m=>m.uid===death.uid),false);
});
test('both lethal hero deathrattles finish before the final result',()=>{
 const s=game();s.players.forEach(p=>p.board=[]);play(s,0,'CHR-002');play(s,1,'CHR-002');s.players.forEach(p=>p.health=1);
 play(s,0,'NEU-043');assert.equal(s.players[0].health,0);assert.equal(s.players[1].health,0);assert.equal(s.winner,'draw');
});
test('max-HP gain is an attribute event; full-HP heal emits no fake healing',()=>{
 const s=game(),m=play(s,0,'KNZ-002');s.players[0].health=30;
 let cap=E.captureCombat(s);play(s,0,'KNZ-004',{kind:'minion',owner:0,uid:m.uid});cap.close();
 assert.ok(cap.items.some(x=>x.type==='attributesChanged'&&x.maxHealth===2));assert.equal(cap.items.some(x=>x.type==='healing'),false);
 cap=E.captureCombat(s);play(s,0,'ZAV-001');cap.close();assert.equal(cap.items.some(x=>x.type==='healing'),false);
});
test('actual healing is recorded before subsequent buffs and is capped at max HP',()=>{
 const s=game();s.players[0].health=29;const cap=E.captureCombat(s);play(s,0,'ZAV-001');cap.close();
 assert.equal(cap.items.find(x=>x.type==='healing').actual,1);
});
test('weapon breaks locally, replacement does not reset attack, invalid attack spends no durability',()=>{
 const s=game();play(s,0,'KNZ-006');s.players[0].weapon.durability=1;
 let cap=E.captureCombat(s);assert.equal(E.attack(s,0,null,{kind:'hero',owner:1},true).ok,true);cap.close();
 assert.equal(s.players[0].weapon,null);assert.ok(cap.items.some(x=>x.type==='weaponChanged'&&!x.after));
 cap=E.captureCombat(s);play(s,0,'KNZ-006');cap.close();assert.equal(s.players[0].heroAttacked,true);
 const before=JSON.stringify(R.snapshot(s));assert.equal(E.attack(s,0,null,{kind:'hero',owner:1},true).ok,false);assert.equal(JSON.stringify(R.snapshot(s)),before);
});
test('targeted hero power cannot pay on invalid target, used state survives a light change',()=>{
 const s=game();play(s,0,'KNZ-002');s.time=0;s.turn=0;s.players[0].mana=10;
 const before=JSON.stringify(R.snapshot(s));assert.equal(E.useHeroPower(s,0,{kind:'hero',owner:0}).ok,false);assert.equal(JSON.stringify(R.snapshot(s)),before);
 const cap=E.captureCombat(s);assert.equal(E.useHeroPower(s,0,{kind:'minion',owner:0,uid:s.players[0].board[0].uid}).ok,true);cap.close();
 assert.ok(cap.items.some(x=>x.type==='heroPowerUsed'));s.time=12;assert.equal(E.heroPowerStatus(s,0).used,true);assert.equal(E.useHeroPower(s,0).ok,false);
});
test('combat observer is side-effect-free and never publishes private zones',()=>{
 const {s,a,b}=pair();R.capture(s);const copy=E.importBattle(E.exportBattle(s));const cap=E.captureCombat(s);
 E.attack(s,0,a.uid,{kind:'minion',owner:1,uid:b.uid});cap.close();E.attack(copy,0,a.uid,{kind:'minion',owner:1,uid:b.uid});
 assert.deepEqual(R.snapshot(s),R.snapshot(copy));const json=JSON.stringify(cap.items);
 for(const key of ['deck','hand','randomState','battleReplay','discoveryOffers'])assert.equal(json.includes('"'+key+'"'),false);
 assert.equal(R.verify(R.exportReplay(s)).ok,true);
});
test('presentation command and combat steps deduplicate without double attack',()=>{
 const {s,a,b}=pair(),session=P.createSession(E,s,{battleId:'combat'});
 const cmd={commandId:'hit',type:'attack',args:[0,a.uid,{kind:'minion',owner:1,uid:b.uid}],expectedRevision:0};
 const first=session.execute(cmd),state=JSON.stringify(s);assert.ok(first.events.some(e=>e.type==='combatStep'));
 assert.deepEqual(session.execute(cmd),first);assert.equal(JSON.stringify(s),state);
 assert.ok(first.events.findIndex(e=>e.type==='attackDeclared')<first.events.findIndex(e=>e.type==='combatStep'));
});
test('screen-space lunge vector stays finite across scale and never moves whole HUD',()=>{
 for(const scale of [.5,1,1.5]){const v=M.vector({left:0,top:0,width:100*scale,height:150*scale},{left:300*scale,top:0,width:100*scale,height:150*scale});assert.ok(v.x>0&&v.x<300*scale);assert.equal(v.y,0);}
 assert.deepEqual(M.vector({left:0,top:0,width:100,height:150},{left:0,top:0,width:100,height:150}),{x:0,y:0});
});
test('controlled QA scenario uses documented armor, canonical cards and verifies deterministically',()=>{
 const QA=require('../battle-combat-qa.js');const a=QA.build(E,R,MW_CANONICAL_CARDS,MW_APPROVED_EXAMPLE_DECKS),b=QA.build(E,R,MW_CANONICAL_CARDS,MW_APPROVED_EXAMPLE_DECKS);
 assert.deepEqual(R.snapshot(a),R.snapshot(b));assert.equal(a.debugged,true);assert.equal(a.players[1].armor,10);
 assert.equal(a.players[0].weapon.durability,2);assert.equal(a.players[0].board[0].ready,true);assert.equal(R.verify(R.exportReplay(a)).ok,true);
});
test('shared attack status rejects frozen sources and follows current taunt without mutation',()=>{
 const {s,a,b}=pair();a.timed.push({kind:'frozen',remaining:1,untilOwner:0});const before=JSON.stringify(R.snapshot(s));
 assert.equal(E.attackStatus(s,0,a.uid,{kind:'minion',owner:1,uid:b.uid}).ok,false);assert.equal(JSON.stringify(R.snapshot(s)),before);
 a.timed=[];assert.equal(E.attackStatus(s,0,a.uid,{kind:'minion',owner:1,uid:b.uid}).ok,true);
});
