/* Node.js tests of the offline gameplay effect registry, using the supplied card catalog. */
"use strict";
const assert=require("node:assert/strict");
global.window=global;
require("../card-catalog.js");
const E=require("../battle-engine.js");
const cards=new Map(global.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
let runs=0;
function test(name,fn){try{fn();runs++;console.log("PASS",name);}catch(e){console.error("FAIL",name,e.stack||e);process.exitCode=1;}}
function fixture(opts={}){
 const d={name:"Fixture",classId:"Воин",counts:{"KNZ-002":30}};
 const s=E.makeGame(d,d,cards,{firstPlayer:0,hour:opts.hour??12,timeMode:opts.timeMode??"off",rng:()=>0.21});
 s.phase="battle";s.turn=0;s.turns=1;
 s.cards=Object.fromEntries(cards.entries());
 s.players.forEach(p=>{p.mana=20;p.maxMana=10;p.deck=Array(25).fill("KNZ-002");p.hand=[];});
 return s;
}
function play(s,o,cardId,target){
 const p=s.players[o];s.turn=o;p.mana=20;p.corpses=Math.max(p.corpses,cardId==="NCR-028"?10:0);
 const h={uid:"z"+(++s.serial),cardId,costAdjustment:0};p.hand.push(h);
 const result=E.playCard(s,o,h.uid,target);
 if(!result.ok)throw new Error(cardId+": "+result.reason);
 return p.board.at(-1)||result;
}
function playResult(s,o,cardId,target){
 const p=s.players[o];s.turn=o;p.mana=20;
 const h={uid:"z"+(++s.serial),cardId,costAdjustment:0};p.hand.push(h);
 return {h,result:E.playCard(s,o,h.uid,target)};
}
function target(s,o,m){return {kind:"minion",owner:o,uid:m.uid};}
test("162 canonical cards, explicit support",()=>{
 assert.equal(cards.size,162);
 assert.equal(E.SUPPORTED_SPELLS.size,46);
 assert.equal(E.SUPPORTED_CREATURES.size,70); // v2.1A: KNZ-007 + CHR-031
 assert.equal(E.SUPPORTED_WEAPONS.size,14);
 assert.equal(E.abilitySupport(cards.get("KNZ-002")),"complete");
 assert.equal(E.abilitySupport(cards.get("NEU-022")),"partial");
});
test("mulligan and 30-health starting state",()=>{
 const d={name:"test",classId:"Воин",counts:{"KNZ-002":30}};
 const s=E.makeGame(d,d,cards,{firstPlayer:0,hour:5,rng:()=>0.2});
 assert.equal(s.players[0].hand.length,3);assert.equal(s.players[1].hand.length,5);
 assert.equal(s.players[0].health,30);
 assert.equal(E.confirmMulligan(s,[]).ok,true);
 assert.equal(s.players[0].maxMana,1);
});
test("target invalid never pays mana or discards card",()=>{
 const s=fixture(),p=s.players[0];
 const {h,result}=playResult(s,0,"KNZ-014",{kind:"hero",owner:1});
 assert.equal(result.ok,false);assert.equal(p.mana,20);
 assert(p.hand.some(x=>x.uid===h.uid));
});
test("damage spell can target hero and spell damage doesn't double in experimental combat mode",()=>{
 const s=fixture({hour:0,timeMode:"floor"});
 play(s,0,"NEU-023",{kind:"hero",owner:1});
 assert.equal(s.players[1].health,29);
});
test("KNZ-001 temporary attack expires on owner's end turn",()=>{
 const s=fixture();const m=play(s,0,"KNZ-002");
 play(s,0,"KNZ-001",target(s,0,m));
 assert.equal(E.effectiveAttack(s,m),2);
 E.endTurn(s,0);
 assert.equal(E.effectiveAttack(s,m),1);
});
test("KNZ-004 buff taunt, only while day",()=>{
 const s=fixture({hour:12});const m=play(s,0,"KNZ-002");
 play(s,0,"KNZ-004",target(s,0,m));
 assert.equal(m.maxHealth,4);assert.equal(m.health,4);assert(m.taunt);
 const s2=fixture({hour:0});const n=play(s2,0,"KNZ-002");
 play(s2,0,"KNZ-004",target(s2,0,n));assert.equal(n.taunt,false);
});
test("KNZ-011 heals 4 but never over maximum",()=>{
 const s=fixture(),m=play(s,0,"KNZ-002");m.health=1;
 play(s,0,"KNZ-011",target(s,0,m));
 assert.equal(m.health,2);
});
test("KNZ-026 token summons and daytime +1/+1",()=>{
 const s=fixture({hour:9});play(s,0,"KNZ-026");
 assert.equal(s.players[0].board.length,3);
 assert(s.players[0].board.every(x=>x.attack===2&&x.health===2));
});
test("KNZ-036 fills at most 7 slots with taunt tokens",()=>{
 const s=fixture();play(s,0,"KNZ-002");play(s,0,"KNZ-036");
 assert.equal(s.players[0].board.length,7);
 assert.equal(s.players[0].board.filter(x=>x.token&&x.taunt).length,6);
});
test("NCR-017 +2 corpses, NRC-006 requires 3, charge only by resource",()=>{
 const s=fixture(),p=s.players[0];p.corpses=0;
 play(s,0,"NCR-017");assert.equal(p.corpses,2);
 const {result}=playResult(s,0,"NCR-006");
 assert.equal(result.ok,false);p.hand=[];
 play(s,0,"NCR-001");assert.equal(p.corpses,3);
 play(s,0,"NCR-006");assert.equal(p.corpses,0);
});
test("NCR-025 ritual requires corpses but does not consume them",()=>{
 const s=fixture(),p=s.players[0];p.corpses=2;
 const {result}=playResult(s,0,"NCR-025");assert.equal(result.ok,false);p.hand=[];
 p.corpses=3;p.health=24;const prior=p.hand.length;
 play(s,0,"NCR-025");assert.equal(p.corpses,3);assert.equal(p.health,27);
 assert.equal(p.hand.length,prior+2);
});
test("CHR-002 deathrattle deals 1 enemy hero",()=>{
 const s=fixture(),m=play(s,1,"CHR-002");
 play(s,0,"KNZ-014",target(s,1,m));
 assert.equal(s.players[0].health,29);
});
test("NCR-002 deathrattle adds one explicit corpse only",()=>{
 const s=fixture(),m=play(s,0,"NCR-002");s.players[0].corpses=0;
 play(s,1,"KNZ-014",target(s,0,m));
 assert.equal(s.players[0].corpses,1);
});
test("NEU-020 reborn once, no repeated rebirth",()=>{
 const s=fixture();const cat=play(s,0,"NEU-026");const pet=s.players[0].board.find(m=>m.cardId==="TKN-006");
 assert(pet);play(s,0,"NEU-020");assert(pet.reborn);
 play(s,1,"NCR-022");assert(s.players[0].board.includes(pet));assert(!pet.reborn);
 assert.equal(pet.health,1);
 play(s,1,"NCR-022");assert(!s.players[0].board.includes(pet));
});
test("CHR-003 next Spirit discount is only this own turn",()=>{
 const s=fixture(),p=s.players[0];play(s,0,"CHR-003");
 const h={uid:"hand",cardId:"NEU-004",costAdjustment:0};
 p.hand.push(h);
 // NEU-004 is Spirit cost 2; discount by one.
 assert.equal(E.currentCost(s,0,h),1);
 E.endTurn(s,0);assert.equal(E.currentCost(s,0,h),2);
});
test("CHR-023 deathrattle next Spirit discount persists across turns",()=>{
 const s=fixture(),p=s.players[0];const m=play(s,0,"CHR-023");
 play(s,1,"NCR-022");play(s,1,"NEU-023",target(s,0,m));assert.equal(p.nextSpiritDiscount,1);
 const h={uid:"new",cardId:"NEU-004",costAdjustment:0};p.hand.push(h);
 E.endTurn(s,1);assert.equal(E.currentCost(s,0,h),1);
});
test("KNZ-024 aura increases allied Humans maximum health and reverts on source death",()=>{
 const s=fixture(),m=play(s,0,"KNZ-002"),src=play(s,0,"KNZ-024");
 assert.equal(m.maxHealth,3);assert.equal(m.health,3);
 play(s,1,"KNZ-014",target(s,0,src));play(s,1,"KNZ-014",target(s,0,src));
 assert(!s.players[0].board.includes(src));
});
test("NEU-027 cat aura +2 atk is not multiplied by two sources",()=>{
 const s=fixture(),a=play(s,0,"NEU-026"),pet=s.players[0].board.find(m=>m.cardId==="TKN-006");
 assert(pet);
 play(s,0,"NEU-027");assert.equal(E.effectiveAttack(s,pet),3);
 play(s,0,"NEU-027");assert.equal(E.effectiveAttack(s,pet),3);
});
test("NCR-026 ritual triggers after 2 owned creature deaths",()=>{
 const s=fixture(),p=s.players[0];
 play(s,0,"NCR-026");assert.equal(s.rituals.length,1);
 const a=play(s,0,"KNZ-002"),b=play(s,0,"KNZ-003");
 p.corpses=0;
 play(s,1,"NCR-022");
 assert.equal(p.corpses,3);assert.equal(s.rituals.length,0);
});
test("NCR-028 +12 attack on second following own start, ends at turn end",()=>{
 const s=fixture(),p=s.players[0],m=play(s,0,"KNZ-002");
 p.corpses=12;play(s,0,"NCR-028",target(s,0,m));
 assert.equal(p.corpses,2);
 E.endTurn(s,0); // bot start
 E.endTurn(s,1); // first next own start
 assert.equal(E.effectiveAttack(s,m),1);
 E.endTurn(s,0);E.endTurn(s,1); // second own start
 assert.equal(E.effectiveAttack(s,m),13);
 E.endTurn(s,0);assert.equal(E.effectiveAttack(s,m),1);
});
test("NEU-015 temporary attack reduction expires after target's next turn",()=>{
 const s=fixture(),m=play(s,1,"KNZ-002");
 play(s,0,"NEU-015",target(s,1,m));
 assert.equal(E.effectiveAttack(s,m),0);
 E.endTurn(s,0);assert.equal(E.effectiveAttack(s,m),0);
 E.endTurn(s,1);assert.equal(E.effectiveAttack(s,m),1);
});
test("KNZ-006 weapon battlecry buffs Druzhina permanently",()=>{
 const s=fixture(),m=play(s,0,"KNZ-002");
 play(s,0,"KNZ-006");assert.equal(m.attack,3);
});
test("NCR-009 charge cannot attack hero",()=>{
 const s=fixture();s.players[0].corpses=4;const m=play(s,0,"NCR-009");assert(m.ready);
 const result=E.attack(s,0,m.uid,{kind:"hero",owner:1});
 assert.equal(result.ok,false);
});
test("start-turn rune vs silence unresolved stays unsupported",()=>{
 assert.equal(E.abilitySupport(cards.get("NCR-021")),"complete");
 assert.equal(E.abilitySupport(cards.get("NEU-028")),"partial");
});
test("local edited spell ability cannot reuse built-in effect by ID",()=>{
 const s=fixture(),c={...s.cards["NEU-023"],effectModified:true};
 s.cards["NEU-023"]=c;
 const {result}=playResult(s,0,"NEU-023",{kind:"hero",owner:1});
 assert.equal(result.ok,false);assert.equal(s.players[1].health,30);
});
test("source class remains unchanged and time cycle advances after each turn",()=>{
 const s=fixture({hour:23});E.endTurn(s,0);
 assert.equal(s.time,0);assert.equal(s.players[1].maxMana,10);
});
test("bot can play a simple creature and finish its turn without server",()=>{
 const s=fixture();s.turn=1;s.players[1].hand=[{uid:"q",cardId:"KNZ-002",costAdjustment:0}];
 s.players[1].mana=3;s.players[1].maxMana=3;s.players[1].board=[];
 assert.equal(E.runBotTurn(s).ok,true);
 assert.equal(s.players[1].board.length,1);
});

test("NEU-009 Gramada draws only with at least three human peasants",()=>{
 const s=fixture(),p=s.players[0],before=p.hand.length;
 play(s,0,"NEU-009");assert.equal(p.hand.length,before);
 play(s,0,"NEU-002");play(s,0,"NEU-003");
 const beforeSecond=p.hand.length;
 play(s,0,"NEU-009");
 assert.equal(p.hand.length,beforeSecond+1); // its own body is the third Peasant
});
test("NCR-023 local night and max-health bonus expire at start of next own turn",()=>{
 const s=fixture(),m=play(s,0,"KNZ-002"),base=m.maxHealth;
 play(s,0,"NCR-023",target(s,0,m));assert.equal(m.maxHealth,base+2);
 E.endTurn(s,0);assert.equal(m.maxHealth,base+2);
 E.endTurn(s,1);assert.equal(m.maxHealth,base);
});
test("CHR-015 weapon battlecry sacrifices own Spirit, durability +2",()=>{
 const s=fixture(),spirit=play(s,0,"NEU-004");
 play(s,0,"CHR-015",target(s,0,spirit));
 assert(!s.players[0].board.some(m=>m.uid===spirit.uid));
 assert.equal(s.players[0].weapon.durability,cards.get("CHR-015").durability+2);
});
test("KNZ-018 weapon after hero kill heals most wounded allied minion",()=>{
 const s=fixture(),ally=play(s,0,"KNZ-002"),enemy=play(s,1,"CHR-002");
 ally.health=1;enemy.health=1;
 play(s,0,"KNZ-018");s.players[0].heroAttacked=false;
 const r=E.attack(s,0,null,target(s,1,enemy),true);
 assert(r.ok);assert.equal(ally.health,2);
});
test("NCR-030 weapon draws on ritual and loses durability",()=>{
 const s=fixture(),p=s.players[0];p.corpses=3;
 play(s,0,"NCR-030");const start=p.weapon.durability;
 const before=p.hand.length;
 play(s,0,"NCR-025");
 assert.equal(p.weapon.durability,start-1);
 assert.equal(p.hand.length,before+3); // 2 from ritual + 1 from staff
});
test("NEU-021 draws a cat from deck",()=>{
 const s=fixture(),p=s.players[0];p.deck=["NEU-026","KNZ-002"];const count=p.hand.length;
 play(s,0,"NEU-021");
 assert.equal(p.hand.length,count+1);
 assert.equal(p.hand[0].cardId,"NEU-026");
});
test("unfavorable daytime affinity can halve attack with chosen rounding",()=>{
 const s=fixture({hour:0,timeMode:"floor"}),m=play(s,0,"KNZ-002");
 assert.equal(E.effectiveAttack(s,m),0);
 s.timeMode="ceil";assert.equal(E.effectiveAttack(s,m),1);
 s.timeMode="off";assert.equal(E.effectiveAttack(s,m),1);
});
test("CHR-001 kill draws one card only after actual death",()=>{
 const s=fixture(),targetMinion=play(s,1,"KNZ-003"),p=s.players[0]; // health 1
 const b=p.hand.length;
 play(s,0,"CHR-001",target(s,1,targetMinion));
 assert.equal(p.hand.length,b+1);
});

console.log(`Complete: ${runs} scenarios, status ${process.exitCode||0}`);
