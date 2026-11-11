/* Node.js regression tests: autonomous, zero packages. */
"use strict";
const assert=require("node:assert/strict");
const engine=require("../battle-engine.js");
global.window=global;require("../card-catalog.js");
const canonical=global.MW_CANONICAL_CARDS;
const byId=Object.fromEntries(canonical.map(c=>[c.cardId,c]));
let passed=0;
function test(name,fn){
 try{fn();passed++;process.stdout.write("PASS "+name+"\n");}
 catch(e){process.stderr.write("FAIL "+name+": "+(e.stack||e)+"\n");process.exitCode=1;}
}
function setup(id,deck=[],opts={}){
 const base={name:"тест",classId:"Воин",counts:{"KNZ-002":30}};
 const s=engine.makeGame(base,base,byId,{rng:()=>0.3,firstPlayer:0,hour:opts.hour??12,timeMode:"off"});
 engine.confirmMulligan(s,[]);
 s.cards={...byId};
 s.players[0].deck=deck.slice();
 s.players[0].hand=[{uid:"h1",cardId:id,costAdjustment:0}];
 s.players[0].mana=10;s.players[0].maxMana=10;s.players[0].corpses=10;
 s.players[0].graveyard=[];s.players[0].board=[];
 s.players[1].board=[];
 return s;
}
function putInGrave(s,id,uidVal,token=false){s.players[0].graveyard.push({uid:uidVal,cardId:id,token});}
function putOnBoard(s,id,u){
 const c=byId[id];
 const m={uid:u,cardId:id,name:c.name,attack:c.attack??1,health:c.health??1,maxHealth:c.health??1,
  affinity:c.timeAffinityId,creatureType:c.creatureTypeId,subtype:c.subtype,
  timed:[],ready:true,attacked:false,taunt:false,stealth:false,auraHealth:0};
 s.players[0].board.push(m);return m;
}
const ms=s=>s.players[0].mana;
const setIds=(s,cardId)=>{s.players[0].hand=[{uid:"h1",cardId,costAdjustment:0}];};
const select=(s,spec,groups)=>{
 const obj={};for(const st of spec.steps)obj[st.key]=groups?.[st.key]??st.options.slice(0,st.min).map(v=>v.id);
 return obj;
};
test("KNZ-008: random eligible draw requires no player selection",()=>{
 const s=setup("KNZ-008",["KNZ-002","KNZ-006","CHR-002"]);
 const status=engine.actionStatus(s,0,"h1");
 assert.equal(status.ok,true);assert.equal(status.choice,null);
 const r=engine.playCard(s,0,"h1");
 assert.equal(r.ok,true);assert.equal(ms(s),8);
 assert.deepEqual(s.players[0].deck,["KNZ-006","CHR-002"]);
 assert.equal(s.players[0].hand[0].cardId,"KNZ-002");
});
test("KNZ-009: night spirit draw automatically reduces drawn card cost",()=>{
 const s=setup("KNZ-009",["CHR-002"],{hour:23});
 assert.equal(engine.actionStatus(s,0,"h1").choice,null);
 assert.equal(engine.playCard(s,0,"h1").ok,true);
 assert.equal(s.players[0].hand[0].cardId,"CHR-002");
 assert.equal(s.players[0].hand[0].costAdjustment,-1);
});
test("KNZ-016: weapon and spell drawn automatically from matching groups",()=>{
 const s=setup("KNZ-016",["KNZ-006","KNZ-001","KNZ-002"]);
 assert.equal(engine.actionStatus(s,0,"h1").choice,null);
 assert.equal(engine.playCard(s,0,"h1").ok,true);
 assert.equal(s.players[0].deck.length,1);
 assert.deepEqual(s.players[0].hand.map(x=>x.cardId),["KNZ-006","KNZ-001"]);
});
test("KNZ-020: two eligible human card instances drawn without replacement",()=>{
 const s=setup("KNZ-020",["KNZ-002","KNZ-002","KNZ-006"]);
 assert.equal(engine.playCard(s,0,"h1").ok,true);
 assert.equal(s.players[0].hand.length,2);
 assert.equal(s.players[0].deck.length,1);
 assert.equal(s.players[0].hand.every(x=>x.costAdjustment===-1),true);
});
test("NEU-014: Congregation draws eligible peasants automatically",()=>{
 const s=setup("NEU-014",["NEU-002","NEU-002","KNZ-002"]);
 for(let i=0;i<3;i++)putOnBoard(s,"NEU-002","p"+i);
 assert.equal(engine.actionStatus(s,0,"h1").choice,null);
 assert.equal(engine.playCard(s,0,"h1").ok,true);
 assert.deepEqual(s.players[0].hand.map(x=>x.cardId),["NEU-002","NEU-002"]);
});
test("KNZ-015: up to two unique own humans; no mutation on cancel",()=>{
 const s=setup("KNZ-015");
 const one=putOnBoard(s,"KNZ-002","u-friend1"),two=putOnBoard(s,"KNZ-002","u-friend2");
 const st=engine.actionStatus(s,0,"h1").choice;
 assert.equal(st.steps[0].max,2);
 assert.equal(ms(s),10);assert.equal(one.timed.length,0);
 assert.equal(engine.playCard(s,0,"h1",null,{human:["board:u-friend1","board:u-friend2"]}).ok,true);
 assert.equal(one.timed[0].kind,"day");assert.equal(two.timed[0].kind,"day");
});
test("CHR-014: deck cards summoned instead of put into hand, nighttime bonuses",()=>{
 const s=setup("CHR-014",["CHR-002","CHR-002","KNZ-002"],{hour:21});
 const choice=select(s,engine.actionStatus(s,0,"h1").choice);
 assert.equal(engine.playCard(s,0,"h1",null,choice).ok,true);
 assert.equal(s.players[0].deck.length,1);assert.equal(s.players[0].hand.length,0);
 assert.equal(s.players[0].board.length,2);
 assert.equal(s.players[0].board[0].attack,(byId["CHR-002"].attack||0)+1);
});
test("NCR-021: only own non-token <=4 mana; remove precisely chosen grave entry",()=>{
 const s=setup("NCR-021");
 putInGrave(s,"KNZ-002","g1");putInGrave(s,"KNZ-002","g2");putInGrave(s,"KNZ-002","gt",true);
 const spec=engine.actionStatus(s,0,"h1").choice;
 assert.equal(spec.steps[0].options.length,2);
 assert.equal(engine.playCard(s,0,"h1",null,{grave:["grave:gt"]}).ok,false);
 assert.equal(ms(s),10);
 assert.equal(engine.playCard(s,0,"h1",null,{grave:["grave:g2"]}).ok,true);
 assert.equal(s.players[0].graveyard.length,2);
 assert.ok(s.players[0].graveyard.find(g=>g.uid==="g1"));
 assert.ok(!s.players[0].graveyard.find(g=>g.uid==="g2"));
 assert.equal(s.players[0].hand[0].cardId,"KNZ-002");
});
test("NCR-027: grave selection, consume entry, summon base stats",()=>{
 const s=setup("NCR-027");
 putInGrave(s,"KNZ-002","g1");putInGrave(s,"KNZ-002","gt",true);
 assert.equal(engine.playCard(s,0,"h1",null,{grave:["grave:g1"]}).ok,true);
 assert.equal(s.players[0].graveyard.length,1);
 assert.equal(s.players[0].board[0].cardId,"KNZ-002");
 assert.equal(s.players[0].board[0].health,byId["KNZ-002"].health);
});
test("CHR-021: grave choice different Spirits; cannot choose duplicates",()=>{
 const s=setup("CHR-021");
 putInGrave(s,"CHR-002","g1");putInGrave(s,"CHR-002","g2");putInGrave(s,"CHR-004","g3");
 const status=engine.actionStatus(s,0,"h1");
 assert.equal(status.choice.steps[0].max,2);
 assert.equal(engine.playCard(s,0,"h1",null,{spirits:["grave:g1","grave:g2"]}).ok,false);
 assert.equal(ms(s),10);
 assert.equal(engine.playCard(s,0,"h1",null,{spirits:["grave:g1","grave:g3"]}).ok,true);
 assert.equal(s.players[0].board.length,2);
 assert.ok(s.players[0].board.every(m=>m.timed.some(t=>t.kind==="night")));
});
test("NEU-017: two distinct fallen Peasants, Spirit & Night, non-token only",()=>{
 const s=setup("NEU-017");
 putInGrave(s,"NEU-002","g1");putInGrave(s,"NEU-002","g2");
 assert.equal(engine.actionStatus(s,0,"h1").ok,false);
 putInGrave(s,"NEU-006","g3");
 const status=engine.actionStatus(s,0,"h1");
 assert.equal(status.ok,true);
 assert.equal(engine.playCard(s,0,"h1",null,{peasants:["grave:g1","grave:g3"]}).ok,true);
 assert.equal(s.players[0].board.length,2);
 assert.ok(s.players[0].board.every(x=>x.creatureType==="Дух"&&x.affinity==="Ноч"));
});
test("NCR-027: no living grave choices blocks before cost",()=>{
 const s=setup("NCR-027");assert.equal(engine.actionStatus(s,0,"h1").ok,false);
 assert.equal(engine.playCard(s,0,"h1").ok,false);
 assert.equal(ms(s),10);
});
test("bot draws from deck automatically without choices",()=>{
 const s=setup("KNZ-008");
 s.players[1].deck=["KNZ-002","KNZ-002"];
 s.players[1].hand=[{uid:"bot-hand",cardId:"KNZ-008",costAdjustment:0}];
 s.players[1].mana=5;s.players[1].maxMana=5;
 assert.equal(engine.choiceSpec(s,1,s.cards["KNZ-008"]),null);
 assert.equal(engine.playCard(s,1,"bot-hand").ok,false); // wrong turn
 s.turn=1;
 assert.equal(engine.playCard(s,1,"bot-hand").ok,true);
 assert.equal(s.players[1].deck.length,1);
 assert.equal(s.players[1].hand[0].cardId,"KNZ-002");
});
test("local text modification disables effect even with source card ID",()=>{
 const s=setup("KNZ-008",["KNZ-002"]);
 s.cards["KNZ-008"]={...s.cards["KNZ-008"],effectModified:true};
 assert.equal(engine.actionStatus(s,0,"h1").ok,false);
});
console.log(`PASS total: ${passed}/14`);
