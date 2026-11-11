/* Mythical Wars v2.0 regression tests: no server and no test framework dependency. */
"use strict";
const assert=require("node:assert/strict");
global.window=global;
require("../card-catalog.js");
const E=require("../battle-engine.js"), D=require("../deck-model.js");
const catalog=new Map(window.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
const examples=window.MW_APPROVED_EXAMPLE_DECKS;
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log("PASS",name);}
 catch(e){failed++;console.error("FAIL",name,e.stack||e);}}
const loose=(id,classId="Воин")=>({name:"Интеграционный тест",classId,counts:{[id]:1,"KNZ-002":3}});
function sandbox(id,classId="Воин"){
 const s=E.makeGame(loose(id,classId),loose("KNZ-002"),catalog,{seed:101,firstPlayer:0,hour:12});
 E.confirmMulligan(s,[]);s.cards=Object.fromEntries(catalog);
 const me=s.players[0];me.deck=[];me.hand=[{uid:"test"+(++s.serial),cardId:id,costAdjustment:0}];
 me.mana=10;me.maxMana=10;me.board=[];s.players[1].board=[];
 return s;
}
function play(s,id){
 let h=s.players[0].hand.find(h=>h.cardId===id);
 if(!h){h={uid:"test"+(++s.serial),cardId:id,costAdjustment:0};s.players[0].hand.push(h);}
 return E.playCard(s,0,h.uid);
}
test("source decks are exactly 30 and individually valid",()=>{
 for(const d of examples){const v=D.validateDeck(d,catalog);assert.equal(v.ok,true,d.name+": "+v.errors);assert.equal(v.total,30);}
});
test("versioned JSON snapshot preserves full game, graves, events and random state",()=>{
 const s=E.makeGame(examples[0],examples[2],catalog,{seed:42,firstPlayer:0,hour:7});
 E.confirmMulligan(s,[]);
 const payload=E.exportBattle(s),text=JSON.stringify(payload);
 assert.ok(!text.includes('"rng"'));assert.equal(payload.version,2);
 const restored=E.importBattle(text);
 assert.deepEqual(E.exportBattle(restored).game, E.exportBattle(s).game);
 assert.equal(restored.phase,"battle");assert.ok(restored.events.length);
});
test("stateful RNG continues identically after restore",()=>{
 const s=E.makeGame(examples[0],examples[2],catalog,{seed:12345,firstPlayer:0,hour:3});
 E.confirmMulligan(s,[]);const restored=E.importBattle(E.exportBattle(s));
 for(let step=0;step<4;step++){
  assert.deepEqual(s.players.map(p=>p.deck),restored.players.map(p=>p.deck));
  E.endTurn(s,0);E.endTurn(restored,0);
  if(s.phase!=="battle"||restored.phase!=="battle")break;
  E.endTurn(s,1);E.endTurn(restored,1);
 }
 assert.deepEqual(s.players.map(p=>p.hand),restored.players.map(p=>p.hand));
 assert.equal(s.randomState,restored.randomState);
});
test("malformed or incompatible game saves are rejected",()=>{
 for(const input of ["junk",{},{"format":"mythical-wars-battle","version":8,game:{}},
  {"format":"mythical-wars-battle","version":2,game:{players:[{}]}}]){
  assert.throws(()=>E.importBattle(input));
 }
});
test("developer commands are disabled until explicitly enabled",()=>{
 const s=sandbox("KNZ-002");
 assert.equal(E.debugAction(s,{type:"mana",value:10}).ok,false);
 E.setDeveloperMode(s,true);
 assert.equal(E.debugAction(s,{type:"mana",value:10}).ok,true);
 assert.equal(E.debugAction(s,{type:"hour",value:24}).ok,false);
 assert.equal(E.debugAction(s,{type:"hour",value:21}).ok,true);
 assert.equal(s.time,21);assert.equal(s.debugged,true);
 assert.ok(E.eventJournal(s,{kind:"debug"}).length>=2);
 E.setDeveloperMode(s,false);
 assert.equal(E.debugAction(s,{type:"mana",value:5}).ok,false);
});
test("test summon and death respects personal graveyard, no free corpses",()=>{
 const s=sandbox("KNZ-002");E.setDeveloperMode(s,true);
 assert.equal(E.debugAction(s,{type:"summon",owner:0,cardId:"KNZ-002",definition:catalog.get("KNZ-002")}).ok,true);
 const m=s.players[0].board.at(-1),uid=m.uid;
 assert.equal(E.debugAction(s,{type:"kill",owner:0,uid}).ok,true);
 assert.equal(s.players[0].board.some(x=>x.uid===uid),false);
 assert.ok(s.players[0].graveyard.find(g=>g.uid===uid));
 assert.equal(s.players[0].corpses,0);
 assert.ok(E.eventJournal(s,{kind:"graveyard"}).length);
 assert.ok(E.eventJournal(s,{kind:"death",owner:"0"}).length);
});
test("resource changes in developer mode are recorded in corpse ledger",()=>{
 const s=sandbox("NCR-008","Некромант");
 E.setDeveloperMode(s,true);
 assert.equal(E.debugAction(s,{type:"corpses",owner:0,value:7}).ok,true);
 assert.equal(s.players[0].corpseLedger.at(-1).balance,7);
 assert.ok(E.eventJournal(s,{kind:"resource"}).length>=1);
});
test("KNZ-010 deathrattle draws one approved Human from shuffled deck",()=>{
 const s=sandbox("KNZ-010");s.players[0].deck=["KNZ-002","NCR-002"];
 E.setDeveloperMode(s,true);
 E.debugAction(s,{type:"summon",cardId:"KNZ-010",definition:catalog.get("KNZ-010")});
 const uid=s.players[0].board.at(-1).uid;
 E.debugAction(s,{type:"kill",uid});
 assert.ok(s.players[0].hand.some(h=>h.cardId==="KNZ-002"));
 assert.deepEqual(s.players[0].deck,["NCR-002"]);
});
test("NCR-008 battlecry draws random ritual only",()=>{
 const s=sandbox("NCR-008","Некромант");s.players[0].deck=["KNZ-002","NCR-025","NCR-026"];
 assert.equal(play(s,"NCR-008").ok,true);
 assert.equal(s.players[0].hand.filter(h=>["NCR-025","NCR-026"].includes(h.cardId)).length,1);
 assert.equal(s.players[0].deck.length,2);
});
test("CHR-006 weapon battlecry damages hero for two and draws a Spirit",()=>{
 const s=sandbox("CHR-006","Чернокнижник");s.players[0].deck=["CHR-002","KNZ-002"];
 assert.equal(play(s,"CHR-006").ok,true);
 assert.equal(s.players[0].health,28);
 assert.ok(s.players[0].hand.some(h=>h.cardId==="CHR-002"));
});
test("KNZ-022 draws maximum printed cost card from remaining deck",()=>{
 const s=sandbox("KNZ-022");s.players[0].deck=["KNZ-002","KNZ-006","KNZ-035"];
 const expensive=s.players[0].deck.reduce((a,id)=>catalog.get(id).costValue>catalog.get(a).costValue?id:a);
 assert.equal(play(s,"KNZ-022").ok,true);
 assert.ok(s.players[0].hand.some(h=>h.cardId===expensive));
});
test("test tools never modify the canonical catalog",()=>{
 const before=JSON.stringify(catalog.get("KNZ-002"));
 const s=sandbox("KNZ-002");
 E.setDeveloperMode(s,true);
 E.debugAction(s,{type:"give",cardId:"KNZ-002",definition:catalog.get("KNZ-002")});
 E.debugAction(s,{type:"mana",value:5});
 assert.equal(JSON.stringify(catalog.get("KNZ-002")),before);
});
test("event filter supports owner and type, and does not reveal bot draws",()=>{
 const s=E.makeGame(examples[0],examples[1],catalog,{firstPlayer:0,seed:321});
 assert.ok(E.eventJournal(s,{kind:"draw",owner:"0"}).length>0);
 const bot=E.eventJournal(s,{kind:"draw",owner:"1"});
 assert.ok(bot.length>0);
 for(const e of bot)assert.equal(e.cardId,null);
 assert.equal(E.eventJournal(s,{search:"ТОЧНО-НЕ-СУЩЕСТВУЕТ"}).length,0);
});
test("bot consumes only legal actions and never exceeds the board or hand limits",()=>{
 for(const [a,b] of [[0,1],[1,2],[2,0]]){
  const s=E.makeGame(examples[a],examples[b],catalog,{firstPlayer:0,seed:400+a,hour:15});
  E.confirmMulligan(s,[]);
  for(let n=0;n<15&&s.phase==="battle";n++){
   if(s.turn===0)assert.equal(E.endTurn(s,0).ok,true);
   if(s.turn===1)assert.equal(E.runBotTurn(s).ok,true);
   for(const p of s.players){
    assert.ok(p.hand.length<=10,"hand size "+p.hand.length);
    assert.ok(p.board.length<=7,"board size "+p.board.length);
    assert.ok(Number.isFinite(p.health));
   }
  }
  assert.ok(s.logs.length>0);
  assert.ok(E.importBattle(E.exportBattle(s)).players.length===2);
 }
});
console.log("TOTAL v2.0: "+passed+" passed, "+failed+" failed");
if(failed)process.exitCode=1;
