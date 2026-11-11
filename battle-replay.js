/* Мифические войны v2.1A — локальные воспроизводимые действия.
 * Не раскрывайте экспорт повтора сопернику до завершения партии:
 * начальный снимок содержит обе руки и порядок обеих колод.
 * Модуль оборачивает только ПУБЛИЧНЫЕ методы, вызовы внутри бота
 * записываются одной воспроизводимой операцией runBotTurn.
 */
(function(root,factory){
 const E=root.MW_GAME_ENGINE;
 const exported=factory(E);
 root.MW_BATTLE_REPLAY=exported;
 if(typeof module!=="undefined"&&module.exports)module.exports=exported;
})(typeof window!=="undefined"?window:globalThis,function(E){
"use strict";
if(!E)throw new Error("Сначала подключите battle-engine.js");
const FORMAT="mythical-wars-replay",VERSION=1,LIMIT=1800;
const original={};
const actions=["confirmMulligan","playCard","attack","useHeroPower",
 "endTurn","runBotTurn","setDeveloperMode","debugAction"];
for(const name of actions)original[name]=E[name];
const originalMake=E.makeGame;
const snapshot=s=>JSON.parse(JSON.stringify(s,(k,v)=>
 (k==="rng"||k==="battleReplay")?undefined:v));
function checksum(value){
 const source=JSON.stringify(value);
 let hash=2166136261;
 for(let i=0;i<source.length;i++){
   hash^=source.charCodeAt(i);
   hash=Math.imul(hash,16777619);
 }
 return (hash>>>0).toString(16).padStart(8,"0");
}
function capture(s){
 if(!s||!Array.isArray(s.players)||s.players.length!==2)
   throw new Error("Нет партии для записи повтора.");
 s.battleReplay={version:VERSION,initial:snapshot(s),actions:[],canReplay:typeof s.rng!=="function",
   startedMidGame:s.phase!=="mulligan",overflow:false};
 return s.battleReplay;
}
E.makeGame=function(...args){
 const game=originalMake(...args);
 capture(game);return game;
};
function ensureCapture(s){
 if(!s.battleReplay)capture(s);
 return s.battleReplay;
}
for(const name of actions){
 E[name]=function(game,...args){
   const trace=game?.battleReplay;
   const before=trace&&trace.canReplay&&!trace.overflow?checksum(snapshot(game)):null;
   const result=original[name](game,...args);
   if(result?.ok&&trace&&trace.canReplay&&!trace.overflow){
     if(trace.actions.length>=LIMIT){trace.overflow=true;return result;}
     // Arguments are copied BEFORE any future actions; only primitives/structured choices.
     trace.actions.push({type:name,args:JSON.parse(JSON.stringify(args)),
       before,after:checksum(snapshot(game)),turn:game.turns});
   }
   return result;
 };
}
function exportReplay(game){
 const trace=game?.battleReplay;
 if(!trace?.canReplay||trace.overflow)throw new Error("Повтор не доступен: внешняя случайность или превышен лимит действий.");
 return {format:FORMAT,version:VERSION,exportedAt:new Date().toISOString(),
   privateDataWarning:"Contains both hidden hands and decks; share only after the game.",
   trace:JSON.parse(JSON.stringify(trace))};
}
function loadReplay(input){
 if(typeof input==="string"){
  if(input.length>12*1024*1024)throw new Error("Повтор превышает ограничение 12 МБ.");
  input=JSON.parse(input);
 }
 if(!input||input.format!==FORMAT||input.version!==VERSION)throw new Error("Неизвестный формат повтора.");
 if(JSON.stringify(input).length>12*1024*1024)throw new Error("Слишком большой повтор.");
 const trace=input.trace;
 if(!trace||trace.version!==1||!trace.canReplay||trace.overflow||
   !Array.isArray(trace.actions)||trace.actions.length>LIMIT||
   !trace.initial||!Array.isArray(trace.initial.players))
   throw new Error("В записи отсутствует исходная партия или действия.");
 return trace;
}
function verify(input,through=null){
 const trace=input?.trace?loadReplay(input):input;
 if(!trace?.initial||!Array.isArray(trace.actions))
   return {ok:false,reason:"Повтор отсутствует."};
 if(!trace.canReplay||trace.overflow)return {ok:false,reason:"Повтор не воспроизводим."};
 let game;
 try{
   game=E.importBattle({format:"mythical-wars-battle",version:2,game:trace.initial});
 }catch(e){return {ok:false,reason:"Неправильное исходное состояние: "+e.message};}
 const count=through==null?trace.actions.length:Math.min(trace.actions.length,
   Math.max(0,Math.floor(through)));
 for(let i=0;i<count;i++){
   const step=trace.actions[i],fn=original[step.type];
   if(!fn||!Array.isArray(step.args))
     return {ok:false,index:i,reason:"Недопустимая операция записи.",game};
   if(checksum(snapshot(game))!==step.before)
     return {ok:false,index:i,reason:"Состояние до действия отличается от записи.",game};
   let result;
   try{result=fn(game,...step.args);}
   catch(e){return {ok:false,index:i,reason:"Ошибка воспроизведения: "+e.message,game};}
   if(!result?.ok)return {ok:false,index:i,reason:"Недопустимое действие в повторе: "+(result?.reason||step.type),game};
   if(checksum(snapshot(game))!==step.after)
     return {ok:false,index:i,reason:"Состояние после действия отличается от записи.",game};
 }
 return {ok:true,steps:count,total:trace.actions.length,game,
   stateHash:checksum(snapshot(game))};
}
return {capture,ensureCapture,exportReplay,loadReplay,verify,checksum,snapshot};
});
