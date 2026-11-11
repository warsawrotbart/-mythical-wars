/* Mythical Wars v05 — dynamic art/text compositor, isolated from battle engine. */
(function(){
"use strict";
const manifest=window.MW_V05_MANIFEST, core=window.MW_V05_CORE, samples=window.MW_V05_CONTROL_SAMPLES;
const $=id=>document.getElementById(id);
if(!manifest||!core||!samples){$("status").textContent="Ошибка: нет манифеста v05";return}
const state={card:null,art:null,artSource:"",artBlob:null,artLabel:"",sampleIndex:null,origin:"sample",
  crop:{x:.48,y:.4,zoom:1},epoch:0,selectionEpoch:0,renderIssues:[],loading:false,
  profiles:new Map(),profileReady:false};
const artStore=window.MW_V05_ART_STORE;
const tplCore=window.MW_V05_TEMPLATE_CORE;
const polish=window.MW_V05_CARD_POLISH;
const templateEditor=window.MW_V05_TEMPLATE_EDITOR?.create({manifest,requestPaint:()=>paint()});
if(!tplCore||!templateEditor||!polish){$("status").textContent="Не загружен редактор оформления v05.13.1";return}

const builtinTestArt=id=>window.MW_TEST_ART_CATALOG?.url(id)||"";
const selectedBuiltinArt=()=>builtinTestArt(state.card?.id);
function updateBuiltinArtUI(){
  if(!state.card)return;
  const builtin=selectedBuiltinArt();
  const preview=$("builtinArtPreview");
  if(builtin){
    preview.src=builtin;preview.hidden=false;
    $("builtinArtMeta").textContent=state.card.id+" · встроен в сборку · тестовый, не утверждён";
  }else{
    preview.hidden=true;preview.removeAttribute("src");
    $("builtinArtMeta").textContent="Для "+state.card.id+" встроенного арта нет. Не подставляем чужое изображение.";
  }
  $("restoreBuiltinArt").disabled=!builtin||(!state.artBlob && state.artSource===builtin);
  if(state.artBlob){
    $("sampleStatus").textContent="Пользовательский арт: "+(state.artLabel||"локальный файл");
  }else if(builtin){
    $("sampleStatus").textContent="Тестовый арт по ID · "+state.card.id+" · встроен в сборку"+
      (state.origin==="library-staged"?" · предпросмотр импорта":"");
  }else{
    $("sampleStatus").textContent="Для этой карты нет тестового арта во встроенной библиотеке. Загрузите изображение вручную.";
  }
}
const profileTimers=new Map();
const loaded=new Map(), tinted=new Map();
const tags={Creature:"Существо",Weapon:"Оружие",Spell:"Заклинание"};
function note(text,bad=false){
  const el=$("status");el.textContent=text;el.classList.toggle("bad",bad)
}
function imgLoad(src){
  if(!loaded.has(src)){
    loaded.set(src,new Promise((resolve,reject)=>{
      const img=new Image();img.decoding="async";
      img.onload=()=>{if(!img.naturalWidth||!img.naturalHeight)reject(Error("Повреждённое изображение "+src));else resolve(img)};
      img.onerror=()=>reject(Error("Не удалось загрузить "+src));img.src=src;
    }));
  }
  return loaded.get(src)
}
function asset(key){
  const entry=manifest.assets[key];
  if(!entry)throw Error("Элемент "+key+" отсутствует в манифесте v05");
  return imgLoad("v05/"+entry.path);
}
function mask(name){return imgLoad("v05/runtime/"+name+"_alpha.png")}
function contain(ctx,img,slot){
  const [x,y,w,h]=slot,s=Math.min(w/img.width,h/img.height);
  const dw=img.width*s,dh=img.height*s;
  ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)
}
function paletteKey(){
  return $("palettePreview").value || state.card.class_key
}
function colored(img,key,palette){
  const ck=key+"@"+palette;
  if(tinted.has(ck))return tinted.get(ck);
  const c=document.createElement("canvas");
  c.width=img.width;c.height=img.height;
  const z=c.getContext("2d");z.drawImage(img,0,0);
  z.globalCompositeOperation="source-in";
  const rgb=manifest.class_palettes[palette][1];
  z.fillStyle=`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;z.fillRect(0,0,c.width,c.height);
  z.globalCompositeOperation="source-over";tinted.set(ck,c);return c;
}
function renderNumber(ctx,value,bind){
  if(value==null)return;
  const [x,y]=bind.center;
  const s=String(value),px=s.length>1?bind.two_digit_font_px:bind.font_px;
  ctx.save();ctx.textAlign="center";ctx.textBaseline="alphabetic";
  ctx.font=`bold ${px}px "DejaVu Serif", Georgia, serif`;
  const metrics=ctx.measureText(s);
  // Centre the rendered glyph ink, not the font-dependent middle baseline.
  const ascent=metrics.actualBoundingBoxAscent||px*.72;
  const descent=metrics.actualBoundingBoxDescent||px*.09;
  const baseline=y+(ascent-descent)/2;
  ctx.fillStyle=manifest.text_rules.numbers.fill;
  ctx.strokeStyle=manifest.text_rules.numbers.outline;
  ctx.lineWidth=manifest.text_rules.numbers.outline_px*2;ctx.lineJoin="round";
  ctx.strokeText(s,x,baseline);ctx.fillText(s,x,baseline);
  ctx.restore()
}
function renderText(ctx,textModel,only=null){
  const card=state.card;
  ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";
  if(!only||only==="title"){
    ctx.fillStyle="#ffdf9c";ctx.strokeStyle="#351920";ctx.lineWidth=3.5;ctx.lineJoin="round";
    ctx.font=`bold ${textModel.title.px}px "DejaVu Serif", Georgia, serif`;
    polish.drawCurvedTitle(ctx,card.name||"",manifest.text_anchors.title,
      manifest.text_regions.title[2]-manifest.text_regions.title[0]);
  }
  if(!only||only==="description"){
    ctx.fillStyle="#2b2119";const body=textModel.description;
    const pos=manifest.text_anchors.description_center_by_type[card.type];
    ctx.font=`${body.px}px "DejaVu Serif", Georgia, serif`;
    const step=body.px*1.18,top=pos[1]-(body.lines.length-1)*step/2;
    body.lines.forEach((t,i)=>ctx.fillText(t,pos[0],top+i*step));
  }
  if((!only||only==="flavor")&&textModel.flavor){
    ctx.fillStyle="#2b2119";const f=textModel.flavor;
    ctx.font=`italic ${f.px}px "DejaVu Serif", Georgia, serif`;
    const fy=manifest.text_anchors.flavor_first_line_center[1];
    f.lines.forEach((t,i)=>ctx.fillText(t,manifest.text_anchors.flavor_first_line_center[0],
      fy+i*manifest.text_anchors.flavor_line_step));
  }
  ctx.restore();
  for(const b of manifest.number_bindings){
    if((!only||only==="number:"+b.field)&&b.types.includes(card.type)){
      const v=core.maybe(card[b.field]);
      if(Number.isSafeInteger(v)&&v>=0)renderNumber(ctx,v,b)
    }
  }
}

function formatIssues(issues){
  $("warnings").replaceChildren();
  if(!issues.length){
    const p=document.createElement("p");p.className="issue-good";p.textContent="Ошибок данных, переполнения и отсутствующих элементов не найдено.";
    $("warnings").append(p);return
  }
  for(const i of issues){
    const li=document.createElement("div");li.className="issue "+(i.severity==="error"?"issue-error":"issue-warning");
    li.textContent=(i.severity==="error"?"✕ ":"! ")+i.message;
    $("warnings").append(li)
  }
}
async function paint(){
  if(!state.card)return;
  const current=++state.epoch;
  state.loading=true;$("exportBtn").disabled=true;
  note("Сборка карты v05.15…");
  const canvas=$("cardCanvas");const ctx=canvas.getContext("2d",{willReadFrequently:false});
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  try{
    const plan=core.drawPlan(state.card,manifest).filter(part=>!polish.skipLayer(part,state.card.type));
    const layers=templateEditor.compose(plan,state.card);
    const palette=paletteKey();
    if(!manifest.class_palettes[palette])throw Error("Класс не найден в палитрах v05");
    const required=plan.filter(t=>t.kind==="asset").map(t=>asset(t.key));
    required.push(mask(manifest.templates[state.card.type].art_mask));
    if(state.artSource)required.push(imgLoad(state.artSource));
    required.push(...layers.filter(x=>x.kind==='custom'&&x.transform.visible).map(x=>imgLoad(x.src)));
    await Promise.all(required);
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    if(current!==state.epoch)return;
    const model=core.analyzeText(state.card,manifest,ctx);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(const layer of layers){
      if(!layer.transform.visible)continue;
      ctx.save();
      try{
        tplCore.applyCanvasTransform(ctx,layer);
        if(layer.kind==='asset'||layer.kind==='component'){
          for(const part of layer.parts){
            const pic=await asset(part.key);
            const visible=part.tint?colored(pic,part.key,palette):pic;
            if(part.fullCanvas){
              const lift=polish.liftTop(part,state.card.type);
              if(lift)ctx.drawImage(visible,0,lift,canvas.width,canvas.height);
              else ctx.drawImage(visible,0,0);
            }else contain(ctx,visible,part.slot);
          }
        }else if(layer.kind==='art'&&state.artSource){
          const part=layer.parts[0];const img=await imgLoad(state.artSource);
          const tmp=document.createElement("canvas");tmp.width=canvas.width;tmp.height=canvas.height;
          const z=tmp.getContext("2d");z.imageSmoothingEnabled=true;z.imageSmoothingQuality="high";
          const loc=core.imagePlacement(img.width,img.height,part.viewport,state.crop);
          z.drawImage(img,loc.dx,loc.dy,loc.dw,loc.dh);
          z.globalCompositeOperation="destination-in";z.drawImage(await mask(part.mask),0,0);
          z.globalCompositeOperation="source-over";ctx.drawImage(tmp,0,0);
        }else if(layer.kind==='text'){
          renderText(ctx,model,layer.subtype);
        }else if(layer.kind==='number'){
          renderText(ctx,model,'number:'+layer.field);
        }else if(layer.kind==='custom'){
          const pic=await imgLoad(layer.src);
          ctx.drawImage(pic,layer.box.x,layer.box.y,layer.box.w,layer.box.h);
        }
      }finally{ctx.restore()}

    }
    if(state.card.type==="Creature"){
      ctx.save();ctx.globalAlpha=.25;ctx.globalCompositeOperation="screen";
      ctx.drawImage(await asset("Common_Outer_Gold_Trim"),0,0);ctx.restore();
    }
    if(current!==state.epoch)return;
    const issues=core.validateCard(state.card,manifest,{hasArt:!!state.artSource})
      .concat(model.issues,templateEditor.validation());
    state.renderIssues=issues;formatIssues(issues);
    const blockers=issues.filter(i=>i.severity==="error");
    $("exportBtn").disabled=blockers.length>0;
    $("sizeBadge").textContent=`1024 × 1536 · ${layers.length} управляемых слоёв`;
    note(blockers.length?`Предпросмотр готов · блокирующих ошибок: ${blockers.length}`:
      "Предпросмотр готов · PNG можно экспортировать",blockers.length>0);
    templateEditor.drawOverlay();
  }catch(e){
    if(current!==state.epoch)return;
    state.renderIssues=[{severity:"error",code:"render",message:e.message}];
    formatIssues(state.renderIssues);$("exportBtn").disabled=true;
    note("Сборка остановлена: "+e.message,true);
  }finally{if(current===state.epoch)state.loading=false}
}
function debouncePaint(){
  clearTimeout(debouncePaint.handle);
  debouncePaint.handle=setTimeout(paint,55)
}
function showData(){
  const c=state.card;
  const fields=[
    ["ID",c.id],["Название",c.name],["Тип",tags[c.type]||c.type],
    ["Класс",manifest.class_palettes[c.class_key]?.[0]||String(c.class||c.class_key)],
    ["Редкость",c.rarity||c.rarity_key],["Мана / ресурс",`${c.cost==null?"—":c.cost} · ${c.resource||"—"}`],
    ["Атака",c.attack],["Здоровье",c.health],["Прочность",c.durability],["Броня",c.armor],
    ["Подтип",c.subtype],["Тип существа",c.race],["Условие",c.time],["Описание",c.description],
    ["Литературный текст",c.flavor_text],
    ["Механики",c.keywords],["Школа",c.school],["Форма",c.spellForm],
    ["Макс. копий",c.maxCopies],["Статус библиотеки",c.status],
    ["Примечания",c.notes],["Статус арта",c.art_status||"тестовый вариант"]
  ];
  const box=$("facts");box.replaceChildren();
  for(const [k,v] of fields){
    const row=document.createElement("div");row.className="fact";
    const label=document.createElement("strong");label.textContent=k;
    const value=document.createElement("span");value.textContent=core.maybe(v)==null?"—":String(v);
    row.append(label,value);box.append(row)
  }
}
function updateCropUI(){
  $("cropX").value=Math.round(state.crop.x*100);
  $("cropY").value=Math.round(state.crop.y*100);
  $("cropZoom").value=Math.round(state.crop.zoom*100);
  $("cropXValue").textContent=$("cropX").value+"%";
  $("cropYValue").textContent=$("cropY").value+"%";
  $("cropZoomValue").textContent=state.crop.zoom.toFixed(2)+"×"
}
function storeProfile(immediate=false,edited=false){
  if(!state.card||!state.card.id)return;
  if(!state.profileReady&&!edited)return; // do not overwrite IndexedDB before async restore
  state.profileReady=true;
  const id=state.card.id;
  const snapshot={id,crop:{...state.crop},blob:state.artBlob||null,fileName:state.artLabel||""};
  state.profiles.set(id,{...snapshot,artSource:state.artSource});
  if(!artStore)return;
  if(profileTimers.has(id))clearTimeout(profileTimers.get(id));
  const save=()=>{
    profileTimers.delete(id);
    artStore.write(snapshot).catch(err=>{
      // Browser-local IndexedDB is optional; the in-memory profile is kept.
      $("sampleStatus").title="Автосохранение арта в IndexedDB недоступно: "+err.message;
    });
  };
  if(immediate)save();else profileTimers.set(id,setTimeout(save,350));
}
function setCard(card,sampleIndex,options={}){
  if(!card||!core.TYPES.includes(card.type))throw Error("Неверный тип карты");
  storeProfile(true);
  state.card=core.copyData(card);
  state.sampleIndex=sampleIndex;
  state.origin=options.fromLibrary?(options.staged?"library-staged":"library"):sampleIndex==null?"json":"sample";
  const token=++state.selectionEpoch;
  const tpl=manifest.templates[card.type];
  const cached=state.profiles.get(card.id);
  state.crop=cached?{...cached.crop}:{x:tpl.art_crop_center[0],y:tpl.art_crop_center[1],zoom:1};
  state.profileReady=!!cached||!artStore;
  state.artBlob=cached?.blob||null;state.artLabel=cached?.fileName||"";
  const bundledArt=builtinTestArt(card.id)||(sampleIndex==null?"":`v05/${card.id}/${card.id}_art_source.png`);
  state.artSource=cached?.artSource||bundledArt;
  $("artUpload").value="";
  $("selectedId").textContent=card.id||"Карта";
  $("selectedName").textContent=card.name||"Без названия";
  updateBuiltinArtUI();
  const pal=$("palettePreview");pal.value=manifest.class_palettes[card.class_key]?card.class_key:"Warrior";
  $("paletteNotice").textContent="Перекраска только для предпросмотра; данные карты не меняются.";
  $("referenceWrap").hidden=sampleIndex==null;
  if(sampleIndex!=null)$("referenceImg").src=`v05/${card.id}/${card.id}_card_v05.png`;
  templateEditor.onCard(card);
  showData();updateCropUI();paint();
  if(!cached&&artStore){
    artStore.read(card.id).then(saved=>{
      if(state.selectionEpoch!==token||state.card?.id!==card.id)return;
      if(state.profileReady&&state.profiles.has(card.id))return; // user edited while loading
      state.profileReady=true;
      if(!saved)return;
      const source=saved.blob?URL.createObjectURL(saved.blob):state.artSource;
      state.crop=saved.crop?{...saved.crop}:state.crop;
      state.artBlob=saved.blob||null;state.artLabel=saved.fileName||"";
      state.artSource=source;
      state.profiles.set(card.id,{...saved,artSource:source});
      updateBuiltinArtUI();
      updateCropUI();paint();
    }).catch(()=>{if(state.selectionEpoch===token)state.profileReady=true});
  }
}
function initCards(){
  const list=$("sampleCards");
  samples.forEach((card,index)=>{
    const b=document.createElement("button");b.className="sample-card";b.type="button";
    const thumb=document.createElement("img");thumb.src=`v05/${card.id}/${card.id}_card_256px.png`;thumb.alt="";
    const copy=document.createElement("span");
    const id=document.createElement("strong");id.textContent=card.id;
    const nm=document.createElement("small");nm.textContent=tags[card.type]+" · "+card.name;
    copy.append(id,nm);b.append(thumb,copy);
    b.addEventListener("click",()=>{
      list.querySelectorAll("button").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");setCard(card,index)
    });
    list.append(b)
  });
}
function readFile(file,as){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(Error("Не удалось прочитать файл"));
    if(as==="text")reader.readAsText(file,"utf-8");else reader.readAsDataURL(file)
  })
}
$("jsonUpload").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>512*1024)throw Error("Лимит JSON — 512 КБ");
    const card=JSON.parse(await readFile(file,"text"));
    if(!card||Array.isArray(card)||!core.TYPES.includes(card.type))throw Error("Нужен JSON одной карты с type Creature/Weapon/Spell");
    $("sampleCards").querySelectorAll("button").forEach(x=>x.classList.remove("active"));
    setCard(card,null)
  }catch(e){note("Импорт JSON: "+e.message,true)}
  event.target.value=""
});
$("artUpload").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  const originalSelection=state.selectionEpoch;
  try{
    if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Нужен PNG, JPEG или WebP");
    if(file.size>25*1024*1024)throw Error("Арт больше 25 МиБ");
    const url=URL.createObjectURL(file);
    let img;
    try{img=await imgLoad(url)}catch(error){URL.revokeObjectURL(url);throw error}
    if(img.width>8192||img.height>8192){URL.revokeObjectURL(url);throw Error("Слишком большое изображение (8192 пикселей максимум)")}
    if(state.selectionEpoch!==originalSelection){URL.revokeObjectURL(url);return}
    state.artSource=url;state.artBlob=file;state.artLabel=file.name;
    updateBuiltinArtUI();
    storeProfile(true,true);paint()
  }catch(e){note("Загрузка арта: "+e.message,true)}
});
$("restoreBuiltinArt").addEventListener("click",()=>{
  const builtin=selectedBuiltinArt();
  if(!state.card||!builtin)return;
  const prior=state.artSource;
  state.artSource=builtin;state.artBlob=null;state.artLabel="";
  $("artUpload").value="";
  // Explicitly replace the per-ID local profile, so IndexedDB cannot
  // reload the old custom art on the next page load.
  storeProfile(true,true);
  updateBuiltinArtUI();paint();
  if(prior?.startsWith("blob:")&&prior!==builtin){loaded.delete(prior);URL.revokeObjectURL(prior)}
});
for(const [id,field,scale] of [["cropX","x",.01],["cropY","y",.01],["cropZoom","zoom",.01]]){
  $(id).addEventListener("input",()=>{
    state.crop[field]=Number($(id).value)*scale;updateCropUI();storeProfile(false,true);debouncePaint()
  })
}
$("resetCrop").addEventListener("click",()=>{
  const t=manifest.templates[state.card.type];
  state.crop={x:t.art_crop_center[0],y:t.art_crop_center[1],zoom:1};
  updateCropUI();storeProfile(false,true);paint()
});
$("palettePreview").addEventListener("change",paint);
$("exportBtn").addEventListener("click",()=>{
  if(state.loading||state.renderIssues.some(i=>i.severity==="error"))return;
  const canvas=$("cardCanvas");
  try{
    canvas.toBlob(blob=>{
      if(!blob){note("Экспорт не удался. Запусти локальный сервер из папки игры.",true);return}
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;
      a.download=(state.card.id||"MW-Card")+"_v05-dynamic.png";
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
      note("Экспорт PNG 1024 × 1536 готов. Игровая библиотека не изменена.")
    },"image/png")
  }catch(e){note("Экспорт ограничен браузером: "+e.message+" — открой через локальный сервер.",true)}
});
window.MW_V05_EDITOR_API={
  openLibraryRecord(card,opts={}){setCard(card,null,{fromLibrary:true,staged:!!opts.staged})},
  currentCardId(){return state.card?.id||null},
  updateOpenedLibraryCard(card){
    if(!state.origin.startsWith("library")||state.card?.id!==card?.id)return false;
    setCard(card,null,{fromLibrary:true});return true;
  }
};
initCards();
const select=$("palettePreview");
Object.entries(manifest.class_palettes).forEach(([key,value])=>{
  const opt=document.createElement("option");opt.value=key;opt.textContent=value[0];select.append(opt)
});
$("sampleCards").querySelector("button").click();
})();