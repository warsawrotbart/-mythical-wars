/* Mythical Wars v2.1M.1 — read-only collection, no template edits. */
(function(){
 "use strict";
 const core=window.MW_COLLECTION_CORE;
 const id=x=>document.getElementById(x);
 if(!core)throw new Error("MW_COLLECTION_CORE must be loaded first");
 const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
   .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
 const safeImg=s=>typeof s==="string" && (/^(data:image\/(?:png|webp|jpeg|gif);base64,|blob:)/i.test(s)||/^test-art\/[A-Z]{3}-\d{3}\.webp$/.test(s)||/^v05\/[A-Z]{3}-\d{3}\/[A-Z]{3}-\d{3}_art_source\.png$/.test(s))?s:"";
 const filters={query:"",classId:"all",type:"all",art:"all",frame:"all",scope:"all"};
 let isOpen=false;
 let rows=[];
 function saved(){
   try{return window.MW_CARD_BRIDGE?.getSavedCards?.()||[];}
   catch(err){console.warn("Collection: could not read local cards",err);return[];}
 }
 function cards(){
   return Array.isArray(window.MW_CANONICAL_CARDS)?window.MW_CANONICAL_CARDS:[];
 }
 function currentData(){
   const builtin={has:id=>!!window.MW_TEST_ART_CATALOG?.has(id)||!!window.MW_WARLOCK_ART?.has(id),
     get:id=>window.MW_TEST_ART_CATALOG?.url(id)||window.MW_WARLOCK_ART?.get(id)||"",
     preview:id=>window.MW_TEST_ART_CATALOG?.preview(id)||window.MW_WARLOCK_ART?.preview(id)||""};
   return {canonical:cards(),saved:saved(),builtin};
 }
 function build(){
   const input=currentData();
   rows=core.build(input.canonical,input.saved,input.builtin);
   return rows;
 }
 const kind={creature:"Существо",spell:"Заклинание",weapon:"Оружие"};
 const artLabel={missing:"Арт отсутствует",test:"Тестовый арт",approved:"Арт утверждён"};
 const frameLabel={base:"Типовая рамка · не утверждена",test:"Рамка на проверке",approved:"Рамка утверждена"};
 function picture(row,savedMap){
   const item=savedMap.get(row.id);
   const art=safeImg(item?.project?.assets?.customArtData);
   if(art)return art;
   if(row.hasBuiltinArt){
     const builtin=window.MW_TEST_ART_CATALOG;
     return safeImg(builtin?.preview?.(row.id)||window.MW_WARLOCK_ART?.preview?.(row.id)||window.MW_WARLOCK_ART?.get?.(row.id));
   }
   return "";
 }
 function classes(){
   const names=new Set(rows.map(x=>String(x.card.classId||"Нейтральные")));
   const preferred=["Воин","Чернокнижник","Некромант","Нейтральные"];
   return [...names].sort((a,b)=>{
     const ai=preferred.indexOf(a),bi=preferred.indexOf(b);
     return (ai<0?100:ai)-(bi<0?100:bi)||a.localeCompare(b,"ru");
   });
 }
 function markupFilters(){
   return `<div class="mw-col-filter-grid">
     <label class="mw-col-search"><span>Поиск</span>
       <input id="mwColSearch" type="search" placeholder="Название или ID карты" autocomplete="off" value="${esc(filters.query)}">
     </label>
     <label><span>Класс</span><select id="mwColClass">
       <option value="all">Все классы</option>
       ${classes().map(x=>`<option value="${esc(x)}" ${filters.classId===x?"selected":""}>${esc(x)}</option>`).join("")}
     </select></label>
     <label><span>Тип</span><select id="mwColType">
       <option value="all">Все типы</option>
       ${Object.entries(kind).map(([k,v])=>`<option value="${k}" ${filters.type===k?"selected":""}>${v}</option>`).join("")}
     </select></label>
     <label><span>Арт</span><select id="mwColArt">
       <option value="all">Любой арт</option>
       ${Object.entries(artLabel).map(([k,v])=>`<option value="${k}" ${filters.art===k?"selected":""}>${v}</option>`).join("")}
     </select></label>
     <label><span>Рамка</span><select id="mwColFrame">
       <option value="all">Любая рамка</option>
       <option value="needs" ${filters.frame==="needs"?"selected":""}>Нужна утверждённая рамка</option>
       <option value="base" ${filters.frame==="base"?"selected":""}>Типовая / не утверждена</option>
       <option value="test" ${filters.frame==="test"?"selected":""}>На проверке</option>
       <option value="approved" ${filters.frame==="approved"?"selected":""}>Утверждена</option>
     </select></label>
     <label><span>Каталог</span><select id="mwColScope">
       <option value="all" ${filters.scope==="all"?"selected":""}>Все карты</option>
       <option value="canonical" ${filters.scope==="canonical"?"selected":""}>162 канонические</option>
       <option value="local" ${filters.scope==="local"?"selected":""}>Новые локальные</option>
     </select></label>
   </div>`;
 }
 function rowCard(row,savedMap,index){
   const c=row.card||{}, art=picture(row,savedMap);
   const rarity=c.rarityId||"";
   return `<article class="mw-col-card" data-card-id="${esc(row.id)}">
     <div class="mw-col-cover">
       ${art?`<img loading="${index<6?"eager":"lazy"}" decoding="async" alt="Арт карты ${esc(c.name||row.id)}" src="${esc(art)}">`:
         `<div class="mw-col-no-art" aria-label="Иллюстрации нет"><span aria-hidden="true">✧</span><small>АРТ НЕ ГОТОВ</small></div>`}
       <span class="mw-col-cover-type">${esc(kind[c.cardType]||c.cardType||"Карта")}</span>
     </div>
     <div class="mw-col-card-info">
       <div class="mw-col-card-id">${esc(row.id)}${row.canonical?"":' · Локальная'}</div>
       <strong title="${esc(c.name||row.id)}">${esc(c.name||row.id)}</strong>
       <div class="mw-col-card-meta">${esc(c.classId||"Нейтральные")}${rarity?" · "+esc(rarity):""}</div>
       <div class="mw-col-flags">
         <span class="mw-col-flag ${row.art==="missing"?"missing":row.art==="approved"?"approved":"test"}">${esc(artLabel[row.art])}</span>
         <span class="mw-col-flag ${row.frame==="approved"?"approved":"frame"}">${esc(frameLabel[row.frame])}</span>
       </div>
       <button class="mw-col-open" type="button" data-mw-col-open="${esc(row.id)}">Открыть в редакторе v05</button>
     </div>
   </article>`;
 }
 function showResults(){
   if(!isOpen)return;
   const visible=core.filter(rows,filters);
   const currentSaved=new Map(saved().map(c=>[c.cardId,c]));
   const grid=id("mwColGrid"),count=id("mwColShown");
   if(count)count.textContent=`Показано ${visible.length} из ${rows.length}`;
   if(grid)grid.innerHTML=visible.map((x,i)=>rowCard(x,currentSaved,i)).join("")||
     `<div class="mw-col-empty-results">По этим фильтрам карт нет. Попробуйте изменить параметры.</div>`;
 }
 function render(){
   build();
   const stats=core.stats(rows);
   const root=id("mwCollectionApp");
   if(!root)return;
   root.innerHTML=`
    <header class="mw-col-header">
      <div>
        <span class="mw-col-kicker">БИБЛИОТЕКА · ЭТАП 1</span>
        <h1>Коллекция карт</h1>
        <p>Весь канонический каталог и новые локальные карты. Здесь можно найти пробелы в артах и оформлении, не меняя боевые данные.</p>
      </div>
      <button type="button" id="mwColBack" class="mw-col-back">← К колодам и игре</button>
    </header>
    <div class="mw-col-stats">
      <div><b>${stats.canonical}</b><span>Канонических карт</span></div>
      <div><b>${stats.artTest}</b><span>Тестовый арт</span></div>
      <div><b>${stats.artMissing}</b><span>Арт не найден</span></div>
      <div><b>${stats.frameNeeds}</b><span>Рамка требует утверждения</span></div>
    </div>
    ${stats.local?`<p class="mw-col-local-note">Кроме каталога: ${stats.local} пользовательских карт с отдельными ID.</p>`:""}
    <div class="mw-col-filters">${markupFilters()}</div>
    <div class="mw-col-count"><span id="mwColShown"></span><span>Сохранённые изменения показываются из локальной библиотеки</span></div>
    <div id="mwColAlert" class="mw-col-alert" role="status" aria-live="polite"></div>
    <div class="mw-col-grid" id="mwColGrid" aria-label="Список карт"></div>
    <footer class="mw-col-foot">
      <b>Как считаются статусы.</b>
      Встроенные 45 CHR-артов относятся к тестовым. Пустой или стандартный фон не считается отдельной иллюстрацией.
      Для всех типов доступны базовые рамки, но окончательное утверждение рамки
      должно быть явно сохранено в метаданных проекта. Поэтому «Требует утверждения»
      не означает, что карта совсем без рамки.
      Коллекция ничего не перезаписывает; при открытии отсутствующей в локальной библиотеке карты создаётся несохранённый черновик.
    </footer>`;
   id("mwColSearch").oninput=event=>{
     const input=event.target;
     filters.query=input.value;
     showResults();
   };
   for(const [field,key] of [["mwColClass","classId"],["mwColType","type"],["mwColArt","art"],
                              ["mwColFrame","frame"],["mwColScope","scope"]]){
      id(field).onchange=event=>{filters[key]=event.target.value;showResults();};
   }
   id("mwColBack").onclick=()=>document.querySelector('[data-app-mode="decks"]')?.click();
   id("mwColGrid").onclick=async event=>{
     const btn=event.target.closest("[data-mw-col-open]");
     if(!btn)return;
     const cardId=btn.dataset.mwColOpen;
     if(!cardId)return;
     btn.disabled=true;
     const alert=id("mwColAlert");
     try{
       // The legacy editor is retired. v05 loads exactly this library ID and its test art.
       window.location.assign("v05-dynamic.html?card="+encodeURIComponent(cardId));
     }catch(err){
       if(alert)alert.textContent=`Не удалось открыть ${cardId}: ${err.message}`;
       console.error("Collection open failed",err);
     }finally{btn.disabled=false;}
   };
   showResults();
 }
 function open(){
   isOpen=true;
   for(const workspace of ["editorWorkspace","decksWorkspace","battleWorkspace"]){
     const node=id(workspace);if(node)node.hidden=true;
   }
   id("mwCollectionWorkspace").hidden=false;
   document.body.dataset.mode="collection";
   document.querySelectorAll(".app-mode-nav button").forEach(x=>x.classList.remove("active"));
   id("mwCollectionNav").classList.add("active");
   render();
   window.scrollTo?.(0,0);
 }
 function close(){
   isOpen=false;
   const node=id("mwCollectionWorkspace");if(node)node.hidden=true;
   id("mwCollectionNav")?.classList.remove("active");
 }
 function install(){
   const button=id("mwCollectionNav");
   if(!button)return;
   button.addEventListener("click",open);
   document.querySelectorAll('.app-mode-nav [data-app-mode]').forEach(btn=>
      btn.addEventListener("click",close));
   window.addEventListener("mw-card-library-updated",()=>{if(isOpen)render();});
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);
 else install();
 window.MW_COLLECTION_TEST={open,close,render,rows:()=>rows,visible:()=>core.filter(rows,filters),
     filters,stats:()=>core.stats(rows)};
})();
