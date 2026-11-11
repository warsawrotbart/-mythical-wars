/* Мифические войны v2.1B: только правила распознавания жеста.
 * Истина о допустимости розыгрыша/атаки всегда в MW_GAME_ENGINE.
 * Не меняет ману, карточки, очередь эффектов или таблицу карт.
 */
(function(root,factory){
  const API=factory();
  if(typeof module==="object"&&module.exports)module.exports=API;
  if(root)root.MW_BATTLE_DRAG_RULES=API;
})(typeof window!=="undefined"?window:globalThis, function(){
  "use strict";
  const deny=(reason)=>({ok:false,reason:reason||"Недопустимое действие."});
  function plan(s,source,target,eng){
    if(!s||s.phase!=="battle"||s.turn!==0)return deny("Действие доступно только в ваш ход.");
    if(!source||!target||!eng)return deny("Неизвестный источник или зона назначения.");
    if(source.kind==="hand"){
      const h=s.players[0].hand.find(x=>x.uid===source.uid);
      if(!h)return deny("Карта больше не находится в руке.");
      const action=eng.actionStatus(s,0,source.uid);
      if(!action.ok)return deny(action.reason);
      const toBoard=target.kind==="board"&&target.owner===0;
      const toOwnMinion=target.kind==="minion"&&target.owner===0;
      if(action.choice){
        return toBoard?{ok:true,mode:"choose",uid:source.uid}:
          deny("Перетащите карту на своё поле для выбора эффекта.");
      }
      if(action.targetType){
        if(toBoard)return {ok:true,mode:"await-target",uid:source.uid};
        if((target.kind==="minion"||target.kind==="hero")&&eng.targetValid(s,0,h.cardId,target))
          return {ok:true,mode:"spell-target",uid:source.uid,target};
        return deny("Для этого заклинания нужна допустимая цель.");
      }
      if(toBoard||toOwnMinion)return {ok:true,mode:"play",uid:source.uid};
      return deny("Перетащите карту на своё поле.");
    }
    if(source.kind==="minion"){
      const m=s.players[0].board.find(x=>x.uid===source.uid);
      if(!m||!m.ready||m.attacked)return deny("Существо пока не готово атаковать.");
      if(target.owner!==1||!["minion","hero"].includes(target.kind))
        return deny("Существом можно атаковать только допустимые вражеские цели.");
      const targets=eng.eligibleAttackTargets(s,0);
      if(!targets.some(t=>t.kind===target.kind&&t.owner===1&&(t.kind==="hero"||t.uid===target.uid)))
        return deny("Эту цель нельзя атаковать (проверьте провокацию).");
      return {ok:true,mode:"attack",uid:source.uid,target};
    }
    return deny("Неподдерживаемый источник перетаскивания.");
  }
  return {plan};
});
