const test=require('node:test'),assert=require('node:assert/strict');
global.window=global;
require('../card-catalog.js');
const E=require('../battle-engine.js'),D=require('../deck-model.js');
const snapshot=require('./fixtures/approved_three_decks_2026-11-18.json');
const catalog=new Map(MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
const legacyCatalog=new Map(catalog);
for(const card of snapshot.cards)legacyCatalog.set(card.cardId,{...catalog.get(card.cardId),...card});
function fixture(classId='Некромант',hour=21,legacy=false){
 const deck={classId,name:'functional fixture',counts:{'KNZ-002':30}};
 const s=E.makeGame(deck,deck,catalog,{seed:18,firstPlayer:0,hour,timeMode:'floor',heroProfiles:['approved-three-decks','approved-three-decks']});
 if(legacy)s.contentVersion='three-decks-2026-11-18';
 E.confirmMulligan(s,[]);s.cards={...Object.fromEntries(legacy?legacyCatalog:catalog),...E.TOKEN_DATA};
 for(const p of s.players){p.hand=[];p.deck=Array(50).fill('KNZ-002');p.mana=p.maxMana=10;}
 return s;
}
function cast(s,id,target=null,choices=null){
 const p=s.players[s.turn],h={uid:'test'+(++s.serial),cardId:id,costAdjustment:0};p.hand.push(h);p.mana=10;
 const result=E.playCard(s,s.turn,h.uid,target,choices);assert.equal(result.ok,true,id+': '+result.reason);return p.board.at(-1);
}
const own=m=>({kind:'minion',owner:0,uid:m.uid});
const enemy=m=>({kind:'minion',owner:1,uid:m.uid});
function kill(s,m){cast(s,'NCR-018',own(m));}
function choose(s,id){const h={uid:'choice'+(++s.serial),cardId:id,costAdjustment:0};s.players[0].hand.push(h);s.players[0].mana=10;const spec=E.actionStatus(s,0,h.uid);assert.equal(spec.ok,true,spec.reason);return {h,choices:E.botChoices(spec.choice)};}
test('all three approved deck compositions validate against the current library',()=>{
 for(const deck of MW_APPROVED_EXAMPLE_DECKS){assert.equal(D.validateDeck(deck,catalog).ok,true);assert.equal(Object.values(deck.counts).reduce((a,b)=>a+b,0),30);for(const id of Object.keys(deck.counts))assert.equal(E.abilitySupport(catalog.get(id)),'complete',id);}
});
test('test profile assigns the approved heroes without granting campaign powers',()=>{
 for(const [cls,name,armor]of [['Воин','Рагвалод',10],['Чернокнижник','Велімір',0],['Некромант','Чернобог',0]]){const s=fixture(cls);assert.equal(s.players[0].heroName,name);assert.equal(s.players[0].health,30);assert.equal(s.players[0].armor,armor);s.players[0].heroProfile='campaign';assert.equal(E.heroPowerStatus(s,0).ok,false);}
});
test('Velimir day armor costs two mana; switching day/night does not reset shared limit',()=>{
 const s=fixture('Чернокнижник',12),p=s.players[0];assert.equal(E.useHeroPower(s,0).ok,true);assert.equal(p.mana,8);assert.equal(p.armor,2);s.time=21;assert.equal(E.useHeroPower(s,0,{kind:'hero',owner:1}).ok,false);
});
test('Velimir drain rejects own targets without payment, heals fixed one on actual damage',()=>{
 const s=fixture('Чернокнижник'),p=s.players[0];p.health=20;
 assert.equal(E.useHeroPower(s,0,{kind:'hero',owner:0}).ok,false);assert.equal(p.mana,10);assert.equal(p.heroPowerUsed,false);
 assert.equal(E.useHeroPower(s,0,{kind:'hero',owner:1}).ok,true);assert.equal(p.health,21);assert.equal(s.players[1].health,29);assert.equal(p.mana,8);
});
test('blocked drain damage grants no healing',()=>{
 const s=fixture('Чернокнижник'),p=s.players[0];p.health=20;s.players[1].invulnerable=true;assert.equal(E.useHeroPower(s,0,{kind:'hero',owner:1}).ok,true);assert.equal(p.health,20);
});
test('Idol is canonical Construct/Night and only shades immediate friendly neighbours',()=>{
 const s=fixture('Некромант',12),p=s.players[0];assert.equal(E.useHeroPower(s,0).ok,true);const idol=p.board[0];assert.equal(idol.cardId,'TKN-010');assert.equal(idol.creatureType,'Конструкт');assert.equal(idol.affinity,'Ноч');assert.equal(idol.taunt,true);
 const first=cast(s,'NCR-005'),far=cast(s,'NCR-005');assert.equal(E.localBright(s,first),false);assert.equal(E.localBright(s,far),true);assert.equal(E.effectiveAttack(s,first),2);assert.equal(E.effectiveAttack(s,far),1);assert.equal(s.time,12);
 idol.silenced=true;assert.equal(E.localBright(s,first),true);idol.silenced=false;E.returnToHand(s,0,idol.uid);assert.equal(E.localBright(s,first),true);
});
test('Chernobog dead token has canonical ID, charge, expires and yields one corpse',()=>{
 const s=fixture(),p=s.players[0];assert.equal(E.useHeroPower(s,0).ok,true);const m=p.board[0];assert.equal(m.cardId,'TKN-011');assert.equal(m.creatureType,'Нежыць');assert.equal(m.ready,true);E.endTurn(s,0);assert.equal(p.board.length,0);assert.equal(p.corpses,1);assert.equal(p.graveyard[0].token,true);
});
test('full board rejects hero summon without mana or power use',()=>{
 const s=fixture('Некромант',12),p=s.players[0];for(let i=0;i<7;i++)cast(s,'NCR-005');const before=p.mana;assert.equal(E.useHeroPower(s,0).ok,false);assert.equal(p.mana,before);assert.equal(p.heroPowerUsed,false);
});
test('corpse-priced creature spends corpses instead of mana and gives no base corpse',()=>{
 const s=fixture(),p=s.players[0];p.corpses=3;const m=cast(s,'NCR-006');assert.equal(p.corpses,0);assert.equal(p.mana,10);kill(s,m);assert.equal(p.corpses,0);assert.equal(p.graveyard.length,1);
});
test('normal death plus explicit deathrattle grants two corpses',()=>{
 const s=fixture(),p=s.players[0];kill(s,cast(s,'NCR-002'));assert.equal(p.corpses,2);assert.deepEqual(p.corpseLedger.map(x=>x.amount),[1,1]);
});
test('resurrection for corpses preserves no-base-corpse but permits explicit extra deathrattle',()=>{
 const s=fixture(),p=s.players[0];kill(s,cast(s,'NCR-002'));p.corpses=6;
 const {h,choices}=choose(s,'NCR-027');assert.equal(E.playCard(s,0,h.uid,null,choices).ok,true);const revived=p.board[0];assert.equal(revived.summonedWithCorpses,true);assert.equal(p.corpses,1);assert.equal(p.graveyard.length,0);kill(s,revived);assert.equal(p.corpses,2);
});
test('Prarodzitca fills on each own end, not on opponent end, and never overfills',()=>{
 const s=fixture('Чернокнижник'),p=s.players[0],mother=cast(s,'CHR-045');E.endTurn(s,0);assert.equal(p.board.length,7);assert(p.board.filter(m=>m!==mother).every(m=>m.cardId==='TKN-009'&&m.health===2&&!m.ready));p.board.pop();E.endTurn(s,1);assert.equal(p.board.length,6);E.endTurn(s,0);assert.equal(p.board.length,7);
});
test('silence or source leaving disables Prarodzitca end trigger',()=>{
 for(const how of ['silence','return']){const s=fixture('Чернокнижник'),m=cast(s,'CHR-045');if(how==='silence')m.silenced=true;else E.returnToHand(s,0,m.uid);E.endTurn(s,0);assert.equal(s.players[0].board.length,how==='silence'?1:0);}
});
test('Roi summons distinct 1/1 tokens without collectible Swarm/Rush abilities',()=>{
 const s=fixture('Чернокнижник');cast(s,'CHR-044');assert.equal(s.players[0].board.length,3);for(const m of s.players[0].board){assert.equal(m.cardId,'TKN-008');assert.equal(E.effectiveAttack(s,m),1);assert.equal(m.ready,false);}
});
test('Kasny gain conditional attack and Naсisk, but cannot attack hero on summon turn',()=>{
 const s=fixture('Чернокнижник'),m=cast(s,'CHR-029');assert.equal(E.effectiveAttack(s,m),1);assert.equal(m.ready,false);cast(s,'CHR-039');assert.equal(E.effectiveAttack(s,m),2);assert.equal(m.ready,true);assert.equal(E.attack(s,0,m.uid,{kind:'hero',owner:1}).ok,false);s.turn=1;const foe=cast(s,'KNZ-002');s.turn=0;assert.equal(E.attack(s,0,m.uid,enemy(foe)).ok,true);
});
test('Kashchei produces needle; needle revives base Kashchei without another deathrattle',()=>{
 const s=fixture(),p=s.players[0];kill(s,cast(s,'NCR-015'));assert(p.hand.some(h=>h.cardId==='TKN-007'));const needle=p.hand.find(h=>h.cardId==='TKN-007');const spec=E.actionStatus(s,0,needle.uid);assert.equal(spec.ok,true);assert.equal(E.playCard(s,0,needle.uid,null,E.botChoices(spec.choice)).ok,true);const revived=p.board[0];assert.equal(revived.noDeathrattle,true);assert.equal(revived.health,8);kill(s,revived);assert.equal(p.hand.some(h=>h.cardId==='TKN-007'),false);
});
test('three waiting rituals block a fourth without payment, immediate rituals remain legal',()=>{
 const s=fixture(),p=s.players[0];for(let i=0;i<3;i++)cast(s,'NCR-026');const h={uid:'fourth',cardId:'NCR-026',costAdjustment:0};p.hand.push(h);const before=p.mana;assert.equal(E.playCard(s,0,h.uid).ok,false);assert.equal(p.mana,before);assert(p.hand.includes(h));p.corpses=3;cast(s,'NCR-025');assert.equal(p.corpses,0);
});
test('Legacy Great Vigil tracks exact instance and cancels on return, not a later new summon',()=>{
 const s=fixture('Некромант',21,true),p=s.players[0],m=cast(s,'NCR-005');p.corpses=10;cast(s,'NCR-028',own(m));assert.equal(s.scheduled.filter(x=>x.ritual).length,1);E.returnToHand(s,0,m.uid);assert.equal(s.scheduled.filter(x=>x.ritual).length,0);const next=cast(s,'NCR-005');E.endTurn(s,0);E.endTurn(s,1);E.endTurn(s,0);E.endTurn(s,1);assert.equal(next.attack,2);
});
test('Legacy Great Vigil resolves at second next own start and survives save/restore',()=>{
 let s=fixture('Некромант',21,true),p=s.players[0],m=cast(s,'NCR-005');p.corpses=10;cast(s,'NCR-028',own(m));s=E.importBattle(E.exportBattle(s));p=s.players[0];m=p.board[0];E.endTurn(s,0);E.endTurn(s,1);assert.equal(E.effectiveAttack(s,m),2);E.endTurn(s,0);E.endTurn(s,1);assert.equal(E.effectiveAttack(s,m),14);E.endTurn(s,0);assert.equal(E.effectiveAttack(s,m),2);
});
test('dragon excludes itself, hits both heroes and sets both hands on fire',()=>{
 const s=fixture('Воин',12),p=s.players[0];p.hand.push({uid:'victim',cardId:'KNZ-002',costAdjustment:0});s.players[1].hand.push({uid:'enemy',cardId:'KNZ-002',costAdjustment:0});const m=cast(s,'NEU-028');assert.equal(m.health,10);assert.equal(p.armor,5);assert.equal(s.players[1].armor,5);assert.equal(p.hand[0].burnTurnsLeft,2);assert.equal(s.players[1].hand[0].burnTurnsLeft,2);assert.equal(p.discarded.length,0);
});
test('spell damage doubles against an unfavourable creature before armor',()=>{
 const s=fixture('Чернокнижник',12),m=cast(s,'CHR-041');m.armor=1;cast(s,'NEU-023',own(m));assert.equal(m.armor,0);assert.equal(m.health,4);
});
test('six ordered deck matchups remain serializable with legal board/resource limits',()=>{
 for(const a of MW_APPROVED_EXAMPLE_DECKS)for(const b of MW_APPROVED_EXAMPLE_DECKS)if(a!==b){let s=E.makeGame(a,b,catalog,{seed:18,firstPlayer:0,hour:17,timeMode:'floor',heroProfiles:['approved-three-decks','approved-three-decks']});E.confirmMulligan(s,[]);for(let i=0;i<40&&s.phase==='battle';i++){const owner=s.turn;E.runBotTurn(s,owner);if(s.phase==='battle'&&s.turn===owner)E.endTurn(s,owner);for(const p of s.players){assert(p.board.length<=7);assert(p.hand.length<=10);assert(p.corpses>=0);assert(p.mana>=0);}if(i===10)s=E.importBattle(E.exportBattle(s));}}
});
test('Kanapelka weakens only the next enemy turn, including creatures summoned during it',()=>{
 const s=fixture('Воин',12);s.turn=1;const old=cast(s,'KNZ-030');s.turn=0;cast(s,'NEU-033');assert.equal(E.effectiveAttack(s,old),4);E.endTurn(s,0);assert.equal(E.effectiveAttack(s,old),2);const fresh=cast(s,'KNZ-030');assert.equal(E.effectiveAttack(s,fresh),2);E.endTurn(s,1);assert.equal(s.players[1].turnAttackReduction,0);
});
test('Striga plays without an enemy target, but rejects an explicitly invalid target before paying',()=>{
 const s=fixture(),p=s.players[0];cast(s,'NCR-010');const h={uid:'bad-target',cardId:'NCR-010',costAdjustment:0};p.hand.push(h);p.mana=10;assert.equal(E.playCard(s,0,h.uid,{kind:'minion',owner:1,uid:'missing'}).ok,false);assert.equal(p.mana,10);assert(p.hand.includes(h));
});
test('old content snapshots are rejected without mutation instead of silently changing rules',()=>{
 const saved=E.exportBattle(fixture());delete saved.game.contentVersion;const before=JSON.stringify(saved);assert.throws(()=>E.importBattle(saved),/другой версии/);assert.equal(JSON.stringify(saved),before);
});
test('Hungry Kasna heals actual combat damage and gains Swarm stats after killing',()=>{
 const s=fixture('Чернокнижник'),p=s.players[0];p.health=20;const m=cast(s,'CHR-040');cast(s,'CHR-039');m.ready=true;s.turn=1;const foe=cast(s,'KNZ-002');s.turn=0;assert.equal(E.attack(s,0,m.uid,enemy(foe)).ok,true);assert.equal(p.health,22);assert.equal(m.attack,4);assert.equal(m.maxHealth,3);
});
test('Enraged Kasna gains attack only on first survived damage per turn with Swarm',()=>{
 const s=fixture('Чернокнижник'),m=cast(s,'CHR-041');cast(s,'CHR-039');cast(s,'NEU-023',own(m));assert.equal(m.attack,4);cast(s,'NEU-023',own(m));assert.equal(m.attack,4);E.endTurn(s,0);s.turn=0;cast(s,'NEU-023',own(m));assert.equal(m.attack,5);
});
test('staff draws a ritual and loses durability at the start of its owner’s turn',()=>{
 const s=fixture(),p=s.players[0];
 cast(s,'NCR-030');p.deck.splice(1,0,'NCR-026');
 cast(s,'NCR-026');assert.equal(p.hand.length,0);assert.equal(p.weapon.durability,3);
 kill(s,cast(s,'NCR-005'));kill(s,cast(s,'NCR-005'));
 assert.equal(s.rituals.length,0);assert.equal(p.corpses,5);assert.equal(p.weapon.durability,3);
 E.endTurn(s,0);E.endTurn(s,1);
 assert.equal(p.weapon.durability,2);assert(p.hand.some(h=>h.cardId==='NCR-026'));
});
test('Great Vigil survives save and buffs the current friendly board on the second own start',()=>{
 let s=fixture(),p=s.players[0],initial=cast(s,'NCR-005');
 p.corpses=10;cast(s,'NCR-028');assert.equal(s.scheduled.length,1);
 E.returnToHand(s,0,initial.uid);
 cast(s,'NCR-005');cast(s,'NCR-005');
 s=E.importBattle(E.exportBattle(s));p=s.players[0];
 E.endTurn(s,0);E.endTurn(s,1);assert.deepEqual(p.board.map(m=>m.attack),[2,2]);
 E.endTurn(s,0);E.endTurn(s,1);assert.deepEqual(p.board.map(m=>m.attack),[4,4]);
 assert.equal(s.scheduled.length,0);
});
test('simultaneous creature deaths credit only each controlling side',()=>{
 const s=fixture();cast(s,'NCR-005');s.turn=1;cast(s,'NCR-005');s.turn=0;cast(s,'NCR-022');assert.equal(s.players[0].corpses,1);assert.equal(s.players[1].corpses,1);assert.equal(s.players[0].graveyard.length,1);assert.equal(s.players[1].graveyard.length,1);
});
