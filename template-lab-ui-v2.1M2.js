/* Mythical Wars v2.1M.2 — isolated template designer (drafts only).
   IMPORTANT: no calls to card-library write APIs and no template auto-application. */
(function(){
  "use strict";
  const core=window.MW_TEMPLATE_LAB;
  if(!core)throw new Error("Template Lab core is missing");
  const id=n=>document.getElementById(n);
  const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const localKey="MW_TEMPLATE_DRAFTS_V2_1M2";
  const label={
    frameVariant:"Вариант рамки",accentColor:"Цвет акцента",nameColor:"Цвет названия",
    bodyColor:"Цвет описания",nameSize:"Размер названия",bodySize:"Размер описания",
    nameY:"Положение названия по Y",descriptionY:"Положение текста по Y",
    descriptionHeight:"Высота описания",titleWidth:"Ширина плашки названия"
  };
  const ranges={
    nameSize:[28,80],bodySize:[20,70],nameY:[865,1110],
    descriptionY:[1110,1350],descriptionHeight:[90,310],titleWidth:[480,827]
  };
  let stored=core.create(),draft=core.create(),dirty=false,isOpen=false;
  let type="creature",clazz="Воин",scope="class",sampleId="";
  function load(){
    try{
      const raw=localStorage.getItem(localKey);
      stored=raw?core.deserialize(raw):core.create();
    }catch(err){
      console.warn("Templates cannot read local storage",err);
      stored=core.create();
      // Do not reset existing browser storage when an unreadable version is found.
    }
    draft=core.normalize(stored);dirty=false;
  }
  function persisted(){
    let normalized=core.normalize(draft);
    normalized.updatedAt=new Date().toISOString();
    try{localStorage.setItem(localKey,core.serialize(normalized));}
    catch(err){showNote("Не удалось сохранить в браузер. Экспортируйте JSON. "+err.message,true);return false;}
    stored=normalized;draft=core.normalize(normalized);dirty=false;
    updateMeta();showNote("Шаблоны сохранены. Карты и игровой движок не изменены.");
    return true;
  }
  function showNote(message,error=false){
    const el=id("mwTplNote");if(!el)return;
    el.textContent=message;
    el.classList.toggle("is-error",error);
  }
  function updateMeta(){
    const stats=core.inspect(draft);
    const status=id("mwTplSaveStatus");
    if(status)status.textContent=(dirty?"● Есть несохранённые изменения":"✓ Сохранено")+
      " · "+stats.changedClasses+" классовых вариантов настроены";
    const saveButton=id("mwTplSave");
    if(saveButton)saveButton.disabled=!dirty;
  }
  function sampleCards(){
    const canonical=Array.isArray(window.MW_CANONICAL_CARDS)?window.MW_CANONICAL_CARDS:[];
    return canonical.filter(c=>c.cardType===type&&core.normalizeClass(c.classId)===clazz);
  }
  function sample(){
    const options=sampleCards();
    if(!options.some(c=>c.cardId===sampleId))sampleId=options[0]?.cardId||"";
    return options.find(c=>c.cardId===sampleId)||null;
  }
  function editorFields(){
    const current=core.resolve(draft,type,clazz);
    const o=draft.overrides?.[type]?.[clazz]||{};
    return core.FIELDS.map(field=>{
      const own=Object.prototype.hasOwnProperty.call(o,field);
      const inherited=scope==="class"&&!own;
      const v=current[field];
      const input=field==="frameVariant"
        ?`<select data-tpl-field="${field}">
           <option value="default" ${v==="default"?"selected":""}>Оригинальная</option>
           <option value="alt" ${v==="alt"?"selected":""}>Альтернативная</option>
         </select>`
        :field.endsWith("Color")
          ?`<input type="color" aria-label="${label[field]}" data-tpl-field="${field}" value="${esc(v)}">`
          :`<input type="number" data-tpl-field="${field}" min="${ranges[field][0]}"
             max="${ranges[field][1]}" step="1" value="${esc(v)}">`;
      return `<div class="mw-tpl-field" data-tpl-row="${field}">
        <div class="mw-tpl-field-head"><span>${label[field]}</span>
         ${scope==="class"?`<span data-tpl-badge="${field}" class="${inherited?"mw-tpl-inherited":"mw-tpl-overridden"}">
             ${inherited?"↳ Базовый":"● Свой"}
           </span>`:""}
        </div>
        <div class="mw-tpl-field-controls">${input}
          ${scope==="class"?`<button type="button" data-tpl-unset="${field}" ${inherited?"disabled":""} title="Вернуть значение из базового шаблона">↶</button>`:""}
        </div>
      </div>`;
    }).join("");
  }
  const percent=n=>(100*n/1024).toFixed(3)+"%";
  const yPercent=n=>(100*n/1536).toFixed(3)+"%";
  function pos(x,y,w,h){
    return `left:${percent(x)};top:${yPercent(y)};width:${percent(w)};height:${yPercent(h)};`;
  }
  const safeArt=x=>typeof x==="string"&&(/^(data:image\/(?:png|jpeg|webp|gif);base64,|blob:)/i.test(x)||/^test-art\/[A-Z]{3}-\d{3}\.webp$/.test(x)||/^v05\/[A-Z]{3}-\d{3}\/[A-Z]{3}-\d{3}_art_source\.png$/.test(x))?x:"";
  function cardArt(card){
    const saved=window.MW_CARD_BRIDGE?.getSavedCards?.()||[];
    const match=saved.find(x=>x.cardId===card?.cardId);
    const art=safeArt(match?.project?.assets?.customArtData);
    if(art)return art;
    const builtin=window.MW_TEST_ART_CATALOG?.url?.(card?.cardId)||window.MW_WARLOCK_ART?.get?.(card?.cardId);
    if(safeArt(builtin))return builtin;
    if(card?.cardId==="KNZ-002")return "assets/art_malady_druzhynnik.png";
    return "";
  }
  function previewHTML(){
    const cfg=core.resolve(draft,type,clazz);
    const hole=core.WINDOWS[type],card=sample(),art=cardArt(card);
    const holeCss=pos(hole.x,hole.y,hole.w,hole.h);
    const mask=hole.shape==="oval"?"ellipse(50% 50% at 50% 50%)":
      hole.shape==="circle"?"circle(49% at 50% 50%)":"inset(0 round 4%)";
    const artContent=art?`<img src="${esc(art)}" alt="Пример иллюстрации из карты">`
     :`<div class="mw-tpl-art-empty"><span>✧</span><small>Арт для этой карты ещё не подготовлен</small></div>`;
    const cardName=card?.name||"Название карты";
    const body=card?.ability||"Описание способности подставляется из библиотеки. Шаблон не изменяет его содержимое.";
    const attack=card?.attack,health=card?.health,durability=card?.durability;
    const cost=card?.costValue;
    return `<div class="mw-tpl-preview-card" role="img" aria-label="Предпросмотр ${esc(core.LABELS[type])} — ${esc(clazz)}">
       <div class="mw-tpl-hole" style="${holeCss}clip-path:${mask}">
        ${artContent}
       </div>
       <img class="mw-tpl-base-image" src="${esc(core.assetFor(type,cfg.frameVariant))}" alt="" draggable="false">
       <div class="mw-tpl-accent" style="--tpl-accent:${esc(cfg.accentColor)}"></div>
       <div class="mw-tpl-class-label" style="--tpl-accent:${esc(cfg.accentColor)}">${esc(clazz)}</div>
       <img class="mw-tpl-title-banner" alt="" draggable="false" src="assets/card-bases/title_banner.png"
         style="${pos(Math.round((1024-cfg.titleWidth)/2),cfg.nameY-47,cfg.titleWidth,188)}">
       <div class="mw-tpl-title-text" style="${pos(200,cfg.nameY,624,78)}
         font-size:${(100*cfg.nameSize/1024).toFixed(4)}cqw;color:${cfg.nameColor}">${esc(cardName)}</div>
       <div class="mw-tpl-description-text" style="${pos(160,cfg.descriptionY,704,cfg.descriptionHeight)}
          color:${cfg.bodyColor};font-size:${(100*cfg.bodySize/1024).toFixed(4)}cqw">${esc(body)}</div>
       <div class="mw-tpl-cost" style="--tpl-accent:${cfg.accentColor}">${esc(cost??"–")}</div>
       ${type==="creature" ? `
         <div class="mw-tpl-stat mw-tpl-attack">${esc(attack??"–")}</div>
         <div class="mw-tpl-stat mw-tpl-health">${esc(health??"–")}</div>`:
         type==="weapon"?`
         <div class="mw-tpl-stat mw-tpl-attack">${esc(attack??"–")}</div>
         <div class="mw-tpl-stat mw-tpl-health">${esc(durability??"–")}</div>`:""}
     </div>`;
  }
  function updatePreview(){
    const preview=id("mwTplPreview");
    if(preview)preview.innerHTML=previewHTML();
    const count=id("mwTplExampleInfo");
    const card=sample();
    if(count)count.textContent=card?`Пример: ${card.cardId} · ${card.name} — данные только для просмотра`:
      "Для этой комбинации в каноническом каталоге пока нет карты";
    const overrides=draft.overrides?.[type]?.[clazz]||{};
    for(const field of core.FIELDS){
      const badge=document.querySelector(`[data-tpl-badge="${field}"]`);
      if(badge){
        const own=Object.prototype.hasOwnProperty.call(overrides,field);
        badge.textContent=own?"● Свой":"↳ Базовый";
        badge.className=own?"mw-tpl-overridden":"mw-tpl-inherited";
      }
      const reset=document.querySelector(`[data-tpl-unset="${field}"]`);
      if(reset)reset.disabled=!Object.prototype.hasOwnProperty.call(overrides,field);
    }
    const exampleCount=id("mwTplExampleCount");
    if(exampleCount)exampleCount.textContent=sampleCards().length+" карт в каталоге этого класса и типа";
    updateMeta();
  }
  function selectionHTML(){
    const examples=sampleCards();
    sample();
    return `
      <div class="mw-tpl-selectors">
        <label><span>Тип шаблона</span><select id="mwTplType">
          ${core.TYPES.map(t=>`<option value="${t}" ${type===t?"selected":""}>${core.LABELS[t]}</option>`).join("")}
        </select></label>
        <label><span>Класс</span><select id="mwTplClass">
          ${core.CLASSES.map(c=>`<option value="${esc(c)}" ${clazz===c?"selected":""}>${esc(c)}</option>`).join("")}
        </select></label>
      </div>
      <fieldset class="mw-tpl-scope"><legend>Что редактируем</legend>
        <label><input type="radio" name="mwTplScope" value="class" ${scope==="class"?"checked":""}> Оформление выбранного класса</label>
        <label><input type="radio" name="mwTplScope" value="base" ${scope==="base"?"checked":""}> Общий шаблон типа карты</label>
      </fieldset>
      <p class="mw-tpl-scope-info">${scope==="base"?
        "Общие параметры наследуются всеми классами, если нет индивидуального переопределения.":
        "Изменяются только настройки выбранного класса. Отдельные параметры можно вернуть к базовому шаблону."}</p>`;
  }
  function render(){
    const root=id("mwTemplatesApp");if(!root)return;
    const examples=sampleCards();sample();
    root.innerHTML=`
      <header class="mw-tpl-header">
        <div>
          <span class="mw-tpl-kicker">ЭТАП 2 · ТОЛЬКО ЧЕРНОВИКИ</span>
          <h1>Шаблоны карт</h1>
          <p>Три базовых типа, четыре класса и наследование настроек оформления. Арт, текст и характеристики берутся только из конкретной карты.</p>
        </div>
        <button type="button" id="mwTplBack" class="mw-tpl-back">← К колодам и игре</button>
      </header>
      <div class="mw-tpl-warning" role="note"><strong>Без массового применения.</strong>
        Изменения здесь сохраняются отдельно. Существующие карты, их PNG, игровые правила,
        2D/3D и пользовательские проекты не меняются.</div>
      <div class="mw-tpl-layout">
        <section class="mw-tpl-editor-panel">
          ${selectionHTML()}
          <div class="mw-tpl-panel-heading"><strong>Параметры оформления</strong>
            <button type="button" id="mwTplResetClass" ${scope!=="class"?"disabled":""}
              title="Удалить только изменения выбранного класса">Сбросить класс</button>
          </div>
          <div class="mw-tpl-controls">${editorFields()}</div>
          <div class="mw-tpl-actions">
            <button id="mwTplSave" type="button" class="mw-tpl-primary">Сохранить шаблоны</button>
            <button id="mwTplDiscard" type="button">Отменить несохранённое</button>
            <button id="mwTplExport" type="button">Экспорт JSON</button>
            <button id="mwTplImport" type="button">Импорт JSON</button>
            <input id="mwTplUpload" type="file" accept=".json,application/json" hidden>
          </div>
          <div id="mwTplSaveStatus" class="mw-tpl-save-status"></div>
          <div id="mwTplNote" class="mw-tpl-note" role="status" aria-live="polite"></div>
        </section>
        <section class="mw-tpl-preview-panel">
          <div class="mw-tpl-panel-heading">
            <strong>Предпросмотр</strong>
            <span id="mwTplExampleCount"></span>
          </div>
          <label class="mw-tpl-example-select">Пример из библиотеки
            <select id="mwTplExample">${examples.map(c=>
              `<option value="${esc(c.cardId)}" ${sampleId===c.cardId?"selected":""}>${esc(c.cardId)} · ${esc(c.name)}</option>`
            ).join("")||'<option value="">Нет карт</option>'}</select>
          </label>
          <div class="mw-tpl-preview-holder" id="mwTplPreview"></div>
          <p id="mwTplExampleInfo" class="mw-tpl-example-info"></p>
          <div class="mw-tpl-legend">
            <strong>Схема: базовый тип → оформление класса → данные карты</strong>
            <p>Овальное окно для существ, прямоугольное для заклинаний, круглое для оружия.
            Индивидуальные арты и игровые характеристики не включены в JSON шаблонов.</p>
          </div>
        </section>
      </div>`;
    id("mwTplBack").onclick=()=>document.querySelector('[data-app-mode="decks"]')?.click();
    id("mwTplType").onchange=e=>{type=e.target.value;sampleId="";render();};
    id("mwTplClass").onchange=e=>{clazz=e.target.value;sampleId="";render();};
    document.querySelectorAll('input[name="mwTplScope"]').forEach(el=>
      el.onchange=e=>{if(e.target.checked){scope=e.target.value;render();}});
    id("mwTplExample").onchange=e=>{sampleId=e.target.value;updatePreview();};
    document.querySelectorAll("[data-tpl-field]").forEach(el=>{
      el.onchange=e=>{
        const field=e.target.dataset.tplField, v=e.target.type==="number"?Number(e.target.value):e.target.value;
        try{
          draft=scope==="base"?core.setBase(draft,type,field,v):core.setClass(draft,type,clazz,field,v);
          dirty=true;updatePreview();showNote("");
        }catch(err){showNote(err.message,true);e.target.value=core.resolve(draft,type,clazz)[field];}
      };
    });
    document.querySelectorAll("[data-tpl-unset]").forEach(el=>
      el.onclick=e=>{
        draft=core.resetClassField(draft,type,clazz,e.target.dataset.tplUnset);
        dirty=true;render();showNote("Параметр снова наследуется от базового шаблона.");
      });
    id("mwTplResetClass").onclick=()=>{
      if(!confirm("Сбросить индивидуальное оформление класса «"+clazz+"» для типа «"+
          core.LABELS[type]+"»? Остальные шаблоны не изменятся."))return;
      draft=core.resetClass(draft,type,clazz);
      dirty=true;render();showNote("Настройки класса сброшены к базовым. Сохраните изменения.");
    };
    id("mwTplSave").onclick=persisted;
    id("mwTplDiscard").onclick=()=>{
      if(dirty&&!confirm("Отменить все несохранённые изменения шаблонов?"))return;
      draft=core.normalize(stored);dirty=false;render();showNote("Возвращено последнее сохранённое состояние.");
    };
    id("mwTplExport").onclick=()=>{
      const obj=core.normalize(stored);
      const payload=core.serialize(obj);
      const blob=new Blob([payload],{type:"application/json;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download="MW_Templates_v2.1M.2.json";
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),500);
      showNote(dirty?"Экспортирована последняя сохранённая версия. Сохраните текущие изменения отдельно.":"Сохранённые шаблоны экспортированы.");
    };
    id("mwTplImport").onclick=()=>id("mwTplUpload").click();
    id("mwTplUpload").onchange=async e=>{
      const file=e.target.files?.[0];e.target.value="";
      if(!file)return;
      if(file.size>200000){showNote("Файл слишком большой для шаблонов",true);return;}
      try{
        const restored=core.deserialize(await file.text());
        if(!confirm("Загрузить шаблоны из файла как несохранённый черновик? Сохранённые настройки останутся до нажатия «Сохранить»."))return;
        draft=restored;dirty=true;render();showNote("Импорт загружен в предпросмотр. Проверьте и нажмите «Сохранить шаблоны».");
      }catch(err){showNote("Ошибка импорта: "+err.message,true);}
    };
    updatePreview();
  }
  function open(){
    isOpen=true;
    for(const key of ["editorWorkspace","decksWorkspace","battleWorkspace","mwCollectionWorkspace"]){
      const node=id(key);if(node)node.hidden=true;
    }
    id("mwTemplatesWorkspace").hidden=false;
    document.body.dataset.mode="templates";
    document.querySelectorAll(".app-mode-nav button").forEach(el=>el.classList.remove("active"));
    id("mwTemplatesNav").classList.add("active");
    render();
  }
  function close(){
    isOpen=false;
    const node=id("mwTemplatesWorkspace");if(node)node.hidden=true;
    id("mwTemplatesNav")?.classList.remove("active");
  }
  function install(){
    load();
    if(!id("mwTemplatesNav"))return;
    id("mwTemplatesNav").addEventListener("click",open);
    document.querySelectorAll('.app-mode-nav [data-app-mode],#mwCollectionNav').forEach(btn=>
      btn.addEventListener("click",close));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);
  else install();
  window.MW_TEMPLATE_LAB_UI={open,close,render,isOpen:()=>isOpen,
    getDraft:()=>core.normalize(draft),getSaved:()=>core.normalize(stored),
    select:(t,c,s)=>{type=t;clazz=c;scope=s||"class";render();},
    previewHTML};
})();
