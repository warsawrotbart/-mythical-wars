/* Мифические войны — автономный тестовый бой v2.1A.
 * ИСТОЧНИКИ: Библиотека карт.xlsx (лист Карты/Токены), правила v0.4.
 * Неутверждённые порядки одновременных триггеров и правила трупов не выдумываются.
 * Список действительно реализованных эффектов явный; остальные помечены.
 * Движок не зависит от Unity, сети и случайных внешних сервисов.
 */
(function(root,factory){
 const exported=factory();
 root.MW_GAME_ENGINE=exported;
 if(typeof module!=="undefined"&&module.exports)module.exports=exported;
})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const APPROVED=typeof module!=="undefined"&&module.exports?require("./approved-test-content.js"):globalThis.MW_APPROVED_TEST_CONTENT;
if(!APPROVED)throw Error("Missing approved-test-content.js");
// Ephemeral observers never enter saves, replay checksums or RNG state.
const movementSinks=new WeakMap();
function captureCardMovements(s){
 const items=[],previous=movementSinks.get(s);movementSinks.set(s,items);
 return {items,close(){if(previous)movementSinks.set(s,previous);else movementSinks.delete(s);}};
}
function addHandCard(s,o,card,source="created"){
 const p=player(s,o);if(p.hand.length>=10)return discardCard(s,o,card.cardId,"overflow",source);p.hand.push(card);
 movementSinks.get(s)?.push({owner:o,source,uid:card.uid,cardId:card.cardId,
  index:p.hand.length-1,handCount:p.hand.length,deckCount:p.deck.length});
 return true;
}
// A discard is never a death: no graveyard entry, corpse or deathrattle.
function discardCard(s,o,cardId,reason,source){
 const p=player(s,o);(p.discarded||(p.discarded=[])).push({cardId,reason,source});
 combatEvent(s,"cardDiscarded",{owner:o,cardId,reason,zoneSource:source,deckCount:p.deck.length,handCount:p.hand.length});
 log(s,reason==="overflow"?"Переполнение руки: карта сброшена.":"Карта сброшена: "+reason+".");return false;
}
// Zone primitive only. Does not enable an unapproved prototype card.
function returnToHand(s,o,instanceUid){return resolveAction(s,()=>{
 const p=player(s,o),index=p.board.findIndex(m=>m.uid===instanceUid);if(index<0)return false;
 const [m]=p.board.splice(index,1);syncAuras(s);
 combatEvent(s,"creatureReturned",{owner:o,instance:{uid:m.uid,cardId:m.cardId},index});
 const received=addHandCard(s,o,{uid:uid(s),cardId:m.cardId,costAdjustment:0},"return");removeDead(s);return received;
});}
// T10–T13: ephemeral causal combat trace. No hidden zones, save fields or RNG.
const combatSinks=new WeakMap(),minionStates=new WeakMap(),resolutionDepth=new WeakMap(),deathResolvers=new WeakMap();
function combatSnapshot(s){return {time:s.time,turn:s.turn,turns:s.turns,phase:s.phase,players:s.players.map(p=>({health:p.health,armor:p.armor,
 mana:p.mana,maxMana:p.maxMana,heroAttacked:p.heroAttacked,heroPowerUsed:p.heroPowerUsed,
 weapon:clean(p.weapon),board:clean(p.board)}))};}
function captureCombat(s,source=null){
 const previous=combatSinks.get(s),sink={items:[],source,group:null};combatSinks.set(s,sink);
 for(const p of s.players)for(const m of p.board)minionStates.set(m,s);
 return {items:sink.items,close(){if(previous)combatSinks.set(s,previous);else combatSinks.delete(s);}};
}
function combatEvent(s,type,payload={}){
 const sink=combatSinks.get(s);if(!sink)return;
 const item={type,source:clean(sink.source),...clean(payload)};
 if(sink.group){sink.group.push(item);return;}
 sink.items.push({...item,snapshot:combatSnapshot(s)});
}
function combatBatch(s,kind,fn){
 const sink=combatSinks.get(s);if(!sink||sink.group)return fn();
 sink.group=[];try{return fn();}finally{const changes=sink.group;sink.group=null;
  if(changes.length)combatEvent(s,"impactBatch",{kind,changes});}
}
function combatCause(s,source,fn){const sink=combatSinks.get(s);if(!sink)return fn();
 const before=sink.source;sink.source=source;try{return fn();}finally{sink.source=before;}}
function resolveAction(s,fn){
 resolutionDepth.set(s,(resolutionDepth.get(s)||0)+1);
 try{return fn();}finally{const depth=resolutionDepth.get(s)-1;
  if(depth)resolutionDepth.set(s,depth);else{resolutionDepth.delete(s);checkEnd(s);}}
}
function weaponEvent(s,o,before,reason){
 const after=player(s,o).weapon;
 if(JSON.stringify(before)!==JSON.stringify(after))combatEvent(s,"weaponChanged",{owner:o,before,after,reason});
}
function attack(s,...args){return resolveAction(s,()=>attackResolved(s,...args));}
function playCard(s,...args){return resolveAction(s,()=>playCardResolved(s,...args));}
function useHeroPower(s,...args){return resolveAction(s,()=>useHeroPowerResolved(s,...args));}
const SPELL_IDS=[
 "KNZ-001","KNZ-004","KNZ-011","KNZ-014","KNZ-026","KNZ-031","KNZ-036","KNZ-038",
 "CHR-001","CHR-003","CHR-005","CHR-008","CHR-010","CHR-018","CHR-025","CHR-037",
 "NEU-013","NEU-015","NEU-016","NEU-018","NEU-020","NEU-021","NEU-023",
 "NCR-017","NCR-018","NCR-019","NCR-020","NCR-021","NCR-022","NCR-023","NCR-024","NCR-025","NCR-026","NCR-027","NCR-028",
 "KNZ-008","KNZ-009","KNZ-015","KNZ-016","KNZ-020","CHR-014","CHR-021","NEU-014","NEU-017","CHR-038","CHR-044"
];
const CREATURE_IDS=[
 "KNZ-005","KNZ-013","KNZ-017","KNZ-019","KNZ-023","KNZ-024","KNZ-027","KNZ-028","KNZ-034","KNZ-035",
 "CHR-002","CHR-004","CHR-007","CHR-012","CHR-013","CHR-016","CHR-020","CHR-023","CHR-024","CHR-030","CHR-032","CHR-033","CHR-034","CHR-035","CHR-036",
 "NEU-003","NEU-004","NEU-005","NEU-006","NEU-007","NEU-009","NEU-010","NEU-019",
 "NEU-001","NEU-024","NEU-025","NEU-026","NEU-027","NEU-029",
 "NEU-045","NEU-046","NEU-047","NEU-048","NEU-049",
 "ZAV-001","ZAV-002","ZAV-003","ZAV-004","ZAV-005","NEU-031","NEU-034","NEU-035","NEU-036","NEU-037","NEU-038","NEU-039","NEU-041","NEU-042","NEU-043","NEU-044",
 "NCR-001","NCR-002","NCR-003","NCR-004","NCR-007","NCR-008","NCR-009","NCR-010","NCR-011","NCR-013","NCR-014","KNZ-010","KNZ-022","KNZ-007","CHR-031",
 "CHR-029","CHR-039","CHR-040","CHR-041","CHR-045","NCR-015","NEU-033","NEU-028"
];
const WEAPON_IDS=[
 "KNZ-006","KNZ-018","KNZ-021","KNZ-029","KNZ-032","KNZ-033",
 "NEU-011","NEU-012","CHR-006","CHR-011","CHR-015","CHR-019","NCR-029","NCR-030"
];
const SUPPORTED_SPELLS=new Set(SPELL_IDS);
SUPPORTED_SPELLS.add("TKN-007");
const SUPPORTED_CREATURES=new Set(CREATURE_IDS);
const SUPPORTED_WEAPONS=new Set(WEAPON_IDS);
const PURE_ABILITIES=new Set(["","Правакацыя.","Правакацыя","Рывок.","Рывок","Маскіроўка.","Маскіроўка"]);
const TARGETS={
 "KNZ-001":"own-human","KNZ-004":"any-human","KNZ-011":"own-minion","KNZ-014":"enemy-minion","KNZ-038":"enemy-minion",
 "CHR-001":"any-minion","CHR-008":"own-minion","CHR-025":"own-minion",
 "NEU-013":"own-peasant","NEU-015":"enemy-minion","NEU-023":"any",
 "NCR-018":"own-minion","NCR-019":"enemy-minion","NCR-020":"any-minion",
 "NCR-023":"own-minion","NCR-024":"enemy-weak",
 "KNZ-017":"own-minion","CHR-024":"enemy-minion","CHR-036":"enemy-minion","NCR-010":"enemy-minion",
 "CHR-015":"own-minion","KNZ-037":"own-minion","ZAV-005":"enemy-minion","CHR-031":"enemy-minion",
 "NEU-048":"any"
};
const TOKENS={
 "TKN-001":{cardId:"TKN-001",name:"ДРУЖЫННІК",cardType:"creature",attack:1,health:1,timeAffinityId:"Дзень",creatureTypeId:"Чалавек",subtype:"Дружыннік",ability:"",origin:"token"},
 "TKN-002":{cardId:"TKN-002",name:"МАЛЫ ЗЛЫДЗЕНЬ",cardType:"creature",attack:1,health:1,timeAffinityId:"Ноч",creatureTypeId:"Дух",subtype:"Злыдзень",ability:"",origin:"token"},
 "TKN-003":{cardId:"TKN-003",name:"ЦЕНЬ",cardType:"creature",attack:2,health:2,timeAffinityId:"Ноч",creatureTypeId:"Дух",subtype:"Цень",ability:"",origin:"token"},
 "TKN-004":{cardId:"TKN-004",name:"СЕЛЯНІН",cardType:"creature",attack:1,health:1,timeAffinityId:"Дзень",creatureTypeId:"Чалавек",subtype:"Селянін",ability:"",origin:"token"},
 "TKN-006":{cardId:"TKN-006",name:"ХАТНІ КОТ",cardType:"creature",attack:1,health:1,timeAffinityId:"Ноч",creatureTypeId:"Звер",subtype:"Кот",ability:"",origin:"token"}
};
Object.assign(TOKENS,APPROVED.tokens);
const TOKEN_DATA=TOKENS;
const ZAV_IDS=["ZAV-001","ZAV-002","ZAV-003","ZAV-004","ZAV-005"];
const PLAYABLE_PARTIAL_SPELLS=new Set(["KNZ-037"]);
const PLAYABLE_PARTIAL_CREATURES=new Set(["NEU-028"]);
const clean=x=>JSON.parse(JSON.stringify(x));
const num=x=>x===null||x===undefined||x===""?0:Number.isFinite(Number(x))?Number(x):0;
const cap=(x,low,hi)=>Math.min(hi,Math.max(low,x));
// Stateful PRNG for ordinary games: resumable and reproducible after restoring a save.
function seededRandom(holder){
 let x=(holder.randomState>>>0)||0x9e3779b9;
 x^=(x<<13);x^=(x>>>17);x^=(x<<5);
 holder.randomState=x>>>0;
 return holder.randomState/4294967296;
}
const rand=s=>typeof s.rng==="function"?s.rng():seededRandom(s);
const pick=(s,list)=>list.length?list[Math.min(list.length-1,Math.floor(rand(s)*list.length))]:null;
const shuffle=(list,rng=Math.random)=>{
 for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
 return list;
};
// v2.0: event log is separate from the compact historic message feed.
const log=(s,msg,meta={})=>{
 const message=String(msg);
 if(!Array.isArray(s.logs))s.logs=[];
 s.logs.push(message);if(s.logs.length>125)s.logs.shift();
 if(!Array.isArray(s.events))s.events=[];
 s.eventSerial=(Number.isInteger(s.eventSerial)?s.eventSerial:0)+1;
 s.events.push({
  id:s.eventSerial,turn:s.turns||0,hour:s.time??null,
  actor:Number.isInteger(meta.owner)&&[0,1].includes(meta.owner)?meta.owner:null,
  kind:typeof meta.kind==="string"?meta.kind:"system",message,
  cardId:typeof meta.cardId==="string"?meta.cardId:null,
  amount:Number.isFinite(meta.amount)?meta.amount:null
 });
 if(s.events.length>1500)s.events.shift();
};
const uid=s=>"u"+(++s.serial);
const player=(s,i)=>s.players[i],other=i=>1-i;
const isBright=h=>h>=6&&h<18;
const phaseOfHour=h=>h<6?"Ночь":h<12?"Утро":h<18?"День":"Вечер";
const isDay=s=>isBright(s.time);
const isHuman=m=>m.creatureType==="Чалавек";
const isSpirit=m=>m.creatureType==="Дух";
const isUndead=m=>m.creatureType==="Нежыць";
const isPeasant=m=>isHuman(m)&&m.subtype==="Селянін";
const isDruzhina=m=>m.subtype==="Дружына"||m.subtype==="Дружыннік";
const isCat=m=>m.subtype==="Кот";
const isKasna=m=>m.subtype==="Касны";
const hasSwarm=(s,o,m)=>player(s,o).board.some(x=>x!==m&&isKasna(x));
const hasKasnaRush=(s,o,m)=>m.cardId==="CHR-029"&&!m.silenced&&hasSwarm(s,o,m);
/* Personal graveyard, approved base corpses and explicit extra corpse effects.
 * Tokens record deaths too; resurrection still follows the source's restrictions.
 */
function graveyardView(s,o){
 const p=player(s,o);
 return {
  owner:o,corpses:p.corpses,
  available:p.graveyard.map(g=>({...g,canRevive:!g.token&&!!s.cards[g.cardId]})),
  history:p.graveyardHistory.map(x=>({...x})),
  corpseLedger:p.corpseLedger.map(x=>({...x})),
  waitingRituals:[...s.rituals.filter(r=>r.owner===o),...s.scheduled.filter(r=>r.owner===o&&r.ritual)].map(r=>({...r,name:s.cards[r.cardId]?.name||r.cardId}))
 };
}
function adjustCorpses(s,o,delta,source){
 const p=player(s,o),before=p.corpses;
 if(delta<0&&p.corpses<-delta)return false;
 p.corpses=Math.max(0,p.corpses+delta);
 p.corpseLedger.push({eventId:"c"+(++s.graveSerial),turn:s.turns,hour:s.time,
   amount:p.corpses-before,balance:p.corpses,source});
 log(s,source+": "+(p.corpses-before>0?"+":"")+(p.corpses-before)+" трупы (всего "+p.corpses+").",
   {kind:"resource",owner:o,amount:p.corpses-before});
 return true;
}
function recordDeath(s,o,m){
 const p=player(s,o);
 const entry={uid:m.uid,cardId:m.cardId,name:m.name,token:!!m.token,
  turn:s.turns,hour:s.time,attack:m.attack,health:m.maxHealth,
  owner:o,deathId:"g"+(++s.graveSerial)};
 p.graveyard.push(entry);
 p.graveyardHistory.push({eventId:entry.deathId,action:"death",...entry});
 log(s,m.name+" → личное кладбище.",{kind:"graveyard",owner:o,cardId:m.cardId});
 return entry;
}
function takeFromGrave(s,o,uid,source){
 const p=player(s,o),i=p.graveyard.findIndex(g=>g.uid===uid);
 if(i<0)return null;
 const [entry]=p.graveyard.splice(i,1);
 p.graveyardHistory.push({eventId:"g"+(++s.graveSerial),action:"removed",
  deathId:entry.deathId,cardId:entry.cardId,uid:entry.uid,name:entry.name,
  turn:s.turns,hour:s.time,source});
 log(s,entry.name+" удалена из кладбища: "+source+".",{kind:"graveyard",owner:o,cardId:entry.cardId});
 return entry;
}
function graveyardSummary(s,o){
 const p=player(s,o);
 return {entries:p.graveyard.length,tokens:p.graveyard.filter(g=>g.token).length,
  corpses:p.corpses,history:p.graveyardHistory.length};
}
const boardOwner=(s,m)=>s.players[0].board.includes(m)?0:s.players[1].board.includes(m)?1:-1;
const minion=(s,owner,id)=>player(s,owner).board.find(x=>x.uid===id);
const withOwner=(s,fn)=>s.players.forEach((p,o)=>p.board.forEach((m,index)=>fn(m,o,index)));
const countPeasants=(s,o)=>player(s,o).board.filter(isPeasant).length;
function abilitySupport(card){
 if(!card)return "unavailable";
 if(card.effectModified)return card.cardType==="spell"?"unavailable":"partial";
 if(card.cardType==="spell")return SUPPORTED_SPELLS.has(card.cardId)?"complete":PLAYABLE_PARTIAL_SPELLS.has(card.cardId)?"partial":"unavailable";
 const text=String(card.ability||"").trim();
 if(PURE_ABILITIES.has(text))return "complete";
 if(card.cardType==="creature")return SUPPORTED_CREATURES.has(card.cardId)?"complete":"partial";
 if(card.cardType==="weapon")return SUPPORTED_WEAPONS.has(card.cardId)?"complete":"partial";
 return "unavailable";
}
/* v1.7 — силы героев из правил v0.4, раздел 17.
 * В кампании обе силы Воина закрыты до квестов. Для проверки есть отдельный
 * профиль demo-unlocked; он не меняет прогресс кампании.
 * approved-three-decks выбирает согласованных героев, не меняя кампанию.
 */
function heroPowerStatus(s,o){
 const p=player(s,o);
 const bright=isBright(s.time);
 const warrior=p.classId==="Воин";
 const warlock=p.classId==="Чернокнижник";
 const necro=p.classId==="Некромант";
 const name=warrior?(bright?"Призыв рекрута":"ФАКЕЛ"):
  necro?(bright?"Призыв идола":"Призыв мертвеца"):
  warlock?(bright?"Броня Веліміра":"Тёмный удар Веліміра"):"Сила героя";
 const cost=warrior?(bright?2:3):2;
 const id=warrior?(bright?"warrior-recruit":"warrior-torch"):
  necro?(bright?"necro-idol":"necro-undead"):
  warlock?(bright?"warlock-armor":"warlock-drain"):"unavailable";
 const targeted=id==="warrior-torch"||id==="warlock-drain";
 const fail=reason=>({ok:false,id,name,cost,targeted,reason,
   used:!!p.heroPowerUsed,profile:p.heroProfile});
 if(!warrior&&!necro&&!warlock)return fail("Сила героя для класса «"+p.classId+"» не утверждена.");
 const testUnlocked=["demo-unlocked","approved-three-decks",APPROVED.heroes[p.classId]?.id].includes(p.heroProfile);
 if(!testUnlocked)return fail("Сила закрыта для текущего профиля кампании.");
 if(necro){
  const def=p.necroTokens?.[bright?"idol":"undead"];
  if(!def||!["Дзень","Ноч"].includes(def.timeAffinityId)||!def.creatureTypeId)
   return fail("Силы Чернобога: тип и временная принадлежность новых токенов ещё не утверждены.");
 }
 if(s.phase!=="battle"||s.turn!==o)return fail("Сейчас не ваш ход.");
 if(p.heroPowerUsed)return fail("Сила героя уже использована в этом ходу.");
 if(p.mana<cost)return fail("Недостаточно маны.");
 if((id==="warrior-recruit"||id.startsWith("necro-"))&&p.board.length>=7)
   return fail("Нет свободного места на поле.");
 if(id==="warrior-torch"&&!p.board.some(isHuman))return fail("Нет дружелюбного существа «Чалавек» для ФАКЕЛА.");
 return {ok:true,id,name,cost,targeted,reason:"",profile:p.heroProfile,used:false};
}
function heroPowerTargetValid(s,o,target){
 if(player(s,o).classId==="Чернокнижник")return !!(target&&target.owner===other(o)&&
   (target.kind==="hero"||(target.kind==="minion"&&minion(s,target.owner,target.uid)&&!minion(s,target.owner,target.uid).stealth)));
 return !!(target&&target.kind==="minion"&&target.owner===o
   &&minion(s,o,target.uid)&&isHuman(minion(s,o,target.uid)));
}
function useHeroPowerResolved(s,o,target=null){
 const check=heroPowerStatus(s,o);
 if(!check.ok)return check;
 if(check.targeted&&!heroPowerTargetValid(s,o,target))
  return {ok:false,reason:"Выберите допустимую цель силы героя."};
 const p=player(s,o);
 // Валидируем всю цель до изменения ресурсов.
 let summoned=null;
 if(check.id==="warrior-recruit")summoned=summon(s,o,TOKENS["TKN-001"]);
 if(check.id==="warrior-torch"){
  const m=minion(s,o,target.uid);
  // Действует до конца этого хода. Временная принадлежность не изменяется.
  addTimed(m,"day",0,o,1);
 }
 if(check.id.startsWith("necro-")){
  const key=check.id==="necro-idol"?"idol":"undead",def=p.necroTokens[key];
  const card={...TOKENS[key==="idol"?"TKN-010":"TKN-011"],...def};
  summoned=summon(s,o,card,key==="undead"?{charge:true}:{taunt:true});
  if(summoned){
    summoned.heroPowerToken=key;
    if(key==="undead")summoned.expiresEndTurn=o;
  }
 }
 if((check.id==="warrior-recruit"||check.id.startsWith("necro-"))&&!summoned)
  return {ok:false,reason:"Не удалось призвать токен."};
 p.mana-=check.cost;p.heroPowerUsed=true;
 if(check.id==="warlock-armor")p.armor+=2;
 if(check.id==="warlock-drain"){
  const done=target.kind==="hero"?damageHero(s,target.owner,1):damageMinion(s,target.owner,target.uid,1,"power");
  if(done>0)healHero(s,o,1);
 }
 combatEvent(s,"heroPowerUsed",{owner:o,id:check.id,target});
 log(s,(o===0?"Игрок":"Бот")+" использует силу героя «"+check.name+"» ("+check.cost+" маны).",{kind:"hero-power",owner:o});
 return {ok:true,id:check.id};
}
const LEGACY_RULES="three-decks-2026-11-18";
const MILITIA_PREVIEW_RULES="militia-2026-11-19";
const CURRENT_RULES="militia-2026-11-19-r2";
const legacyRules=s=>s.contentVersion===LEGACY_RULES;
function makeGame(deckA,deckB,catalog,opts={}){
 const seedHolder={randomState:(Number.isInteger(opts.seed)?opts.seed:Math.floor(Math.random()*4294967296))>>>0};
 const rng=opts.rng||(()=>seededRandom(seedHolder));
 const first=opts.firstPlayer??(rng()<.5?0:1),get=id=>catalog instanceof Map?catalog.get(id):catalog[id],cards={};
 for(const deck of [deckA,deckB])for(const [id,qty] of Object.entries(deck.counts||{})){
  if(!qty)continue;
  const c=get(id);if(!c)throw new Error("Нет карты "+id);
  cards[id]=clean(c);
 }
 // Related cards: can be created by effects, never put in starting decks.
 for(const id of ZAV_IDS){const related=get(id);if(related&&!cards[id])cards[id]=clean(related);}
 for(const [id,card]of Object.entries(TOKENS))cards[id]=clean(card);
 const players=[deckA,deckB].map((d,owner)=>({
   classId:d.classId,deckName:d.name,health:30,
   heroName:opts.heroNames?.[owner]??(["approved-three-decks","demo-unlocked",APPROVED.heroes[d.classId]?.id].includes(opts.heroProfiles?.[owner])?APPROVED.heroes[d.classId]?.name||d.classId:d.classId),
   armor:d.classId==="Воин"&&["ragvalod","approved-three-decks"].includes(opts.heroProfiles?.[owner])?10:0,
   deck:shuffle(Object.entries(d.counts).flatMap(([id,q])=>Array(num(q)).fill(id)),rng),
   hand:[],board:[],discarded:[],graveyard:[],graveyardHistory:[],corpseLedger:[],
   heroPowerUsed:false,heroProfile:opts.heroProfiles?.[owner]||"campaign",
   necroTokens:opts.necroTokens||{idol:clean(TOKENS["TKN-010"]),undead:clean(TOKENS["TKN-011"])},
   weapon:null,maxMana:0,mana:0,corpses:0,
   fatigue:0,heroAttacked:false,lastDamageTurn:-1,deathTriggerTurn:-1,
   nextSpiritDiscount:0,spiritDiscountThisTurn:0,nextSpellDiscount:0,enemySpellTax:0
 }));
 const s={serial:0,graveSerial:0,eventSerial:0,players,cards,turn:first,firstPlayer:first,
    contentVersion:CURRENT_RULES,time:opts.hour??Math.floor(rng()*24),timeMode:opts.timeMode||"off",
    phase:"mulligan",winner:null,logs:[],events:[],turns:0,rng:opts.rng||null,randomState:seedHolder.randomState,
    rituals:[],scheduled:[],effectDepth:0,discoveryOffers:{},debugged:false,debugMode:false};
 log(s,"Подготовка партии. "+(first===0?"Первым ходит игрок.":"Первым ходит бот."));
 for(let owner=0;owner<2;owner++){
  for(let i=0;i<(owner===first?3:4);i++)draw(s,owner);
  if(owner!==first)player(s,owner).hand.push({uid:uid(s),cardId:"__coin__"});
 }
 return s;
}
function checkEnd(s){
 if(resolutionDepth.get(s)||deathResolvers.has(s))return;
 const a=player(s,0).health,b=player(s,1).health;
 if(s.phase==="ended")return;
 if(a<=0&&b<=0){s.phase="ended";s.winner="draw";log(s,"Ничья: оба героя погибли.");}
 else if(a<=0){s.phase="ended";s.winner=1;log(s,"Победил бот.");}
 else if(b<=0){s.phase="ended";s.winner=0;log(s,"Победил игрок.");}
}
function applyDamage(s,target,amount,ref){
 const packet=Math.max(0,num(amount)),before={health:target.health,armor:Math.max(0,num(target.armor))};
 let blocked=null,armorLoss=0,healthLoss=0;
 if(packet&&target.invulnerable)blocked="Неуязвимость";
 else if(packet&&target.divineShield){target.divineShield=false;blocked="Божественный щит";}
 else{armorLoss=Math.min(packet,before.armor);healthLoss=Math.min(Math.max(0,before.health),packet-armorLoss);
  if(before.armor||armorLoss)target.armor=before.armor-armorLoss;
  target.health-=packet-armorLoss;}
 const actual=armorLoss+healthLoss;
 if(packet)combatEvent(s,"damage",{target:ref,packet,actual,armorLoss,healthLoss,blocked,
  healthBefore:before.health,healthAfter:target.health,armorBefore:before.armor,armorAfter:target.armor||0});
 return actual;
}
function damageHero(s,o,amount){
 const p=player(s,o),actual=applyDamage(s,p,amount,{kind:"hero",owner:o});
 if(actual)p.lastDamageTurn=s.turns;
 if(actual)log(s,"Герой "+(o===0?"игрока":"бота")+" получает "+actual+" урона.",
  {kind:"damage",owner:o,amount:actual});
 checkEnd(s);return actual;
}
function healHero(s,o,amount){
 const p=player(s,o),before=p.health;
 if(before<=0)return 0;
 p.health=Math.min(30,p.health+Math.max(0,num(amount)));
 const restored=p.health-before;
 if(restored)combatEvent(s,"healing",{target:{kind:"hero",owner:o},actual:restored});
 if(restored)log(s,"Герой "+(o===0?"игрока":"бота")+" восстанавливает "+restored+" здоровья.",
    {kind:"healing",owner:o,amount:restored});
 return restored;
}
function draw(s,o){
 const p=player(s,o);
 if(!p.deck.length){p.fatigue++;combatEvent(s,"fatigue",{owner:o,amount:p.fatigue});damageHero(s,o,p.fatigue);log(s,"Усталость: "+p.fatigue+" урона.");return false;}
 const id=p.deck.shift();
 if(p.hand.length>=10)return discardCard(s,o,id,"overflow","deck");
 addHandCard(s,o,{uid:uid(s),cardId:id,costAdjustment:0},"deck");
 log(s,(o===0?"Игрок взял карту: "+(s.cards[id]?.name||id):"Бот взял карту")+" (верх колоды).",
   {kind:"draw",owner:o,cardId:o===0?id:null});
 return true;
}
function drawOneWhere(s,o,predicate,adjustment=0){
 const p=player(s,o),idx=p.deck.findIndex(id=>predicate(s.cards[id]));
 if(idx<0)return false;
 const [id]=p.deck.splice(idx,1);
 if(p.hand.length>=10)return discardCard(s,o,id,"overflow","deck");
 addHandCard(s,o,{uid:uid(s),cardId:id,costAdjustment:adjustment},"deck");
 return true;
}
// Selects an eligible card uniformly at random from remaining physical deck entries.
 // No selection dialog, no replacement, and no fatigue when a specific category is absent.
function drawRandomWhere(s,o,predicate,adjustment=0){
 const p=player(s,o),matches=p.deck.map((id,i)=>({id,i})).filter(x=>predicate(s.cards[x.id]));
 const selected=pick(s,matches);
 if(!selected){log(s,"Добор из колоды: подходящих карт не осталось.");return false;}
 p.deck.splice(selected.i,1);
 if(p.hand.length>=10)return discardCard(s,o,selected.id,"overflow","deck");
 addHandCard(s,o,{uid:uid(s),cardId:selected.id,costAdjustment:adjustment},"deck");
 log(s,(o===0?"Вы взяли карту: "+(s.cards[selected.id]?.name||selected.id):
   "Бот взял карту")+" (случайный добор из колоды).",
   {kind:"draw",owner:o,cardId:o===0?selected.id:null});
 return true;
}
function currentCost(s,o,hand){
 if(hand.cardId==="__coin__")return 0;
 if(ZAV_IDS.includes(hand.cardId))return Math.max(0,num(hand.costAdjustment));
 const p=player(s,o),c=s.cards[hand.cardId];if(!c)return Infinity;
 let cost=Math.max(0,num(c.costValue)+num(hand.costAdjustment));
 if(c.cardType==="spell")cost=Math.max(0,cost-p.nextSpellDiscount)*
   (p.enemySpellTax>0?2:1);
 else if(c.cardType==="creature"&&c.creatureTypeId==="Дух")cost=Math.max(0,cost-p.nextSpiritDiscount-p.spiritDiscountThisTurn);
 return cost;
}
function confirmMulligan(s,selected=[]){
 if(s.phase!=="mulligan")return {ok:false,reason:"Муллиган завершён."};
 const p=player(s,0),selection=new Set(selected),removed=p.hand.filter(h=>selection.has(h.uid)&&h.cardId!=="__coin__");
 p.hand=p.hand.filter(h=>!selection.has(h.uid)||h.cardId==="__coin__");
 for(let i=0;i<removed.length;i++)draw(s,0);
 p.deck.push(...removed.map(x=>x.cardId));shuffle(p.deck,()=>rand(s));
 s.phase="battle";log(s,"Игрок заменил "+removed.length+" карт.");
 startTurn(s,s.turn);return {ok:true};
}
function times(s,m){
 const owner=boardOwner(s,m);
 if(owner<0)return m.affinity||"";
 const p=player(s,owner),index=p.board.indexOf(m);
 if(m.timed.some(t=>t.kind==="day"))return "Дзень";
 if(m.timed.some(t=>t.kind==="night"))return "Ноч";
 if(m.creatureType==="Чалавек"){
  if(p.weapon?.cardId==="KNZ-032"&&s.turn===owner)return "Дзень";
  if(p.board.some((src,i)=>src.cardId==="KNZ-019"&&Math.abs(i-index)===1))return "Дзень";
 }
 return m.affinity||"";
}
function auraAttack(s,m,owner){
 const p=player(s,owner);let atk=s.turn===owner?-num(p.turnAttackReduction):0;
 for(const source of p.board){
  if(source.silenced)continue;
  if(source.cardId==="KNZ-005"&&(legacyRules(s)||source!==m)&&isDruzhina(m))atk++;
  if(source.cardId==="NEU-007"&&source!==m&&isPeasant(m))atk++;
  if(source.cardId==="NEU-004"&&source===m&&p.board.some(isPeasant))atk++;
  if(source.cardId==="NCR-014"&&source!==m&&isUndead(m))atk++;
  if(source.cardId==="NEU-027"&&isCat(m))atk+=2;
 }
 if(!m.silenced&&["CHR-029","CHR-039"].includes(m.cardId)&&hasSwarm(s,owner,m))atk++;
 for(const source of s.players[other(owner)].board)if(source.cardId==="CHR-027"&&source!==m)atk-=2;
 return atk;
}
function auraHealth(s,m,owner){
 let h=0;
 for(const src of player(s,owner).board){
  if(src.cardId==="KNZ-024"&&isHuman(m))h++;
  if(src.cardId==="NEU-019"&&src!==m&&isHuman(m))h++;
  if(src.cardId==="NEU-039"&&isSpirit(m))h++;
 }
 return h;
}
function syncAuras(s){
 withOwner(s,(m,o)=>{
  if(m.cardId==="CHR-029"&&m.summonedTurn===s.turns&&s.turn===o&&!m.attacked)
    m.ready=m.charge||hasKasnaRush(s,o,m);
  const desired=auraHealth(s,m,o),delta=desired-num(m.auraHealth);
  if(delta){m.maxHealth+=delta;m.health+=delta;m.auraHealth=desired;
   combatEvent(s,"attributesChanged",{target:{kind:"minion",owner:o,uid:m.uid},attack:0,maxHealth:delta,aura:true});}
 });
}
function localBright(s,m){
 // Прямое временное "действует как День / Ночь" перекрывает неблагоприятное
 // глобальное и локальное освещение, не меняя напечатанный timeAffinityId.
 if((m.timed||[]).some(t=>t.kind==="day"))return true;
 if((m.timed||[]).some(t=>t.kind==="night"))return false;
 const o=boardOwner(s,m);if(o<0)return isBright(s.time);
 const p=player(s,o),pos=p.board.indexOf(m);
 return p.board.some((source,index)=>!source.silenced&&(source.heroPowerToken==="idol"||source.cardId==="TKN-010")&&Math.abs(index-pos)===1)
    ?false:isBright(s.time);
}
function effectiveAttack(s,m){
 const o=boardOwner(s,m);let amount=Math.max(0,num(m.attack)+
    (m.timed||[]).reduce((x,t)=>x+(t.kind==="attack"?num(t.amount):0),0)+(o<0?0:auraAttack(s,m,o)));
 if(s.timeMode==="off")return amount;
 const affinity=times(s,m);
 if(!affinity)return amount;
 const unfavorable=(affinity==="Дзень"&&!localBright(s,m))||(affinity==="Ноч"&&localBright(s,m));
 return unfavorable?(s.timeMode==="ceil"?Math.ceil(amount/2):Math.floor(amount/2)):amount;
}
function incomingMultiplier(s,m,kind="combat"){
 if(s.timeMode==="off")return 1;
 const affinity=times(s,m);
 if(!affinity)return 1;
 return (affinity==="Дзень"&&!localBright(s,m))||(affinity==="Ноч"&&localBright(s,m))?2:1;
}
function addTimed(m,kind,amount,untilOwner,remaining=1){
 if(!Array.isArray(m.timed))m.timed=[];
 const s=minionStates.get(m),before=s?effectiveAttack(s,m):m.attack;
 m.timed.push({kind,amount,untilOwner,remaining});
 if(s)combatEvent(s,"attributesChanged",{target:{kind:"minion",owner:boardOwner(s,m),uid:m.uid},attack:effectiveAttack(s,m)-before,maxHealth:0,timedKind:kind});
}
function cleanseKnownNegativeEffects(s,m){
 if(!m)return 0;
 const before=(m.timed||[]).length;
 // Unmodelled debuffs cannot be undone safely.
 m.timed=(m.timed||[]).filter(t=>!(t.kind==="frozen"||
   (t.kind==="attack"&&num(t.amount)<0)||t.kind==="infection"));
 const cured=m.infected===true?1:0;
 m.infected=false;
 return before-m.timed.length+cured;
}
function igniteHands(s){
 let count=0;
 for(const p of s.players)for(const h of p.hand){
   // Rules 0.6: refresh the two-personal-turn duration.
   h.burnTurnsLeft=2;h.burnStartedAt=s.turns;count++;
 }
 log(s,"Падпал: отмечено "+count+" карт в руках; два следующих собственных хода.");
}
function buff(s,m,atk=0,hp=0){
 if(!m)return;
 m.attack+=atk;m.maxHealth+=hp;m.health+=hp;
 if(atk||hp)combatEvent(s,"attributesChanged",{target:{kind:"minion",owner:boardOwner(s,m),uid:m.uid},attack:atk,maxHealth:hp});
}
function makeMinion(s,card,bonus=0,opts={}){
 const text=String(card.ability||"").trim();
 const taunt=/(^|[.!]\s*)Правакацыя[.!]?(\s|$)/i.test(text);
 const charge=/(^|[.!]\s*)Рывок[.!]?(\s|$)/i.test(text);
 const stealth=/(^|[.!]\s*)Маскіроўка[.!]?(\s|$)/i.test(text);
 const support=abilitySupport(card);
 return {uid:uid(s),cardId:card.cardId,name:card.name,attack:num(card.attack)+bonus,
  health:num(card.health)+bonus,maxHealth:num(card.health)+bonus,
  affinity:card.timeAffinityId||"",creatureType:card.creatureTypeId||"",subtype:card.subtype||"",
  taunt,charge,stealth,silenced:false,reborn:false,ready:charge,attacked:false,timed:[],auraHealth:0,
  unsupported:support==="partial",token:card.origin==="token"||card.cardId.startsWith("TKN-"),
  summonedWithCorpses:!!opts.summonedWithCorpses,summonedTurn:s.turns,
  healTriggeredTurn:-1,graveId:card.cardId};
}
function randomMinion(s,o,predicate){return pick(s,player(s,o).board.filter(predicate));}
function summon(s,o,card,opts={}){
 const p=player(s,o);if(!card||p.board.length>=7)return null;
 const m=makeMinion(s,card,num(opts.bonus),opts);minionStates.set(m,s);
 if(opts.taunt)m.taunt=true;
 if(opts.charge){m.charge=true;m.ready=true;}
 p.board.splice(opts.position??p.board.length,0,m);syncAuras(s);
 combatEvent(s,"creatureEntered",{owner:o,instance:m,index:p.board.indexOf(m)});
 log(s,(o===0?"Игрок":"Бот")+" призывает "+m.name+".",
   {kind:"summon",owner:o,cardId:m.cardId});
 // NEU-010: after you summon a Peasant with 1 attack, give +1/+1.
 if(isPeasant(m)&&m.attack===1&&p.board.some(src=>src!==m&&src.cardId==="NEU-010"))buff(s,m,1,1);
 return m;
}
function summonTokens(s,o,id,count,bonus=0,opts={}){
 const result=[];
 for(let i=0;i<count;i++){const m=summon(s,o,TOKENS[id],{...opts,bonus});if(!m)break;result.push(m);}
 return result;
}
function healMinion(s,o,id,amount){
 const m=minion(s,o,id);if(!m)return 0;
 const before=m.health;m.health=Math.min(m.maxHealth,m.health+Math.max(0,num(amount)));
 const restored=m.health-before;
 if(restored>0){
  combatEvent(s,"healing",{target:{kind:"minion",owner:o,uid:id},actual:restored});
  log(s,m.name+" восстанавливает "+restored+" здоровья.",
     {kind:"healing",owner:o,cardId:m.cardId,amount:restored});
  for(const source of [...player(s,o).board])if(source.cardId==="KNZ-028"&&source.uid===id){
   const candidate=randomMinion(s,o,x=>isHuman(x));if(candidate)buff(s,candidate,1,1);
  }
 }
 return restored;
}
function damageMinion(s,o,id,amount,kind="spell",batch=false){
 const m=minion(s,o,id);if(!m)return 0;
 const dmg=Math.max(0,num(amount))*incomingMultiplier(s,m,kind);
 const actual=applyDamage(s,m,dmg,{kind:"minion",owner:o,uid:id});
 if(actual>0&&m.health>0&&!m.silenced&&m.cardId==="CHR-041"&&hasSwarm(s,o,m)&&m.damageTriggeredTurn!==s.turns){
  m.damageTriggeredTurn=s.turns;buff(s,m,1,0);
 }
 if(actual)log(s,m.name+" получает "+actual+" урона.",
    {kind:"damage",owner:o,cardId:m.cardId,amount:actual});
 if(!batch)removeDead(s);return actual;
}
function areaDamage(s,targets,amount,kind="spell"){
 combatBatch(s,"area",()=>{for(const [o,m] of targets)if(minion(s,o,m.uid))damageMinion(s,o,m.uid,amount,kind,true);});
 removeDead(s);
}
function destroyMinion(s,o,id){
 const m=minion(s,o,id);if(!m)return;
 m.health=0;combatEvent(s,"destroyed",{target:{kind:"minion",owner:o,uid:id}});removeDead(s);
}
function chooseWounded(s,o){return player(s,o).board
 .filter(m=>m.health<m.maxHealth).sort((a,b)=>(a.health-a.maxHealth)-(b.health-b.maxHealth))[0];}
function deathrattle(s,o,m){
 if(m.silenced||m.noDeathrattle)return;
 const supported=new Set(["CHR-002","CHR-023","CHR-034","KNZ-010","NEU-003","NEU-005","NEU-037","NEU-042","ZAV-004","NCR-002","NCR-013"]);
 if(supported.has(m.cardId))combatEvent(s,"deathrattleTriggered",{owner:o,instance:m});
 switch(m.cardId){
  case "CHR-002":damageHero(s,other(o),1);break;
  case "CHR-023":player(s,o).nextSpiritDiscount++;break;
  case "CHR-034":damageHero(s,other(o),2);break;
  case "KNZ-010":drawRandomWhere(s,o,c=>c?.cardType==="creature"&&c.creatureTypeId==="Чалавек");break;
  case "CHR-030":areaDamage(s,s.players.flatMap((p,i)=>p.board.map(x=>[i,x])),1);break;
  case "NEU-003":summonTokens(s,o,"TKN-004",1);break;
  case "NEU-005":{const x=randomMinion(s,o,y=>isPeasant(y));if(x)buff(s,x,1,1);break;}
  case "NEU-037":healHero(s,o,2);break;
  case "NEU-042":areaDamage(s,s.players.flatMap((p,i)=>p.board.map(x=>[i,x])),2);break;
   case "ZAV-004":draw(s,o);break;
  case "NCR-002":adjustCorpses(s,o,1,"Предсмертный эффект NCR-002");break;
  case "NCR-013":adjustCorpses(s,o,2,"Предсмертный эффект NCR-013");break;
  case "NCR-015":addHandCard(s,o,{uid:uid(s),cardId:"TKN-007",costAdjustment:0},"deathrattle");break;
 }
}
function friendlyDeath(s,o,m){
 const p=player(s,o);
 for(const source of [...p.board]){
  if(source.uid===m.uid||source.silenced)continue;
  if(source.cardId==="NCR-003"&&s.turn===o&&source.healTriggeredTurn!==s.turns){
    source.healTriggeredTurn=s.turns;healHero(s,o,2);
  }
  if(source.cardId==="NCR-011"&&s.turn===o&&!m.summonedWithCorpses&&source.healTriggeredTurn!==s.turns){
    source.healTriggeredTurn=s.turns;adjustCorpses(s,o,1,"Аура NCR-011");
  }
  if(source.cardId==="CHR-016"&&isSpirit(m))buff(s,source,1,0);
 }
 for(const ritual of s.rituals.filter(r=>r.owner===o&&r.cardId==="NCR-026")){
  ritual.progress++;
  if(ritual.progress>=2){adjustCorpses(s,o,3,"Ритуал ТРЫЗНА");draw(s,o);ritual.done=true;
   log(s,"Ритуал «ТРЫЗНА» завершён: +3 трупы, добор карты.");}
 }
 s.rituals=s.rituals.filter(r=>!r.done);
}
function removeDead(s){
 const hasRitualTarget=task=>!task.ritual||task.targetUid==null||!!minion(s,task.owner,task.targetUid);
 s.scheduled=s.scheduled.filter(hasRitualTarget);
 const active=deathResolvers.get(s);
 if(active){collectDeaths(s,active);return;}
 const context={queue:[],waves:0};deathResolvers.set(s,context);
 try{
  collectDeaths(s,context);
  while(context.queue.length&&context.waves<35){
   const {o,m}=context.queue.shift();
   combatCause(s,{kind:"deathrattle",owner:o,uid:m.uid,cardId:m.cardId},()=>{friendlyDeath(s,o,m);deathrattle(s,o,m);});
   collectDeaths(s,context);
  }
  if(context.waves>=35)log(s,"Защитное ограничение цепочки смертей.");
 }finally{deathResolvers.delete(s);}
 s.scheduled=s.scheduled.filter(hasRitualTarget);
 checkEnd(s);
}
function collectDeaths(s,context){
 while(context.waves<35){
  syncAuras(s);
  // Canon §15.3: active side first, each side left-to-right; subsequent triggers append.
  const order=[s.turn,other(s.turn)];
  const dying=order.flatMap(o=>player(s,o).board.filter(m=>m.health<=0).map(m=>({o,m})));
  if(!dying.length)return;
  context.waves++;const departed=[];
  // Remove the whole wave before recalculating auras or running a death effect.
  for(const {o,m} of dying)player(s,o).board=player(s,o).board.filter(x=>x.uid!==m.uid);
  for(const {o,m} of dying){
   if(m.reborn){
    // Existing legacy rebirth is explicitly outside the canonical death-queue acceptance.
    m.reborn=false;m.health=m.maxHealth;m.ready=false;m.attacked=true;player(s,o).board.push(m);
    combatEvent(s,"legacyRebirth",{owner:o,instance:m});log(s,m.name+": Перараджэнне — восстановлено здоровье.");
   }else{
    departed.push({owner:o,instance:clean(m)});recordDeath(s,o,m);
    if(!m.summonedWithCorpses)adjustCorpses(s,o,1,"Гибель "+m.cardId);
    log(s,m.name+" погибает.",{kind:"death",owner:o,cardId:m.cardId});context.queue.push({o,m});
   }
  }
  if(departed.length)combatEvent(s,"creaturesDied",{instances:departed});
 }
}
function targetMode(s,o,card){
 if(legacyRules(s)){
  if(card.cardId==="KNZ-004")return "own-human";
  if(card.cardId==="NCR-028")return "own-minion";
 }
 if(card.cardId==="CHR-007"&&!isBright(s.time))return "enemy-minion";
 return TARGETS[card.cardId]||null;
}
function spellTargetType(cardId,s=null,owner=0){
 if(s?.cards?.[cardId])return targetMode(s,owner,s.cards[cardId]);
 return TARGETS[cardId]||null;
}
function targetValid(s,o,cardId,target){
 const mode=targetMode(s,o,s.cards[cardId]||{cardId});
 if(!mode)return true;
 if(!target)return false;
 if(target.kind==="hero")return mode==="any"&&(target.owner===0||target.owner===1);
 if(target.kind!=="minion"||![0,1].includes(target.owner))return false;
 const m=minion(s,target.owner,target.uid);if(!m)return false;
 if(m.stealth&&target.owner!==o)return false;
 switch(mode){
  case "any":case "any-minion":return true;
  case "own-minion":return target.owner===o;
  case "own-human":return target.owner===o&&isHuman(m);
  case "any-human":return isHuman(m);
  case "own-peasant":return target.owner===o&&isPeasant(m);
  case "enemy-minion":return target.owner!==o;
  case "enemy-weak":return target.owner!==o&&effectiveAttack(s,m)<=5;
  default:return false;
 }
}
function targetsAvailable(s,o,card){
 const mode=targetMode(s,o,card);if(!mode)return true;
 if(mode==="any")return true;
 return s.players.some((p,i)=>p.board.some(m=>targetValid(s,o,card.cardId,{kind:"minion",owner:i,uid:m.uid})));
}

/* v1.6: выбор из собственной колоды, кладбища и на поле.
 * Списки — только действительные экземпляры: deck:index, grave:uid, board:uid.
 * Весь выбор проверяется повторно непосредственно перед оплатой; отмена не меняет бой.
 * Для неутверждённых правил оживления токены исключены. Неявное расходование записей
 * кладбища не производится: удаляем только там, где это прямо написано на карте.
 */
// Only cards that actually require a player decision should open the selection dialog.
 // "Вазьміце з калоды" is an automatic random draw among eligible deck entries.
const CHOICE_SPELLS=new Set(["KNZ-015","CHR-014","CHR-021","NEU-017","NCR-021","TKN-007"]);
const needsSpellChoice=(s,id)=>CHOICE_SPELLS.has(id)||(id==="NCR-027"&&s.contentVersion!==CURRENT_RULES);
function choiceSpec(s,o,c){
 if(!c||!(needsSpellChoice(s,c.cardId)||c.cardId==="NEU-001"))return null;
 const pl=player(s,o),freeSlots=7-pl.board.length;
 // Discover offers remain stable across UI renders and cancel/reopen.
 if(c.cardId==="NEU-001"){
   const offerKey=o+":"+s.turns+":"+c.cardId,day=isDay(s),needed=day?2:4;
   if(!s.discoveryOffers)s.discoveryOffers={};
   if(!s.discoveryOffers[offerKey])
     s.discoveryOffers[offerKey]=shuffle(ZAV_IDS.filter(id=>!!s.cards[id]),()=>rand(s)).slice(0,3);
   const ids=s.discoveryOffers[offerKey];
   const options=ids.map(id=>({
     id:"zav:"+id,cardId:id,name:s.cards[id].name,cost:0,type:"creature",
     detail:"Асобая карта · бясплатны прызоў"
   }));
   const steps=[{key:"zav",title:day?"Выберите одну Карту Завальні":"Ночь: разыграть все три Карты Завальні",
     options,min:day?1:3,max:day?1:3,distinctCardIds:true,locked:!day}];
   if(ids.includes("ZAV-005")&&player(s,other(o)).board.length){
     steps.push({key:"fireTarget",title:"ВОГНЕННЫ ДУХ · выберите вражеское существо (если выбрана эта карта)",
       options:player(s,other(o)).board.filter(m=>!m.stealth).map(m=>({
         id:"target:"+m.uid,cardId:m.cardId,name:m.name,cost:0,type:"creature",
         detail:m.attack+"/"+m.health+" · поле противника"})),min:0,max:1});
   }
   const blocked=ids.length!==3||freeSlots<needed;
   return {cardId:c.cardId,title:c.name,steps,blocked,
     reason:ids.length!==3?"Не найдены все пять Карт Завальні.":blocked?
       `Требуются ${needed} свободных места (включая Шляхціца): переполнение не утверждено.`:""};
 }
 const deckWhere=pred=>pl.deck.map((id,i)=>({id:"deck:"+i,cardId:id,card:s.cards[id]}))
   .filter(x=>x.card&&pred(x.card)).map(x=>({
    id:x.id,cardId:x.cardId,name:x.card.name,cost:num(x.card.costValue),
    type:x.card.cardType,detail:"Из колоды"
   }));
 const graveWhere=pred=>pl.graveyard.filter(g=>!g.token&&s.cards[g.cardId]&&pred(s.cards[g.cardId]))
   .map(g=>({id:"grave:"+g.uid,cardId:g.cardId,name:s.cards[g.cardId].name,
    cost:num(s.cards[g.cardId].costValue),type:"creature",detail:"Погибшее существо"}));
 const boardWhere=pred=>pl.board.filter(pred).map(m=>({
   id:"board:"+m.uid,cardId:m.cardId,name:m.name,cost:num(s.cards[m.cardId]?.costValue),
   type:"creature",detail:`${m.attack}/${m.health} · на поле`
 }));
 const step=(key,title,options,requested,{distinct=false,upTo=false}={})=>{
  const unique=distinct?new Set(options.map(x=>x.cardId)).size:options.length;
  const max=Math.min(requested,unique);
  return {key,title,options,min:upTo?Math.min(1,max):max,max,distinctCardIds:distinct};
 };
 const human=c=>c.cardType==="creature"&&c.creatureTypeId==="Чалавек";
 const spirit=c=>c.cardType==="creature"&&c.creatureTypeId==="Дух";
 const peasant=c=>human(c)&&c.subtype==="Селянін";
 let steps=[];
 switch(c.cardId){
  case "KNZ-015":steps=[step("human","До двух дружелюбных существ «Чалавек»",
    boardWhere(isHuman),2,{upTo:true})];break;
  case "CHR-014":steps=[step("spirits","До двух Духов стоимостью не более 2 маны для призыва",
    deckWhere(c=>spirit(c)&&c.costType==="mana"&&num(c.costValue)<=2),
    Math.min(2,freeSlots))];break;
  case "CHR-021":steps=[step("spirits","До трёх разных погибших Духов",
    graveWhere(spirit),Math.min(3,freeSlots),{distinct:true,upTo:true})];break;
  case "NEU-017":steps=[step("peasants","Два разных погибших Селянина",
    graveWhere(peasant),Math.min(2,freeSlots),{distinct:true})];break;
  case "NCR-021":steps=[step("grave","Собственное нетокенное существо стоимостью до 4 маны",
    graveWhere(c=>c.cardType==="creature"&&c.costType==="mana"&&num(c.costValue)<=4),1)];break;
  case "NCR-027":steps=[step("grave","Собственное нетокенное существо стоимостью до 5 маны",
    graveWhere(c=>c.cardType==="creature"&&c.costType==="mana"&&num(c.costValue)<=5),1)];break;
  case "TKN-007":steps=[step("grave","Кашчэй Бессмяротны на своём кладбище",
    graveWhere(c=>c.cardId==="NCR-015"),1)];break;
 }
 if(!steps.length)return null;
 const blocked=steps.some(st=>st.min===0||st.options.length<st.min)
    ||(c.cardId==="NEU-017"&&steps[0].max<2);
 return {cardId:c.cardId,title:c.name,steps,blocked,
  reason:blocked?"Нет подходящих карт или свободных мест для указанного выбора.":""};
}
function validateChoices(s,o,c,choices){
 const spec=choiceSpec(s,o,c);
 if(!spec)return {ok:true,spec:null};
 if(spec.blocked)return {ok:false,reason:spec.reason};
 if(!choices||typeof choices!=="object")return {ok:false,reason:"Выберите карты для эффекта.",requiresChoice:true,spec};
 const used=new Set();
 for(const step of spec.steps){
  const ids=choices[step.key];
  if(!Array.isArray(ids)||ids.length<step.min||ids.length>step.max)
   return {ok:false,reason:`«${step.title}»: выберите от ${step.min} до ${step.max}.`,requiresChoice:true,spec};
  const names=new Set();
  for(const id of ids){
   if(typeof id!=="string"||used.has(id))return {ok:false,reason:"Один и тот же экземпляр выбран повторно.",requiresChoice:true,spec};
   const item=step.options.find(x=>x.id===id);
   if(!item)return {ok:false,reason:"Карта больше недоступна. Обновите выбор.",requiresChoice:true,spec};
   if(step.distinctCardIds&&names.has(item.cardId))
    return {ok:false,reason:"Нужны разные карты, а не копии одной.",requiresChoice:true,spec};
   names.add(item.cardId);used.add(id);
  }
 }
 if(c.cardId==="NEU-001"&&spec.steps.some(st=>st.key==="fireTarget")){
   const selected=(choices.zav||[]).includes("zav:ZAV-005");
   const fire=choices.fireTarget||[];
   if(selected&&!fire.length)
     return {ok:false,requiresChoice:true,spec,reason:"Для «ВОГНЕННЫ ДУХ» выберите вражеское существо."};
   if(!selected&&fire.length)
     return {ok:false,requiresChoice:true,spec,reason:"Цель огня нужна только для «ВОГНЕННЫ ДУХ»."};
 }
 return {ok:true,spec};
}
function botChoices(spec){
 if(!spec||spec.blocked)return null;
 const choices={};
 for(const st of spec.steps){
  const usedNames=new Set(),ids=[];
  for(const opt of st.options){
   if(st.distinctCardIds&&usedNames.has(opt.cardId))continue;
   ids.push(opt.id);usedNames.add(opt.cardId);
   if(ids.length>=st.max)break;
  }
  choices[st.key]=ids;
 }
 if(spec.cardId==="NEU-001"&&choices.fireTarget &&
    !(choices.zav||[]).includes("zav:ZAV-005"))choices.fireTarget=[];
 return choices;
}
function resolveChoices(s,o,c,choices){
 if(c.cardId==="NEU-001"){
   const offer=choiceSpec(s,o,c).steps[0].options;
   const chosen=(choices.zav||[]).map(id=>id.slice(4)),day=isDay(s);
   const selected=day?chosen:offer.map(x=>x.cardId),pl=player(s,o);
   for(const id of selected){
     const source=s.cards[id];if(!source)continue;
     const summoned=summon(s,o,source);
     if(summoned){
       const fireUid=(choices.fireTarget||[])[0]?.slice(7);
       const target=fireUid?{kind:"minion",owner:other(o),uid:fireUid}:null;
       onMinionPlayed(s,o,summoned,id==="ZAV-005"?target:null);
     }
   }
   if(day){
     const rest=offer.map(x=>x.cardId).filter(id=>!selected.includes(id));
     pl.deck.push(...rest);shuffle(pl.deck,()=>rand(s));
   }
   log(s,c.name+": Раскопкі — "+selected.length+" призвано"+(day?", остальные замешаны в колоду.":"."));
   return;
 }
 const pl=player(s,o),steps=choiceSpec(s,o,c).steps;
 const entries=steps.flatMap(st=>(choices[st.key]||[]).map(id=>st.options.find(x=>x.id===id)));
 const deck=entries.filter(x=>x.id.startsWith("deck:"));
 // Запоминаем ID всех выбранных экземпляров до удаления из массива колоды.
 for(const idx of deck.map(x=>Number(x.id.split(":")[1])).sort((a,b)=>b-a))
   pl.deck.splice(idx,1);
 function toHand(cardId,discount=0){
  if(pl.hand.length>=10){discardCard(s,o,cardId,"overflow","graveyard");return;}
  addHandCard(s,o,{uid:uid(s),cardId,costAdjustment:discount},"graveyard");
 }
 function revive(x,transform=null){
  const definition=s.cards[x.cardId];if(!definition)return;
  const m=summon(s,o,definition,{summonedWithCorpses:c.costType==="corpses"});if(!m)return;
  if(c.cardId==="TKN-007")m.noDeathrattle=true;
  if(transform==="night"){m.creatureType="Дух";m.affinity="Ноч";}
  if(c.cardId==="CHR-021")addTimed(m,"night",0,o,2);
  return m;
 }
 switch(c.cardId){
  case "CHR-014":deck.forEach(x=>{
    const m=summon(s,o,s.cards[x.cardId]);if(m&&!isDay(s))buff(s,m,1,1);
   });break;
  case "KNZ-015":entries.forEach(x=>{
    const m=pl.board.find(y=>"board:"+y.uid===x.id);
    if(m)addTimed(m,"day",0,o,1);
   });break;
  case "NCR-021":
   for(const x of entries){
    const i=pl.graveyard.findIndex(g=>"grave:"+g.uid===x.id);
    if(i>=0){takeFromGrave(s,o,x.id.slice(6),"Карта NCR-021");toHand(x.cardId);}
   }
   break;
  case "NCR-027":case "TKN-007":
   for(const x of entries){
    const i=pl.graveyard.findIndex(g=>"grave:"+g.uid===x.id);
    if(i>=0&&revive(x))takeFromGrave(s,o,x.id.slice(6),"Карта "+c.cardId);
   }
   break;
  case "CHR-021":case "NEU-017":entries.forEach(x=>revive(x,c.cardId==="NEU-017"?"night":null));break;
 }
 log(s,c.name+": выбранные карты обработаны ("+entries.length+").");
}

function resurrectionPool(s,o){
 return player(s,o).graveyard.filter(entry=>!entry.token&&s.cards[entry.cardId]?.cardType==="creature");
}

function actionStatus(s,o,uidValue){
 if(s.phase!=="battle"||s.turn!==o)return {ok:false,reason:"Сейчас не ваш ход."};
 const p=player(s,o),h=p.hand.find(x=>x.uid===uidValue);
 if(!h)return {ok:false,reason:"Карта отсутствует в руке."};
 if(h.cardId==="__coin__")return {ok:true};
 const c=s.cards[h.cardId];if(!c)return {ok:false,reason:"Нет определения карты."};
 const cost=currentCost(s,o,h);
 if(!["mana","corpses"].includes(c.costType)&&!ZAV_IDS.includes(c.cardId))return {ok:false,reason:"Неизвестный вид стоимости."};
 if(c.costType==="mana"&&cost>p.mana)return {ok:false,reason:"Недостаточно маны."};
 if(c.costType==="corpses"&&cost>p.corpses)return {ok:false,reason:"Недостаточно трупов."};
 if(c.cardType==="creature"){
  if(p.board.length>=7)return {ok:false,reason:"На поле уже семь существ."};
  if(c.attack==null||c.health==null)return {ok:false,reason:"Нет атаки или здоровья."};
 }else if(c.cardType==="weapon"){
  if(c.attack==null||c.durability==null)return {ok:false,reason:"Нет атаки или прочности."};
 }else if(c.cardType==="spell"){
  if(abilitySupport(c)!=="complete"&&!(PLAYABLE_PARTIAL_SPELLS.has(c.cardId)&&!c.effectModified))return {ok:false,reason:"Эффект заклинания ещё не реализован или текст изменён относительно библиотеки."};
  if(c.cardId==="NCR-025"&&p.corpses<3)return {ok:false,reason:"Условие ритуала: минимум три трупа."};
  if(["NCR-027","TKN-007"].includes(c.cardId)&&p.board.length>=7)return {ok:false,reason:"Нет места для оживления."};
  if(c.cardId==="NCR-027"&&!needsSpellChoice(s,c.cardId)&&!resurrectionPool(s,o).length)
   return {ok:false,reason:"В вашем кладбище нет подходящих существ."};
  if(["NCR-026","NCR-028"].includes(c.cardId)&&
    s.rituals.filter(r=>r.owner===o).length+s.scheduled.filter(r=>r.owner===o&&r.ritual).length>=3)
    return {ok:false,reason:"Уже ожидают три Ритуала."};
 }else return {ok:false,reason:"Неизвестный вид карты."};
 let mode=targetMode(s,o,c);
 if(c.cardType==="creature"&&mode&&!targetsAvailable(s,o,c))mode=null;
 if(mode&&!targetsAvailable(s,o,c))return {ok:false,reason:"Нет подходящей цели для карты."};
 const choice=choiceSpec(s,o,c);
 if(choice?.blocked)return {ok:false,reason:choice.reason};
 return {ok:true,targetType:mode,cost,support:abilitySupport(c),choice:choice||null};
}
function resolveSpell(s,o,c,t,choices=null){
 const p=player(s,o),enemy=player(s,other(o)),m=t?.kind==="minion"?minion(s,t.owner,t.uid):null;
 if(needsSpellChoice(s,c.cardId)){resolveChoices(s,o,c,choices);return;}
 switch(c.cardId){
  // These spells say "Вазьміце з калоды", not "Выберыце". Drawing is
  // automatic and random among eligible entries; the player never picks.
  case "KNZ-008":
   drawRandomWhere(s,o,x=>x?.cardType==="creature"&&x.creatureTypeId==="Чалавек"&&
     x.costType==="mana"&&num(x.costValue)<=3);
   break;
  case "KNZ-009":
   drawRandomWhere(s,o,x=>x?.cardType==="creature"&&x.creatureTypeId==="Дух",
     isDay(s)?0:-1);
   break;
  case "KNZ-016":
   drawRandomWhere(s,o,x=>x?.cardType==="weapon");
   drawRandomWhere(s,o,x=>x?.cardType==="spell");
   break;
  case "KNZ-020":
   for(let i=0;i<2;i++)drawRandomWhere(s,o,x=>x?.cardType==="creature"&&
     x.creatureTypeId==="Чалавек",isDay(s)?-1:0);
   break;
  case "NEU-014":{
   const count=countPeasants(s,o)>=3?2:1;
   for(let i=0;i<count;i++)drawRandomWhere(s,o,x=>x?.cardType==="creature"&&
     x.creatureTypeId==="Чалавек"&&x.subtype==="Селянін");
   break;
  }
  case "NEU-023":
   if(t.kind==="hero")damageHero(s,t.owner,1);else damageMinion(s,t.owner,t.uid,1);break;
  case "KNZ-001":addTimed(m,"attack",1,o,1);break;
  case "KNZ-037":{
    const removed=cleanseKnownNegativeEffects(s,m);
    healMinion(s,t.owner,t.uid,2);
    log(s,c.name+": снято известных отрицательных состояний — "+removed+
      ". Остальные виды очищения требуют отдельного описания.");
    break;
  }
  case "CHR-038":{
    areaDamage(s,s.players.flatMap((pl,i)=>pl.board.filter(x=>x.creatureType!=="Нечысць").map(x=>[i,x])),2);
    if(!isDay(s))damageHero(s,other(o),2);
    break;
  }
  case "CHR-044":summonTokens(s,o,"TKN-008",3);break;
  case "KNZ-004":buff(s,m,0,2);if(!legacyRules(s)||isDay(s))m.taunt=true;break;
  case "KNZ-011":healMinion(s,t.owner,t.uid,4);if(isSpirit(m))buff(s,m,1,0);break;
  case "KNZ-014":damageMinion(s,t.owner,t.uid,p.weapon?5:3);break;
  case "KNZ-026":summonTokens(s,o,"TKN-001",3,isDay(s)?1:0);break;
  case "KNZ-031":
   for(const x of p.board.filter(isHuman)){buff(s,x,2,2);addTimed(x,"day",0,o,1);}break;
  case "KNZ-036":{
   const troops=summonTokens(s,o,"TKN-001",7,2,{taunt:true});
   if(legacyRules(s))for(const troop of troops)addTimed(troop,"day",0,o,2);
   break;
  }
  case "KNZ-038":addTimed(m,"frozen",0,t.owner,1);if(!isDay(s))damageMinion(s,t.owner,t.uid,2);break;
  case "CHR-001":{const actual=m?.health||0;damageMinion(s,t.owner,t.uid,1);
    if(actual>0&&!minion(s,t.owner,t.uid))draw(s,o);break;}
  case "CHR-003":damageHero(s,o,2);p.spiritDiscountThisTurn=1;break;
  case "CHR-005":summonTokens(s,o,"TKN-002",2);break;
  case "CHR-008":destroyMinion(s,t.owner,t.uid);draw(s,o);draw(s,o);break;
  case "CHR-010":areaDamage(s,s.players.flatMap((pl,i)=>pl.board.filter(x=>!isSpirit(x)).map(x=>[i,x])),isDay(s)?2:legacyRules(s)?3:5);break;
  case "CHR-018":
   for(const x of summonTokens(s,o,"TKN-003",3))addTimed(x,"night",0,o,2);
   for(const x of p.board.filter(isSpirit))if(!x.timed.some(y=>y.kind==="night"))addTimed(x,"night",0,o,2);
   break;
  case "CHR-025":buff(s,m,0,3);m.taunt=true;if(isDay(s))draw(s,o);break;
  case "CHR-037":damageHero(s,o,3);{
    const before=new Set(p.hand.map(h=>h.uid));
    draw(s,o);draw(s,o);
    if(!isDay(s))for(const h of p.hand)if(!before.has(h.uid))h.costAdjustment-=1;
   }break;
  case "NEU-013":addTimed(m,"attack",countPeasants(s,o)>=3?2:1,o,1);break;
  case "NEU-015":
   addTimed(m,"attack",-2,t.owner,1);
   if(countPeasants(s,o)>=3)buff(s,m,0,-2);
   removeDead(s);break;
  case "NEU-016":summonTokens(s,o,"TKN-004",3);break;
  case "NEU-018":{
   const community=countPeasants(s,o)>=3;
   for(const x of p.board.filter(isPeasant))buff(s,x,1,2);
   if(community)draw(s,o);break;
  }
  case "NEU-020":for(const x of p.board.filter(isCat))x.reborn=true;break;
  case "NEU-021":drawRandomWhere(s,o,x=>x?.cardType==="creature"&&x?.subtype==="Кот");break;
  case "NCR-017":adjustCorpses(s,o,2,"Заклинание NCR-017");break;
  case "NCR-018":destroyMinion(s,o,m.uid);draw(s,o);draw(s,o);break;
  case "NCR-019":addTimed(m,"frozen",0,t.owner,1);damageMinion(s,t.owner,t.uid,3);break;
  case "NCR-020":{const done=damageMinion(s,t.owner,t.uid,3);healHero(s,o,done);break;}
  case "NCR-022":areaDamage(s,s.players.flatMap((pl,i)=>pl.board.map(x=>[i,x])),3);break;
  case "NCR-023":buff(s,m,0,2);addTimed(m,"night",0,o,2);
   m.timed[m.timed.length-1].source="NCR-023";
   s.scheduled.push({
     kind:"remove-hp",owner:o,targetUid:m.uid,amount:2,remainingStarts:1});
   break;
  case "NCR-024":destroyMinion(s,t.owner,t.uid);break;
  case "NCR-025":if(!legacyRules(s))adjustCorpses(s,o,-3,"Ритуал Дзяды");draw(s,o);draw(s,o);healHero(s,o,3);break;
  case "NCR-026":s.rituals.push({cardId:c.cardId,owner:o,progress:0});break;
  case "NCR-027":{
   const entry=pick(s,resurrectionPool(s,o));
   if(entry&&summon(s,o,s.cards[entry.cardId],{summonedWithCorpses:true}))
    takeFromGrave(s,o,entry.uid,"Карта NCR-027");
   break;
  }
  case "NCR-028":s.scheduled.push({kind:"second-turn",cardId:c.cardId,ritual:true,owner:o,targetUid:legacyRules(s)?m.uid:undefined,remainingStarts:2});break;
  default:throw new Error("Нет обработчика заклинания "+c.cardId);
 }
}
function onMinionPlayed(s,o,m,target,choices=null){
 const p=player(s,o);
 switch(m.cardId){
  case "KNZ-007":
    drawRandomWhere(s,o,c=>c?.cardType==="weapon");
    drawRandomWhere(s,o,c=>c?.cardType==="creature"&&
      (c.subtype==="Дружына"||c.subtype==="Дружыннік"));
    break;
  case "CHR-031":{
    const victim=target&&target.kind==="minion"?minion(s,target.owner,target.uid):null;
    if(victim&&!victim.infected){
      victim.infected=true;
      log(s,victim.name+" заражена картой ЛІХАМАНКА.",
        {kind:"effect",owner:o,cardId:m.cardId});
    }
    break;
  }
  case "NEU-001":resolveChoices(s,o,s.cards[m.cardId],choices);break;
  case "NEU-028":{
    combatBatch(s,"area",()=>{
     for(const [owner,pl]of s.players.entries())for(const x of [...pl.board])if(x.uid!==m.uid)damageMinion(s,owner,x.uid,5,"spell",true);
     damageHero(s,0,5);damageHero(s,1,5);
    });
    removeDead(s);
    if(legacyRules(s)){
     for(const [owner,side] of s.players.entries()){
      for(const h of side.hand)discardCard(s,owner,h.cardId,"burn","NEU-028");
      side.hand=[];
     }
    }else igniteHands(s);
    removeDead(s);
    break;
  }
  case "NEU-048":{
    if(target?.kind==="hero")healHero(s,target.owner,6);
    else if(target?.kind==="minion")healMinion(s,target.owner,target.uid,6);
    break;
  }
  case "NEU-049":{
    for(const side of s.players)for(const unit of side.board)if(isHuman(unit))buff(s,unit,1,1);
    break;
  }
  case "NEU-033":player(s,other(o)).nextTurnAttackReduction=num(player(s,other(o)).nextTurnAttackReduction)+2;break;
  case "ZAV-001":{
    healHero(s,o,3);
    if(!isDay(s))for(const x of [...p.board])healMinion(s,o,x.uid,2);
    break;
  }
  case "ZAV-002":{
    const options=player(s,other(o)).hand.filter(h=>h.cardId!=="__coin__");
    const picked=pick(s,options);
    if(picked)addHandCard(s,o,{uid:uid(s),cardId:picked.cardId,costAdjustment:1},"created");
    break;
  }
  case "ZAV-005":{
    if(target&&target.kind==="minion"&&target.owner===other(o))
      damageMinion(s,target.owner,target.uid,isDay(s)?2:3);
    else log(s,"ВОГНЕННЫ ДУХ: нет выбранной вражеской цели, боевой клич пропущен.");
    break;
  }
  case "KNZ-013":if(p.weapon){const before=clean(p.weapon);p.weapon.durability++;weaponEvent(s,o,before,"repair");}break;
  case "KNZ-022":{
   const available=p.deck.map(id=>s.cards[id]).filter(Boolean);
   if(available.length){
    const mostExpensive=Math.max(...available.map(c=>num(c.costValue)));
    drawRandomWhere(s,o,c=>!!c&&num(c.costValue)===mostExpensive);
   }
   break;
  }
  case "NCR-008":drawRandomWhere(s,o,c=>c?.cardType==="spell"&&c.spellForm==="Ритуал");break;
  case "KNZ-017":healMinion(s,o,target.uid,isSpirit(minion(s,o,target.uid))?5:3);break;
  case "KNZ-027":{
    const spirits=p.graveyard.filter(g=>!g.token&&s.cards[g.cardId]?.creatureTypeId==="Дух");
    const g=pick(s,spirits);if(g)addHandCard(s,o,{uid:uid(s),cardId:g.cardId,costAdjustment:-1},"graveyard");break;}
  case "KNZ-034":summonTokens(s,o,"TKN-001",2,0,{charge:true});break;
  case "KNZ-035":{
   const old=legacyRules(s),bonus=old?2:4;
   for(const x of p.board.filter(isHuman)){
    if(x!==m)buff(s,x,bonus,bonus);
    if(old)addTimed(x,"day",0,o,2);
   }
   break;
  }
  case "CHR-004":if(p.lastDamageTurn===s.turns)buff(s,m,1,1);break;
  case "CHR-007":if(!isDay(s))damageMinion(s,other(o),target.uid,legacyRules(s)?2:5);break;
  case "CHR-020":
   summonTokens(s,o,"TKN-002",7);
   for(const x of [...p.board].filter(x=>x!==m&&isSpirit(x)))buff(s,x,1,1);
   break;
  case "CHR-012":if(p.lastDamageTurn===s.turns)m.taunt=true;break;
  case "CHR-024":addTimed(minion(s,other(o),target.uid),"attack",-2,other(o),1);break;
  case "CHR-032":damageHero(s,o,2);draw(s,o);if(!isDay(s))draw(s,o);break;
  case "CHR-033":damageHero(s,o,3);draw(s,o);draw(s,o);break;
  case "CHR-034":areaDamage(s,player(s,other(o)).board.map(x=>[other(o),x]),1);break;
  case "CHR-036":{const v=minion(s,other(o),target.uid);const hp=v?.health||0;
    damageMinion(s,other(o),target.uid,4);if(hp>0&&!minion(s,other(o),target.uid))draw(s,o);break;}
  case "NEU-009":if(countPeasants(s,o)>=3)draw(s,o);break;
  case "NEU-024":
   // Только заклинания противника на его следующем ходу.
   player(s,other(o)).enemySpellTax=1;break;
  case "NEU-025":if(p.board.length===1)buff(s,m,3,3);break;
  case "NEU-026":summonTokens(s,o,"TKN-006",1);break;
  case "NEU-029":p.maxMana=Math.min(10,p.maxMana+1);p.mana=Math.min(10,p.mana+1);break;
  case "NEU-034":p.nextSpellDiscount=1;break;
  case "NEU-035":if(!isDay(s))draw(s,o);break;
  case "NEU-036":draw(s,o);if(isDay(s))healHero(s,o,2);break;
  case "NEU-038":
    for(const x of p.board)healMinion(s,o,x.uid,2);
    if(isDay(s))for(const x of p.board)addTimed(x,"attack",1,o,1);
    break;
  case "NEU-043":{
    // КОТ БАЮН: одновременно 5 всем существам, 10 Людям, включая союзников.
    const targets=s.players.flatMap((pl,i)=>pl.board.map(x=>[i,x]));
    combatBatch(s,"area",()=>{for(const [owner,x] of targets)if(minion(s,owner,x.uid))
      damageMinion(s,owner,x.uid,isHuman(x)?10:5,"spell",true);});
    removeDead(s);break;
  }
  case "NEU-044":{
    // МАРАНА: 3 всем остальным; лечение по числу убитых непосредственно уроном.
    const targets=s.players.flatMap((pl,i)=>pl.board.filter(x=>x.uid!==m.uid).map(x=>[i,x]));
    combatBatch(s,"area",()=>{for(const [owner,x] of targets)if(minion(s,owner,x.uid))
      damageMinion(s,owner,x.uid,3,"spell",true);});
    const dead=targets.filter(([owner,x])=>minion(s,owner,x.uid)?.health<=0).length;
    removeDead(s);
    if(dead)healHero(s,o,dead);
    break;
  }
  case "NCR-001":adjustCorpses(s,o,1,"Боевой клич NCR-001");break;
  case "NCR-004":if(p.corpses>=3)draw(s,o);break;
  case "NCR-010":{const dmg=damageMinion(s,other(o),target.uid,2);healHero(s,o,dmg);break;}
 }
}
function onWeaponPlayed(s,o,w,target){
 const p=player(s,o);
 switch(w.cardId){
  case "CHR-006":damageHero(s,o,2);drawRandomWhere(s,o,c=>c?.cardType==="creature"&&c.creatureTypeId==="Дух");break;
  case "KNZ-006":for(const x of p.board.filter(isDruzhina))buff(s,x,2,0);break;
  case "CHR-015":{const m=minion(s,o,target.uid),spirit=isSpirit(m);
    destroyMinion(s,o,target.uid);if(spirit)w.durability+=2;break;}
 }
}
function onWeaponAttack(s,o,killedMinion,wasMinion){
 const p=player(s,o),w=p.weapon;if(!w)return;
 switch(w.cardId){
  case "KNZ-018":if(killedMinion){const x=chooseWounded(s,o);if(x)healMinion(s,o,x.uid,2);}break;
  case "KNZ-021":if(wasMinion)summonTokens(s,o,"TKN-001",1);break;
  case "KNZ-029":{const x=randomMinion(s,o,isHuman);if(x)buff(s,x,1,1);break;}
  case "KNZ-033":for(const x of p.board.filter(isHuman))addTimed(x,"attack",1,o,1);break;
  case "NEU-011":{const x=randomMinion(s,o,isPeasant);if(x)buff(s,x,1,0);break;}
  case "NEU-012":for(const x of p.board.filter(x=>isPeasant(x)&&effectiveAttack(s,x)===1))addTimed(x,"attack",1,o,1);break;
  case "CHR-019":summonTokens(s,o,"TKN-003",1);break;
  case "NCR-029":if(killedMinion)adjustCorpses(s,o,1,"Оружие NCR-029");break;
 }
}
function onCardPlayed(s,o,card){
 const p=player(s,o);
 if(card.cardType==="creature"&&card.creatureTypeId==="Дух"){
  const w=p.weapon;
  if(w?.cardId==="CHR-011"&&w.lastTriggerTurn!==s.turns){
   const targets=player(s,other(o)).board.slice().sort((a,b)=>a.health-b.health);
   if(targets.length){w.lastTriggerTurn=s.turns;damageMinion(s,other(o),targets[0].uid,1);}
  }
 }
 const staff=p.weapon;
 if(legacyRules(s)&&staff?.cardId==="NCR-030"&&card.cardType==="spell"&&card.spellForm==="Ритуал"){
  draw(s,o);const before=clean(staff);staff.durability--;
  if(staff.durability<=0)p.weapon=null;
  weaponEvent(s,o,before,"ritual");
 }
}
function onEndTurn(s,o){
 const p=player(s,o);
 // Призванный силой Чернобога Мертвец погибает в конце текущего хода.
 // Own token deaths also grant the approved base corpse.
 const expiring=p.board.filter(m=>m.heroPowerToken==="undead"&&m.expiresEndTurn===o);
 for(const m of expiring)m.health=0;
 if(expiring.length)removeDead(s);
 for(const src of [...p.board]){
  if(!minion(s,o,src.uid)||src.silenced)continue;
  switch(src.cardId){
   case "CHR-045":summonTokens(s,o,"TKN-009",7-p.board.length);break;
   case "KNZ-023":for(const x of p.board.filter(x=>isHuman(x)||isSpirit(x)))healMinion(s,o,x.uid,1);break;
   case "NEU-006":for(const x of p.board.filter(x=>x.uid!==src.uid&&isPeasant(x)))healMinion(s,o,x.uid,1);break;
   case "NEU-031":healHero(s,o,4);for(const x of p.board)healMinion(s,o,x.uid,4);break;
   case "NEU-037":{const x=chooseWounded(s,o);if(x)healMinion(s,o,x.uid,1);break;}
   case "NEU-040":{
     const own=player(s,o).board;
     if(!own.length)break;
     const lowest=Math.min(...own.map(x=>effectiveAttack(s,x)));
     const minima=own.filter(x=>effectiveAttack(s,x)===lowest);
     if(legacyRules(s)&&minima.length>1){
      log(s,"ЖЫЦЕНЬ: равная минимальная атака; выбор требует утверждения.",{kind:"rules-pending",owner:o});
      break;
     }
     const chosen=minima.length===1?minima[0]:pick(s,minima);
     if(chosen){buff(s,chosen,1,1);
       log(s,"ЖЫЦЕНЬ усиливает "+chosen.name+" на +1/+1.",
         {kind:"buff",owner:o,cardId:chosen.cardId});}
     break;
   }
   case "NEU-041":{const x=randomMinion(s,other(o),()=>true);
     if(x)damageMinion(s,other(o),x.uid,1);if(isDay(s))healHero(s,o,1);break;}
   case "CHR-035":{
     areaDamage(s,player(s,other(o)).board.map(x=>[other(o),x]),1);
     damageHero(s,other(o),1);break;
   }
  }
 }
}
function onStartTurn(s,o){
 const staff=player(s,o).weapon;
 if(!legacyRules(s)&&staff?.cardId==="NCR-030"){
  drawRandomWhere(s,o,c=>c?.cardType==="spell"&&c.spellForm==="Ритуал");
  const before=clean(staff);staff.durability--;
  if(staff.durability<=0)player(s,o).weapon=null;
  weaponEvent(s,o,before,"start-turn-ritual-search");
 }
 // ЛІХАМАНКА: в начале собственного хода заражённого существа 1 урон.
 // Повторное заражение не создаёт неутверждённых дополнительных стеков.
 for(const m of [...player(s,o).board].filter(x=>x.infected===true))
   if(minion(s,o,m.uid)&&s.phase==="battle")damageMinion(s,o,m.uid,1,"effect");
 for(const task of [...s.scheduled]){
  if(task.owner!==o)continue;
  task.remainingStarts--;
  if(task.remainingStarts>0)continue;
  const m=minion(s,o,task.targetUid);
  if(task.kind==="second-turn"){
   if(task.targetUid==null){
    for(const unit of player(s,o).board)buff(s,unit,2,2);
   }else if(m){
    addTimed(m,"night",0,o,1);addTimed(m,"attack",12,o,1);
   }
  }else if(m){
   if(task.kind==="remove-hp"){
    buff(s,m,0,-task.amount);
    m.timed=m.timed.filter(t=>t.source!=="NCR-023");
    removeDead(s);
   }
  }
  task.done=true;
 }
 s.scheduled=s.scheduled.filter(t=>!t.done);
}
function startTurn(s,o){
 if(s.phase!=="battle")return;
 const p=player(s,o);
 s.turn=o;s.turns++;
 p.turnAttackReduction=num(p.nextTurnAttackReduction);p.nextTurnAttackReduction=0;
 // At start of turn pending ritual/temporary effects resolve before mana/draw.
 p.heroAttacked=false;p.heroPowerUsed=false;
 p.board.forEach(m=>{m.ready=true;m.attacked=false;});
 combatEvent(s,"turnStage",{stage:"start",owner:o});
 resolveAction(s,()=>onStartTurn(s,o));if(s.phase==="ended")return;
 p.maxMana=Math.min(10,p.maxMana+1);p.mana=p.maxMana;
 // Pending attack prohibition lasts through this owner's turn, then expires at its end.
 combatEvent(s,"turnStage",{stage:"resources",owner:o});
 resolveAction(s,()=>draw(s,o));if(s.phase!=="battle")return;
 combatEvent(s,"turnStage",{stage:"ready",owner:o});
 log(s,"Ход "+s.turns+" · "+(o===0?"Игрок":"Бот")+" · "+
      String(s.time).padStart(2,"0")+":00 · "+phaseOfHour(s.time)+".",{kind:"turn",owner:o});
}
function endTurn(s,o){
 if(s.phase!=="battle"||s.turn!==o)return {ok:false,reason:"Сейчас не ваш ход."};
 combatEvent(s,"turnStage",{stage:"end-effects",owner:o});
 resolveAction(s,()=>onEndTurn(s,o));
 if(s.phase!=="battle")return {ok:true};
 resolveAction(s,()=>{
 // Two next personal turns; death effects must never trigger on discarded cards.
 const burning=player(s,o),old=burning.hand.length;
 burning.hand=burning.hand.filter(h=>{
   if(h.burnTurnsLeft==null||h.burnStartedAt>=s.turns)return true;
   h.burnTurnsLeft--;
   if(h.burnTurnsLeft>0)return true;
   discardCard(s,o,h.cardId,"burn","hand");
   log(s,"Падпал: "+(o===0?(s.cards[h.cardId]?.name||h.cardId):"Карта соперника")+" сгорела в руке "+(o===0?"игрока":"бота")+".");
   return false;
 });
 if(old!==burning.hand.length)log(s,"Падпал: сброшено "+(old-burning.hand.length)+" карт.");
 for(const pl of s.players)for(const m of pl.board){
  for(const t of m.timed)if(t.untilOwner===o)t.remaining--;
  m.timed=m.timed.filter(t=>t.remaining>0);
 }
 for(const task of s.scheduled)if(task.kind==="remove-hp"&&task.owner===o){} // start-turn task
 const p=player(s,o);
 p.turnAttackReduction=0;
 p.nextSpellDiscount=0;
 // Discount "next Spirit this turn" expires on its current owner's turn.
 p.spiritDiscountThisTurn=0;
 if(p.enemySpellTax>0)p.enemySpellTax--;
 p.mana=0;
 removeDead(s);combatEvent(s,"turnStage",{stage:"expired",owner:o});
 });
 if(s.phase==="battle"){
  const previousHour=s.time;s.time=(s.time+1)%24;resolveAction(s,()=>{syncAuras(s);removeDead(s);});
  combatEvent(s,"clockAdvanced",{owner:o,previousHour,hour:s.time});
  if(s.phase==="battle")startTurn(s,other(o));
 }
 return {ok:true};
}
function playCardResolved(s,o,uidValue,target=null,choices=null,position=null){
 // Reject stale/invalid placement before payment, choices, or mutation.
 if(position!==null&&(!Number.isInteger(position)||position<0||position>player(s,o).board.length))
  return {ok:false,reason:"Место размещения недоступно."};
 const check=actionStatus(s,o,uidValue);if(!check.ok)return check;
 const p=player(s,o),idx=p.hand.findIndex(x=>x.uid===uidValue),h=p.hand[idx];
 if(h.cardId==="__coin__"){p.hand.splice(idx,1);p.mana++;log(s,"Монетка: +1 временная мана.");return {ok:true};}
 const c=s.cards[h.cardId];
 if(c.cardId==="NEU-048"&&!target)return {ok:false,reason:"Выберите существо или героя для лечения.",requiresTarget:true};
 if((check.targetType||(target&&TARGETS[c.cardId]))&&(target||c.cardType==="spell")&&!targetValid(s,o,c.cardId,target))return {ok:false,reason:"Нужна подходящая цель.",requiresTarget:true};
 const verified=validateChoices(s,o,c,choices);
 if(!verified.ok)return verified; // Не оплачивать карту до проверки полного выбора.
 const payment=check.cost;
 // No payment or mutation before the target is confirmed.
 if(c.costType==="corpses")adjustCorpses(s,o,-payment,"Стоимость карты "+c.cardId);else p.mana-=payment;
 p.hand.splice(idx,1);
 if(c.cardType==="creature"&&c.creatureTypeId==="Дух"){
  if(p.spiritDiscountThisTurn)p.spiritDiscountThisTurn=0;
  else if(p.nextSpiritDiscount)p.nextSpiritDiscount=0;
 }
 if(c.cardType==="spell"&&p.nextSpellDiscount)p.nextSpellDiscount=0;
 if(c.cardType==="creature"){
  const m=summon(s,o,c,{summonedWithCorpses:c.costType==="corpses",position});
  if(m?.unsupported)log(s,c.name+": способность реализована не полностью.");
   if(m&&(!m.unsupported||PLAYABLE_PARTIAL_CREATURES.has(c.cardId))&&(!TARGETS[c.cardId]||target))
     combatCause(s,{kind:"card",owner:o,uid:m.uid,cardId:c.cardId},()=>onMinionPlayed(s,o,m,target,choices));
 }else if(c.cardType==="weapon"){
  const weapon={cardId:c.cardId,name:c.name,attack:num(c.attack),durability:num(c.durability),lastTriggerTurn:-1};
  const priorWeapon=clean(p.weapon);p.weapon=weapon;weaponEvent(s,o,priorWeapon,"equip");
  if(abilitySupport(c)!=="complete")log(s,c.name+": дополнительная способность пока не реализована.");
  else onWeaponPlayed(s,o,weapon,target);
 }else if(c.cardType==="spell"){
  combatCause(s,{kind:"card",owner:o,cardId:c.cardId},()=>resolveSpell(s,o,c,target,choices));
 }
 onCardPlayed(s,o,c);
 syncAuras(s);removeDead(s);checkEnd(s);
 log(s,(o===0?"Игрок":"Бот")+" разыгрывает "+c.name+".",{kind:"play",owner:o,cardId:c.cardId});
 return {ok:true};
}
function eligibleAttackTargets(s,o){
 const enemy=player(s,other(o)),taunts=enemy.board.filter(m=>m.taunt&&!m.stealth);
 return taunts.length?taunts.map(m=>({kind:"minion",owner:other(o),uid:m.uid})):
   [...enemy.board.filter(m=>!m.stealth).map(m=>({kind:"minion",owner:other(o),uid:m.uid})),
     {kind:"hero",owner:other(o)}];
}
function attackStatus(s,o,attackerUid,target,hero=false){
 if(s.phase!=="battle"||s.turn!==o)return {ok:false,reason:"Сейчас не ваш ход."};
 const p=player(s,o),allowed=eligibleAttackTargets(s,o);
 if(!target||!allowed.some(t=>t.kind===target.kind&&t.owner===target.owner&&
  (target.kind==="hero"||target.uid===t.uid)))
  return {ok:false,reason:"Недопустимая цель: проверьте Правакацыю и Маскіроўку."};
 let a,damage,weaponUsed=p.weapon,wasMinion=target.kind==="minion";
 if(hero){
  if(!p.weapon||p.heroAttacked||p.weapon.attack<=0)return {ok:false,reason:"Герой не готов атаковать."};
  damage=p.weapon.attack;
 }else{
  a=minion(s,o,attackerUid);
  if(!a||!a.ready||a.attacked||a.timed.some(t=>t.kind==="frozen"))return {ok:false,reason:"Существо не готово атаковать."};
  if(a.cardId==="NCR-009"&&target.kind==="hero")return {ok:false,reason:"Касцяны ваяр не атакует героев."};
  if(hasKasnaRush(s,o,a)&&a.summonedTurn===s.turns&&target.kind==="hero")return {ok:false,reason:"Націск в ход появления разрешает атаковать только существ."};
  damage=effectiveAttack(s,a);if(damage<=0)return {ok:false,reason:"Атака равна 0."};
 }
 return {ok:true};
}
function attackResolved(s,o,attackerUid,target,hero=false){
 const status=attackStatus(s,o,attackerUid,target,hero);if(!status.ok)return status;
 const p=player(s,o),a=hero?null:minion(s,o,attackerUid),weaponUsed=p.weapon,wasMinion=target.kind==="minion";
 const damage=hero?p.weapon.attack:effectiveAttack(s,a);
 let died=false,dealt=0,counterDealt=0,defender=null;
 combatCause(s,{kind:"attack",owner:o,uid:hero?null:attackerUid,hero,target},()=>combatBatch(s,"combat",()=>{
  if(target.kind==="hero")dealt=damageHero(s,other(o),damage);
  else{
   const m=minion(s,other(o),target.uid),counter=effectiveAttack(s,m),before=m.health;defender=m;
   dealt=damageMinion(s,other(o),m.uid,damage,"combat",true);
   if(hero)counterDealt=damageHero(s,o,counter);else counterDealt=damageMinion(s,o,a.uid,counter,"combat",true);
   died=before>0&&m.health<=0;
  }
 }));
 const steal=(owner,source,actual)=>{if(source&&!source.silenced&&["CHR-040","NCR-007"].includes(source.cardId)&&actual>0)healHero(s,owner,actual);};
 steal(o,a,dealt);steal(other(o),defender,counterDealt);
 if(a&&!a.silenced&&a.cardId==="CHR-040"&&died&&a.health>0&&hasSwarm(s,o,a))buff(s,a,1,1);
 if(defender&&!defender.silenced&&defender.cardId==="CHR-040"&&a?.health<=0&&defender.health>0&&hasSwarm(s,other(o),defender))buff(s,defender,1,1);
 if(target.kind==="minion")removeDead(s);
 if(hero){
  p.heroAttacked=true;
  if(weaponUsed){combatCause(s,{kind:"weapon",owner:o,cardId:weaponUsed.cardId},()=>onWeaponAttack(s,o,died,wasMinion));
    // Weapon might have been removed by an effect; decrement only if still equipped.
    const priorWeapon=clean(p.weapon);
    if(p.weapon===weaponUsed){weaponUsed.durability--;if(weaponUsed.durability<=0)p.weapon=null;}
    weaponEvent(s,o,priorWeapon,"attack");
  }
 }else{
  a.attacked=true;
  if(a.stealth)a.stealth=false;
  if(a.cardId==="ZAV-003"&&died)buff(s,a,0,1);
   if(a.cardId==="CHR-013"&&dealt>0)healHero(s,o,2);
 }
 combatEvent(s,"attackConsumed",{owner:o,hero,attackerUid});
 log(s,(o===0?"Игрок":"Бот")+" атакует "+(target.kind==="hero"?"героя":"существо")+".",{kind:"attack",owner:o});
 checkEnd(s);return {ok:true};
}
// v2.0 test bot: tactical priority uses only existing engine rules and approved card values.
function chooseTargetForBot(s,o,cardId){
 const c=s.cards[cardId],mode=targetMode(s,o,c||{cardId});
 if(!mode)return null;
 const options=[];
 for(let owner=0;owner<2;owner++)for(const m of player(s,owner).board){
  const t={kind:"minion",owner,uid:m.uid};
  if(targetValid(s,o,cardId,t))options.push(t);
 }
 if(mode==="any"){
  const enemy=player(s,other(o));
  // "ЦАП-ЦАРАП": a lethal hero hit takes precedence.
  if(enemy.health<=1)return {kind:"hero",owner:other(o)};
  if(!options.length)return {kind:"hero",owner:other(o)};
 }
 if(!options.length)return null;
 const heals=new Set(["KNZ-017","KNZ-037"]);
 const buffs=new Set(["KNZ-001","KNZ-004","KNZ-011","KNZ-015","NCR-018","NCR-023","NCR-028","CHR-008","CHR-025"]);
 const weaken=new Set(["NEU-015","CHR-024","CHR-036"]);
 const score=t=>{
  const m=minion(s,t.owner,t.uid),enemy=t.owner!==o,missing=Math.max(0,m.maxHealth-m.health);
  if(heals.has(cardId))return missing*4+effectiveAttack(s,m)*.3+(isSpirit(m)?2:0);
  if(buffs.has(cardId))return effectiveAttack(s,m)*1.3+m.health*.25+(m.ready&&!m.attacked?2:0);
  if(enemy){
   const damage=cardId==="CHR-001"?1:cardId==="NCR-020"?3:cardId==="NCR-010"?2:
    cardId==="KNZ-014"?3:cardId==="KNZ-038"?4:cardId==="NEU-023"?1:0;
   const lethal=damage&&m.health<=damage?12:0;
   return lethal+effectiveAttack(s,m)*1.2+(m.taunt?2:0)+
     (weaken.has(cardId)?effectiveAttack(s,m)*2:0)-Math.max(0,damage-m.health)*.15;
  }
  return -(effectiveAttack(s,m)*1.2+m.health);
 };
 options.sort((x,y)=>score(y)-score(x)||String(x.uid).localeCompare(String(y.uid)));
 return options[0];
}
function botPlayScore(s,o,entry){
 const c=entry.c,p=player(s,o),cost=entry.status.cost??num(c.costValue);
 if(!c)return -9999;
 let value=0;
 if(c.cardType==="creature"){
  value=4+num(c.attack)*.65+num(c.health)*.55+Math.min(cost,8)*.2;
  if(p.board.length===0)value+=1.5;
  if(/Правакацыя/.test(String(c.ability)))value+=2;
  if(p.board.length>=6)value-=3;
 }else if(c.cardType==="weapon"){
  value=3+num(c.attack)*.75+num(c.durability)*.5;
  if(p.weapon)value-=4; // avoid wasting existing durability
 }else if(c.cardType==="spell"){
  value=3+Math.min(cost,8)*.15;
  const text=String(c.ability||"");
  if(/Вазьм|вазм|Вазьмі|Добор/.test(text))value+=p.hand.length<6?2.5:-1;
  if(/аднаўля|леч/.test(text))value+=p.health<18?3:-1;
  if(c.cardId==="NCR-017"&&p.corpses<3)value+=4;
  if(c.cardId==="CHR-038"||c.cardId==="NCR-022"){
   const enemies=player(s,other(o)).board.length,allies=p.board.length;
   value+=enemies*1.4-allies*.7;
  }
  if(c.cardId==="CHR-044")value+=Math.min(3,7-p.board.length)*1.5;
 }else value=-30;
 return value-cost*.1;
}
function botAttackScore(s,o,attacker,target,hero=false){
 const me=player(s,o),enemy=player(s,other(o));
 const damage=hero?num(me.weapon?.attack):effectiveAttack(s,attacker);
 if(target.kind==="hero")
  return enemy.health<=damage?1000:5+damage*.9+(enemy.board.length?-.5:1);
 const defender=minion(s,target.owner,target.uid);
 if(!defender)return -1000;
 const trueDamage=damage*incomingMultiplier(s,defender,"combat");
 const retaliation=effectiveAttack(s,defender);
 const ownHealth=hero?me.health+me.armor:attacker.health;
 const retaliationDamage=hero?retaliation:retaliation*incomingMultiplier(s,attacker,"combat");
 const kills=trueDamage>=defender.health;
 const dies=retaliationDamage>=ownHealth;
 return (kills?15:0)+effectiveAttack(s,defender)*1.5+
   (defender.taunt?2:0)+Math.min(trueDamage,defender.health)*.25-
   (dies?hero?12:6+effectiveAttack(s,attacker):0);
}
function* botTurnFrames(s,o=1,dispatch=null){
 const invoke=(name,args)=>dispatch?dispatch(name,args):({playCard,attack,useHeroPower,endTurn}[name])(s,...args);
 if(s.phase!=="battle"||s.turn!==o)return {ok:false,reason:"Не ход управляемого игрока."};
 const p=player(s,o),actions=[];
 // Если летальная атака уже доступна без провокации, не тратим ману прежде неё.
 const enemy=player(s,other(o)),blockers=enemy.board.some(m=>m.taunt&&!m.stealth);
 const lethalAttackers=p.board.filter(m=>m.ready&&!m.attacked&&effectiveAttack(s,m)>0&&
    !m.timed.some(t=>t.kind==="frozen")&&m.cardId!=="NCR-009");
 const lethalDamage=lethalAttackers.reduce((x,m)=>x+effectiveAttack(s,m),0)+
   (p.weapon&&!p.heroAttacked?Math.max(0,p.weapon.attack):0);
 if(!blockers&&lethalDamage>=enemy.health+enemy.armor){
   for(const m of lethalAttackers){
     if(s.phase!=="battle")break;
     const r=invoke("attack",[o,m.uid,{kind:"hero",owner:other(o)}]);
     if(r.ok){actions.push({type:"attack",target:"hero",lethal:true});yield actions[actions.length-1];}
   }
   if(s.phase==="battle"&&p.weapon&&!p.heroAttacked){
     const r=invoke("attack",[o,null,{kind:"hero",owner:other(o)},true]);
     if(r.ok){actions.push({type:"attack",target:"hero",lethal:true});yield actions[actions.length-1];}
   }
   if(s.phase==="ended")return {ok:true,actions};
 }
 for(let iteration=0;iteration<25&&s.phase==="battle";iteration++){
  const options=p.hand.map(h=>({h,c:s.cards[h.cardId],status:actionStatus(s,o,h.uid)}))
   .filter(x=>x.status.ok&&x.c)
   .map(x=>({...x,target:chooseTargetForBot(s,o,x.h.cardId)}))
   .filter(x=>!x.status.targetType||x.target);
  if(!options.length)break;
  options.sort((a,b)=>botPlayScore(s,o,b)-botPlayScore(s,o,a)||
   num(b.c?.costValue)-num(a.c?.costValue)||String(a.h.uid).localeCompare(String(b.h.uid)));
  let played=false;
  for(const option of options){
   const decisions=option.status.choice?botChoices(option.status.choice):null;
   const result=invoke("playCard",[o,option.h.uid,option.target,decisions]);
   if(result.ok){played=true;actions.push({type:"play",cardId:option.h.cardId});yield actions[actions.length-1];break;}
  }
  if(!played)break;
 }
 if(s.phase==="battle"){
  const power=heroPowerStatus(s,o);
  if(power.ok){
   const humans=p.board.filter(isHuman);
   humans.sort((a,b)=>effectiveAttack(s,b)-effectiveAttack(s,a));
   const target=power.id==="warlock-drain"?{kind:"hero",owner:other(o)}:
     power.targeted&&humans.length?{kind:"minion",owner:o,uid:humans[0].uid}:null;
   const result=invoke("useHeroPower",[o,target]);
   if(result.ok){actions.push({type:"hero-power",id:result.id});yield actions[actions.length-1];}
  }
  const attackers=[...p.board.filter(m=>m.ready&&!m.attacked&&!m.timed.some(t=>t.kind==="frozen"))
    .map(m=>({uid:m.uid,hero:false}))];
  if(p.weapon&&!p.heroAttacked)attackers.push({uid:null,hero:true});
  for(const a of attackers){
   if(s.phase!=="battle")break;
   const self=a.hero?null:minion(s,o,a.uid);
   if(!a.hero&&!self)continue;
   const opts=eligibleAttackTargets(s,o).filter(t=>!(t.kind==="hero"&&!a.hero&&self?.cardId==="NCR-009"));
   if(!opts.length)continue;
   opts.sort((x,y)=>botAttackScore(s,o,self,y,a.hero)-botAttackScore(s,o,self,x,a.hero));
   const goal=opts[0];
   const result=invoke("attack",[o,a.uid,goal,a.hero]);
   if(result.ok){actions.push({type:"attack",target:goal.kind,uid:goal.uid||null});yield actions[actions.length-1];}
  }
 }
 if(s.phase==="battle")invoke("endTurn",[o]);
 return {ok:true,actions};
}
function runBotTurn(s,o=1){
 // The published synchronous API drains the same strategic iterator.
 // RNG calls, decisions, state mutations and the returned actions stay identical.
 const steps=botTurnFrames(s,o);
 let next=steps.next();
 while(!next.done)next=steps.next();
 return next.value;
}
// --- 2.0: safe, versioned battle snapshots and explicit developer-only tools ---
const BATTLE_SAVE_FORMAT="mythical-wars-battle";
const BATTLE_SAVE_VERSION=2;
function exportBattle(s){
 if(!s||!Array.isArray(s.players)||s.players.length!==2)throw new Error("Нет корректной партии.");
 const raw=JSON.parse(JSON.stringify(s,(key,value)=>key==="rng"?undefined:value));
 return {format:BATTLE_SAVE_FORMAT,version:BATTLE_SAVE_VERSION,
   savedAt:new Date().toISOString(),game:raw};
}
function importBattle(payload,opts={}){
 if(typeof payload==="string"){
  if(payload.length>12*1024*1024)throw new Error("Файл слишком большой.");
  try{payload=JSON.parse(payload);}catch(_){throw new Error("Ошибка формата JSON.");}
 }
 if(!payload||payload.format!==BATTLE_SAVE_FORMAT||payload.version!==BATTLE_SAVE_VERSION)
   throw new Error("Неизвестный формат или версия сохранения партии.");
 if(JSON.stringify(payload).length>12*1024*1024)throw new Error("Сохранение слишком большое.");
 const raw=payload.game;
 if(![LEGACY_RULES,MILITIA_PREVIEW_RULES,CURRENT_RULES].includes(raw?.contentVersion))throw new Error("Партия создана по другой версии правил. Старое сохранение не изменено; для новых правил начните новый тестовый бой.");
 if(!raw||!Array.isArray(raw.players)||raw.players.length!==2||
    !raw.cards||typeof raw.cards!=="object"||Array.isArray(raw.cards)||
    !["mulligan","battle","ended"].includes(raw.phase)||
    ![0,1].includes(raw.turn)||!Number.isInteger(raw.turns)||
    !Number.isInteger(raw.time)||raw.time<0||raw.time>23||
    !Number.isInteger(raw.serial)||raw.serial<0)
  throw new Error("Некорректная структура игрового состояния.");
 if(Object.keys(raw.cards).length>800)throw new Error("Слишком много определений карт.");
 for(const pl of raw.players){
  if(!Array.isArray(pl.deck)||pl.deck.length>500||
     !Array.isArray(pl.hand)||pl.hand.length>20||
     !Array.isArray(pl.board)||pl.board.length>7||
     !Array.isArray(pl.graveyard)||pl.graveyard.length>500||
     !Number.isFinite(pl.health)||!Number.isFinite(pl.mana)||!Number.isFinite(pl.corpses))
   throw new Error("В сохранении некорректные зоны или показатели игрока.");
 }
 const s=JSON.parse(JSON.stringify(raw));
 s.rng=typeof opts.rng==="function"?opts.rng:null;
 s.randomState=Number.isInteger(raw.randomState)?raw.randomState>>>0:0x9e3779b9;
 s.logs=Array.isArray(s.logs)?s.logs.slice(-125):[];
 s.events=Array.isArray(s.events)?s.events.slice(-1500):[];
 s.eventSerial=Math.max(num(s.eventSerial),...s.events.map(e=>Number.isInteger(e.id)?e.id:0),0);
 s.graveSerial=Number.isInteger(s.graveSerial)?s.graveSerial:0;
 s.rituals=Array.isArray(s.rituals)?s.rituals:[];
 s.scheduled=Array.isArray(s.scheduled)?s.scheduled:[];
 s.discoveryOffers=s.discoveryOffers&&typeof s.discoveryOffers==="object"?s.discoveryOffers:{};
 s.debugMode=!!s.debugMode;s.debugged=!!s.debugged;
 for(const pl of s.players){
  pl.discarded=Array.isArray(pl.discarded)?pl.discarded:[];
  pl.graveyardHistory=Array.isArray(pl.graveyardHistory)?pl.graveyardHistory:[];
  pl.corpseLedger=Array.isArray(pl.corpseLedger)?pl.corpseLedger:[];
 }
 return s;
}
function setDeveloperMode(s,enabled){
 if(!s||!["battle","mulligan"].includes(s.phase))return {ok:false,reason:"Нет активного тестового боя."};
 s.debugMode=enabled===true;
 log(s,s.debugMode?"Тестовый режим включён (без прогресса кампании).":"Тестовый режим выключен.",
  {kind:"debug"});
 return {ok:true};
}
function debugAction(s,action){
 if(!s?.debugMode||s.phase!=="battle")return {ok:false,reason:"Режим разработчика выключен."};
 if(!action||typeof action!=="object")return {ok:false,reason:"Команда отсутствует."};
 const o=action.owner===1?1:0,p=player(s,o),value=Number(action.value);
 const cardId=String(action.cardId||"").trim();
 let detail="";
 if(action.type==="hour"){
  if(!Number.isInteger(value)||value<0||value>23)return {ok:false,reason:"Час должен быть от 0 до 23."};
  s.time=value;detail="установлено время "+value+":00";
 }else if(action.type==="mana"){
  if(!Number.isInteger(value)||value<0||value>10)return {ok:false,reason:"Мана от 0 до 10."};
  p.maxMana=Math.max(p.maxMana,value);p.mana=value;detail="мана = "+value;
 }else if(action.type==="corpses"){
  if(!Number.isInteger(value)||value<0||value>999)return {ok:false,reason:"Трупы от 0 до 999."};
  adjustCorpses(s,o,value-p.corpses,"Тестовая установка ресурса");
  detail="трупы = "+value;
 }else if(action.type==="give"||action.type==="summon"){
  const c=s.cards[cardId]||action.definition;
  if(!c||c.cardId!==cardId||!["creature","spell","weapon"].includes(c.cardType))
    return {ok:false,reason:"Выберите карту из утверждённой библиотеки."};
  if(c.origin==="token"||c.origin==="special")return {ok:false,reason:"Эта карта не коллекционная. Призыв специальных карт — только через подтверждённый эффект."};
  if(action.type==="summon"&&c.cardType!=="creature")return {ok:false,reason:"Призвать можно только существо."};
  if(action.type==="give"&&p.hand.length>=10)return {ok:false,reason:"В руке уже десять карт."};
  if(action.type==="summon"&&p.board.length>=7)return {ok:false,reason:"На поле уже семь существ."};
  if(!s.cards[cardId])s.cards[cardId]=clean(c);
  if(action.type==="give")p.hand.push({uid:uid(s),cardId,costAdjustment:0});
  else summon(s,o,s.cards[cardId]); // not played from hand: no battlecry
  detail=(action.type==="give"?"выдана карта ":"призвано существо ")+c.name;
 }else if(action.type==="kill"){
  const m=minion(s,o,String(action.uid||""));
  if(!m)return {ok:false,reason:"Существо отсутствует на поле."};
  detail="уничтожено существо "+m.name;
  m.health=0;combatEvent(s,"destroyed",{target:{kind:"minion",owner:o,uid:m.uid}});removeDead(s); // use the normal death and graveyard rules
 }else return {ok:false,reason:"Неизвестная команда тестирования."};
 s.debugged=true;
 log(s,"ТЕСТ · "+(o===0?"игрок":"бот")+": "+detail+".",{kind:"debug",owner:o,cardId:cardId||null});
 return {ok:true};
}
function eventJournal(s,{kind="all",owner="all",search=""}={}){
 if(!s||!Array.isArray(s.events))return [];
 const term=String(search).trim().toLocaleLowerCase("ru");
 return s.events.filter(e=>(kind==="all"||e.kind===kind)&&
  (owner==="all"||e.actor===Number(owner))&&
  (!term||e.message.toLocaleLowerCase("ru").includes(term)||String(e.cardId||"").toLowerCase().includes(term)));
}

return {
 makeGame,confirmMulligan,startTurn,endTurn,draw,returnToHand,playCard,attack,attackStatus,actionStatus,captureCardMovements,captureCombat,
 exportBattle,importBattle,setDeveloperMode,debugAction,eventJournal,
 eligibleAttackTargets,effectiveAttack,incomingMultiplier,phaseOfHour,isBright,currentCost,
 spellTargetType,targetValid,chooseTargetForBot,runBotTurn,botTurnFrames,abilitySupport,
 choiceSpec,validateChoices,botChoices,
 heroPowerStatus,heroPowerTargetValid,useHeroPower,graveyardView,graveyardSummary,localBright,
 SUPPORTED_SPELLS,SUPPORTED_CREATURES,SUPPORTED_WEAPONS,TOKEN_DATA,ZAV_IDS,igniteHands,cleanseKnownNegativeEffects
};
});
