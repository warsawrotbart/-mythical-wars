/* MW 1.4: local deck catalog and basic sandbox match.
 * No backend, Unity runtime, CDN or mandatory login.
 */
(() => {
"use strict";
const $=id=>document.getElementById(id), dm=window.MW_DECK_MODEL, eng=window.MW_GAME_ENGINE;
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const nameType=t=>dm.types[t]||"Неизвестно";
const getSaved=()=>window.MW_CARD_BRIDGE?.getSavedCards()||[];
let catalog=dm.indexCatalog(window.MW_CANONICAL_CARDS,getSaved()), decks=new Map(),activeId=null;
let deckDB=null,storageMode="memory",saveQueue=Promise.resolve(),currentMode="editor",filterText="",filterType="all",filterCost="all",onlyEligible=true;
let game=null,pending=null,mulliganSelection=new Set(),gameRunningAI=false,notifyTimeout=null;
let labLastSummary=null,labBusy=false,loadedReplay=null,lastAuditReport="";
// v2.0: local battle save is separate from cards, assets and deck storage.
const BATTLE_SAVE_KEY="mw-active-battle-v2.0";
const BATTLE_PREVIOUS_KEY="mw-previous-battle-v2.0";
let battleSaveError="",lastSavedAt="";

let graveOpenOwner=null;
let inspectOpen=false,lastBattleVisual=null,heroPortraitOwner=null;
const PORTRAIT_KEY="mw-hero-portrait-v1.9:";
const heroPortraitMemory=new Map();
let visualScale=1.15,artFit="contain";
let battleDragSession=null;
try{
  const z=Number(localStorage.getItem("mw-card-zoom-v1.9"));
  if([1,1.15,1.3].includes(z))visualScale=z;
  const f=localStorage.getItem("mw-art-fit-v1.9");
  if(["contain","cover"].includes(f))artFit=f;
}catch(_){}
const safeDataImage=s=>typeof s==="string"&&(/^data:image\/(?:png|jpeg|webp);base64,[\w+/=]+$/i.test(s)||/^assets\/[\w.-]+\.(?:png|jpeg|webp)$/i.test(s)||/^test-art\/[A-Z]{3}-\d{3}\.webp$/.test(s)||/^v05\/[A-Z]{3}-\d{3}\/[A-Z]{3}-\d{3}_art_source\.png$/.test(s))?s:"";
function applyBattleVisualSettings(){
  const field=$("battleWorkspace");
  if(field){field.style.setProperty("--battle-scale",String(visualScale));field.dataset.artFit=artFit;}
  if($("battleCardScale"))$("battleCardScale").value=String(visualScale);
  if($("battleArtFit"))$("battleArtFit").value=artFit;
}
function heroPowerDescription(status){
  switch(status?.id){
    case "warrior-recruit":return "Призывает ДРУЖЫННІКА 1/1 (Дзень) · 1 раз за ход";
    case "warrior-torch":return "Выбранный дружественный Чалавек действует как Дзень до конца хода";
    case "necro-idol":return "Идол: тип и время токена ещё не утверждены";
    case "necro-undead":return "Мертвец: тип и время токена ещё не утверждены";
    default:return status?.reason||"Сила для этого класса ещё не утверждена";
  }
}
function heroPortraitKey(o,cls){return PORTRAIT_KEY+o+":"+(cls||"unknown");}
function readHeroPortrait(o,cls,phase="day"){
  const key=heroPortraitKey(o,cls);
  // User-selected portraits are never overwritten by built-in test art.
  if(heroPortraitMemory.has(key))return heroPortraitMemory.get(key);
  let userArt="";
  try{userArt=safeDataImage(localStorage.getItem(key));}catch(_){}
  return userArt||window.MW_HERO_ART?.portraitFor(cls,phase)||"";
}
function updateHeroPortrait(o,cls,profile){
  const button=$(o===0?"myHeroPortrait":"botHeroPortrait"),label=$(o===0?"myHeroName":"botHeroName");
  if(!button)return;
  const phase=game&&!eng.isBright(game.time)?"night":"day";
  const src=readHeroPortrait(o,cls,phase);
  const symbol=cls==="Воин"?"⚔":cls==="Некромант"?"☠":cls==="Чернокнижник"?"✧":"♜";
  button.innerHTML=src?`<img src="${esc(src)}" alt="Портрет ${esc(cls)}">`:`<span aria-hidden="true">${symbol}</span>`;
  const shell=button.closest("[data-hero-owner]");
  if(shell)shell.dataset.heroClass=cls;
  label.textContent=profile==="ragvalod"&&cls==="Воин"?"Рагвалод · обучение":cls+" · "+(profile==="demo-unlocked"?"силы открыты (тест)":"кампания");
}
// Same portrait source is shared with 3D; local user overrides remain first.
window.MW_HERO_PORTRAIT_BRIDGE=Object.freeze({get:(owner,cls,phase)=>readHeroPortrait(owner,cls,phase)});

function targetClass(owner,kind,uid=null){
  if(!pending||!game)return "";
  const target={kind,owner,uid};let eligible=false;
  if(pending.kind==="hero-power")eligible=eng.heroPowerTargetValid(game,0,target);
  else if(pending.kind==="spell"){
    const h=game.players[0].hand.find(x=>x.uid===pending.uid);
    eligible=!!h&&eng.targetValid(game,0,h.cardId,target);
  }else if(pending.kind==="attack")
    eligible=eng.eligibleAttackTargets(game,0).some(t=>t.owner===owner&&t.kind===kind&&(kind==="hero"||t.uid===uid));
  return eligible?" battle-valid-target":" battle-invalid-target";
}
function battleAppearance(s){
 return {game:s,players:s.players.map(p=>({
   health:p.health,armor:p.armor,
   minions:new Map(p.board.map(m=>[m.uid,m.health]))
 }))};
}
function popBattleNumber(node,n){
 if(!node||!n)return;
 const span=document.createElement("span");
 span.className="battle-floating-number "+(n>0?"healed":"damaged");
 span.textContent=(n>0?"+":"")+n;
 node.appendChild(span);span.addEventListener("animationend",()=>span.remove(),{once:true});
}
function updateCombatVisualEffects(){
 if(!game){lastBattleVisual=null;return;}
 const now=battleAppearance(game),prev=lastBattleVisual;lastBattleVisual=now;
 if(!prev||prev.game!==game)return;
 for(let o=0;o<2;o++){
   const a=prev.players[o],b=now.players[o];
   const hero=$(o===0?"myHeroPortrait":"botHeroPortrait");
   const diff=(b.health+b.armor)-(a.health+a.armor);
   popBattleNumber(hero,diff);
   for(const [id,hp] of b.minions){
     if(!a.minions.has(id))continue;
     const node=document.querySelector(`[data-battle-minion="${o}|${id}"]`);
     popBattleNumber(node,hp-a.minions.get(id));
   }
   if(a.minions.size>b.minions.size){
     const board=$(o===0?"myBoard":"botBoard");
     board.classList.remove("battle-death-flash");void board.offsetWidth;board.classList.add("battle-death-flash");
   }
 }
}
function openCardInspect(owner,kind,uid){
 if(!game)return;
 const p=game.players[owner];
 const item=kind==="hand"?p.hand.find(x=>x.uid===uid):p.board.find(x=>x.uid===uid);
 if(!item)return;
 const c=game.cards[item.cardId]||{},coin=item.cardId==="__coin__";
 const type=coin?"Особая":dm.types[c.cardType]||c.cardType||"Существо";
 $("battleInspectName").textContent=coin?"Монетка":c.name||item.name||item.cardId;
 $("battleInspectMeta").textContent=(c.cardId||item.cardId)+" · "+type+" · "+(c.classId||"")+" · "+(dm.rarityLabel[c.rarityId]||"");
 const attack=kind==="minion"?eng.effectiveAttack(game,item):c.attack;
 const health=kind==="minion"?item.health:c.health??c.durability;
 $("battleInspectStats").textContent=`Стоимость ${c.costValue??"без стоимости"} · Атака ${attack??"—"} · Здоровье/прочность ${health??"—"}`;
 $("battleInspectEffect").textContent=coin?"Даёт 1 временную ману.":c.ability||"Без способности";
 $("battleInspectSupport").textContent=c.cardId&&eng.abilitySupport(c)!=="complete"?
   "Часть игровой механики пока не реализована полностью.":"";
 window.MW_BATTLE_CARD_RENDERER?.hydrateInspect(game,owner,kind,uid);
 $("battleCardInspect").hidden=false;inspectOpen=true;
}
function closeCardInspect(){
 inspectOpen=false;$("battleCardInspect").hidden=true;
}

let pendingChoice=null,choiceDraft={};

function message(msg){
 const el=$("deckNotice");
 if(!el){const div=document.createElement("div");div.id="deckNotice";document.body.appendChild(div);}
 const e=$("deckNotice");e.textContent=msg;e.classList.add("visible");
 clearTimeout(notifyTimeout);notifyTimeout=setTimeout(()=>e.classList.remove("visible"),4200);
}
function refreshCatalog(){
 catalog=dm.indexCatalog(window.MW_CANONICAL_CARDS,getSaved());
 window.MW_BATTLE_CARD_RENDERER?.clear();
 window.MW_ARENA_3D?.invalidateCards();
}
function currentDeck(){return decks.get(activeId)||null;}
function validate(){const d=currentDeck();return d?dm.validateDeck(d,catalog):{ok:false,errors:["Выберите колоду."],warnings:[],total:0};}
function openDB(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(new Error("IndexedDB недоступна"));return;}
  const req=indexedDB.open("MythicalWars_Decks_v1",1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("decks"))db.createObjectStore("decks",{keyPath:"deckId"});
    if(!db.objectStoreNames.contains("meta"))db.createObjectStore("meta",{keyPath:"key"});};
  req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
 });
}
function dbMeta(key,value){
 if(!deckDB)return Promise.resolve(null);
 return new Promise((resolve,reject)=>{
  const tx=deckDB.transaction("meta",value===undefined?"readonly":"readwrite");
  const store=tx.objectStore("meta");
  const req=value===undefined?store.get(key):store.put({key,value});
  req.onsuccess=()=>resolve(value===undefined?req.result?.value:req.result);
  req.onerror=()=>reject(req.error);
 });
}
function getAllDB(){
 return new Promise((resolve,reject)=>{
  const tx=deckDB.transaction("decks","readonly");
  const req=tx.objectStore("decks").getAll();
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
function putDB(deck){
 if(!deckDB)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const tx=deckDB.transaction("decks","readwrite");
  tx.objectStore("decks").put(clone(deck));
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
function deleteDB(id){
 if(!deckDB)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const tx=deckDB.transaction("decks","readwrite");
  tx.objectStore("decks").delete(id);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
function saveFallback(){
 if(storageMode!=="localStorage")return;
 try{localStorage.setItem("mw-decks-v1",JSON.stringify([...decks.values()]));}
 catch(err){storageMode="memory";$("deckPersistenceNote").textContent="Нет постоянного хранения. Экспортируйте резервную копию!";}
}
async function persist(deck){
 const copy=clone(deck);copy.updatedAt=new Date().toISOString();decks.set(copy.deckId,copy);
 if(deckDB){
  saveQueue=saveQueue.catch(()=>{}).then(()=>putDB(copy));
  try{await saveQueue;}catch(e){
   console.warn("deck persistence",e);storageMode="memory";message("Не удалось сохранить колоду. Сделайте экспорт резервной копии.");
  }
 }else saveFallback();
}
async function removeDeck(id){
 decks.delete(id);
 if(deckDB)try{await deleteDB(id);}catch(err){message("Ошибка удаления из хранилища.");}
 else saveFallback();
}
function sortedDecks(){return [...decks.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),"ru"));}
function renderDeckList(){
 $("deckList").innerHTML=sortedDecks().map(d=>{
  const x=dm.validateDeck(d,catalog),q=dm.totalCards(d);
  return `<button class="deck-entry ${d.deckId===activeId?"active":""}" type="button" data-deck-id="${esc(d.deckId)}">
   <span class="deck-entry-name">${esc(d.name)}</span>
   <span class="deck-entry-sub">${esc(d.classId)} · ${q}/30 ${x.ok?"✓":"· не готова"}</span>
   <div class="deck-entry-meter"><span style="width:${Math.min(100,q/30*100)}%"></span></div>
   ${d.source&&d.source.includes("xlsx")?'<span class="deck-badge">Исходная колода из Excel</span>':""}
   </button>`;
 }).join("")||'<div class="deck-list-empty">Создайте первую колоду.</div>';
}
function costLabel(c){return c.costValue===null||c.costValue===undefined?"—":c.costValue;}
function metaLabel(c){
 const rarity=dm.rarityLabel[c.rarityId]||"Не указана";
 return `${nameType(c.cardType)} · ${rarity} · ${c.classId||"Класс не указан"}`;
}
function renderCollection(){
 const d=currentDeck(),search=filterText.toLocaleLowerCase();
 const entries=[...catalog.values()].filter(c=>{
  if(onlyEligible&&d&&!dm.allowedForClass(c,d.classId))return false;
  if(filterType!=="all"&&c.cardType!==filterType)return false;
  if(filterCost!=="all"){
   const cost=Number(c.costValue);
   if(c.costValue===null||!Number.isFinite(cost))return false;
   if(filterCost==="0-2"&&!(cost>=0&&cost<=2))return false;
   if(filterCost==="3-5"&&!(cost>=3&&cost<=5))return false;
   if(filterCost==="6+"&&cost<6)return false;
  }
  return !search||(c.name+" "+c.cardId+" "+(c.keywords||"")).toLocaleLowerCase().includes(search);
 }).sort((a,b)=>Number(a.costValue??100)-Number(b.costValue??100)||a.name.localeCompare(b.name,"be"));
 $("collectionCount").textContent=entries.length+" карт";
 $("collectionCards").innerHTML=entries.map(c=>{
   const reason=d?dm.canAddCard(d,c,catalog):"Колода не выбрана.";
   const qty=d?.counts?.[c.cardId]||0;
   const text=String(c.ability||"");
   return `<article class="deck-card-row ${reason?"muted":""}" draggable="true" data-drag-card-id="${esc(c.cardId)}" title="${esc(text||metaLabel(c))}">
     <span class="card-cost ${c.costType==="corpses"?"corpses":""}" title="${c.costType==="corpses"?"Трупы":"Мана"}">${esc(costLabel(c))}</span>
     <div class="deck-card-body">
       <strong>${esc(c.name)} ${c.origin==="local"?'<span class="deck-badge draft">Черновик</span>':""}</strong>
       <div class="deck-card-meta">${esc(c.cardId)} · ${esc(metaLabel(c))}</div>
       ${text?`<div class="deck-card-effect">${esc(text)}</div>`:""}
     </div>
     ${qty?`<span class="mini-count">${qty} шт.</span>`:""}
     <button class="deck-add" type="button" data-add="${esc(c.cardId)}" ${reason?"disabled":""}
       title="${esc(reason||"Добавить в колоду")}">＋</button>
   </article>`;
 }).join("")||'<div class="deck-cards-empty">Нет карт по выбранным фильтрам.</div>';
}
function renderContents(){
 const d=currentDeck();
 if(!d){$("deckContents").innerHTML='<div class="deck-list-empty">Нет выбранной колоды.</div>';return;}
 const cards=Object.entries(d.counts||{}).filter(([,n])=>n>0).map(([id,count])=>({c:catalog.get(id)||{cardId:id,name:"Карта отсутствует",costValue:null},count}))
 .sort((a,b)=>Number(a.c.costValue??100)-Number(b.c.costValue??100)||a.c.name.localeCompare(b.c.name,"be"));
 $("deckContents").innerHTML=cards.map(({c,count})=>{
  return `<div class="deck-line" title="${esc(c.cardId)}">
    <span class="deck-line-cost">${esc(costLabel(c))}</span>
    <span class="deck-line-title">${esc(c.name)}</span>
    <button type="button" data-dec="${esc(c.cardId)}" title="Убрать карту">−</button>
    <span class="deck-line-mult">×${count}</span>
    <button type="button" data-inc="${esc(c.cardId)}" ${dm.canAddCard(d,c,catalog)?"disabled":""} title="Добавить копию">＋</button>
  </div>`;
 }).join("")||'<div class="deck-list-empty">Пока нет карт. Нажимайте ＋ слева.</div>';
}
function renderValidation(){
 const x=validate();
 const b=$("deckValidation"),total=$("deckTotal");
 total.textContent=x.total+"/30";
 total.classList.toggle("invalid",!x.ok);
 b.className="deck-validation "+(!x.ok?"error":x.warnings.length?"warn":"");
 b.innerHTML='<strong>'+(x.ok?"✓ Колода соответствует проверяемым ограничениям":"Колода ещё не готова")+"</strong>"+
   (x.errors.length?"<ul>"+x.errors.map(e=>`<li>${esc(e)}</li>`).join("")+"</ul>":"")+
   (x.ok&&x.warnings.length?"<div style='margin-top:7px'>"+esc(x.warnings.join(" "))+"</div>":"");
 $("deckPlayBtn").disabled=!x.ok;
}
function renderDeck(){
 renderDeckList();
 const d=currentDeck();
 $("activeDeckTitle").textContent=d?.name||"Выберите колоду";
 $("deckName").value=d?.name||"";
 $("deckClass").value=d?.classId||"Воин";
 $("deckName").disabled=!d;$("deckClass").disabled=!d;
 $("deckSaveBtn").disabled=!d;$("deckDeleteBtn").disabled=!d;$("deckCloneBtn").disabled=!d;
 renderValidation();renderContents();renderCollection();renderBattleDeckOptions();
}
function chooseDeck(id){if(!decks.has(id))return;activeId=id;renderDeck();}
async function mutateDeck(mutator){
 const d=currentDeck();if(!d)return;
 const next=clone(d);mutator(next);next.updatedAt=new Date().toISOString();
 decks.set(next.deckId,next);
 renderDeck();await persist(next);
}
async function addCard(id){
 const d=currentDeck(),c=catalog.get(id);
 if(!d){message("Сначала выберите колоду.");return;}
 const reason=dm.canAddCard(d,c,catalog);
 if(reason){message(reason);return;}
 await mutateDeck(x=>{x.counts[id]=(x.counts[id]||0)+1;});
}
async function removeCard(id){
 const d=currentDeck();if(!d||!d.counts[id])return;
 await mutateDeck(x=>{x.counts[id]--;if(!x.counts[id])delete x.counts[id];});
}
async function createDeck(){
 const cls=currentDeck()?.classId||"Воин",d=dm.newDeck("Новая колода",cls);
 decks.set(d.deckId,d);activeId=d.deckId;await persist(d);renderDeck();$("deckName").focus();$("deckName").select();
 message("Новая колода создана. Укажите название и выберите карты.");
}
async function cloneDeck(){
 const d=currentDeck();if(!d)return;
 const fresh=dm.newDeck(d.name+" · копия",d.classId);fresh.counts=clone(d.counts);fresh.source="Локальная копия";
 decks.set(fresh.deckId,fresh);activeId=fresh.deckId;await persist(fresh);renderDeck();
}
async function deleteDeck(){
 const d=currentDeck();if(!d)return;
 if(!confirm("Удалить колоду «"+d.name+"»? Это не удалит карты из библиотеки."))return;
 await removeDeck(d.deckId);activeId=sortedDecks()[0]?.deckId||null;renderDeck();message("Колода удалена.");
}
function downloadText(content,name){
 const a=document.createElement("a"),url=URL.createObjectURL(new Blob([content],{type:"application/json;charset=utf-8"}));
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function exportDecks(){
 const obj={format:"mythical-wars-decks",version:1,createdAt:new Date().toISOString(),decks:sortedDecks()};
 downloadText(JSON.stringify(obj,null,2),"Mythical_Wars_Decks_Backup.json");
 message("Экспортирована резервная копия: "+obj.decks.length+" колод.");
}
async function importDecks(file){
 if(!file)return;
 if(file.size>5*1024*1024){message("Слишком большой файл.");return;}
 let obj;try{obj=JSON.parse(await file.text());}catch(e){message("Некорректный JSON.");return;}
 if(obj?.format!=="mythical-wars-decks"||!Array.isArray(obj.decks)||obj.decks.length>1000){
  message("Неверный формат резервной копии.");return;
 }
 let updated=0,skipped=0;
 for(const src of obj.decks){
  if(!src||typeof src.deckId!=="string"||src.deckId.length>120||
      typeof src.name!=="string"||src.name.length>150||!dm.CLASSES.includes(src.classId)||
      !src.counts||typeof src.counts!=="object"||Array.isArray(src.counts)){skipped++;continue;}
  const counts={};let ok=true;
  for(const [id,q] of Object.entries(src.counts)){
    if(typeof id!=="string"||id.length>90||!Number.isInteger(q)||q<0||q>30){ok=false;break;}
    counts[id]=q;
  }
  if(!ok){skipped++;continue;}
  let id=src.deckId;
  if(decks.has(id))id=dm.newDeck().deckId;
  const d={deckId:id,name:src.name,classId:src.classId,counts,
      source:"Импортированная колода",updatedAt:new Date().toISOString()};
  decks.set(id,d);await persist(d);updated++;
 }
 if(updated)activeId=sortedDecks().find(x=>x.source==="Импортированная колода")?.deckId||activeId;
 renderDeck();message("Импорт: "+updated+" колод; пропущено: "+skipped+".");
}
function setMode(mode){
 if(!["editor","decks","battle"].includes(mode))return;
 if(mode==="editor"){window.location.assign("v05-dynamic.html");return;}
 currentMode=mode;document.body.dataset.mode=mode;
 $("editorWorkspace").hidden=mode!=="editor";
 $("decksWorkspace").hidden=mode!=="decks";
 $("battleWorkspace").hidden=mode!=="battle";
 document.querySelectorAll("[data-app-mode]").forEach(b=>b.classList.toggle("active",b.dataset.appMode===mode));
 if(mode==="decks"){refreshCatalog();renderDeck();}
 if(mode==="battle"){refreshCatalog();renderBattleDeckOptions();renderGame();}
 if(mode==="editor")window.dispatchEvent(new Event("resize"));
}
function battleCatalog(){
 if(!$("battleUseLocal").checked)return catalog;
 const map=new Map([...catalog.entries()].map(([id,c])=>[id,{...c}]));
 for(const item of getSaved()){
  if(!item?.cardId)continue;
  const local=dm.fromSaved(item),original=map.get(item.cardId);
  if(!original){map.set(item.cardId,local);continue;}
  const updated={...original};
  for(const field of ["name","cardType","classId","rarityId","costType","costValue",
                       "attack","health","durability","timeAffinityId","creatureTypeId",
                       "subtype","schoolId","ability","keywords"]){
   // Blank values are intentionally stored in a draft. Only defined gameplay values override canonical fields.
   if(local[field]!==null && local[field]!==undefined && local[field]!=="")
     updated[field]=local[field];
  }
  // Нельзя запускать обработчик эффекта по ID, если текст локально изменён.
  updated.effectModified=String(updated.ability||"").trim()!==String(original.ability||"").trim();
  updated.origin="local-test";map.set(item.cardId,updated);
 }
 return map;
}
function renderBattleDeckOptions(){
 const complete=window.MW_CANONICAL_CARDS.filter(c=>eng.abilitySupport(c)==="complete").length;
 const coverage=$("battleEffectCoverage");
 if(coverage)coverage.textContent="Обработчики: "+complete+"/"+window.MW_CANONICAL_CARDS.length+
  " карт · остальные частично реализованы или заблокированы.";
 const localSource=battleCatalog();
 const valid=sortedDecks().filter(d=>dm.validateDeck(d,localSource).ok),previousA=$("battleMyDeck").value,previousB=$("battleBotDeck").value;
 const options=valid.map(d=>`<option value="${esc(d.deckId)}">${esc(d.name)} · ${esc(d.classId)}</option>`).join("");
 $("battleMyDeck").innerHTML=options;$("battleBotDeck").innerHTML=options;
 if(valid.some(d=>d.deckId===previousA))$("battleMyDeck").value=previousA;
 else if(valid.some(d=>d.deckId===activeId))$("battleMyDeck").value=activeId;
 if(valid.some(d=>d.deckId===previousB))$("battleBotDeck").value=previousB;
 else if(valid.length>1)$("battleBotDeck").value=valid.find(d=>d.deckId!==$("battleMyDeck").value)?.deckId||valid[0].deckId;
 $("battleStartBtn").disabled=!valid.length;
}
function timeLabel(s){
 const hh=String(s.time).padStart(2,"0")+":00";
 return "◷ "+hh+" · "+eng.phaseOfHour(s.time);
}
function pName(owner){return owner===0?"Игрок":"Бот";}
function battleCard(h,owner,kind){
 const c=game.cards[h.cardId]||(kind==="minion"?window.MW14_BOARD_STATUS?.cardDefinition(game,h,eng.TOKEN_DATA):null),coin=h.cardId==="__coin__";
 const name=coin?"Монетка":c?.name||h.name||"Неизвестная карта";
 const cost=coin?"0":owner===0&&kind==="hand"&&c?
   String(eng.currentCost(game,owner,h)):String(c?.costValue??"—");
 const rarity=dm.rarityLabel[c?.rarityId]||"";
 const status=owner===0&&kind==="hand"?eng.actionStatus(game,owner,h.uid):{ok:true};
 const notSupported=owner===0&&kind==="hand"&&!status.ok;
 const active=pending?.uid===h.uid&&pending.owner===owner;
 const atk=kind==="minion"?eng.effectiveAttack(game,h):c?.attack;
 const hp=kind==="minion"?h.health:c?.health;
 const taunt=kind==="minion"&&h.taunt;
 const ready=kind==="minion"&&owner===0&&h.ready&&!h.attacked;
 const more=coin?"Мана +1":kind==="minion"?(h.unsupported?"Эффект частично":h.timed?.some(t=>t.kind==="frozen")?
   "Заморожено":ready?"Готов":"Ждёт"):
   notSupported?"Недоступно":c&&eng.abilitySupport(c)==="partial"?"Частичный эффект":"";
 const label=coin?"Монетка · +1 маны":(c?.ability||"")+
   ((kind==="hand"&&c&&eng.abilitySupport(c)!=="complete")||(kind==="minion"&&h.unsupported)?" · НЕ ПОЛНОСТЬЮ РЕАЛИЗОВАНО":"")+
   (notSupported?" · "+status.reason:"");
 const type=coin?"coin":c?.cardType||"creature";
 const rarityClass=/^(common|standard|rare|epic|legendary)$/.test(c?.rarityId)?c.rarityId:"common";
 const affinity=kind==="minion"?(h.affinity||c?.timeAffinityId):c?.timeAffinityId;
 const theme=affinity==="Ноч"?"moon":affinity==="Дзень"?"sun":"neutral";
 const frozen=kind==="minion"&&h.timed?.some(t=>t.kind==="frozen");
 const statusIcons=kind==="minion"?(window.MW14_BOARD_STATUS?.statusIcons(h)||[]):[];
 const deathIcon=statusIcons.find(x=>x.id==="deathrattle");
 const otherIcons=statusIcons.filter(x=>x.id!=="deathrattle");
 const effectBadge=kind==="minion"&&otherIcons.length?
   '<span class="mw14-sigils" aria-hidden="true">'+otherIcons.map(x=>
     '<span class="mw14-sigil mw14-sigil-'+esc(x.id)+'" title="'+esc(x.label)+'">'+esc(x.glyph)+'</span>').join("")+'</span>':"";
 const deathBadge=kind==="minion"&&deathIcon?
   '<span class="mw14-deathrattle" title="'+esc(deathIcon.label)+'" aria-hidden="true">'+esc(deathIcon.glyph)+'</span>':"";
 const guardCrest=taunt?'<span class="mw14-guard-emblem" title="Провокация" aria-hidden="true">⛨</span>':"";
 const boardTooltip=name+" · атака "+atk+", здоровье "+hp+
   (taunt?" · Провокация":"")+(affinity?" · "+affinity:"")+
   (statusIcons.length?" · "+statusIcons.map(x=>x.label).join(", "):"")+(label?" · "+label:"");
 const affinityMark=kind==="minion"&&["Ноч","Дзень"].includes(affinity)?
   '<span class="mw14-affinity" title="'+esc(affinity)+'" aria-hidden="true">'+(affinity==="Ноч"?"☾":"☀")+"</span>":"";
 // Prefer original card artwork over a potentially stale cached thumbnail.
 const thumbnail=c?.thumbnail,art=safeDataImage(c?.artImage)||
   safeDataImage(window.MW_TEST_ART_CATALOG?.url(h.cardId))||
   safeDataImage(window.MW_WARLOCK_ART?.get(h.cardId))||
   safeDataImage(thumbnail)||
   (h.cardId==="KNZ-002"?"assets/art_malady_druzhynnik.png":"");
 const icon=coin?"✦":type==="spell"?"✧":type==="weapon"?"⚔":"✥";
 const pick=kind==="minion"?owner+"|"+h.uid:h.uid;
 const dragEnabled=owner===0&&game.phase==="battle"&&game.turn===0&&!gameRunningAI&&!pendingChoice&&
  (kind==="hand"?status.ok:kind==="minion"&&h.ready&&!h.attacked&&!frozen);
 const burn=kind==="hand"&&h.burnTurnsLeft!=null;
 return `<div class="battle-card ${kind==="minion"?"minion":"hand"} ${notSupported?"disabled":""} ${active?"selected":""}
  ${ready?"ready":""} ${taunt?"mw14-taunt":""} ${frozen?"mw14-frozen":""} ${h.token?"mw14-token":""} theme-${theme} rarity-${rarityClass} cardtype-${type}${burn?" burning":""}${kind==="minion"?targetClass(owner,"minion",h.uid):""}"
  role="button" tabindex="0" ${dragEnabled?'draggable="true"':""} title="${esc(kind==="minion"?boardTooltip:label)}" ${kind==="minion"?`aria-label="${esc(boardTooltip)}"`:""} data-battle-${kind}="${esc(pick)}" data-mw-card-id="${esc(h.cardId)}" data-mw-template-type="${esc(type)}" data-mw-cost="${esc(cost)}">
  <button type="button" class="bc-inspect" data-preview-card="${esc(owner+"|"+kind+"|"+h.uid)}" title="Полный просмотр карты и арта" aria-label="Увеличить карту ${esc(name)}">⛶</button>
  ${burn?`<span class="bc-burn" title="Падпал: оставшиеся собственные ходы">🔥 ${h.burnTurnsLeft}</span>`:""}
  <span class="bc-top"><b>${esc(cost)}</b><span>${taunt?"🛡":coin?"✦":esc(rarity.slice(0,4))}</span></span>
  <span class="bc-art">${art?`<img src="${esc(art)}" alt="" loading="lazy" draggable="false">`:
     `<span class="bc-fallback" aria-hidden="true">${icon}</span>`}</span>
  <span class="bc-name">${esc(kind==="minion"?h.name:name)}</span>
  ${affinityMark}
  ${guardCrest}${deathBadge}${effectBadge}
  <span class="bc-stats">${coin?"":`<span class="bc-attack">${atk??"—"} ⚔</span><span class="bc-health">${hp??(c?.durability??"—")} ♥</span>`}</span>
  <span class="bc-status">${esc(more)}</span></div>`;
}

function readBattleSnapshot(previous=false){
 try{
  const text=localStorage.getItem(previous?BATTLE_PREVIOUS_KEY:BATTLE_SAVE_KEY);
  return text?JSON.parse(text):null;
 }catch(_){return null;}
}
function updateBattleSessionStatus(){
 const badge=$("battleSessionStatus"),resume=$("battleResumeBtn"),stored=readBattleSnapshot();
 if(resume)resume.disabled=!stored;
 if($("battleQuickResume"))$("battleQuickResume").disabled=!stored;
 const previousBtn=$("battleResumePrevious");
 if(previousBtn)previousBtn.hidden=!readBattleSnapshot(true);
 if(!badge)return;
 if(battleSaveError){badge.textContent="Автосохранение недоступно: "+battleSaveError+
   " · Используйте кнопку «Бой JSON» для переноса.";}
 else if(game){badge.textContent=(game.debugged?"ТЕСТОВАЯ ПАРТИЯ · ":"")+
   (lastSavedAt?"Локально сохранено: "+lastSavedAt:"Бой открыт · выберите «Сохранить бой»")+
   " · JSON-резервная копия доступна отдельной кнопкой.";}
 else badge.textContent=stored?"Есть сохранённая партия · нажмите «Продолжить».":"Сохранённой партии пока нет.";
}
function persistBattleSession(){
 if(!game){updateBattleSessionStatus();return false;}
 try{
  const raw=JSON.stringify(eng.exportBattle(game));
  localStorage.setItem(BATTLE_SAVE_KEY,raw);
  lastSavedAt=new Date().toLocaleTimeString("ru-RU");
  battleSaveError="";updateBattleSessionStatus();return true;
 }catch(err){
  battleSaveError=err?.message||"ошибка хранилища";
  updateBattleSessionStatus();return false;
 }
}
function loadBattleSave(input){
 let restored;
 try{restored=eng.importBattle(input);}catch(err){message("Ошибка сохранения: "+err.message);return false;}
 game=restored;
 window.MW_BATTLE_REPLAY?.ensureCapture(game);
 loadedReplay=null;
 pending=null;pendingChoice=null;choiceDraft={};
 graveOpenOwner=null;mulliganSelection=new Set();gameRunningAI=false;lastBattleVisual=null;
 $("battleChoiceDialog").hidden=true;$("battleGraveyardDialog").hidden=true;
 $("battleMulligan").hidden=game.phase!=="mulligan";
 closeCardInspect();
 if(game.phase==="mulligan")selectMulligan();
 setMode("battle");renderGame();
 if(game.phase==="battle"&&game.turn===1)maybeBot();
 message("Партия восстановлена: ход "+game.turns+" · "+String(game.time).padStart(2,"0")+":00.");
 return true;
}
function exportBattleSave(){
 if(!game){message("Сначала начните или восстановите партию.");return;}
 try{downloadText(JSON.stringify(eng.exportBattle(game),null,2),
   "MW_battle_turn_"+game.turns+"_v2.0.json");message("Резервная копия боя сохранена в JSON.");}
 catch(err){message("Экспорт партии: "+err.message);}
}
function renderEventJournal(){
 const box=$("battleLog");if(!box)return;
 if(!game){box.innerHTML="<div>Начните партию или восстановите сохранение.</div>";return;}
 const options={kind:$("battleLogKind").value,owner:$("battleLogOwner").value,
   search:$("battleLogSearch").value};
 const events=eng.eventJournal(game,options).slice(-125).reverse();
 box.innerHTML=events.length?events.map(ev=>{
   const phase=ev.hour===null?"--":String(ev.hour).padStart(2,"0");
   const cls=String(ev.kind||"system").replace(/[^a-z-]/g,"");
   return `<div class="battle-event-entry event-${cls}">
     <span class="event-meta">Х${ev.turn}<br>${phase}:00</span>
     <span class="event-message">${esc(ev.message)}</span></div>`;
 }).join(""):"<div>Нет событий по выбранным фильтрам.</div>";
}
function exportBattleJournal(){
 if(!game){message("Нет партии для выгрузки журнала.");return;}
 const selected=eng.eventJournal(game,{kind:$("battleLogKind").value,
   owner:$("battleLogOwner").value,search:$("battleLogSearch").value});
 const quote=x=>'"'+String(x??"").replaceAll('"','""')+'"';
 const rows=[["ID","Ход","Час","Сторона","Категория","Карта","Значение","Событие"],
  ...selected.map(e=>[e.id,e.turn,e.hour,
    e.actor===0?"Игрок":e.actor===1?"Бот":"Система",e.kind,e.cardId||"",e.amount??"",e.message])];
 downloadText("\ufeff"+rows.map(row=>row.map(quote).join(";")).join("\r\n"),
   "MW_events_v2.0.csv");
}

// v2.1A — настоящий аудит каталога. Отчёт не записывается в карточки или колоды.
function runLibraryAudit(){
 const A=window.MW_CARD_AUDIT;
 if(!A)return message("Модуль аудита не загружен.");
 const cards=A.auditCatalog([...catalog.values()]);
 const copies=A.auditDecks([...decks.values()],catalog);
 lastAuditReport=A.toReport(cards,copies);
 $("deckAuditPanel").hidden=false;$("deckAuditPanel").open=true;
 $("deckAuditResult").textContent=lastAuditReport;
 const err=cards.errors.length+copies.invalid;
 message(`Аудит: ${cards.count} карт, ${copies.valid}/${copies.count} допустимых колод, замечаний: ${err}.`);
}
function currentReplay(){
 const R=window.MW_BATTLE_REPLAY;
 if(loadedReplay)return loadedReplay;
 if(!game||!R)return null;
 return R.ensureCapture(game);
}
function updateReplayUI(){
 const trace=currentReplay();
 const slider=$("battleReplayStep"),info=$("battleReplayInfo");
 slider.max=String(trace?.actions?.length||0);
 if(Number(slider.value)>Number(slider.max))slider.value=slider.max;
 if(!trace)info.textContent="Начните бой или загрузите повтор.";
 else if(!trace.canReplay)info.textContent="В этом бою использовался внешний генератор случайных чисел. Точный повтор недоступен.";
 else info.textContent=`Доступны ${trace.actions.length} записанных действий`+
  (trace.startedMidGame?" (запись начата с восстановленного состояния)":" (с начала партии)")+
  (trace.overflow?" · лимит событий превышен":"")+". Переместите ползунок и нажмите «Просмотреть».";
}
function exportBattleReplay(){
 const R=window.MW_BATTLE_REPLAY;
 if(!game||!R)return message("Нет открытого боя.");
 try{
  downloadText(JSON.stringify(R.exportReplay(game),null,2),
    `MW_private_replay_turn_${game.turns}_v2.1A.json`);
  message("Личная запись повтора сохранена. Она содержит закрытые карты обеих сторон!");
 }catch(e){message("Повтор недоступен: "+e.message);}
}
function checkBattleReplay(){
 const R=window.MW_BATTLE_REPLAY,trace=currentReplay();
 if(!trace||!R)return message("Нет истории для проверки.");
 const checked=R.verify(trace);
 $("battleReplayPanel").open=true;
 const text=checked.ok?`Повтор проверен: ${checked.steps} действий, итоговый ход ${checked.game.turns}, код ${checked.stateHash}.`:
   `Ошибка шага ${checked.index??"—"}: ${checked.reason}`;
 $("battleReplayInfo").textContent=text;
 message(text);
}
function inspectReplayStep(){
 const trace=currentReplay(),R=window.MW_BATTLE_REPLAY;
 if(!trace||!R)return message("Нет записи повтора.");
 const count=Number($("battleReplayStep").value)||0,checked=R.verify(trace,count);
 if(!checked.ok){
  $("battleReplayInfo").textContent="Проверка не пройдена: "+checked.reason;return;
 }
 const state=checked.game;
 const p=state.players.map((pl,i)=>`${i===0?"Игрок":"Бот"}: ${pl.health} HP / ${pl.armor} брони / ${pl.mana} маны / ${pl.corpses} трупов · рука ${pl.hand.length}, стол ${pl.board.length}, колода ${pl.deck.length}`);
 const last=count?trace.actions[count-1]:null;
 $("battleReplayInfo").textContent=`Шаг ${count}/${checked.total} · ход ${state.turns} · ${state.time}:00 · ${state.phase}`+
   (last?` · действие: ${last.type}`:" · начальное состояние")+"\n"+p.join("\n");
}
async function runLaboratory(){
 const L=window.MW_BATTLE_LAB;
 if(!L||labBusy)return;
 labBusy=true;$("battleLabRunBtn").disabled=true;$("battleLabExportBtn").disabled=true;
 labLastSummary=null;
 const originals=window.MW_APPROVED_EXAMPLE_DECKS;
 const canonical=new Map(window.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
 const count=Number($("battleLabGames").value)||2;
 const seedRaw=Number($("battleLabSeed").value);
 const seed=Number.isSafeInteger(seedRaw)?seedRaw:20211108;
 const cases=L.schedulePairs(originals,{gamesPerPair:count,seed,maxHalfTurns:220,timeMode:"off"});
 const results=[];
 try{
  for(const c of cases){
   // Yield to UI between full matches — no network or background server.
   await new Promise(resolve=>setTimeout(resolve,0));
   const r=L.playFullMatch(c.deckA,c.deckB,canonical,c.opts);
   results.push(r);
   $("battleLabResult").textContent=`Проверено ${results.length}/${cases.length}: `+
      `${r.deckA} / ${r.deckB} · ${r.termination} · ${r.turns} ходов`+
      (r.issues.length?" · нарушения: "+r.issues.join("; "):"");
  }
  labLastSummary=L.summarize(results);
  $("battleLabResult").textContent=`Завершено: ${labLastSummary.ended}/${labLastSummary.games}, `+
    `лимит ходов: ${labLastSummary.turnLimit}, ошибки: ${labLastSummary.errors}, ничьи: ${labLastSummary.draws}.\n`+
    Object.entries(labLastSummary.wins).map(([name,n])=>`${name}: ${n} побед`).join("\n")+
    "\nРежим штрафов дня/ночи: off (округление не утверждено).";
  $("battleLabExportBtn").disabled=false;
  message("Автоматические полные матчи завершены.");
 }catch(e){
  $("battleLabResult").textContent="Автотест остановлен: "+e.message;
  message("Ошибка автотестов: "+e.message);
 }finally{labBusy=false;$("battleLabRunBtn").disabled=false;}
}
function refreshDeveloperControls(){
 const active=!!game,checked=!!game?.debugMode;
 $("battleDevToggle").disabled=!active;
 $("battleDevToggle").checked=checked;
 $("battleDevControls").hidden=!checked;
 $("battleDevNote").textContent=game?.debugged?
   "Эта партия использовала тестовые команды; её результат не относится к кампании.":"";
 const action=$("battleDevAction").value;
 $("battleDevValueRow").hidden=["give","summon","kill"].includes(action);
 $("battleDevCardRow").hidden=!["give","summon"].includes(action);
 $("battleDevMinionRow").hidden=action!=="kill";
 const owner=Number($("battleDevOwner").value)||0;
 if(action==="kill"){
  const board=game?.players[owner]?.board||[];
  const previous=$("battleDevMinion").value;
  $("battleDevMinion").innerHTML=board.map(m=>
    `<option value="${esc(m.uid)}">${esc(m.name)} (${m.attack}/${m.health})</option>`).join("");
  if(board.some(m=>m.uid===previous))$("battleDevMinion").value=previous;
 }
}
function initDeveloperCardList(){
 const options=[...catalog.values()].filter(c=>["creature","spell","weapon"].includes(c.cardType)&&
    c.origin!=="token"&&c.origin!=="special").sort((a,b)=>a.cardId.localeCompare(b.cardId));
 $("battleDevCard").innerHTML=options.map(c=>
   `<option value="${esc(c.cardId)}">${esc(c.cardId)} · ${esc(c.name)} · ${esc(c.cardType)}</option>`).join("");
}
function runDeveloperCommand(){
 if(!game?.debugMode)return;
 const type=$("battleDevAction").value,owner=Number($("battleDevOwner").value),
  cardId=$("battleDevCard").value;
 const def=battleCatalog().get(cardId);
 const result=eng.debugAction(game,{type,owner,value:$("battleDevValue").value,
    cardId,definition:def,uid:$("battleDevMinion").value});
 if(!result.ok)message(result.reason);
 else{renderGame();message("Тестовая команда выполнена (помечена в журнале).");}
}
function renderGame(){
 const workspace=$("battleWorkspace"),hour=game?Number(game.time):12,
       phase=game?eng.phaseOfHour(hour):"День";
 workspace.dataset.phase=phase==="Утро"?"morning":phase==="День"?"day":phase==="Вечер"?"evening":"night";
 $("battleCelestial").textContent=hour>=6&&hour<18?"☀":"☾";
 $("battleHourPips").innerHTML=Array.from({length:12},(_,i)=>`<span class="${game&&i<=hour%12?"lit":""}" title="${i===0?"12":i} час"></span>`).join("");
 $("battleClock").textContent=game?timeLabel(game):"◷ —";
 if(!game){
  updateReplayUI();
  $("battleTurnInfo").textContent="Выберите колоды и начните тест";
  $("myBoard").innerHTML="";$("botBoard").innerHTML="";$("myHand").innerHTML="";$("botHand").innerHTML="";
  $("battleEndTurn").disabled=true;$("battleLog").innerHTML='<div>Сначала выберите колоду для игрока и для бота.</div>';
  $("myHero").textContent="30 ♥";$("botHero").textContent="30 ♥";
  $("myHeroPower").disabled=true;$("botHeroPower").disabled=true;
  $("myHeroPower").textContent="Сила героя";
  $("botHeroPower").textContent="Сила героя";
  for(const prefix of ["my","bot"]){
    const b=$(prefix+"GraveyardBtn");
    b.textContent="0";b.title="Кладбище: 0 карт";b.setAttribute("aria-label","Кладбище: 0 карт");
  }
  $("myClassLabel").textContent="—";$("botClassLabel").textContent="—";
  window.MW_ARENA_ART?.render(null);
  window.MW_ARENA_3D?.render(null);
  return;
 }
 const me=game.players[0],bot=game.players[1];
 $("myClassLabel").textContent=me.classId;$("botClassLabel").textContent=bot.classId;
 for(const o of [0,1]){
  const status=eng.heroPowerStatus(game,o);
  const button=$(o===0?"myHeroPower":"botHeroPower");
  button.textContent=(status.ok?"✦ ":"◇ ")+status.name+" · "+status.cost+" маны";
  button.title=status.reason||"Сила героя доступна (не чаще одного раза за ход)";
  button.disabled=o===1||!status.ok||gameRunningAI;
  const abilityImage=window.MW_HERO_ART?.abilityFor(game.players[o].classId)||"";
  button.classList.toggle("mw-hero-art-ability",!!abilityImage);
  if(abilityImage)button.style.setProperty("--mw-ability-image",`url("${abilityImage}")`);
  else button.style.removeProperty("--mw-ability-image");
  const hint=$(o===0?"myHeroAbilityHint":"botHeroAbilityHint");
  hint.textContent=heroPowerDescription(status)+(status.reason?" · "+status.reason:"");
  const chassis=document.querySelector(`[data-hero-owner="${o}"]`);
  chassis.classList.toggle("hero-power-ready",status.ok);
  chassis.classList.toggle("hero-power-used",status.used);
  updateHeroPortrait(o,game.players[o].classId,game.players[o].heroProfile);
  const grave=eng.graveyardSummary(game,o);
  const graveBtn=$(o===0?"myGraveyardBtn":"botGraveyardBtn");
  graveBtn.textContent=String(grave.entries);
  graveBtn.title="Кладбище: "+grave.entries+" карт";
  graveBtn.setAttribute("aria-label","Кладбище: "+grave.entries+" карт");
  graveBtn.disabled=false;
 }
 if(graveOpenOwner!==null)renderGraveyardDialog();
 $("myHero").textContent=me.health+" ♥"+(me.armor?" · "+me.armor+" ◈":"")+
    (me.weapon?" · ⚔ "+me.weapon.attack+"/"+me.weapon.durability:"");
 $("botHero").textContent=bot.health+" ♥"+(bot.armor?" · "+bot.armor+" ◈":"")+
    (bot.weapon?" · ⚔ "+bot.weapon.attack+"/"+bot.weapon.durability:"");
 $("myStats").textContent=me.mana+"/"+me.maxMana+" маны · "+me.deck.length+" в колоде";
 $("botStats").textContent=bot.deck.length+" карт в колоде · "+bot.hand.length+" в руке";
 $("myBoard").innerHTML=me.board.map(m=>battleCard(m,0,"minion")).join("")||
    '<span class="deck-small-muted">На поле нет существ</span>';
 $("botBoard").innerHTML=bot.board.map(m=>battleCard(m,1,"minion")).join("")||
    '<span class="deck-small-muted">На поле нет существ</span>';
 $("myHand").innerHTML=me.hand.map(h=>battleCard(h,0,"hand")).join("")||
    '<span class="deck-small-muted">Рука пуста</span>';
 $("botHand").innerHTML=Array(bot.hand.length).fill("<span></span>").join("");
 $("myBoard").classList.toggle("board-empty",me.board.length===0);
 $("botBoard").classList.toggle("board-empty",bot.board.length===0);
 $("battleEndTurn").disabled=game.phase!=="battle"||game.turn!==0||gameRunningAI;
 $("battleCancelTarget").hidden=!pending;
 $("battleTurnInfo").textContent=game.phase==="ended"
   ?game.winner==="draw"?"Оба героя погибли":game.winner===0?"Победа игрока!":"Победа бота."
   :game.phase==="mulligan"?"Начальная замена":
     game.turn===0?"Ваш ход":"Ход бота";
 $("battleActionHint").textContent=pending?.kind==="hero-power"?
      "ФАКЕЛ: выберите своё существо «Чалавек» (Esc — отмена).":
    pending?.kind==="spell"?"Выберите обязательную цель для карты (Esc — отмена).":
     pending?.kind==="attack"?"Выберите цель атаки (учитывается Правакацыя).":
      "Выберите карту или готовое существо. Не реализованные способности отмечены; оружие героя — нажмите на свой портрет.";
 renderEventJournal();
 for(const o of [0,1]){
   const ch=document.querySelector(`[data-hero-owner="${o}"]`);
   ch.classList.remove("battle-valid-target","battle-invalid-target");
   const cl=targetClass(o,"hero");
   if(cl)ch.classList.add(cl.trim());
 }
 updateCombatVisualEffects();
 window.MW_ARENA_ART?.render(game);
 window.MW_ARENA_3D?.render(game);
 window.MW_BATTLE_CARD_RENDERER?.hydrate(game,$("battleWorkspace"));
 window.MW14_HAND_UI?.live?.render(game,{busy:gameRunningAI,pendingChoice:!!pendingChoice,pending:!!pending});
 window.MW_HERO_HUD_V0511?.render2D(game);
 refreshDeveloperControls();
 updateReplayUI();
 persistBattleSession();
}
/* v2.1J — actual card faces during the initial hand replacement.
   The underlying mulligan selection remains strictly UID-based and unchanged. */
function selectMulligan(){
 if(!game)return;
 $("battleMulligan").hidden=false;
 const me=game.players[0];
 $("mulliganCards").innerHTML=me.hand.map(h=>{
  const coin=h.cardId==="__coin__",c=game.cards[h.cardId];
  const chosen=mulliganSelection.has(h.uid);
  const title=coin?"Монетка":c?.name||h.cardId;
  return `<button type="button" data-mulligan="${esc(h.uid)}" data-mulligan-card="${esc(h.cardId)}"
    class="mulligan-card ${chosen?"replace":""}" aria-label="${esc(title)} — ${coin?"нельзя заменить":chosen?"заменить":"оставить"}"
    aria-pressed="${chosen}" ${coin?"disabled":""}>
    <span class="mulligan-face">
      <img alt="${esc(title)}" hidden draggable="false">
      <span class="mulligan-fallback">
       <span>${coin?"🪙":"✦"}</span><span>${esc(title)}</span>
      </span>
    </span>
    <span class="mulligan-choice">${coin?"Монетку не заменяем":chosen?"✓ Будет заменена":"Оставить карту"}</span>
   </button>`;
 }).join("");
 const renderer=window.MW_BATTLE_CARD_RENDERER;
 if(!renderer?.request)return;
 for(const h of me.hand){
  if(h.cardId==="__coin__")continue;
  const c=game.cards[h.cardId];if(!c)continue;
  const cost=eng.currentCost(game,0,h);
  renderer.request(c,"full",{cost}).then(url=>{
   if(!url)return;
   const button=[...$("mulliganCards").querySelectorAll("[data-mulligan]")].find(x=>x.dataset.mulligan===h.uid);
   if(!button||button.dataset.mulliganCard!==h.cardId)return;
   const img=button.querySelector(".mulligan-face img");
   if(img){img.src=url;img.hidden=false;}
  }).catch(()=>{/* visible card-name fallback remains */});
 }
}
function startBattle(){
 const previous=readBattleSnapshot();
 if(((game&&game.phase!=="ended")||(!game&&previous))&&
    !window.confirm("Начать новую партию? Предыдущее состояние сохранится в резервном слоте. Для надёжности используйте «Бой JSON»."))return;
 const a=decks.get($("battleMyDeck").value),b=decks.get($("battleBotDeck").value);
 const source=battleCatalog();
 if(!a||!b||!dm.validateDeck(a,source).ok||!dm.validateDeck(b,source).ok){message("Выберите две допустимые колоды.");return;}
 if(previous)try{localStorage.setItem(BATTLE_PREVIOUS_KEY,JSON.stringify(previous));}catch(_){}
 try{game=eng.makeGame(clone(a),clone(b),source,{
   timeMode:$("battleTimeMode").value,
   heroProfiles:[$("battleHeroProfile").value,$("battleBotHeroProfile").value]
  });
    loadedReplay=null;
    pending=null;pendingChoice=null;choiceDraft={};graveOpenOwner=null;lastBattleVisual=null;closeCardInspect();
     $("battleGraveyardDialog").hidden=true;
     $("battleChoiceDialog").hidden=true;mulliganSelection=new Set();gameRunningAI=false;
    $("battleMulligan").hidden=false;selectMulligan();renderGame();}
 catch(e){console.error(e);message("Не удалось начать бой: "+e.message);}
}
function confirmMulligan(){
 if(!game)return;
 const result=eng.confirmMulligan(game,[...mulliganSelection]);
 if(!result.ok){message(result.reason);return;}
 $("battleMulligan").hidden=true;mulliganSelection.clear();renderGame();maybeBot();
}

function openChoice(uid,spec){
 pending=null;
 pendingChoice={uid,cardId:spec.cardId};
 choiceDraft=Object.fromEntries(spec.steps.map(step=>
   [step.key,step.locked?step.options.map(x=>x.id):[]]));
 renderGame();renderChoiceDialog();
}
function closeChoice(){
 pendingChoice=null;choiceDraft={};
 $("battleChoiceDialog").hidden=true;
 renderGame();
}
function renderChoiceDialog(){
 const modal=$("battleChoiceDialog"),panel=$("battleChoiceSections");
 if(!pendingChoice||!game){modal.hidden=true;return;}
 const status=eng.actionStatus(game,0,pendingChoice.uid),spec=status.choice;
 if(!status.ok||!spec){message(status.reason||"Доступность выбора изменилась.");closeChoice();return;}
 $("battleChoiceTitle").textContent="Выбор для карты «"+spec.title+"»";
 panel.innerHTML=spec.steps.map(step=>{
  const active=choiceDraft[step.key]||[];
  return `<section class="choice-section"><h3>${esc(step.title)}</h3>
     <div class="choice-count">Выбрано ${active.length} из ${step.max}${step.min!==step.max
       ?` · минимум ${step.min}`:""}</div>
     <div class="choice-options">${step.options.map(opt=>
      `<button type="button" class="choice-option ${active.includes(opt.id)?"picked":""}"
       data-choice-step="${esc(step.key)}" data-choice-option="${esc(opt.id)}"
       aria-pressed="${active.includes(opt.id)}" ${step.locked?"disabled":""}><span class="choice-cost">${esc(opt.cost)}</span>
       <span class="choice-content"><strong>${esc(opt.name)}</strong>
       <small>${esc(opt.cardId)} · ${esc(opt.detail)}</small></span>
       <span class="choice-mark">${active.includes(opt.id)?"✓":"＋"}</span></button>`).join("")}</div>
   </section>`;
 }).join("");
 $("battleChoiceConfirm").disabled=spec.steps.some(st=>{
  const chosen=choiceDraft[st.key]||[];return chosen.length<st.min||chosen.length>st.max;
 })||!eng.validateChoices(game,0,game.cards[pendingChoice.cardId],choiceDraft).ok;
 modal.hidden=false;
}
function toggleChoice(stepKey,id){
 if(!pendingChoice||!game)return;
 const status=eng.actionStatus(game,0,pendingChoice.uid),spec=status.choice,
       step=spec?.steps.find(x=>x.key===stepKey),option=step?.options.find(x=>x.id===id);
 if(!step||!option||step.locked)return;
 const current=choiceDraft[stepKey]||[];
 if(current.includes(id))choiceDraft[stepKey]=current.filter(x=>x!==id);
 else{
  if(step.distinctCardIds){
   const existing=current.map(x=>step.options.find(o=>o.id===x)?.cardId);
   if(existing.includes(option.cardId)){message("Для этой карты нужны разные названия, не копии одной.");return;}
  }
  choiceDraft[stepKey]=step.max===1?[id]:current.length<step.max?[...current,id]:[...current.slice(1),id];
 }
 renderChoiceDialog();
}
function confirmChoice(){
 if(!pendingChoice||!game)return;
 const result=eng.playCard(game,0,pendingChoice.uid,null,choiceDraft);
 if(!result.ok){
  message(result.reason);
  renderChoiceDialog();
  return;
 }
 pendingChoice=null;choiceDraft={};
 $("battleChoiceDialog").hidden=true;
 renderGame();
}

function onHandClick(uid){
 if(!game||game.phase!=="battle"||game.turn!==0||gameRunningAI)return;
 const status=eng.actionStatus(game,0,uid);
 if(!status.ok){message(status.reason);return;}
 if(status.choice){openChoice(uid,status.choice);return;}
 if(status.targetType){pending={kind:"spell",owner:0,uid};renderGame();return;}
 const result=eng.playCard(game,0,uid);
 pending=null;if(!result.ok)message(result.reason);renderGame();
}
function onMinionClick(owner,uid){
 if(!game||game.phase!=="battle"||game.turn!==0||gameRunningAI)return;
 if(pending){
  const target={kind:"minion",owner,uid};
  const result=pending.kind==="spell"?eng.playCard(game,0,pending.uid,target):
       pending.kind==="hero-power"?eng.useHeroPower(game,0,target):
       eng.attack(game,0,pending.uid,target,pending.hero);
  if(result.ok)pending=null;else message(result.reason);
  renderGame();return;
 }
 if(owner===0){
  const m=game.players[0].board.find(x=>x.uid===uid);
  if(!m)return;
  if(!m.ready||m.attacked){message("Существо пока не готово атаковать.");return;}
  pending={kind:"attack",owner:0,uid,hero:false};renderGame();
 }else message("Сначала выберите атакующее существо или карту заклинания.");
}
function onHeroClick(owner){
 if(!game||game.phase!=="battle"||game.turn!==0||gameRunningAI)return;
 if(pending){
  const target={kind:"hero",owner};
  const result=pending.kind==="spell"?eng.playCard(game,0,pending.uid,target):
    pending.kind==="hero-power"?{ok:false,reason:"ФАКЕЛ требует выбрать дружелюбное существо «Чалавек»."}:
    eng.attack(game,0,pending.uid,target,pending.hero);
  if(result.ok)pending=null;else message(result.reason);
  renderGame();return;
 }
 if(owner===0){
  if(!game.players[0].weapon){message("Герой может атаковать при наличии оружия.");return;}
  pending={kind:"attack",owner:0,uid:null,hero:true};renderGame();
 }
}
function activateHeroPower(){
 if(!game||game.phase!=="battle"||game.turn!==0||gameRunningAI)return;
 if(pendingChoice){message("Сначала закончите выбор карты.");return;}
 const status=eng.heroPowerStatus(game,0);
 if(!status.ok){message(status.reason);renderGame();return;}
 if(status.targeted){
  pending={kind:"hero-power",owner:0};
  renderGame();
  return;
 }
 const outcome=eng.useHeroPower(game,0);
 if(!outcome.ok)message(outcome.reason);
 pending=null;renderGame();
}
function openGraveyard(owner){
 if(!game)return;
 graveOpenOwner=owner;$("battleGraveyardDialog").hidden=false;
 renderGraveyardDialog();
}
function closeGraveyard(){
 graveOpenOwner=null;$("battleGraveyardDialog").hidden=true;
}
function renderGraveyardDialog(){
 if(!game||graveOpenOwner===null)return;
 const o=graveOpenOwner,summary=eng.graveyardView(game,o);
 $("graveTitle").textContent="Кладбище · "+(o===0?"Игрок":"Бот")+" · "+summary.available.length+" записей";
 document.querySelectorAll("[data-grave-owner]").forEach(b=>b.classList.toggle("active",Number(b.dataset.graveOwner)===o));
 const entries=summary.available.map(g=>`<div class="grave-entry">
   <div><b>${esc(g.name||g.cardId)}</b> <small>${esc(g.cardId)}</small></div>
   <div class="grave-meta">Погиб: ход ${g.turn} · ${String(g.hour).padStart(2,"0")}:00
   ${g.token?" · токен (оживление не утверждено)":""}</div>
 </div>`).join("")||'<p class="grave-muted">Погибших существ пока нет.</p>';
 const history=summary.history.slice().reverse().map(h=>`<div class="grave-event">
   <span>${h.action==="death"?"†":"↗"}</span>
   <span>${esc(h.name||h.cardId)} · ${h.action==="death"?"гибель":"удалена запись"}
   · ход ${h.turn}${h.source?" · "+esc(h.source):""}</span>
 </div>`).join("")||'<p class="grave-muted">Истории пока нет.</p>';
 const ledger=summary.corpseLedger.slice().reverse().map(c=>`<div class="grave-event">
   <span>${c.amount>=0?"+":""}${c.amount}</span>
   <span>${esc(c.source)} · итог ${c.balance} · ход ${c.turn}</span>
 </div>`).join("")||'<p class="grave-muted">Начислений и расходов трупов пока нет.</p>';
 $("battleGraveyardBody").innerHTML=`
  <div class="grave-resource-line"><span>Трупы как отдельный ресурс</span>
  <strong>${summary.corpses}</strong></div>
  <div class="grave-warning">Смерть существа создаёт запись на личном кладбище,
  но не выдаёт автоматически трупы: порядок начисления для всех смертей ещё не утверждён.</div>
  <h3>Доступные записи (${summary.available.length})</h3>
  <div class="grave-entries">${entries}</div>
  <details><summary>История кладбища (${summary.history.length})</summary>${history}</details>
  <details><summary>Журнал трупов (${summary.corpseLedger.length})</summary>${ledger}</details>`;
}
function finishTurn(){
 if(!game||game.phase!=="battle"||game.turn!==0)return;
 if(pendingChoice){closeChoice();return;}
 pending=null;const result=eng.endTurn(game,0);
 if(!result.ok)message(result.reason);
 renderGame();maybeBot();
}
function maybeBot(){
 if(!game||game.phase!=="battle"||game.turn!==1||gameRunningAI)return;
 gameRunningAI=true;const snapshot=game;renderGame();
 setTimeout(()=>{
  if(game!==snapshot){gameRunningAI=false;return;}
  try{if(game?.phase==="battle"&&game.turn===1)eng.runBotTurn(game);}
  catch(e){console.error(e);message("Ошибка бота: "+e.message);}
  finally{gameRunningAI=false;renderGame();}
 },380);
}
async function handleHeroPortraitFile(file){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))return message("Выберите PNG, JPEG или WEBP.");
 if(file.size>12*1024*1024)return message("Портрет больше 12 МБ. Используйте уменьшенное изображение.");
 try{
   const url=URL.createObjectURL(file);
   const img=new Image();
   try{
     await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
     const canvas=document.createElement("canvas"),w=img.naturalWidth,h=img.naturalHeight;
     const ratio=Math.min(1,480/Math.max(w,h));
     canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));
     canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
     const data=canvas.toDataURL("image/jpeg",.87);
     const o=heroPortraitOwner??0,cls=game?.players[o].classId||"unknown";
     const key=heroPortraitKey(o,cls);
     heroPortraitMemory.set(key,data);
     let persisted=true;
     try{localStorage.setItem(key,data);}catch(_){persisted=false;}
     if(game)updateHeroPortrait(o,cls,game.players[o].heroProfile);
     window.MW_ARENA_3D?.invalidateHeroes?.();
     message(persisted?"Портрет сохранён локально для героя "+cls+".":"Портрет применён только до закрытия: браузер не разрешает локальное сохранение.");
   }finally{URL.revokeObjectURL(url);}
 }catch(err){console.error("Portrait import",err);message("Не удалось сохранить портрет. Доступ к локальному хранилищу ограничен.");}
}
/* 2.1B: боковые панели по умолчанию закрыты и не перекрывают игровую зону.
 * Независимо от видимости все прежние узлы журнала и тестов остаются в DOM. */
function setSideOpen(open){
 const panel=$("battleSidePanel"),button=$("battleSideToggle");
 panel.hidden=!open;
 panel.setAttribute("aria-hidden",String(!open));
 button.setAttribute("aria-expanded",String(open));
 button.textContent=open?"✕ Закрыть журнал":"☰ Журнал и тесты";
}
function readBattleDropTarget(node,source){
 if(!(node instanceof Element))return null;
 const card=node.closest("[data-battle-minion]");
 const hero=node.closest("[data-hero-owner]");
 const board=node.closest("#myBoard,#botBoard");
 if(source?.kind==="hand" && board){
   const h=game?.players?.[0]?.hand?.find(x=>x.uid===source.uid);
   const action=h?eng.actionStatus(game,0,source.uid):null;
   // Обычная карта кладётся на свою сторону даже поверх уже лежащего существа.
   if(!action?.targetType)return {kind:"board",owner:board.id==="myBoard"?0:1,node:board};
 }
 if(card){
   const [owner,...uid]=card.dataset.battleMinion.split("|");
   return {kind:"minion",owner:Number(owner),uid:uid.join("|"),node:card};
 }
 if(hero)return {kind:"hero",owner:Number(hero.dataset.heroOwner),node:hero};
 if(board)return {kind:"board",owner:board.id==="myBoard"?0:1,node:board};
 return null;
}
function clearBattleDropDecoration(finished=true){
 const area=$("battleWorkspace");
 area.querySelectorAll(".drag-over,.drag-invalid")
   .forEach(n=>n.classList.remove("drag-over","drag-invalid"));
 if(finished){
   area.querySelectorAll(".battle-dragging,.mw14-legal-drop")
     .forEach(n=>n.classList.remove("battle-dragging","mw14-legal-drop"));
   area.classList.remove("mw14-drag-active");
 }
}
function highlightBattleDropTargets(source){
 const area=$("battleWorkspace"),rule=window.MW_BATTLE_DRAG_RULES;
 if(!source||!rule||!game)return;
 const h=source.kind==="hand"?game.players[0].hand.find(x=>x.uid===source.uid):null;
 const action=h?eng.actionStatus(game,0,source.uid):null;
 const selectors=source.kind==="hand"&&!action?.targetType?"#myBoard":
   "#myBoard,#botBoard,[data-battle-minion],[data-hero-owner]";
 area.querySelectorAll(selectors).forEach(node=>{
   const target=readBattleDropTarget(node,source);
   if(target&&rule.plan(game,source,target,eng).ok)node.classList.add("mw14-legal-drop");
 });
}
function processBattleDrop(source,target){
 const plan=window.MW_BATTLE_DRAG_RULES?.plan(game,source,target,eng) || {ok:false,reason:"Модуль переноса не загрузился."};
 if(!plan.ok){message(plan.reason);return false;}
 if(plan.mode==="choose"){const action=eng.actionStatus(game,0,plan.uid);openChoice(plan.uid,action.choice);return true;}
 if(plan.mode==="await-target"){
   pending={kind:"spell",owner:0,uid:plan.uid};renderGame();
   message("Карта выбрана. Нажмите на подсвеченную допустимую цель.");
   return true;
 }
 let result;
 if(plan.mode==="play")result=eng.playCard(game,0,plan.uid);
 else if(plan.mode==="spell-target")result=eng.playCard(game,0,plan.uid,plan.target);
 else if(plan.mode==="attack")result=eng.attack(game,0,plan.uid,plan.target,false);
 if(!result?.ok){message(result?.reason||"Действие не удалось.");renderGame();return false;}
 pending=null;renderGame();return true;
}
function wireBattleDragAndDrop(){
 const area=$("battleWorkspace");
 area.addEventListener("dragstart",e=>{
   const card=e.target.closest?.(".battle-card[draggable=true]");
   if(!card||!game||game.turn!==0||game.phase!=="battle"||gameRunningAI||pendingChoice)return;
   if(card.hasAttribute("data-battle-hand")&&!eng.actionStatus(game,0,card.dataset.battleHand).ok){
     e.preventDefault();return;
   }
   if(card.hasAttribute("data-battle-hand"))
     battleDragSession={kind:"hand",uid:card.dataset.battleHand};
   else if(card.hasAttribute("data-battle-minion")){
     const [owner,...uid]=card.dataset.battleMinion.split("|");
     if(Number(owner)!==0)return;
     battleDragSession={kind:"minion",uid:uid.join("|")};
   }else return;
   if(e.dataTransfer){
     e.dataTransfer.effectAllowed="move";
     e.dataTransfer.setData("application/x-mw-battle",JSON.stringify(battleDragSession));
     e.dataTransfer.setData("text/plain","MYTHICAL_WARS_BATTLE_DRAG");
   }
   card.classList.add("battle-dragging");
   area.classList.add("mw14-drag-active");
   window.MW14_HAND_UI?.live?.dragStarted(card,e.dataTransfer);
   highlightBattleDropTargets(battleDragSession);
 });
 area.addEventListener("dragover",e=>{
   if(!battleDragSession||!game)return;
   clearBattleDropDecoration(false);
   const target=readBattleDropTarget(e.target,battleDragSession);
   if(!target)return;
   const plan=window.MW_BATTLE_DRAG_RULES.plan(game,battleDragSession,target,eng);
   e.preventDefault();
   if(e.dataTransfer)e.dataTransfer.dropEffect=plan.ok?"move":"none";
   if(plan.ok)target.node.classList.add("drag-over");
   else target.node.classList.add("drag-invalid");
 });
 area.addEventListener("drop",e=>{
   if(!battleDragSession)return;
   e.preventDefault();e.stopPropagation();
   const source=battleDragSession,target=readBattleDropTarget(e.target,source);
   battleDragSession=null;clearBattleDropDecoration();
   if(!target){message("Перетащите карту на своё поле или на допустимую цель.");return;}
   processBattleDrop(source,target);
 });
 area.addEventListener("dragend",()=>{
   battleDragSession=null;clearBattleDropDecoration();
   window.MW14_HAND_UI?.live?.hide();
 });
}

function wire(){
 $("battleQuickStart").onclick=()=>{
   $("battleSettingsDrawer").open=false;
   $("battleStartBtn").click();
 };
 $("battleQuickResume").onclick=()=>{
   $("battleSettingsDrawer").open=false;
   $("battleResumeBtn").click();
 };
 $("battleSideToggle").onclick=()=>setSideOpen($("battleSidePanel").hidden);
 setSideOpen(false);
 wireBattleDragAndDrop();
 document.querySelectorAll("[data-app-mode]").forEach(btn=>btn.addEventListener("click",()=>setMode(btn.dataset.appMode)));
 $("deckList").addEventListener("click",e=>{const t=e.target.closest("[data-deck-id]");if(t)chooseDeck(t.dataset.deckId);});
 $("deckNewBtn").onclick=createDeck;$("deckCloneBtn").onclick=cloneDeck;$("deckDeleteBtn").onclick=deleteDeck;
 $("deckSaveBtn").onclick=async()=>{if(currentDeck()){await persist(currentDeck());message("Колода сохранена локально.");}};
 $("deckPlayBtn").onclick=()=>{setMode("battle");$("battleMyDeck").value=activeId;renderBattleDeckOptions();};
 $("collectionCards").addEventListener("click",e=>{const add=e.target.closest("[data-add]");if(add)addCard(add.dataset.add);});
 $("collectionCards").addEventListener("dragstart",e=>{
   const card=e.target.closest("[data-drag-card-id]");
   if(!card)return;
   e.dataTransfer.setData("text/x-mythical-card-id",card.dataset.dragCardId);
   e.dataTransfer.setData("text/plain",card.dataset.dragCardId);
   e.dataTransfer.effectAllowed="copy";
 });
 $("deckContents").addEventListener("dragover",e=>{
   if(!e.dataTransfer.types.includes("text/plain")&&!e.dataTransfer.types.includes("text/x-mythical-card-id"))return;
   e.preventDefault();e.dataTransfer.dropEffect="copy";e.currentTarget.classList.add("drag-over");
 });
 $("deckContents").addEventListener("dragleave",e=>e.currentTarget.classList.remove("drag-over"));
 $("deckContents").addEventListener("drop",e=>{
   e.preventDefault();e.currentTarget.classList.remove("drag-over");
   const id=e.dataTransfer.getData("text/x-mythical-card-id")||e.dataTransfer.getData("text/plain");
   if(catalog.has(id))addCard(id);
 });
 $("deckContents").addEventListener("click",e=>{
  const add=e.target.closest("[data-inc]"),dec=e.target.closest("[data-dec]");
  if(add)addCard(add.dataset.inc);else if(dec)removeCard(dec.dataset.dec);
 });
 $("deckName").addEventListener("change",()=>mutateDeck(d=>{d.name=$("deckName").value.trim().slice(0,100)||"Без названия";}));
 $("deckClass").addEventListener("change",()=>mutateDeck(d=>{d.classId=$("deckClass").value;}));
 $("collectionSearch").addEventListener("input",e=>{filterText=e.target.value;renderCollection();});
 $("collectionType").addEventListener("change",e=>{filterType=e.target.value;renderCollection();});
 $("collectionCost").addEventListener("change",e=>{filterCost=e.target.value;renderCollection();});
 $("collectionEligibleOnly").addEventListener("change",e=>{onlyEligible=e.target.checked;renderCollection();});
 $("deckAuditBtn").onclick=runLibraryAudit;
 $("deckAuditExportBtn").onclick=()=>{
   if(lastAuditReport)downloadText(lastAuditReport,"MW_card_deck_audit_v2.1A.txt");
 };
 $("deckExportBtn").onclick=exportDecks;
 $("deckImportBtn").onclick=()=>$("deckImportFile").click();
 $("deckImportFile").onchange=async e=>{await importDecks(e.target.files[0]);e.target.value="";};
 $("battleUseLocal").onchange=renderBattleDeckOptions;
 $("battleStartBtn").onclick=startBattle;
 $("battleSaveBtn").onclick=()=>{if(persistBattleSession())message("Бой сохранён локально.");else message("Сохранение недоступно: скачайте «Бой JSON».");};
 function resumeBattle(previous=false){
  const snapshot=readBattleSnapshot(previous);
  if(!snapshot)return message("Локального сохранения нет.");
  if(game&&game.phase!=="ended"&&!window.confirm("Заменить текущую партию сохранённой?"))return;
  loadBattleSave(snapshot);
 }
 $("battleResumeBtn").onclick=()=>resumeBattle();
 $("battleResumePrevious").onclick=()=>resumeBattle(true);
 $("battleExportSaveBtn").onclick=exportBattleSave;
 $("battleReplayExportBtn").onclick=exportBattleReplay;
 $("battleReplayVerifyBtn").onclick=checkBattleReplay;
 $("battleReplayImportBtn").onclick=()=>$("battleReplayImportFile").click();
 $("battleReplayImportFile").onchange=async e=>{
   const file=e.target.files?.[0];e.target.value="";
   if(!file)return;
   if(file.size>12*1024*1024)return message("Файл повтора превышает 12 МБ.");
   try{
     const R=window.MW_BATTLE_REPLAY;
     const trace=R.loadReplay(await file.text());
     const check=R.verify(trace);
     if(!check.ok)throw new Error("Повтор недостоверен: "+check.reason);
     loadedReplay=trace;
     $("battleReplayPanel").open=true;
     $("battleReplayStep").value=String(trace.actions.length);
     updateReplayUI();
     $("battleReplayInfo").textContent=`Загружен и проверен повтор: ${trace.actions.length} действий. Используйте ползунок для просмотра.`;
   }catch(e){message("Ошибка импорта повтора: "+e.message);}
 };
 $("battleReplayInspectBtn").onclick=inspectReplayStep;
 $("battleLabRunBtn").onclick=runLaboratory;
 $("battleLabExportBtn").onclick=()=>{
   if(labLastSummary)downloadText(window.MW_BATTLE_LAB.toCSV(labLastSummary),"MW_full_matches_v2.1A.csv");
 };
 $("battleImportSaveBtn").onclick=()=>$("battleImportSaveFile").click();
 $("battleImportSaveFile").onchange=async e=>{
  const file=e.target.files?.[0];e.target.value="";
  if(!file)return;
  if(file.size>12*1024*1024)return message("Сохранение превышает 12 МБ.");
  try{loadBattleSave(await file.text());}
  catch(err){message("Не удалось прочитать файл боя: "+err.message);}
 };
 for(const id of ["battleLogKind","battleLogOwner","battleLogSearch"])
  $(id).addEventListener(id==="battleLogSearch"?"input":"change",renderEventJournal);
 $("battleExportLogBtn").onclick=exportBattleJournal;
 $("battleDevToggle").onchange=e=>{
  if(!game)return;
  eng.setDeveloperMode(game,e.target.checked);renderGame();
 };
 $("battleDevAction").onchange=refreshDeveloperControls;
 $("battleDevOwner").onchange=refreshDeveloperControls;
 $("battleDevApply").onclick=runDeveloperCommand;
 $("mulliganConfirm").onclick=confirmMulligan;
 $("mulliganCards").addEventListener("click",e=>{
  const c=e.target.closest("[data-mulligan]");if(!c)return;
  const uid=c.dataset.mulligan;
  if(mulliganSelection.has(uid))mulliganSelection.delete(uid);else mulliganSelection.add(uid);
  selectMulligan();
 });
 $("myHand").addEventListener("click",e=>{const c=e.target.closest("[data-battle-hand]");if(c)onHandClick(c.dataset.battleHand);});
 for(const id of ["myBoard","botBoard"]){
  $(id).addEventListener("click",e=>{
   const c=e.target.closest("[data-battle-minion]");if(!c)return;
   const [owner,uid]=c.dataset.battleMinion.split("|");onMinionClick(Number(owner),uid);
  });
 }
 $("myHero").style.cursor="pointer";$("botHero").style.cursor="pointer";
 $("myHero").onclick=()=>onHeroClick(0);$("botHero").onclick=()=>onHeroClick(1);
 $("myHeroPower").onclick=activateHeroPower;
 $("myGraveyardBtn").onclick=()=>openGraveyard(0);
 $("botGraveyardBtn").onclick=()=>openGraveyard(1);
 $("graveCloseBtn").onclick=closeGraveyard;
 document.querySelectorAll("[data-grave-owner]").forEach(b=>b.onclick=()=>openGraveyard(Number(b.dataset.graveOwner)));
 $("battleChoiceSections").addEventListener("click",e=>{
   const t=e.target.closest("[data-choice-option]");
   if(t)toggleChoice(t.dataset.choiceStep,t.dataset.choiceOption);
 });
 $("battleChoiceConfirm").onclick=confirmChoice;
 $("battleChoiceCancel").onclick=closeChoice;
 $("battleChoiceCancelBottom").onclick=closeChoice;
 $("battleEndTurn").onclick=finishTurn;
 $("battleCancelTarget").onclick=()=>{pending=null;renderGame();};
 document.addEventListener("keydown",e=>{
  if(currentMode==="battle"&&e.key==="Escape"){
   if(inspectOpen){e.stopPropagation();closeCardInspect();}
   else if(pendingChoice){e.stopPropagation();closeChoice();}
   else if(graveOpenOwner!==null){e.stopPropagation();closeGraveyard();}
   else if($("battleSettingsDrawer").open){$("battleSettingsDrawer").open=false;}
   else if(!$("battleSidePanel").hidden){setSideOpen(false);}
   else{pending=null;renderGame();}
 }
 },true);
 // Zoom/fit settings affect only battle UI, not original card art or exported PNG.
 $("battleCardScale").onchange=e=>{
   visualScale=Number(e.target.value)||1.15;applyBattleVisualSettings();
   try{localStorage.setItem("mw-card-zoom-v1.9",String(visualScale));}catch(_){}
 };
 $("battleArtFit").onchange=e=>{
   artFit=e.target.value==="cover"?"cover":"contain";applyBattleVisualSettings();
   try{localStorage.setItem("mw-art-fit-v1.9",artFit);}catch(_){}
 };
 // Preview clicks run in capture before card-click handlers, so preview never plays a card.
 $("battleWorkspace").addEventListener("click",e=>{
   const button=e.target.closest("[data-preview-card]");
   if(!button)return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   const [owner,kind,...uid]=button.dataset.previewCard.split("|");
   openCardInspect(Number(owner),kind,uid.join("|"));
 },true);
 for(const [o,id] of [[0,"myHeroPortrait"],[1,"botHeroPortrait"]]){
   $(id).onclick=()=>onHeroClick(o);
   $(o===0?"myHeroUpload":"botHeroUpload").onclick=()=>{
     heroPortraitOwner=o;$("battleHeroPortraitFile").click();
   };
 }
 $("battleHeroPortraitFile").onchange=async e=>{
   await handleHeroPortraitFile(e.target.files?.[0]);e.target.value="";
 };
 $("battleInspectClose").onclick=closeCardInspect;
 $("battleCardInspect").addEventListener("click",e=>{
   if(e.target===$("battleCardInspect"))closeCardInspect();
 });
 $("battleWorkspace").addEventListener("keydown",e=>{
   const card=e.target.closest(".battle-card[role=button]");
   if(card&&(e.key==="Enter"||e.key===" ")){
     e.preventDefault();
     if(e.target.closest("[data-preview-card]"))e.target.click();else card.click();
   }
 });
  window.addEventListener("mw-card-library-updated",()=>{refreshCatalog();if(currentMode==="decks")renderDeck();});
}
async function init(){
 wire();
 try{
  deckDB=await openDB();
  const saved=await getAllDB();
  for(const d of saved)decks.set(d.deckId,d);
  storageMode="indexedDB";
 }catch(e){
  console.warn("deck IndexedDB",e);
  try{
   const saved=JSON.parse(localStorage.getItem("mw-decks-v1")||"[]");
   if(Array.isArray(saved))for(const d of saved)if(d&&d.deckId)decks.set(d.deckId,d);
   storageMode="localStorage";
  }catch(e){storageMode="memory";}
 }
 let seeded=false;
 try{seeded=deckDB?await dbMeta("samples-seeded")===true:localStorage.getItem("mw-decks-seeded")==="1";}catch(e){}
 if(!seeded){
  for(const src of window.MW_APPROVED_EXAMPLE_DECKS){
   if(decks.has(src.id))continue;
   const d={deckId:src.id,name:src.name,classId:src.classId,counts:clone(src.counts),source:src.source,updatedAt:new Date().toISOString()};
   decks.set(d.deckId,d);await persist(d);
  }
  try{if(deckDB)await dbMeta("samples-seeded",true);else localStorage.setItem("mw-decks-seeded","1");}catch(e){}
 }
 activeId=decks.has("sample-warrior")?"sample-warrior":sortedDecks()[0]?.deckId||null;
 $("deckPersistenceNote").textContent=storageMode==="indexedDB"?
   "Колоды сохраняются в IndexedDB. Для переноса на другой компьютер экспортируйте резервную копию.":
   storageMode==="localStorage"?"Колоды сохраняются локально (резервный способ). Регулярно делайте экспорт.":
   "Постоянное хранение недоступно: экспортируйте резервную копию после изменений.";
 refreshCatalog();initDeveloperCardList();applyBattleVisualSettings();renderDeck();renderGame();setMode("decks");
 updateBattleSessionStatus();
 window.MW_DECK_IMPORT_ADAPTER={
   catalog:()=>catalog,
   model:dm,
   notify:message,
   async importNew({name,classId,counts,source}){
     const fresh=dm.newDeck(name||"Импортированная колода",classId);
     fresh.counts=clone(counts);
     fresh.source=source||"Импорт XLSX/CSV";
     const check=dm.validateDeck(fresh,catalog);
     if(!check.ok)throw new Error(check.errors.slice(0,3).join(" "));
     decks.set(fresh.deckId,fresh);activeId=fresh.deckId;
     await persist(fresh);renderDeck();setMode("decks");
     return fresh;
   }
 };
 // v2.1G: explicit, offline CSV exchange. No Google credentials or network access.
 window.MW_DECK_SHEET_BRIDGE={
   snapshot:()=>sortedDecks().map(clone),
   plan:(decksCSV,countsCSV)=>window.MW_CARD_WORKFLOW.planDecksImport(
     decksCSV,countsCSV,sortedDecks(),dm.CLASSES),
   async apply(plan){
     let added=0,updated=0,skipped=0;
     for(const item of plan){
       if(!["new","update"].includes(item.kind)){skipped++;continue;}
       const now=decks.get(item.id),stamp=item.row.updatedAt||"";
       if((item.kind==="new"&&now)||
          (item.kind==="update"&&(!now||now.updatedAt!==stamp))||
          (now&&item.id.startsWith("sample-"))){skipped++;continue;}
       const card=clone(item.deck);
       if(!card||!dm.CLASSES.includes(card.classId)){skipped++;continue;}
       if(item.kind==="new")added++;else updated++;
       await persist(card);
     }
     refreshCatalog();renderDeck();
     message("CSV колод: новых "+added+", обновлено "+updated+", пропущено "+skipped+".");
     return {added,updated,skipped};
   }
 };
 window.dispatchEvent(new Event("mw-deck-import-ready"));
 
  // v2.1H: a second presentation of the SAME game, using existing checked actions.
  // Nothing here changes cards, rules, save formats, bot decisions or randomness.
  window.MW_BATTLE_VIEW_BRIDGE={
    state:()=>game,
    ui:()=>({pending:pending?{...pending}:null,busy:gameRunningAI,mode:currentMode,choice:!!pendingChoice}),
    plan:(source,target)=>gameRunningAI||pendingChoice?
      {ok:false,reason:"Сначала завершите текущее действие."}:
      window.MW_BATTLE_DRAG_RULES.plan(game,source,target,eng),
    dispatch(action){
      if(!game)return {ok:false,reason:"Сначала начните партию."};
      if(gameRunningAI)return {ok:false,reason:"Сейчас ход бота."};
      if(pendingChoice && action.type!=="cancel")return {ok:false,reason:"Сначала завершите выбор карты в открытом окне."};
      const before=game.eventSerial||0;
      const previous=pending?{...pending}:null;
      if(action.type==="drop"){
        const plan=this.plan(action.source,action.target);
        if(!plan.ok)return plan;
        if(!processBattleDrop(action.source,action.target))return {ok:false,reason:"Действие отклонено движком."};
      }else if(action.type==="hand"){
        const status=eng.actionStatus(game,0,action.uid);
        if(!status.ok)return status;
        onHandClick(action.uid);
      }else if(action.type==="minion")onMinionClick(action.owner,action.uid);
      else if(action.type==="hero")onHeroClick(action.owner);
      else if(action.type==="endTurn")finishTurn();
      else if(action.type==="power")activateHeroPower();
      else if(action.type==="cancel"){pending=null;closeChoice();renderGame();}
      else return {ok:false,reason:"Неизвестная команда интерфейса."};
      const events=(game.events||[]).filter(e=>(e.id||0)>before);
      if(events.some(e=>e.kind==="attack")){
        const source=action.type==="drop"?action.source:
          {kind:previous?.hero?"hero":"minion",owner:0,uid:previous?.uid};
        const target=action.type==="drop"?action.target:
          {kind:action.type,owner:action.owner,uid:action.uid};
        window.MW_ARENA_3D?.animateAttack(source,target);
      }
      return {ok:true,changed:(game.eventSerial||0)!==before,pending:pending?{...pending}:null};
    },
    inspect:(owner,kind,uid)=>openCardInspect(owner,kind,uid),
    graveyard:openGraveyard,
    start:()=>{setMode("battle");startBattle();},
    render:renderGame
  };
  window.dispatchEvent(new Event("mw-battle-view-ready"));

 window.MW_DECK_TEST={catalog:()=>[...catalog.values()],decks:()=>sortedDecks().map(clone),validate:id=>dm.validateDeck(decks.get(id),catalog),
  chooseDeck,addCard,removeCard,createDeck,setMode,game:()=>game,startBattle,confirmMulligan,
  selectCard:onHandClick,selectMinion:onMinionClick,endTurn:finishTurn};
}
init().catch(e=>{console.error("Deck module",e);message("Не удалось инициализировать колоды.");});
})();
