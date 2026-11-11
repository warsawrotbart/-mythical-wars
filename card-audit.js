/* Мифические войны v2.1A — аудит канонической/локальной библиотеки.
 * Проверяет данные, не редактирует карты и не угадывает отсутствующие правила.
 */
(function(root,factory){
 const exported=factory(root.MW_DECK_MODEL);
 root.MW_CARD_AUDIT=exported;
 if(typeof module!=="undefined"&&module.exports)module.exports=exported;
})(typeof window!=="undefined"?window:globalThis,function(D){
"use strict";
const ID=/^(KNZ|CHR|NCR|NEU|ZAV)-\d{3}$/;
const TYPES=new Set(["creature","spell","weapon"]);
const CLASSES=new Set([...(D?.CLASSES||["Воин","Чернокнижник","Некромант"]),"Нейтральная"]);
const RARITIES=new Set(["common","standard","rare","epic","legendary"]);
const assertNum=x=>typeof x==="number"&&Number.isFinite(x);
const isSpecial=c=>c.origin==="special"||c.cardId?.startsWith("ZAV-")||
 String(c.status||"").includes("только Раскопки");
function auditCatalog(cards){
 const entries=cards instanceof Map?[...cards.values()]:Array.isArray(cards)?cards:
     Object.values(cards||{});
 const issues=[],seen=new Map(),nameMap=new Map();
 const issue=(severity,id,code,detail)=>issues.push({severity,cardId:id||"",code,detail});
 for(let i=0;i<entries.length;i++){
   const c=entries[i],id=String(c?.cardId||"").trim();
   if(!id){issue("error","", "missing-id",`Позиция ${i+1}: отсутствует ID`);continue;}
   if(seen.has(id)){issue("error",id,"duplicate-id",`Дубликат ID (${seen.get(id)+1} и ${i+1})`);}
   else seen.set(id,i);
   if(!ID.test(id)&&!c.origin?.startsWith("local"))
      issue("warning",id,"id-format","ID вне стандартной схемы; проверьте уникальность.");
   if(!String(c.name||"").trim())issue("error",id,"name","Нет названия.");
   if(!TYPES.has(c.cardType))issue("error",id,"type","Неизвестный тип карты.");
   if(!CLASSES.has(c.classId))issue("error",id,"class","Неизвестный класс/нейтральность.");
   if(!RARITIES.has(c.rarityId))issue("error",id,"rarity","Не указана утверждённая редкость.");
   if(c.cardType==="creature"){
     if(!assertNum(c.attack)||c.attack<0)issue("error",id,"attack","Атака должна быть неотрицательным числом.");
     if(!assertNum(c.health)||c.health<=0)issue("error",id,"health","Здоровье существа должно быть положительным числом.");
   }
   if(c.cardType==="weapon"){
     if(!assertNum(c.attack)||c.attack<0)issue("error",id,"weapon-attack","Неверная атака оружия.");
     if(!assertNum(c.durability)||c.durability<=0)issue("error",id,"durability","Неверная прочность оружия.");
   }
   if(!isSpecial(c)){
     if(!["mana","corpses"].includes(c.costType))
       issue("error",id,"cost-type","Отсутствует тип оплаты: мана / трупы.");
     if(!assertNum(c.costValue)||c.costValue<0||!Number.isInteger(c.costValue))
       issue("error",id,"cost","Стоимость должна быть неотрицательным целым числом.");
   }
   if(typeof c.ability!=="string")issue("warning",id,"ability","Описание эффекта не является текстом.");
   if(c.requiresCardId&&typeof c.requiresCardId!=="string")
     issue("error",id,"key","Требование ключевой карты должно содержать ID.");
   const normalized=String(c.name||"").trim().toLocaleLowerCase("ru");
   if(normalized&&nameMap.has(normalized)&&nameMap.get(normalized)!==id)
      issue("warning",id,"duplicate-name",`Название уже используется у ${nameMap.get(normalized)}.`);
   else if(normalized)nameMap.set(normalized,id);
 }
 // Second pass: verify explicit foreign keys only. Do NOT infer links from free text.
 for(const c of entries){
   if(c?.requiresCardId&&!seen.has(c.requiresCardId))
     issue("error",c.cardId,"dangling-key",`Нет обязательной карты ${c.requiresCardId}.`);
   if(c?.maxCopies!=null&&!Number.isInteger(Number(c.maxCopies)))
     issue("warning",c.cardId,"copies","Неоднозначное максимальное количество копий.");
 }
 return {count:entries.length,errors:issues.filter(i=>i.severity==="error"),
   warnings:issues.filter(i=>i.severity==="warning"),issues,
   stats:{creature:entries.filter(c=>c?.cardType==="creature").length,
     spell:entries.filter(c=>c?.cardType==="spell").length,
     weapon:entries.filter(c=>c?.cardType==="weapon").length,
     classes:Object.fromEntries([...CLASSES].map(n=>[n,entries.filter(c=>c?.classId===n).length]))}};
}
function auditDecks(decks,cards){
 if(!D)throw new Error("Не подключён модуль колод.");
 const catalog=cards instanceof Map?cards:new Map((Array.isArray(cards)?cards:
    Object.values(cards||{})).map(c=>[c.cardId,c]));
 const arr=Array.isArray(decks)?decks:[...decks?.values?.()||[]];
 const result=arr.map(deck=>{
   const valid=D.validateDeck(deck,catalog);
   const unknown=Object.entries(deck?.counts||{}).filter(([id,q])=>q>0&&!catalog.has(id)).map(([id])=>id);
   return {name:deck?.name||"Без названия",classId:deck?.classId||"",
     valid:valid.ok,total:valid.total,errors:valid.errors,warnings:valid.warnings,
     unknownCards:unknown};
 });
 return {count:result.length,valid:result.filter(d=>d.valid).length,invalid:result.filter(d=>!d.valid).length,
   decks:result};
}
function toReport(catalog,deckAudit=null){
 const lines=["МИФИЧЕСКИЕ ВОЙНЫ — аудит библиотеки v2.1A",
  `Карт: ${catalog.count}; ошибок: ${catalog.errors.length}; предупреждений: ${catalog.warnings.length}`];
 for(const item of catalog.issues)lines.push(`${item.severity==="error"?"ОШИБКА":"ПРЕДУПРЕЖДЕНИЕ"} · ${item.cardId||"—"} · ${item.code}: ${item.detail}`);
 if(deckAudit){
   lines.push(`Колоды: ${deckAudit.count}; валидны: ${deckAudit.valid}; с ошибками: ${deckAudit.invalid}`);
   for(const d of deckAudit.decks)lines.push(`${d.name} (${d.classId}): ${d.total}/30; ${d.valid?"OK":d.errors.join("; ")}`);
 }
 lines.push("Ограничение: текстовые фракционные требования и неформализованные способности не проверяются.");
 return lines.join("\n");
}
return {auditCatalog,auditDecks,toReport};
});
