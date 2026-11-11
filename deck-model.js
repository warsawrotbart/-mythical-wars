/* Мифические войны — модуль колод, без Unity и сети.
   Источник коллекционных карт: приложенный файл Библиотека карт.xlsx, лист Карты. */
(function(root,factory){
 const exported=factory();root.MW_DECK_MODEL=exported;
 if(typeof module!=="undefined"&&module.exports)module.exports=exported;
})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const MAX_DECK=30;
const CLASSES=["Воин","Чернокнижник","Некромант","Чародей","Ведун","Заклинатель","Разбойник"];
const className=x=>String(x||"").trim();
const types={creature:"Существо",spell:"Заклинание",weapon:"Оружие"};
const rarityLabel={common:"Обычная",standard:"Стандартная",rare:"Редкая",epic:"Эпическая",legendary:"Легендарная"};
const num=v=>(v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v)))?Number(v):null;
function fromSaved(item){
 const d=item?.definition||item?.project?.cardDefinition||{};
 return {cardId:String(d.cardId||item.cardId||""),name:d.name||item.name||"Без названия",
   cardType:d.cardType||item.cardType,classId:d.classId||"",rarityId:d.rarityId||null,
   costType:d.costType||"mana",costValue:num(d.costValue),attack:num(d.attack),
   health:num(d.health),durability:num(d.durability),timeAffinityId:d.timeAffinityId||"",
   creatureTypeId:d.creatureTypeId||"",subtype:d.subtype||"",ability:d.ability||"",
   keywords:Array.isArray(d.keywords)?d.keywords.join(", "):String(d.keywords||""),
   schoolId:d.schoolId||"",status:"Локальная карта",origin:"local",maxCopies:d.rarityId==="legendary"?1:2,
   thumbnail:item.thumbnail||null,artImage:item.artImage||null};
}
function indexCatalog(sheetCards,savedItems=[]){
 const map=new Map((sheetCards||[]).map(c=>[c.cardId,{...c}]));
 for(const item of savedItems){
  const card=fromSaved(item);
  if(!card.cardId)continue;
  if(map.has(card.cardId)){
    // Canonical fields stay authoritative; saved card is a visual asset / local working copy.
    const existing=map.get(card.cardId);
    existing.thumbnail=item.thumbnail||null;existing.artImage=item.artImage||null;existing.savedVisual=true;
  }else map.set(card.cardId,card);
 }
 return map;
}
function allowedForClass(card,heroClass){
 if(!card||!heroClass)return false;
 const cls=className(card.classId);
 return cls==="Нейтральная"||cls===className(heroClass);
}
function cardCopyLimit(card){
 if(!card)return 0;
 if(card.maxCopies===0||card.maxCopies==="0")return 0;
 return card.rarityId==="legendary"?1:Math.min(2,Math.max(0,Number.isFinite(Number(card.maxCopies))?Number(card.maxCopies):2));
}
function totalCards(deck){
 return Object.values(deck?.counts||{}).reduce((n,x)=>n+Math.max(0,Number.isFinite(Number(x))?Math.floor(Number(x)):0),0);
}
function validateDeck(deck,catalog){
 const errors=[],warnings=[],counts=deck?.counts||{},cls=deck?.classId;
 if(!CLASSES.includes(cls))errors.push("Выберите утверждённый класс героя.");
 const total=totalCards(deck);
 if(total!==MAX_DECK)errors.push("В колоде должно быть ровно 30 карт. Сейчас: "+total+".");
 for(const [id,raw] of Object.entries(counts)){
  const qty=Number(raw),card=catalog.get(id);
  if(!Number.isInteger(qty)||qty<0){errors.push("Некорректное количество: "+id);continue;}
  if(qty===0)continue;
  if(!card){errors.push("Карта "+id+" отсутствует в библиотеке.");continue;}
  if(!allowedForClass(card,cls))errors.push(card.name+" ("+id+"): карта другого класса.");
  const max=cardCopyLimit(card);
  if(qty>max)errors.push(card.name+": "+qty+" шт., допустимо "+max+".");
  if(card.cardType==="creature"&&(card.attack==null||card.health==null))
     errors.push(card.name+": не заполнены атака или здоровье.");
  if(card.cardType==="weapon"&&(card.attack==null||card.durability==null))
     errors.push(card.name+": не заполнены атака или прочность.");
  if(!types[card.cardType])errors.push(card.name+": неизвестный тип карты.");
  if(card.costValue==null||!card.costType)errors.push(card.name+": отсутствует стоимость.");
  if(card.requiresCardId&&!counts[card.requiresCardId])
    errors.push(card.name+": требуется ключевая карта "+card.requiresCardId+".");
  if(card.origin==="local"&&(!card.classId||!card.rarityId))
    errors.push(card.name+": у локальной карты отсутствует класс или редкость.");
 }
 warnings.push("Фракционные ограничения и требования ключевых карт без структурированного поля в исходной таблице не проверяются.");
 return {ok:errors.length===0,errors,warnings,total};
}
function canAddCard(deck,card,catalog){
 if(!card)return "Карта не найдена.";
 if(!allowedForClass(card,deck.classId))return "Карта другого класса.";
 const cur=Number(deck.counts?.[card.cardId]||0);
 if(cur>=cardCopyLimit(card))return "Достигнут предел копий.";
 if(totalCards(deck)>=MAX_DECK)return "В колоде уже 30 карт.";
 return "";
}
function newDeck(name="Новая колода",cls="Воин"){
 return {deckId:"deck-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),
   name,classId:cls,counts:{},source:"Локальная колода",updatedAt:new Date().toISOString()};
}
return {MAX_DECK,CLASSES,types,rarityLabel,num,fromSaved,indexCatalog,allowedForClass,cardCopyLimit,totalCards,validateDeck,canAddCard,newDeck};
});
