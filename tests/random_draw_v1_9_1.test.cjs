/* v1.9.1 — faithful automatic draw rules from approved XLSX (Карты).
 * No external packages. All choices use a seeded pseudo-random generator for reproducibility.
 */
"use strict";
const assert = require("node:assert/strict");
const game = require("../battle-engine.js");
global.window=global;
require("../card-catalog.js");
const catalog=Object.fromEntries(global.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
let passed=0;
function test(name,fn) {
  try { fn();passed++;console.log("PASS",name); }
  catch (e) {console.error("FAIL",name,e.stack||e);process.exitCode=1;}
}
function setup(cardId,deck,{hour=12,random=0.1}={}){
  const base={name:"Тест",classId:"Воин",counts:{"KNZ-002":30}};
  const s=game.makeGame(base,base,catalog,{rng:()=>random,firstPlayer:0,hour,timeMode:"off"});
  game.confirmMulligan(s,[]);
  s.cards={...catalog};
  s.players[0].deck=deck.slice();
  s.players[0].hand=[{uid:"h1",cardId,costAdjustment:0}];
  s.players[0].mana=10;s.players[0].maxMana=10;
  s.players[0].board=[];s.players[1].board=[];
  return s;
}
const hand=s=>s.players[0].hand.map(h=>h.cardId);
const deck=s=>s.players[0].deck;
const cast=s=>game.playCard(s,0,"h1");

test("ordinary draw takes next card of a shuffled deck (no chooser)",()=>{
  const s=setup("KNZ-008",["NEU-002","KNZ-002"]);
  s.players[0].hand=[];
  assert.equal(game.draw(s,0),true);
  assert.deepEqual(hand(s),["NEU-002"]);
  assert.deepEqual(deck(s),["KNZ-002"]);
});
test("KNZ-008 chooses random human among eligible cards, not first always",()=>{
  const deckIds=["NEU-002","CHR-002","KNZ-002","KNZ-006"];
  const first=setup("KNZ-008",deckIds,{random:0});
  const last=setup("KNZ-008",deckIds,{random:0.9999});
  assert.equal(game.actionStatus(first,0,"h1").choice,null);
  assert.equal(cast(first).ok,true);
  assert.equal(cast(last).ok,true);
  assert.deepEqual(hand(first),["NEU-002"]);
  assert.deepEqual(hand(last),["KNZ-002"]);
  assert.equal(first.players[0].mana,8);
  assert.equal(last.players[0].mana,8);
  assert.deepEqual(deck(first),["CHR-002","KNZ-002","KNZ-006"]);
  assert.deepEqual(deck(last),["NEU-002","CHR-002","KNZ-006"]);
});
test("KNZ-008 with no eligible human consumes spell, not mana for fatigue",()=>{
  const s=setup("KNZ-008",["CHR-002","KNZ-006"]);
  assert.equal(game.actionStatus(s,0,"h1").ok,true);
  assert.equal(cast(s).ok,true);
  assert.equal(s.players[0].mana,8);
  assert.equal(s.players[0].fatigue,0);
  assert.deepEqual(hand(s),[]);
  assert.deepEqual(deck(s),["CHR-002","KNZ-006"]);
});
test("KNZ-009 randomly draws eligible Spirit and discounts only at night",()=>{
  const byNight=setup("KNZ-009",["CHR-002","KNZ-002","CHR-004"],{hour:20,random:0.99});
  assert.equal(cast(byNight).ok,true);
  assert.deepEqual(hand(byNight),["CHR-004"]);
  assert.equal(byNight.players[0].hand[0].costAdjustment,-1);
  const byDay=setup("KNZ-009",["CHR-002","CHR-004"],{hour:12,random:0});
  assert.equal(cast(byDay).ok,true);
  assert.deepEqual(hand(byDay),["CHR-002"]);
  assert.equal(byDay.players[0].hand[0].costAdjustment,0);
});
test("KNZ-016 draws one random Weapon and one random Spell, not from UI",()=>{
  const s=setup("KNZ-016",["KNZ-006","KNZ-001","KNZ-014","KNZ-018","KNZ-002"],{random:0.99});
  assert.equal(game.actionStatus(s,0,"h1").choice,null);
  assert.equal(cast(s).ok,true);
  assert.deepEqual(hand(s),["KNZ-018","KNZ-014"]);
  assert.deepEqual(deck(s),["KNZ-006","KNZ-001","KNZ-002"]);
});
test("KNZ-020 draws two physical Human card copies without replacement",()=>{
  const s=setup("KNZ-020",["KNZ-002","KNZ-002","KNZ-006"],{random:0.8});
  assert.equal(cast(s).ok,true);
  assert.deepEqual(hand(s),["KNZ-002","KNZ-002"]);
  assert.deepEqual(deck(s),["KNZ-006"]);
  assert.equal(s.players[0].hand.every(h=>h.costAdjustment===-1),true);
});
test("KNZ-020 takes only available eligible cards, never invents cards",()=>{
  const s=setup("KNZ-020",["KNZ-002","KNZ-006"],{random:0});
  assert.equal(cast(s).ok,true);
  assert.deepEqual(hand(s),["KNZ-002"]);
  assert.deepEqual(deck(s),["KNZ-006"]);
  assert.equal(s.players[0].fatigue,0);
});
test("NEU-014 draws a random Peasant, then second with three Peasants on board",()=>{
  const s=setup("NEU-014",["NEU-002","NEU-006","CHR-002"],{random:0.99});
  const peasant=catalog["NEU-002"];
  s.players[0].board=[1,2,3].map(i=>({
    uid:"p"+i,name:peasant.name,cardId:"NEU-002",creatureType:"Чалавек",
    subtype:"Селянін",attack:1,health:2,maxHealth:2,ready:true,attacked:false,timed:[]
  }));
  assert.equal(cast(s).ok,true);
  assert.deepEqual(hand(s),["NEU-006","NEU-002"]);
  assert.deepEqual(deck(s),["CHR-002"]);
});
test("full hand: first draw fits, second is burned, deck still loses both",()=>{
  const s=setup("KNZ-020",["KNZ-002","KNZ-002"],{random:0});
  s.players[0].hand.push(...Array.from({length:9},(_,i)=>({uid:"f"+i,cardId:"KNZ-002",costAdjustment:0})));
  assert.equal(s.players[0].hand.length,10);
  assert.equal(cast(s).ok,true);
  assert.equal(s.players[0].hand.length,10);
  assert.equal(deck(s).length,0);
  assert.ok(s.logs.some(x=>x.includes("Переполнение руки")));
});
test("ordinary draw on empty deck still applies fatigue",()=>{
  const s=setup("KNZ-008",[]);
  s.players[0].hand=[];
  const prev=s.players[0].health;
  assert.equal(game.draw(s,0),false);
  assert.equal(s.players[0].health,prev-1);
  assert.equal(s.players[0].fatigue,1);
});
test("player selection remains for explicit 'Выберыце' and graveyard",()=>{
  const s=setup("KNZ-015",[]);
  s.players[0].board=[{uid:"b1",cardId:"KNZ-002",creatureType:"Чалавек",subtype:"Дружына",timed:[]}];
  assert.ok(game.actionStatus(s,0,"h1").choice);
  const nec=setup("NCR-021",[]);
  nec.players[0].corpses=10;
  nec.players[0].graveyard.push({uid:"g1",cardId:"KNZ-002",token:false});
  assert.ok(game.actionStatus(nec,0,"h1").choice);
});
test("bot auto-draw needs no selection object",()=>{
  const s=setup("KNZ-008",["KNZ-002"]);
  s.turn=1;
  s.players[1].deck=["NEU-002"];
  s.players[1].hand=[{uid:"bh1",cardId:"KNZ-008",costAdjustment:0}];
  s.players[1].mana=10;s.players[1].maxMana=10;
  assert.equal(game.actionStatus(s,1,"bh1").choice,null);
  assert.equal(game.playCard(s,1,"bh1").ok,true);
  assert.deepEqual(s.players[1].hand.map(h=>h.cardId),["NEU-002"]);
});
console.log("PASS total:",passed+"/12");
