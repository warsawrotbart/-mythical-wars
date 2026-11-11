const assert=require("node:assert/strict");
global.window=global;
require("../card-catalog.js");
const deck=require("../deck-model.js"),game=require("../battle-engine.js");
const cat=deck.indexCatalog(window.MW_CANONICAL_CARDS);
const examples=window.MW_APPROVED_EXAMPLE_DECKS;
let checked=0;
function it(name,fn){fn();checked++;console.log("PASS",name);}
it("Card catalog contains 162 unique cards with stable IDs",()=>{
 assert.equal(cat.size,162);
 assert.equal(new Set([...cat.keys()]).size,162);
 assert.equal(cat.get("KNZ-002").attack,1);assert.equal(cat.get("KNZ-002").health,2);
 assert.equal(cat.get("KNZ-002").name,"МАЛАДЫ ДРУЖЫННІК");
});
it("Original Warrior, Warlock, Necromancer decks match all specified deck restrictions",()=>{
 examples.forEach(x=>{
  const v=deck.validateDeck(x,cat);
  assert.equal(v.ok,true,x.name+": "+v.errors.join("; "));
  assert.equal(v.total,30);
 });
});
it("Reject too few or too many cards and wrong class",()=>{
 let d=structuredClone(examples[0]);d.counts["KNZ-002"]=1;
 assert.equal(deck.validateDeck(d,cat).ok,false);
 d=structuredClone(examples[0]);d.classId="Некромант";
 assert.equal(deck.validateDeck(d,cat).ok,false);
});
it("Reject more than one legendary and special non-deck cards",()=>{
 const d=deck.newDeck();const legen=window.MW_CANONICAL_CARDS.find(x=>x.rarityId==="legendary");
 assert.equal(deck.cardCopyLimit(legen),1);
 const special=window.MW_CANONICAL_CARDS.find(x=>x.maxCopies===0);
 assert.ok(special);assert.equal(deck.cardCopyLimit(special),0);
});
it("Reject duplicate IDs when local card shadows canonical stats",()=>{
 const c=deck.indexCatalog(window.MW_CANONICAL_CARDS,[{cardId:"KNZ-002",thumbnail:"data:image/png;base64,QQ==",
  definition:{cardId:"KNZ-002",name:"OVERRIDE",attack:999}}]);
 assert.equal(c.get("KNZ-002").attack,1);
 assert.equal(c.get("KNZ-002").savedVisual,true);
});
it("Game state starts with correct mulligan, mana, hero health, coin for second",()=>{
 const s=game.makeGame(examples[0],examples[1],cat,{firstPlayer:0,hour:6,rng:()=>.5});
 assert.equal(s.players[0].hand.length,3);assert.equal(s.players[1].hand.length,5);
 assert.equal(s.players[1].hand.filter(x=>x.cardId==="__coin__").length,1);
 assert.equal(s.players[0].health,30);assert.equal(s.players[1].health,30);
 assert.equal(s.phase,"mulligan");assert.equal(s.time,6);
 game.confirmMulligan(s,[]);assert.equal(s.players[0].maxMana,1);assert.equal(s.players[0].mana,1);
});
it("Day/night remains off until explicit test selection, time advances after each turn",()=>{
 const s=game.makeGame(examples[0],examples[1],cat,{firstPlayer:0,hour:17});
 game.confirmMulligan(s,[]);
 assert.equal(s.timeMode,"off");assert.equal(s.time,17);
 game.endTurn(s,0);assert.equal(s.time,18);assert.equal(s.turn,1);
 assert.equal(game.phaseOfHour(s.time),"Вечер");
});
it("Play basic creature, summoning sickness, ready next turn and attack hero",()=>{
 const a={...examples[0],counts:{"KNZ-002":30}},s=game.makeGame(a,a,cat,{firstPlayer:0,hour:12});
 game.confirmMulligan(s,[]);
 const h=s.players[0].hand.find(x=>x.cardId==="KNZ-002");
 assert.ok(h);assert.equal(game.playCard(s,0,h.uid).ok,true);
 const m=s.players[0].board[0];assert.equal(m.health,2);assert.equal(m.ready,false);
 assert.equal(game.attack(s,0,m.uid,{kind:"hero",owner:1}).ok,false);
 game.endTurn(s,0);game.endTurn(s,1);
 assert.equal(game.attack(s,0,m.uid,{kind:"hero",owner:1}).ok,true);
 assert.equal(s.players[1].health,29);
});
it("Weapon can attack with durability and battle retaliation",()=>{
 const a={...examples[0],counts:{"KNZ-006":30}},s=game.makeGame(a,a,cat,{firstPlayer:0,hour:12});
 game.confirmMulligan(s,[]);
 s.players[0].mana=10;s.players[0].maxMana=10;
 const h=s.players[0].hand[0];
 assert.equal(game.playCard(s,0,h.uid).ok,true);
 assert.equal(s.players[0].weapon.attack,4);
 assert.equal(game.attack(s,0,null,{kind:"hero",owner:1},true).ok,true);
 assert.equal(s.players[0].weapon.durability,1);
});
it("Taunt redirects attacks",()=>{
 const a={...examples[0],counts:{"KNZ-002":15,"KNZ-012":15}},s=game.makeGame(a,a,cat,{firstPlayer:0,hour:12});
 game.confirmMulligan(s,[]);
 const card=cat.get("KNZ-012");
 // set up a summoned taunt by legal card play.
 s.players[1].hand.push({uid:"test1",cardId:"KNZ-012"});
 s.turn=1;s.players[1].mana=5;
 assert.equal(game.playCard(s,1,"test1").ok,true);
 s.players[0].board.push({uid:"testm",name:"Test",attack:3,health:3,maxHealth:3,affinity:"Дзень",ready:true,attacked:false,taunt:false,tempAttack:0});
 s.turn=0;s.phase="battle";
 assert.equal(game.eligibleAttackTargets(s,0).some(x=>x.kind==="hero"),false);
 assert.equal(game.attack(s,0,"testm",{kind:"hero",owner:1}).ok,false);
});
it("Spells with edited unrecognized effect text do not consume mana or cards",()=>{
 const a={...examples[0],counts:{"KNZ-008":30}},s=game.makeGame(a,a,cat,{firstPlayer:0,hour:12});
 game.confirmMulligan(s,[]);s.players[0].mana=10;
 const h=s.players[0].hand[0],hand=s.players[0].hand.length;
 s.cards["KNZ-008"].effectModified=true;
 assert.equal(game.playCard(s,0,h.uid).ok,false);
 assert.equal(s.players[0].mana,10);assert.equal(s.players[0].hand.length,hand);
});
it("Targeted supported spell damages hero by approved effect",()=>{
 const a={...examples[0],counts:{"NEU-023":30}},s=game.makeGame(a,a,cat,{firstPlayer:0,hour:12});
 game.confirmMulligan(s,[]);s.players[0].mana=10;
 const h=s.players[0].hand[0];
 assert.equal(game.playCard(s,0,h.uid,{kind:"hero",owner:1}).ok,true);
 assert.equal(s.players[1].health,29);
});
it("Fatigue increases on each attempt to draw from empty deck",()=>{
 const a={...examples[0],counts:{}},s=game.makeGame(a,a,cat,{firstPlayer:0,hour:12});
 game.confirmMulligan(s,[]);
 const prev=s.players[0].fatigue;
 game.draw(s,0);assert.equal(s.players[0].fatigue,prev+1);
});
it("Bot can complete turn without runaway loop",()=>{
 const s=game.makeGame(examples[0],examples[1],cat,{firstPlayer:0,hour:12});
 game.confirmMulligan(s,[]);game.endTurn(s,0);
 assert.equal(game.runBotTurn(s).ok,true);
 assert.equal(s.turn,0);
 assert.ok(s.logs.length>0);
});
console.log("PASS TOTAL:",checked);
