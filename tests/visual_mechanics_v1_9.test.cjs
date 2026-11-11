/* v1.9 regression: canonical effects, deliberate partial scope, no server. */
"use strict";
const assert=require("node:assert/strict");
global.window=global;
require("../card-catalog.js");
const E=require("../battle-engine.js");
const all=new Map(global.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
const d=(ids,cls)=>({name:"test",classId:cls,counts:Object.fromEntries(ids.map(id=>[id,1]))});
const ids=["CHR-038","CHR-044","CHR-029","KNZ-037","NEU-001","NEU-028","KNZ-002","NEU-030","ZAV-001","ZAV-002","ZAV-003","ZAV-004","ZAV-005"];
function fresh(hour=12){
 const s=E.makeGame(d(ids,"Чернокнижник"),d(ids,"Воин"),all,{firstPlayer:0,hour,rng:()=>0.37});
 s.phase="battle";s.turn=0;s.turns=7;s.players.forEach(p=>{p.hand=[];p.board=[];p.mana=10;p.maxMana=10;p.deck=[...ids];});
 return s;
}
let count=0;
function test(label,fn){fn();console.log("PASS "+label);count++;}
function hand(s,id,owner=0){
 const h={uid:"x"+Math.random(),cardId:id,costAdjustment:0};s.players[owner].hand.push(h);return h;
}
function creature(s,id,owner=0){
 const c=s.cards[id],m={uid:"m"+Math.random(),cardId:id,name:c.name,attack:c.attack,health:c.health,
  maxHealth:c.health,creatureType:c.creatureTypeId,subtype:c.subtype,
  affinity:c.timeAffinityId,taunt:false,stealth:false,ready:true,attacked:false,timed:[],auraHealth:0};
 s.players[owner].board.push(m);return m;
}
test("CHR-038 damages only non-Нечысць and hits hero only at night",()=>{
 const s=fresh(22),bad=creature(s,"NEU-030",1),human=creature(s,"KNZ-002",1),h=hand(s,"CHR-038");
 const r=E.playCard(s,0,h.uid);assert.ok(r.ok,r.reason);assert.equal(bad.health,20);
 assert.equal(s.players[1].board.includes(human),false);assert.equal(s.players[1].health,28);
});
test("CHR-044 summons three canonical Kasny 1/1 without invented token stats",()=>{
 const s=fresh(),h=hand(s,"CHR-044");const r=E.playCard(s,0,h.uid);
 assert.ok(r.ok,r.reason);assert.equal(s.players[0].board.length,3);
 assert.ok(s.players[0].board.every(m=>m.cardId==="CHR-029"&&m.attack===1&&m.health===1));
});
test("KNZ-037 cleanses modeled negative timed effects and heals, retains partial flag",()=>{
 const s=fresh(),m=creature(s,"KNZ-002");
 m.health=1;m.timed=[{kind:"frozen",remaining:1},{kind:"attack",amount:-2,remaining:1},{kind:"day",amount:0,remaining:1}];
 const h=hand(s,"KNZ-037");
 assert.equal(E.abilitySupport(s.cards["KNZ-037"]),"partial");
 const r=E.playCard(s,0,h.uid,{kind:"minion",owner:0,uid:m.uid});
 assert.ok(r.ok,r.reason);assert.equal(m.health,2);assert.deepEqual(m.timed.map(x=>x.kind),["day"]);
});
test("NEU-001 offers three distinct Zav cards and shuffles other two in daylight",()=>{
 const s=fresh(),h=hand(s,"NEU-001");
 const spec=E.actionStatus(s,0,h.uid).choice;assert.ok(spec&&!spec.blocked);
 assert.equal(spec.steps[0].options.length,3);
 assert.equal(new Set(spec.steps[0].options.map(x=>x.cardId)).size,3);
 const selected=spec.steps[0].options.find(x=>x.cardId!=="ZAV-005")||spec.steps[0].options[0];
 const before=s.players[0].deck.length;
 const r=E.playCard(s,0,h.uid,null,{zav:[selected.id],...(spec.steps.some(x=>x.key==="fireTarget")?{fireTarget:[]}: {})});
 assert.ok(r.ok,r.reason);
 assert.equal(s.players[0].board.length,2);assert.equal(s.players[0].deck.length,before+2);
});
test("NEU-001 night summons three, not in deck; restriction when board nearly full",()=>{
 const s=fresh(21),h=hand(s,"NEU-001");
 const spec=E.actionStatus(s,0,h.uid).choice;assert.equal(spec.steps[0].min,3);
 const c={zav:spec.steps[0].options.map(x=>x.id)};
 if(spec.steps.some(x=>x.key==="fireTarget"))c.fireTarget=[];
 const r=E.playCard(s,0,h.uid,null,c);
 assert.ok(r.ok,r.reason);assert.equal(s.players[0].board.length,4);
 assert.equal(s.players[0].deck.includes("ZAV-001")&&s.players[0].deck.length,ids.length, false);
});
test("NEU-028 ignites hand cards, expires on second following own end, never creates grave records",()=>{
 const s=fresh(),h=hand(s,"NEU-028"),victim=hand(s,"KNZ-002"),enemy=hand(s,"CHR-044",1);
 const r=E.playCard(s,0,h.uid);assert.ok(r.ok,r.reason);
 assert.equal(victim.burnTurnsLeft,2);assert.equal(enemy.burnTurnsLeft,2);
 E.endTurn(s,0);assert.equal(victim.burnTurnsLeft,2);
 E.endTurn(s,1);assert.equal(enemy.burnTurnsLeft,1);
 E.endTurn(s,0);assert.equal(victim.burnTurnsLeft,1);
 E.endTurn(s,1);assert.ok(!s.players[1].hand.some(x=>x.uid===enemy.uid));
 E.endTurn(s,0);assert.ok(!s.players[0].hand.some(x=>x.uid===victim.uid));
 assert.equal(s.players[0].graveyard.length,0);
});
test("Local project original art is retained independently of the thumbnail and canonical stats",()=>{
 const D=require("../deck-model.js");
 const source=global.MW_CANONICAL_CARDS.find(c=>c.cardId==="KNZ-002");
 const origArt="data:image/png;base64,iVBORw0KGgo=";
 const catalog=D.indexCatalog([source],[{cardId:"KNZ-002",name:"МАЛАДЫ ДРУЖЫННІК",cardType:"creature",rarityId:"common",thumbnail:"data:image/png;base64,AAAA",artImage:origArt,definition:{cardId:"KNZ-002",name:"Локальная версия",attack:999}}]);
 const c=catalog.get("KNZ-002");
 assert.equal(c.attack,1,"canonical game stat unchanged");
 assert.equal(c.artImage,origArt,"raw artwork survives");
 assert.ok(c.savedVisual);
});
console.log("v1.9 PASS "+count);
