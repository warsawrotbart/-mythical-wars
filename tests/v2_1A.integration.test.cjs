/* Mythical Wars 2.1A — offline integration tests; node --test not needed. */
"use strict";
const assert=require("node:assert/strict");
global.window=global;
require("../card-catalog.js");
const D=require("../deck-model.js"),E=require("../battle-engine.js");
const R=require("../battle-replay.js"),A=require("../card-audit.js"),L=require("../battle-lab.js");
const cards=window.MW_CANONICAL_CARDS,catalog=new Map(cards.map(c=>[c.cardId,c]));
const decks=window.MW_APPROVED_EXAMPLE_DECKS;
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log("PASS "+name);}
  catch(e){failed++;console.error("FAIL "+name,e.stack||e);}}
function game(id,ownerClass="Воин"){
 const d={name:"Test",classId:ownerClass,counts:{"KNZ-002":3,[id]:1}};
 const s=E.makeGame(d,d,catalog,{seed:106,firstPlayer:0,hour:12,timeMode:"off"});
 E.confirmMulligan(s,[]);
 s.cards=Object.fromEntries(catalog);
 const p=s.players[0];p.board=[];p.deck=[];p.hand=[{uid:"h-test",cardId:id,costAdjustment:0}];
 p.mana=10;p.maxMana=10;
 s.players[1].board=[];
 // The test deliberately adjusts state; replay begins AFTER fixture setup.
 R.capture(s);
 return s;
}
test("canonical catalog has no structural errors; 162 cards indexed",()=>{
 const c=A.auditCatalog(cards);assert.equal(c.count,162);assert.equal(c.errors.length,0);
 assert.equal(c.stats.creature+c.stats.spell+c.stats.weapon,162);
});
test("all three source decks pass strict 30-card validation",()=>{
 const a=A.auditDecks(decks,catalog);assert.equal(a.count,3);assert.equal(a.invalid,0);
 for(const d of a.decks)assert.equal(d.total,30);
});
test("audit detects duplicate ID, bad health, missing key without modifying originals",()=>{
 const changed=JSON.parse(JSON.stringify(cards.slice(0,2)));
 changed[0].requiresCardId="MISSING-999";
 changed[1].cardId=changed[0].cardId;changed[1].health=-2;
 const copy=JSON.stringify(changed);
 const result=A.auditCatalog(changed);
 assert.ok(result.errors.some(i=>i.code==="duplicate-id"));
 assert.ok(result.errors.some(i=>i.code==="dangling-key"));
 assert.equal(JSON.stringify(changed),copy);
});
test("KNZ-007 draws random weapon and Druzhyna, never an unrelated card",()=>{
 const s=game("KNZ-007");
 s.players[0].deck=["KNZ-006","KNZ-002","CHR-002"];
 const r=E.playCard(s,0,"h-test");assert.equal(r.ok,true,r.reason);
 assert.deepEqual(new Set(s.players[0].hand.map(c=>c.cardId)),new Set(["KNZ-006","KNZ-002"]));
 assert.deepEqual(s.players[0].deck,["CHR-002"]);
});
test("CHR-031 infects a selected enemy; takes one damage at its next start",()=>{
 const s=game("CHR-031","Чернокнижник");
 E.setDeveloperMode(s,true);
 assert.equal(E.debugAction(s,{type:"summon",owner:1,cardId:"KNZ-002",definition:catalog.get("KNZ-002")}).ok,true);
 const m=s.players[1].board[0];
 assert.equal(E.playCard(s,0,"h-test",{kind:"minion",owner:1,uid:m.uid}).ok,true);
 assert.equal(m.infected,true);
 const old=m.health;
 E.endTurn(s,0);
 assert.equal(m.health,old-1);
 assert.ok(s.events.some(e=>e.kind==="effect"&&e.cardId==="CHR-031"));
});
test("CHR-031 requires target before charging mana or changing hand",()=>{
 const s=game("CHR-031","Чернокнижник");
 const before=s.players[0].mana;
 const r=E.playCard(s,0,"h-test");
 assert.equal(r.ok,false);
 assert.equal(s.players[0].mana,before);
 assert.equal(s.players[0].hand.length,1);
});
test("NEU-040 unique minimum gets +1/+1 at end of own turn",()=>{
 const s=game("NEU-040");
 E.setDeveloperMode(s,true);
 E.debugAction(s,{type:"summon",owner:0,cardId:"NEU-040",definition:catalog.get("NEU-040")});
 E.debugAction(s,{type:"summon",owner:0,cardId:"KNZ-002",definition:catalog.get("KNZ-002")});
 const m=s.players[0].board.find(x=>x.cardId==="KNZ-002"),before=m.attack;
 E.endTurn(s,0);
 assert.equal(m.attack,before+1);
});
test("NEU-040 ties do not invent selection ordering",()=>{
 const s=game("NEU-040");
 E.setDeveloperMode(s,true);
 E.debugAction(s,{type:"summon",owner:0,cardId:"NEU-040",definition:catalog.get("NEU-040")});
 E.debugAction(s,{type:"summon",owner:0,cardId:"KNZ-002",definition:catalog.get("KNZ-002")});
 E.debugAction(s,{type:"summon",owner:0,cardId:"KNZ-002",definition:catalog.get("KNZ-002")});
 const min=s.players[0].board.filter(m=>m.cardId==="KNZ-002").map(m=>m.attack);
 E.endTurn(s,0);
 assert.deepEqual(s.players[0].board.filter(m=>m.cardId==="KNZ-002").map(m=>m.attack),min);
 assert.ok(s.events.some(e=>e.kind==="rules-pending"));
});
test("replay of real bot-vs-bot actions recovers exactly identical state",()=>{
 const s=E.makeGame(decks[0],decks[2],catalog,{seed:914,firstPlayer:0,hour:14});
 assert.equal(E.confirmMulligan(s,[]).ok,true);
 for(let i=0;i<15&&s.phase==="battle";i++)assert.equal(E.runBotTurn(s,s.turn).ok,true);
 const file=R.exportReplay(s);
 const check=R.verify(R.loadReplay(JSON.stringify(file)));
 assert.equal(check.ok,true,check.reason);
 assert.equal(check.steps,s.battleReplay.actions.length);
 assert.equal(R.checksum(R.snapshot(check.game)),R.checksum(R.snapshot(s)));
});
test("replay detects one altered action",()=>{
 const s=E.makeGame(decks[0],decks[1],catalog,{seed:515,firstPlayer:0});
 E.confirmMulligan(s,[]);
 E.runBotTurn(s,s.turn);
 const file=R.exportReplay(s);file.trace.actions[0].after="deadbeef";
 const r=R.verify(file);
 assert.equal(r.ok,false);assert.equal(r.index,0);
});
test("replay can inspect intermediate game without changing live game",()=>{
 const s=E.makeGame(decks[1],decks[2],catalog,{seed:533,firstPlayer:0});
 E.confirmMulligan(s,[]);E.runBotTurn(s,s.turn);
 const raw=R.exportReplay(s);
 const start=R.verify(raw,0);const middle=R.verify(raw,1);
 assert.equal(start.ok,true);assert.equal(middle.ok,true);
 assert.equal(start.game.phase,"mulligan");
 assert.equal(middle.game.phase,"battle");
 assert.equal(s.phase,"battle");
});
test("v2.0-style imported battle can start an honest partial replay",()=>{
 const s=E.makeGame(decks[0],decks[1],catalog,{seed:525,firstPlayer:0});
 E.confirmMulligan(s,[]);
 const exportData=E.exportBattle(s);delete exportData.game.battleReplay;
 const loaded=E.importBattle(exportData);
 R.ensureCapture(loaded);
 assert.equal(loaded.battleReplay.startedMidGame,true);
 assert.equal(E.runBotTurn(loaded,loaded.turn).ok,true);
 assert.equal(R.verify(R.exportReplay(loaded)).ok,true);
});
test("both owners can be controlled legally by AI",()=>{
 const s=E.makeGame(decks[2],decks[0],catalog,{seed:707,firstPlayer:0});
 E.confirmMulligan(s,[]);
 let owners=new Set;
 for(let i=0;i<12&&s.phase==="battle";i++){
   const owner=s.turn;owners.add(owner);
   assert.equal(E.runBotTurn(s,owner).ok,true);
   assert.deepEqual(L.invariants(s),[]);
 }
 assert.equal(owners.size,2);
});
test("six deterministic full matches cover all class pairings",()=>{
 const a=L.runBatch(decks,catalog,{seed:20211108,gamesPerPair:2,maxHalfTurns:220,timeMode:"off"});
 assert.equal(a.games,6);assert.equal(a.errors,0);assert.equal(a.turnLimit,0);
 assert.equal(a.ended,6);
 assert.ok(a.results.every(x=>x.turns>0&&x.issues.length===0));
 const b=L.runBatch(decks,catalog,{seed:20211108,gamesPerPair:2,maxHalfTurns:220,timeMode:"off"});
 assert.deepEqual(b.results,a.results);
});
test("selfplay honors upper turn-limit without inventing a winner",()=>{
 const a=L.playFullMatch(decks[0],decks[1],catalog,{seed:1,maxHalfTurns:1});
 assert.equal(a.termination,"turn-limit");assert.equal(a.winner,null);
});
test("batch output is a regular UTF-8 CSV with six records",()=>{
 const a=L.runBatch(decks,catalog,{seed:42,gamesPerPair:2});
 const csv=L.toCSV(a);
 assert.equal(csv.trim().split("\r\n").length,7);assert.ok(csv.includes("deckA"));
});
console.log(`TOTAL 2.1A: ${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
