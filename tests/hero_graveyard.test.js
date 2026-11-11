/* 1.7: утверждённые силы героя, личное кладбище и отсутствие домысленных механик */
"use strict";
const assert=require("node:assert/strict");
global.window=global;
require("../card-catalog.js");
const E=require("../battle-engine.js");
const cards=Object.fromEntries(global.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
let passed=0;
function check(name,fn){
 try{fn();passed++;console.log("PASS",name);}
 catch(e){console.error("FAIL",name,e.stack||e);process.exitCode=1;}
}
function fixture({hour=12,profile="demo-unlocked",classId="Воин",timeMode="floor",necroTokens=null}={}){
 const deck={name:"Тест",classId,counts:{"KNZ-002":30}};
 const s=E.makeGame(deck,deck,cards,{
  firstPlayer:0,hour,timeMode,rng:()=>0.2,
  heroProfiles:[profile,"campaign"],necroTokens
 });
 E.confirmMulligan(s,[]);
 s.cards={...cards};
 s.players[0].mana=10;
 s.players[0].maxMana=10;
 s.players[1].deck=Array(30).fill("KNZ-002");
 return s;
}
function cast(s,owner,id,target=null,choices=null){
 const h={uid:"h"+(++s.serial),cardId:id,costAdjustment:0};
 s.players[owner].hand.push(h);s.players[owner].mana=Math.max(10,s.players[owner].mana);
 return E.playCard(s,owner,h.uid,target,choices);
}
check("tutorial Ragvalod starts with the documented test armor 10",()=>{
 const s=fixture({profile:"ragvalod"});
 assert.equal(s.players[0].armor,10);
 assert.equal(E.heroPowerStatus(s,0).ok,true);
 const c=fixture({profile:"campaign"});
 assert.equal(c.players[0].armor,0);
});
check("warrior power is locked in campaign mode",()=>{
 const s=fixture({profile:"campaign"});
 assert.equal(E.heroPowerStatus(s,0).ok,false);
 assert.equal(E.useHeroPower(s,0).ok,false);
 assert.equal(s.players[0].mana,10);
});
check("warrior sunny power calls only approved TKN-001 1/1",()=>{
 const s=fixture(),p=s.players[0];
 assert.equal(E.heroPowerStatus(s,0).id,"warrior-recruit");
 assert.equal(E.useHeroPower(s,0).ok,true);
 assert.equal(p.mana,8);
 assert.equal(p.board.length,1);
 assert.equal(p.board[0].cardId,"TKN-001");
 assert.equal(p.board[0].attack,1);
 assert.equal(p.board[0].health,1);
 assert.equal(p.board[0].affinity,"Дзень");
 assert.equal(p.board[0].subtype,"Дружыннік");
});
check("power shared once-per-turn limit, resets next personal turn",()=>{
 const s=fixture(),p=s.players[0];
 assert.equal(E.useHeroPower(s,0).ok,true);
 assert.equal(E.useHeroPower(s,0).ok,false);
 assert.equal(p.mana,8);
 E.endTurn(s,0);E.endTurn(s,1);
 assert.equal(s.turn,0);
 assert.equal(p.heroPowerUsed,false);
});
check("no summon with full seven-minion board",()=>{
 const s=fixture(),p=s.players[0];
 for(let i=0;i<7;i++)p.board.push({uid:"x"+i,attack:1,health:1,maxHealth:1,creatureType:"Чалавек",subtype:"",
  timed:[],ready:true,attacked:false});
 assert.equal(E.heroPowerStatus(s,0).ok,false);
 assert.equal(E.useHeroPower(s,0).ok,false);
 assert.equal(p.board.length,7);assert.equal(p.mana,10);
});
check("night FAKEL requires a friendly Human and does not pay before choice",()=>{
 const s=fixture({hour:21}),p=s.players[0];
 const power=E.heroPowerStatus(s,0);
 assert.equal(power.id,"warrior-torch");assert.equal(power.ok,false);
 assert.equal(cast(s,0,"KNZ-002").ok,true);
 const m=p.board.at(-1);
 const now=p.mana;
 assert.equal(E.useHeroPower(s,0,{kind:"hero",owner:1}).ok,false);
 assert.equal(p.mana,now);
 assert.equal(p.heroPowerUsed,false);
 assert.equal(E.useHeroPower(s,0,{kind:"minion",owner:0,uid:m.uid}).ok,true);
 assert.equal(p.mana,now-3);
 assert.equal(E.effectiveAttack(s,m),1);
 assert.equal(E.incomingMultiplier(s,m,"combat"),1);
});
check("FAKEL does not restore HP or change printed affinity and expires at end",()=>{
 const s=fixture({hour:21}),p=s.players[0];
 assert.equal(cast(s,0,"KNZ-002").ok,true);
 const m=p.board[0];m.health=1;
 assert.equal(E.effectiveAttack(s,m),0);assert.equal(E.incomingMultiplier(s,m,"combat"),2);
 assert.equal(E.useHeroPower(s,0,{kind:"minion",owner:0,uid:m.uid}).ok,true);
 assert.equal(m.health,1);assert.equal(m.affinity,"Дзень");
 E.endTurn(s,0);
 assert.equal(E.effectiveAttack(s,m),0);
 assert.equal(E.incomingMultiplier(s,m,"combat"),2);
});
check("unapproved Warlock power stays unavailable",()=>{
 const s=fixture({classId:"Чернокнижник"});
 assert.equal(E.heroPowerStatus(s,0).ok,false);
});
check("Chernobog powers remain disabled without approved token metadata",()=>{
 const s=fixture({classId:"Некромант",hour:12});
 const st=E.heroPowerStatus(s,0);
 assert.equal(st.ok,false);assert.match(st.reason,/не утверждены/i);
});
check("custom necromancer token metadata permits configured idol, local darkness to neighbors",()=>{
 const s=fixture({classId:"Некромант",hour:12,necroTokens:{
  idol:{creatureTypeId:"Дух",timeAffinityId:"Ноч"},
  undead:{creatureTypeId:"Нежыць",timeAffinityId:"Ноч"}
 }});
 const p=s.players[0];
 assert.equal(E.useHeroPower(s,0).ok,true);
 assert.equal(p.board[0].heroPowerToken,"idol");
 assert.equal(p.board[0].taunt,true);
 assert.equal(p.board[0].health,2);
 assert.equal(cast(s,0,"KNZ-002").ok,true);
 const m=p.board.at(-1);
 assert.equal(E.localBright(s,m),false);
 assert.equal(E.effectiveAttack(s,m),0);
 p.board[0].health=0;
 // Removing source from board is enough for spatial aura invalidation.
 p.board.shift();
 assert.equal(E.localBright(s,m),true);
 assert.equal(E.effectiveAttack(s,m),1);
});
check("configured Chernobog undead has charge, expires this turn, no auto corpse",()=>{
 const s=fixture({classId:"Некромант",hour:21,necroTokens:{
  idol:{creatureTypeId:"Дух",timeAffinityId:"Ноч"},
  undead:{creatureTypeId:"Нежыць",timeAffinityId:"Ноч"}
 }});
 const p=s.players[0];
 assert.equal(E.useHeroPower(s,0).ok,true);
 const m=p.board[0];assert.equal(m.attack,1);assert.equal(m.health,1);
 assert.equal(m.ready,true);
 assert.equal(p.corpses,0);
 E.endTurn(s,0);
 assert.equal(p.board.some(x=>x.uid===m.uid),false);
 const v=E.graveyardView(s,0);
 assert.equal(v.available.length,1);assert.equal(v.available[0].token,true);
 assert.equal(v.available[0].canRevive,false);
 assert.equal(p.corpses,0);
});
check("death of own minion writes to only own graveyard, not automatic corpses",()=>{
 const s=fixture(),p=s.players[0];
 assert.equal(cast(s,0,"KNZ-002").ok,true);
 const m=p.board[0];
 assert.equal(cast(s,0,"NCR-018",{kind:"minion",owner:0,uid:m.uid}).ok,true);
 assert.equal(p.board.length,0);
 assert.equal(p.graveyard.length,1);
 const g=p.graveyard[0];assert.equal(g.cardId,"KNZ-002");
 assert.equal(g.owner,0);assert.ok(g.deathId);assert.equal(g.name,"МАЛАДЫ ДРУЖЫННІК");
 assert.equal(s.players[1].graveyard.length,0);
 assert.equal(p.corpses,0);
 assert.equal(E.graveyardView(s,0).history[0].action,"death");
});
check("explicit corpse spell and card cost appear in separate ledger",()=>{
 const s=fixture(),p=s.players[0];
 assert.equal(cast(s,0,"NCR-017").ok,true);
 assert.equal(p.corpses,2);
 const entry=E.graveyardView(s,0).corpseLedger;
 assert.equal(entry.length,1);assert.equal(entry[0].amount,2);assert.equal(entry[0].balance,2);
 const corpseCard=Object.values(cards).find(c=>c.costType==="corpses"&&c.costValue===2&&c.cardType==="creature");
 if(corpseCard){
   p.hand.push({uid:"corpse-test",cardId:corpseCard.cardId,costAdjustment:0});
   p.mana=10;
   const r=E.playCard(s,0,"corpse-test");
   assert.equal(r.ok,true,r.reason);assert.equal(p.corpses,0);
   assert.equal(p.corpseLedger.at(-1).amount,-2);
 }
});
check("grave selection removal is recorded as separate history item",()=>{
 const s=fixture(),p=s.players[0];
 assert.equal(cast(s,0,"KNZ-002").ok,true);
 const m=p.board[0];
 assert.equal(cast(s,0,"NCR-018",{kind:"minion",owner:0,uid:m.uid}).ok,true);
 p.corpses=10; // только тестовая подготовка ресурсов, не правило начисления
 const hand={uid:"return-spell",cardId:"NCR-021",costAdjustment:0};
 p.hand.push(hand);p.mana=10;
 const status=E.actionStatus(s,0,hand.uid);
 assert.equal(status.ok,true,status.reason);
 const opt=status.choice.steps[0].options[0];
 const choices={[status.choice.steps[0].key]:[opt.id]};
 assert.equal(E.playCard(s,0,hand.uid,null,choices).ok,true);
 assert.equal(p.graveyard.length,0);
 assert.equal(p.graveyardHistory.length,2);
 assert.equal(p.graveyardHistory.at(-1).action,"removed");
 assert.equal(p.graveyardHistory.at(-1).source,"Карта NCR-021");
});


check("CHR-020 fills own board with Malye Zlydni and buffs other Spirits",()=>{
 const s=fixture(),p=s.players[0];
 assert.equal(cast(s,0,"CHR-020").ok,true);
 assert.equal(p.board.length,7);
 const tokens=p.board.filter(m=>m.cardId==="TKN-002");
 assert.equal(tokens.length,6);
 assert(tokens.every(m=>m.attack===2&&m.health===2));
});
check("NEU-024 doubles opponent spell cost only on following turn",()=>{
 const s=fixture(),enemy=s.players[1];
 assert.equal(cast(s,0,"NEU-024").ok,true);
 assert.equal(enemy.enemySpellTax,1);
 enemy.hand.push({uid:"spell-t",cardId:"NEU-023",costAdjustment:0});
 E.endTurn(s,0);
 assert.equal(E.currentCost(s,1,enemy.hand.find(h=>h.uid==="spell-t")),2*Number(cards["NEU-023"].costValue));
 E.endTurn(s,1);
 assert.equal(enemy.enemySpellTax,0);
});
check("CHR-030 deathrattle deals one damage to each creature",()=>{
 const s=fixture(),p=s.players[0],enemy=s.players[1];
 assert.equal(cast(s,0,"CHR-030").ok,true);
 assert.equal(cast(s,0,"KNZ-002").ok,true);
 s.turn=1;enemy.mana=10;
 assert.equal(cast(s,1,"KNZ-002").ok,true);
 s.turn=0;p.mana=10;
 const bog=p.board.find(m=>m.cardId==="CHR-030");
 assert(bog);
 assert.equal(cast(s,0,"NCR-018",{kind:"minion",owner:0,uid:bog.uid}).ok,true);
 assert.equal(enemy.board[0].health,1);
});
check("NEU-043 inflicts double battlecry damage to Humans, including allied Humans",()=>{
 const s=fixture(),p=s.players[0];
 assert.equal(cast(s,0,"KNZ-002").ok,true);
 const ownHuman=p.board[0];
 assert.equal(cast(s,0,"NEU-043").ok,true);
 assert.equal(p.board.some(m=>m.uid===ownHuman.uid),false);
 assert(E.graveyardView(s,0).history.some(x=>x.cardId==="KNZ-002"));
});
check("NEU-044 heals for creatures killed directly by battlecry",()=>{
 const s=fixture(),p=s.players[0],enemy=s.players[1];
 p.health=25;
 assert.equal(cast(s,0,"KNZ-002").ok,true);
 s.turn=1;enemy.mana=10;
 assert.equal(cast(s,1,"KNZ-002").ok,true);
 s.turn=0;p.mana=10;
 assert.equal(cast(s,0,"NEU-044").ok,true);
 assert.equal(p.health,27);
});
console.log(`HERO, GRAVEYARD, CREATURE TESTS: ${passed} passed`);
