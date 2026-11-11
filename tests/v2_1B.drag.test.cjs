/* v2.1B — drag & drop plan unit tests. UI calls same engine, never bypasses costs. */
"use strict";
const assert=require("node:assert/strict");
global.window=global;
require("../card-catalog.js");
const E=require("../battle-engine.js");
const Drag=require("../battle-drag-rules-v2.1B.js");
const catalog=new Map(window.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
const d={name:"Test",classId:"Воин",counts:{"KNZ-002":30}};
let passed=0;
const test=(name,fn)=>{try{fn();passed++;console.log("PASS",name);}catch(e){console.error("FAIL",name,e.stack);process.exitCode=1;}};
function fixture(){
 const s=E.makeGame(d,d,catalog,{firstPlayer:0,seed:1427,timeMode:"off",hour:12});
 E.confirmMulligan(s,[]);
 s.phase="battle";s.turn=0;
 s.cards=Object.fromEntries(catalog.entries());
 s.players.forEach(p=>{p.mana=10;p.maxMana=10;p.deck=Array(25).fill("KNZ-002");p.hand=[];p.board=[];});
 return s;
}
function hand(s,id){
 const h={uid:"hand-"+id+"-"+(s.serial++),cardId:id,costAdjustment:0};
 s.players[0].hand.push(h);return h;
}
function summon(s,owner,id="KNZ-002"){
 E.setDeveloperMode(s,true);
 const r=E.debugAction(s,{type:"summon",owner,cardId:id,definition:catalog.get(id)});
 assert.equal(r.ok,true,r.reason);
 return s.players[owner].board.at(-1);
}
const board={kind:"board",owner:0};
test("own board accepts a playable creature",()=>{
 const s=fixture(),h=hand(s,"KNZ-002"),p=Drag.plan(s,{kind:"hand",uid:h.uid},board,E);
 assert.equal(p.ok,true);assert.equal(p.mode,"play");
 const before=s.players[0].mana;
 assert(E.playCard(s,0,h.uid).ok);
 assert.equal(s.players[0].mana,before-1);
 assert.equal(s.players[0].board.length,1);
});
test("enemy board rejects a creature before any payment",()=>{
 const s=fixture(),h=hand(s,"KNZ-002"),before=s.players[0].mana;
 const plan=Drag.plan(s,{kind:"hand",uid:h.uid},{kind:"board",owner:1},E);
 assert.equal(plan.ok,false);assert.equal(s.players[0].mana,before);
 assert.equal(s.players[0].hand.length,1);
});
test("putting a normal creature over an existing own minion still plays to board",()=>{
 const s=fixture(),h=hand(s,"KNZ-002"),m=summon(s,0);
 const plan=Drag.plan(s,{kind:"hand",uid:h.uid},{kind:"minion",owner:0,uid:m.uid},E);
 assert.equal(plan.mode,"play");
});
test("targeted spell onto board opens selection rather than auto-targeting",()=>{
 const s=fixture(),h=hand(s,"NEU-023"),p=Drag.plan(s,{kind:"hand",uid:h.uid},board,E);
 assert.equal(p.ok,true);assert.equal(p.mode,"await-target");
 assert.equal(s.players[0].hand.length,1);
});
test("targeted spell onto valid enemy hero is allowed",()=>{
 const s=fixture(),h=hand(s,"NEU-023");
 const p=Drag.plan(s,{kind:"hand",uid:h.uid},{kind:"hero",owner:1},E);
 assert.equal(p.mode,"spell-target");assert(p.ok);
 assert(E.playCard(s,0,p.uid,p.target).ok);
 assert.equal(s.players[1].health,29);
});
test("invalid target for spell cannot consume mana or card",()=>{
 const s=fixture(),h=hand(s,"NEU-023"),before=s.players[0].mana;
 const r=Drag.plan(s,{kind:"hand",uid:h.uid},{kind:"board",owner:1},E);
 assert.equal(r.ok,false);assert.equal(s.players[0].mana,before);
 assert(s.players[0].hand.includes(h));
});
test("own ready minion can attack enemy hero through drop",()=>{
 const s=fixture(),m=summon(s,0);m.ready=true;m.attacked=false;
 const p=Drag.plan(s,{kind:"minion",uid:m.uid},{kind:"hero",owner:1},E);
 assert.equal(p.mode,"attack");assert(p.ok);
 assert(E.attack(s,0,m.uid,p.target,false).ok);
 assert.equal(s.players[1].health,29);
});
test("unready minion cannot attack through drag",()=>{
 const s=fixture(),m=summon(s,0);m.ready=false;
 const p=Drag.plan(s,{kind:"minion",uid:m.uid},{kind:"hero",owner:1},E);
 assert.equal(p.ok,false);
 assert.equal(s.players[1].health,30);
});
test("enemy taunt blocks drag attack on enemy hero",()=>{
 const s=fixture(),m=summon(s,0),t=summon(s,1);m.ready=true;m.attacked=false;t.taunt=true;
 const p=Drag.plan(s,{kind:"minion",uid:m.uid},{kind:"hero",owner:1},E);
 assert.equal(p.ok,false);
});
test("invalid turn and missing uid reject drag",()=>{
 const s=fixture(),h=hand(s,"KNZ-002");
 assert.equal(Drag.plan(s,{kind:"hand",uid:"nonexistent"},board,E).ok,false);
 s.turn=1;
 assert.equal(Drag.plan(s,{kind:"hand",uid:h.uid},board,E).ok,false);
});
test("two sources with same card ID remain distinct via uid",()=>{
 const s=fixture(),a=hand(s,"KNZ-002"),b=hand(s,"KNZ-002");
 const plan=Drag.plan(s,{kind:"hand",uid:b.uid},board,E);
 assert.equal(plan.uid,b.uid);assert.notEqual(plan.uid,a.uid);
});
console.log(`v2.1B drag rules: ${passed} passed`);
