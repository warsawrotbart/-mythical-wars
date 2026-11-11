/* Мифические войны v2.1A — локальные испытания ПОЛНЫХ партий.
 * Время суток в режиме "off" оставлено без неутверждённого округления урона.
 * Каждое действие выполняется настоящим battle-engine.js, а не имитацией.
 */
(function(root,factory){
 const exported=factory(root.MW_GAME_ENGINE,root.MW_DECK_MODEL);
 root.MW_BATTLE_LAB=exported;
 if(typeof module!=="undefined"&&module.exports)module.exports=exported;
})(typeof window!=="undefined"?window:globalThis,function(E,D){
"use strict";
if(!E||!D)throw new Error("Подключите battle-engine.js и deck-model.js");
function invariants(s){
 const issues=[];
 if(!s||!Array.isArray(s.players)||s.players.length!==2)return ["Нет двух игроков."];
 for(let owner=0;owner<2;owner++){
   const p=s.players[owner];
   if(p.board.length>7||p.board.length<0)issues.push(`Игрок ${owner}: переполнено поле`);
   if(p.hand.length>10||p.hand.length<0)issues.push(`Игрок ${owner}: переполнена рука`);
   if(!Number.isFinite(p.health)||!Number.isFinite(p.mana)||!Number.isFinite(p.corpses))
     issues.push(`Игрок ${owner}: некорректный ресурс`);
   if(p.corpses<0)issues.push(`Игрок ${owner}: отрицательные трупы`);
   if(p.deck.some(id=>typeof id!=="string"||!s.cards[id]))issues.push(`Игрок ${owner}: неизвестная карта в колоде`);
   const unique=new Set(p.board.map(m=>m.uid));
   if(unique.size!==p.board.length)issues.push(`Игрок ${owner}: повтор UID существа`);
 }
 if(s.time<0||s.time>23||!Number.isInteger(s.time))issues.push("Некорректный игровой час");
 return issues;
}
function playFullMatch(deckA,deckB,catalog,opts={}){
 const map=catalog instanceof Map?catalog:new Map((catalog||[]).map(c=>[c.cardId,c]));
 for(const d of [deckA,deckB]){
   const checked=D.validateDeck(d,map);
   if(!checked.ok)throw new Error(`Недопустимая колода «${d.name}»: ${checked.errors.join("; ")}`);
 }
 const maxHalfTurns=Math.min(400,Math.max(1,Math.floor(opts.maxHalfTurns||220)));
 const seed=Number.isInteger(opts.seed)?opts.seed>>>0:1;
 const config={seed,firstPlayer:opts.firstPlayer??(seed&1),hour:opts.hour??(seed%24),
   timeMode:opts.timeMode||"off",heroProfiles:opts.heroProfiles||["campaign","campaign"]};
 const s=E.makeGame(deckA,deckB,map,config);
 const started=E.confirmMulligan(s,[]);
 if(!started.ok)throw new Error("Муллиган не завершён: "+started.reason);
 const problems=[],counts=[0,0],acts=[0,0];
 let loop=0,term="ended";
 for(;s.phase==="battle"&&loop<maxHalfTurns;loop++){
   const owner=s.turn;
   const before=s.turns;
   const result=E.runBotTurn(s,owner);
   if(!result.ok){term="illegal-action";problems.push(`Ход ${before}: ${result.reason||"бот не смог действовать"}`);break;}
   counts[owner]++;acts[owner]+=(result.actions||[]).length;
   problems.push(...invariants(s).map(x=>`Ход ${before}: ${x}`));
   if(problems.length){term="invariant";break;}
   if(s.phase==="battle"&&s.turns===before){term="stalled";problems.push(`Ход ${before}: нет перехода хода`);break;}
 }
 if(s.phase==="battle"&&term==="ended")term="turn-limit";
 const winner=s.phase==="ended"?s.winner:null;
 const result={seed,deckA:deckA.name,deckB:deckB.name,classes:[deckA.classId,deckB.classId],
   firstPlayer:config.firstPlayer,timeMode:config.timeMode,
   phase:s.phase,winner,turns:s.turns,halfTurns:loop+(s.phase==="ended"?1:0),
   termination:term,health:s.players.map(p=>p.health),fatigue:s.players.map(p=>p.fatigue),
   actions:acts,turnsBySide:counts,issues:problems,
   eventCount:s.eventSerial,graveEntries:s.players.map(p=>p.graveyard.length),
   reproducible:!!s.battleReplay?.canReplay&&!s.battleReplay?.overflow};
 if(opts.returnGame)result.game=s;
 return result;
}
function schedulePairs(decks,opts={}){
 if(!Array.isArray(decks)||decks.length!==3)throw new Error("Нужны ровно три утверждённые колоды.");
 const per=Math.max(1,Math.min(20,Math.floor(opts.gamesPerPair||2))),seed=Number.isInteger(opts.seed)?opts.seed:20211108;
 const cases=[];
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)for(let r=0;r<per;r++){
   const flip=r%2===1;
   cases.push({deckA:flip?decks[j]:decks[i],deckB:flip?decks[i]:decks[j],
     opts:{...opts,seed:(seed+cases.length*7919)>>>0,firstPlayer:r%2}});
 }
 return cases;
}
function summarize(results){
 const summary={games:results.length,ended:0,turnLimit:0,errors:0,draws:0,
   wins:{},results:results.map(r=>({...r,game:undefined}))};
 for(const r of results){
   if(r.termination==="ended")summary.ended++;
   else if(r.termination==="turn-limit")summary.turnLimit++;
   else summary.errors++;
   if(r.winner==="draw")summary.draws++;
   else if([0,1].includes(r.winner)){
     const name=r.winner===0?r.deckA:r.deckB;
     summary.wins[name]=(summary.wins[name]||0)+1;
   }
 }
 return summary;
}
function runBatch(decks,catalog,opts={}){
 const cases=schedulePairs(decks,opts);
 const results=[];
 for(const c of cases)results.push(playFullMatch(c.deckA,c.deckB,catalog,c.opts));
 return summarize(results);
}
function toCSV(summary){
 const cols=["seed","deckA","deckB","firstPlayer","timeMode","phase","winner",
   "termination","turns","halfTurns","eventCount","issues"];
 const encode=x=>'"'+String(x??"").replace(/"/g,'""')+'"';
 return "\ufeff"+[cols.join(";"),...summary.results.map(r=>cols.map(key=>
   encode(key==="issues"?(r.issues||[]).join(" | "):r[key])).join(";"))].join("\r\n");
}
return {invariants,playFullMatch,schedulePairs,summarize,runBatch,toCSV};
});
