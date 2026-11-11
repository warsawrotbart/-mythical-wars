/* Mythical Wars v05 / stage 3: pure, explicit library normalization and transactional diff.
 * No writes to the combat catalogue, decks, art, or v05 production manifest.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.MW_V05_LIBRARY_CORE=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const FIELDS=[
 ["id","ID",["id","cardid","кодкарты"]],
 ["name","Название",["название","name","title"]],
 ["mana","Мана",["мана","mana"]],
 ["rarity","Редкость",["редкость","rarity"]],
 ["type","Тип карты",["типкарты","cardtype","type"]],
 ["attack","Атака",["атака","attack"]],
 ["health","Здоровье",["здоровье","health"]],
 ["durability","Прочность",["прочность","durability"]],
 ["time","Время суток",["времясуток","timeaffinity","time"]],
 ["race","Принадлежность",["принадлежность","вид","race"]],
 ["subtype","Подтип",["подтип","subtype"]],
 ["description","Текст карты (BY)",["тексткартыby","описание","description","ability"]],
 ["keywords","Ключевые механики",["ключевыемеханики","keywords"]],
 ["class","Класс",["класс","class"]],
 ["maxCopies","Макс. копий",["макскопий","maxcopies"]],
 ["status","Статус",["статус","status"]],
 ["cost","Стоимость",["стоимость","cost","costvalue"]],
 ["resource","Ресурс стоимости",["ресурсстоимости","resource","costtype"]],
 ["school","Школа",["школа","school"]],
 ["spellForm","Форма заклинания",["формазаклинания","spellform"]],
 ["notes","Примечания",["примечания","notes"]]
];
const MODEL_FIELDS=FIELDS.map(x=>x[0]);
const SUMMARY_FIELDS=["name","type","class","rarity","cost","resource","attack","health","durability","time","race","subtype","description","keywords","maxCopies","status","school","spellForm","notes","mana"];
const NUMERIC=new Set(["mana","cost","attack","health","durability","maxCopies"]);
const EMPTY=new Set(["","—","–","-"]);
const CLASS_MAP={"воин":"Warrior","чернокнижник":"Warlock","некромант":"Necromancer","чародей":"Wizard","ведун":"Seer","заклинатель":"Conjurer","разбойник":"Rogue","нейтральная":"Neutral","нейтральные":"Neutral","warrior":"Warrior","warlock":"Warlock","necromancer":"Necromancer","wizard":"Wizard","seer":"Seer","conjurer":"Conjurer","rogue":"Rogue","neutral":"Neutral"};
const RARITIES={"обычнаясерая":"Common","стандартнаязеленая":"Green","редкаясиняя":"Blue","эпическаяфиолетовая":"Purple","легендарнаязолотая":"Gold","common":"Common","standard":"Green","green":"Green","rare":"Blue","blue":"Blue","epic":"Purple","purple":"Purple","legendary":"Gold","gold":"Gold"};
const TYPE_MAP={"существо":"Creature","оружие":"Weapon","заклинание":"Spell","creature":"Creature","weapon":"Weapon","spell":"Spell"};
const TIME_MAP={"дзень":"Day","ноч":"Night","day":"Day","night":"Night"};
const RACE_MAP={"чалавек":"Human","нежыць":"Undead","дух":"Spirit","дракон":"Dragon","нечысць":"Demon","абаротні":"Shapeshifter","звер":"Beast","human":"Human","undead":"Undead","spirit":"Spirit","dragon":"Dragon","demon":"Demon","shapeshifter":"Shapeshifter","beast":"Beast"};
const KIND_LABEL={cards:"Карты",tokens:"Токены"};
const REQUIRED={cards:162,tokens:7};
function key(v){return String(v??"").trim().toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[\s\p{P}\p{S}_]+/gu,"")}
function clean(v){if(v===null||v===undefined)return null;const s=String(v).replace(/\r\n?/g,"\n").trim();return EMPTY.has(s)?null:s}
function own(obj,k){return Object.prototype.hasOwnProperty.call(obj||{},k)}
function issue(severity,code,message,id=null,row=null){return {severity,code,message,id,row}}
function headerInfo(rows){
 let best=null;
 for(let i=0;i<Math.min(25,rows.length);i++){
  const map={},duplicates=[];
  (rows[i]||[]).forEach((value,index)=>{
   const normalized=key(value);if(!normalized)return;
   for(const [field,,aliases] of FIELDS){
    if(aliases.includes(normalized)){
     if(own(map,field))duplicates.push(field);else map[field]=index;
     break;
    }
   }
  });
  const score=Object.keys(map).length;
  if(!best||score>best.score)best={row:i,map,duplicates,score};
 }
 if(!best||best.score<5||!own(best.map,"id"))throw Error("Не найден заголовок библиотеки с колонкой ID.");
 if(best.duplicates.length)throw Error("Дублируются столбцы: "+best.duplicates.join(", "));
 const missing=MODEL_FIELDS.filter(k=>!own(best.map,k));
 if(missing.length)throw Error("Для безопасного полного импорта нужны все 21 столбец; отсутствуют: "+missing.map(k=>FIELDS.find(x=>x[0]===k)[1]).join(", "));
 return best;
}
function parseInteger(value,label,id,row,issues){
 const v=clean(value);if(v===null)return null;
 const str=v.replace(/\s/g,"");
 if(!/^\d+(?:[.,]0+)?$/.test(str)){
  issues.push(issue("error","integer",`${label}: требуется целое неотрицательное число; получено «${v.slice(0,60)}»`,id,row));return null;
 }
 const n=Number(str.replace(",","."));
 if(!Number.isSafeInteger(n)||n<0||n>9999){issues.push(issue("error","integer-range",label+": значение вне диапазона 0–9999",id,row));return null}
 return n;
}
function normalizeOne(row,map,kind,rowNumber,manifest){
 const issues=[];const data={};
 for(const [field] of FIELDS){const raw=row[map[field]];data[field]=NUMERIC.has(field)?parseInteger(raw,FIELDS.find(x=>x[0]===field)[1],clean(row[map.id]),rowNumber,issues):clean(raw)}
 const id=data.id;
 if(!id){issues.push(issue("error","missing-id","В строке с данными отсутствует ID",null,rowNumber));return {data:null,issues}}
 if(!new RegExp(kind==="tokens"?"^TKN-[0-9]{3}$":"^(?:KNZ|CHR|NEU|NCR|ZAV)-[0-9]{3}$").test(id))issues.push(issue("error","id",`${id}: неверный формат ID для раздела «${KIND_LABEL[kind]}»`,id,rowNumber));
 if(!data.name)issues.push(issue("error","name",id+": пустое название",id,rowNumber));
 const type=TYPE_MAP[key(data.type)];
 if(!type)issues.push(issue("error","type",id+": неизвестный тип «"+data.type+"»",id,rowNumber));
 const classKey=CLASS_MAP[key(data.class)];
 if(!classKey||!own(manifest.class_palettes,classKey))issues.push(issue("error","class",id+": неизвестный класс «"+data.class+"»",id,rowNumber));
 let rarityKey=RARITIES[key(data.rarity)]||null;
 if(kind==="tokens"&&["токен","неутверждена"].includes(key(data.rarity))){rarityKey=null;
  if(key(data.rarity)!=="токен")issues.push(issue("warning","token-rarity",id+": редкость токена не утверждена; значок v05 скрыт",id,rowNumber));}
 else if(!rarityKey)issues.push(issue("error","rarity",id+": неизвестная редкость «"+data.rarity+"»",id,rowNumber));
 const resourceKey=key(data.resource);
 if(data.resource&&!(["мана","mana","трупы","corpses"].includes(resourceKey)))issues.push(issue("error","resource",id+": неизвестный ресурс стоимости «"+data.resource+"»",id,rowNumber));
 const costResource=resourceKey==="трупы"||resourceKey==="corpses"?"Трупы":resourceKey?"Мана":null;
 if(data.cost==null&&costResource==="Мана"&&data.mana!=null){data.cost=data.mana;issues.push(issue("warning","mana-fallback",id+": стоимость взята из «Мана» (колонка «Стоимость» пуста)",id,rowNumber));}
 if(data.mana!=null&&data.cost!=null&&costResource==="Мана"&&data.mana!==data.cost)issues.push(issue("warning","mana-disagree",`${id}: «Мана» и «Стоимость» различаются, использована «Стоимость»`,id,rowNumber));
 if(data.cost!=null&&!costResource)issues.push(issue("error","resource-required",id+": указана стоимость, но не её ресурс",id,rowNumber));
 if(data.maxCopies==null||data.maxCopies>99)issues.push(issue("error","copies",id+": «Макс. копий» должно быть целым от 0 до 99",id,rowNumber));
 if(type==="Creature"&&(data.attack==null||data.health==null))issues.push(issue("warning","stats-missing",id+": существу не хватает атаки или здоровья; PNG будет заблокирован",id,rowNumber));
 if(type==="Weapon"&&(data.attack==null||data.durability==null))issues.push(issue("warning","stats-missing",id+": оружию не хватает атаки или прочности; PNG будет заблокирован",id,rowNumber));
 if(data.cost==null)issues.push(issue("warning","cost-missing",id+": стоимость отсутствует; PNG по v05 может быть заблокирован",id,rowNumber));
 let timeKey=TIME_MAP[key(data.time)]||null;
 if(data.time&&!timeKey)issues.push(issue("warning","time-icon",id+": нет утверждённого v05 значка времени «"+data.time+"» (значение сохранено)",id,rowNumber));
 let raceKey=RACE_MAP[key(data.race)]||null;
 if(data.race&&!raceKey)issues.push(issue("warning","race-icon",id+": нет утверждённого v05 значка вида «"+data.race+"» (значение сохранено)",id,rowNumber));
 const subtypeKey=key(data.subtype)==="дружына"?"Druzhyna":null;
 if(data.subtype&&!subtypeKey)issues.push(issue("warning","subtype-icon",id+": нет утверждённого v05 значка подтипа «"+data.subtype+"»; PNG будет заблокирован для существа",id,rowNumber));
 if(type!=="Creature"&&data.subtype)issues.push(issue("warning","subtype-layout",id+": подтип оружия/заклинания не имеет слота v05; PNG заблокирован",id,rowNumber));
 if(data.attack!=null&&data.attack>99||data.health!=null&&data.health>99||data.durability!=null&&data.durability>99||data.cost!=null&&data.cost>99)
  issues.push(issue("warning","number-overflow",id+": значение > 99 нельзя показать в v05 PNG",id,rowNumber));
 const derived={...data,type:type||data.type,rarity_key:rarityKey,class_key:classKey||null,
   cost_resource:costResource,race_icon_key:raceKey,time_key:timeKey,subtype_icon_key:subtypeKey,
   armor:null,flavor_text:null,art_status:"тестовый вариант"};
 return {data:derived,issues};
}
function normalizeSheet(sheet,kind,manifest){
 if(!sheet||!Array.isArray(sheet.rows)||!manifest)throw Error("Нет листа или манифеста для импорта");
 const {row:header,map}=headerInfo(sheet.rows),records=[],issues=[],seen=new Set();
 for(let i=header+1;i<sheet.rows.length;i++){
  const r=sheet.rows[i]||[],hasData=Object.values(map).some(col=>clean(r[col])!==null);
  if(!hasData)continue;
  const {data,issues:next}=normalizeOne(r,map,kind,i+1,manifest);
  issues.push(...next);
  if(!data)continue;
  if(seen.has(data.id))issues.push(issue("error","duplicate",`Повторный ID «${data.id}»`,data.id,i+1));
  else{seen.add(data.id);records.push(data)}
 }
 if(records.length!==REQUIRED[kind])issues.push(issue("error","count",`${KIND_LABEL[kind]}: найдено ${records.length}, требуется ${REQUIRED[kind]} без потери ID`,null,null));
 return {kind,records,issues,headerRow:header+1};
}
function normalizeSeed(seed,manifest){
 const cards=normalizeSheet({rows:seed.cards},"cards",manifest),tokens=normalizeSheet({rows:seed.tokens},"tokens",manifest);
 const errors=[...cards.issues,...tokens.issues].filter(x=>x.severity==="error");
 if(errors.length)throw Error("Ошибка встроенной библиотеки: "+errors[0].message);
 return {version:1,cards:cards.records,tokens:tokens.records};
}
function validateSnapshot(snapshot,baseline){
 if(!snapshot||snapshot.version!==1||!Array.isArray(snapshot.cards)||!Array.isArray(snapshot.tokens))throw Error("Неизвестный формат локальной библиотеки");
 for(const kind of ["cards","tokens"]){
  const ids=new Set(baseline[kind].map(x=>x.id));
  if(snapshot[kind].length!==REQUIRED[kind])throw Error("Локальная библиотека неполная: "+kind);
  const currentIds=snapshot[kind].map(x=>x.id);
  if(new Set(currentIds).size!==REQUIRED[kind]||currentIds.some(id=>!ids.has(id)))throw Error("Локальная библиотека содержит чужие или повторные ID: "+kind);
 }
 return snapshot;
}
function diffRecords(before,after,kind){
 const old=new Map(before.map(x=>[x.id,x]));
 return after.map(next=>{
  const previous=old.get(next.id),diff=[];
  for(const field of SUMMARY_FIELDS){
   const a=previous?previous[field]??null:null,b=next[field]??null;
   if(a!==b)diff.push({field,label:FIELDS.find(x=>x[0]===field)?.[1]||field,before:a,after:b});
  }
  return {kind,id:next.id,name:next.name,changed:diff.length>0,diff};
 });
}
function prepare(current,sheets,manifest){
 if(!sheets||!sheets.length)throw Error("В файле не найдены листы «Карты» или «Токены».");
 const next=JSON.parse(JSON.stringify(current));const issues=[],included=[],diff=[];
 const unique=new Set();
 for(const sheet of sheets){
  if(!sheet||!REQUIRED[sheet.kind])throw Error("Неизвестный тип листа");
  if(unique.has(sheet.kind))throw Error("Повторно загружен раздел «"+KIND_LABEL[sheet.kind]+"»");
  unique.add(sheet.kind);
  const parsed=normalizeSheet(sheet,sheet.kind,manifest);
  issues.push(...parsed.issues);
  const existingIds=new Set(current[sheet.kind].map(x=>x.id));
  for(const item of parsed.records)if(!existingIds.has(item.id))issues.push(issue("error","unknown-id",`Неизвестный ID ${item.id}: новые карты требуют отдельного согласования`,item.id,null));
  const incoming=new Set(parsed.records.map(x=>x.id));
  for(const id of existingIds)if(!incoming.has(id))issues.push(issue("error","missing-id",`В файле отсутствует исходный ID: ${id}`,id,null));
  next[sheet.kind]=parsed.records;
  included.push(sheet.kind);
  diff.push(...diffRecords(current[sheet.kind],parsed.records,sheet.kind));
 }
 if(!included.includes("cards"))issues.push(issue("warning","cards-intact","Раздел «Карты» не загружен и не будет изменён"));
 if(!included.includes("tokens"))issues.push(issue("warning","tokens-intact","Раздел «Токены» не загружен и не будет изменён"));
 const errors=issues.filter(x=>x.severity==="error");
 return {next,included,issues,diff,errors,changed:diff.filter(x=>x.changed).length,ready:!errors.length};
}
function resolveSheet(sheet,kindHint){
 if(kindHint==="cards"||kindHint==="tokens")return kindHint;
 const name=key(sheet.name);
 if(name==="карты"||name==="cards")return "cards";
 if(name==="токены"||name==="tokens")return "tokens";
 return null;
}
function classifyInput(parsed,fileName){
 if(!parsed||!Array.isArray(parsed.sheets))throw Error("Не удалось прочитать листы");
 if(parsed.kind==="xlsx"){
  return parsed.sheets.filter(sheet=>resolveSheet(sheet)).map(sheet=>({kind:resolveSheet(sheet),rows:sheet.rows,name:sheet.name}));
 }
 const sheet=parsed.sheets[0];
 if(!sheet)throw Error("Пустой CSV");
 let kind=resolveSheet(sheet);
 if(!kind){
  const ids=(sheet.rows||[]).slice(0,100).map(r=>clean(r?.[0])).filter(Boolean);
  kind=ids.some(v=>/^TKN-\d{3}$/.test(v))?"tokens":ids.some(v=>/^(KNZ|NEU|CHR|NCR|ZAV)-\d{3}$/.test(v))?"cards":null;
 }
 if(!kind){
  kind=/токен|token/i.test(fileName||"")?"tokens":/карт|cards/i.test(fileName||"")?"cards":null;
 }
 if(!kind)throw Error("CSV: невозможно определить раздел по имени или ID. Используйте имя Карты.csv / Токены.csv.");
 return [{name:fileName||sheet.name,kind,rows:sheet.rows}];
}
function toV05Card(record){
 if(!record)return null;
 return {id:record.id,name:record.name,type:record.type,class:record.class,class_key:record.class_key,
   rarity:record.rarity,rarity_key:record.rarity_key,cost:record.cost,resource:record.resource,
   attack:record.attack,health:record.health,durability:record.durability,armor:record.armor??null,
   time:record.time??"—",time_key:record.time_key,race:record.race??"—",race_icon_key:record.race_icon_key,
   subtype:record.subtype??"—",subtype_icon_key:record.subtype_icon_key,
   description:record.description??"",school:record.school,keywords:record.keywords,
   mana:record.mana,maxCopies:record.maxCopies,status:record.status,notes:record.notes,
   spellForm:record.spellForm,cost_resource:record.cost_resource,
   flavor_text:record.flavor_text??null,art_status:record.art_status??"тестовый вариант"};
}
return {FIELDS,MODEL_FIELDS,REQUIRED,KIND_LABEL,key,clean,headerInfo,normalizeSheet,normalizeSeed,
 validateSnapshot,diffRecords,prepare,resolveSheet,classifyInput,toV05Card};
});
