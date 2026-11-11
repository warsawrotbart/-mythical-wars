/* Mythical Wars v2.1M.1 — Collection read model.
   Canonical catalogue + saved projects; no writes to game, cards or templates. */
(function(root, factory){
  "use strict";
  const api=factory();
  root.MW_COLLECTION_CORE=api;
  if(typeof module!=="undefined" && module.exports) module.exports=api;
})(typeof window!=="undefined" ? window : globalThis, function(){
 "use strict";
 const TYPES=Object.freeze({creature:"Существо",spell:"Заклинание",weapon:"Оружие"});
 const ARTS=Object.freeze({missing:"Нет арта",test:"Тестовый арт",approved:"Арт утверждён"});
 const FRAMES=Object.freeze({base:"Базовая / не утверждена",test:"Рамка на проверке",approved:"Рамка утверждена"});
 const owned=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
 const clean=x=>String(x===null||x===undefined?"":x).trim();
 const approved=x=>x===true||x==="approved"||x==="Утверждена";
 const hasArtValue=x=>typeof x==="string" && /^(data:image\/(?:png|jpeg|webp|gif);base64,|blob:)/i.test(x);
 function isBuiltin(builtin,id){
   if(!builtin)return false;
   if(typeof builtin.has==="function")return !!builtin.has(id);
   if(Array.isArray(builtin))return builtin.includes(id);
   return !!builtin[id];
 }
 function effectiveCard(original,saved){
   if(!saved)return {...original};
   const changes=saved.definition||saved.project?.cardDefinition||{};
   const card={...original};
   // Existing edited data may change text or stats, but never re-key a canonical ID.
   for(const field of ["name","cardType","classId","rarityId","costType","costValue",
       "attack","health","durability","timeAffinityId","creatureTypeId","subtype",
       "ability","keywords","schoolId","spellForm"]){
     if(changes[field]!==undefined && changes[field]!==null && changes[field]!==""){
       card[field]=changes[field];
     }
   }
   return card;
 }
 function deriveArt(saved,builtin,id){
   const meta=saved?.project?.metadata||{};
   const custom=hasArtValue(saved?.project?.assets?.customArtData);
   const fromBuiltin=isBuiltin(builtin,id);
   // A saved thumbnail can be a complete placeholder card; it does not prove that an art exists.
   if(!custom && !fromBuiltin)return {status:"missing",source:"",custom:false};
   const explicit=meta.artStatus||saved?.artStatus;
   const status=approved(meta.artApproved)||approved(explicit)?"approved":"test";
   return {status,source:custom?"custom":"built-in test art",custom};
 }
 function deriveFrame(saved){
   const meta=saved?.project?.metadata||{};
   // A baseline frame exists for each card type, but is not a reviewed class-specific frame.
   const explicit=meta.frameStatus||meta.frameApprovalStatus;
   if(approved(meta.frameApproved)||approved(explicit))return "approved";
   if(explicit==="test"||explicit==="review")return "test";
   return "base";
 }
 function build(canonical,saved=[],builtin){
   if(!Array.isArray(canonical))throw new TypeError("Canonical cards array expected");
   const savedMap=new Map((Array.isArray(saved)?saved:[]).filter(x=>x&&clean(x.cardId))
     .map(x=>[clean(x.cardId),x]));
   const seen=new Set();
   const rows=[];
   for(const original of canonical){
     if(!original || !clean(original.cardId))continue;
     const id=clean(original.cardId);
     if(seen.has(id))continue;
     seen.add(id);
     const item=savedMap.get(id);
     const art=deriveArt(item,builtin,id);
     rows.push({
       id, canonical:true, card:effectiveCard(original,item), saved:!!item,
       art:art.status, artSource:art.source, customArt:art.custom,
       frame:deriveFrame(item), hasBuiltinArt:isBuiltin(builtin,id)
     });
   }
   // New local cards are visible without pretending that they belong to the canonical 162.
   for(const [id,item] of savedMap){
     if(seen.has(id))continue;
     const card=item.definition||item.project?.cardDefinition||{};
     if(!card.cardType || !owned(TYPES,card.cardType))continue;
     const art=deriveArt(item,builtin,id);
     rows.push({
       id,canonical:false, card:{...card,cardId:id},saved:true, art:art.status,
       artSource:art.source,customArt:art.custom,frame:deriveFrame(item),hasBuiltinArt:false
     });
   }
   return rows;
 }
 function filter(rows,options={}){
   const q=clean(options.query).toLocaleLowerCase();
   const clazz=options.classId||"all",type=options.type||"all";
   const art=options.art||"all",frame=options.frame||"all";
   const scope=options.scope||"all";
   return rows.filter(row=>{
     const card=row.card||{};
     if(q && !(`${row.id} ${clean(card.name)}`.toLocaleLowerCase().includes(q)))return false;
     if(clazz!=="all"&&clean(card.classId||"Нейтральные")!==clazz)return false;
     if(type!=="all"&&card.cardType!==type)return false;
     if(art!=="all"&&row.art!==art)return false;
     if(frame==="needs" && row.frame==="approved")return false;
     if(frame!=="all"&&frame!=="needs"&&row.frame!==frame)return false;
     if(scope==="canonical"&&!row.canonical)return false;
     if(scope==="local"&&row.canonical)return false;
     return true;
   });
 }
 function stats(rows){
   const canonical=rows.filter(x=>x.canonical);
   return {
     canonical:canonical.length,local:rows.length-canonical.length,
     artMissing:canonical.filter(x=>x.art==="missing").length,
     artTest:canonical.filter(x=>x.art==="test").length,
     artApproved:canonical.filter(x=>x.art==="approved").length,
     frameNeeds:canonical.filter(x=>x.frame!=="approved").length,
     frameApproved:canonical.filter(x=>x.frame==="approved").length
   };
 }
 return Object.freeze({TYPES,ARTS,FRAMES,build,filter,stats,deriveArt,deriveFrame});
});
