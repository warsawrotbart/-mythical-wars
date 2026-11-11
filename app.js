/* Мифические войны — автономный редактор карт · v1.3
   Без Unity, серверов, сетевых API, сторонних библиотек.
   Модель карты и дерево слоёв независимо сохраняются в проекте JSON.
*/
(() => {
"use strict";
const $ = id => document.getElementById(id);
const deepCopy = obj => JSON.parse(JSON.stringify(obj));
const CW=1024, CH=1536;
const rarityAssets = {common:"rarityCommon",standard:"rarityStandard",rare:"rarityRare",epic:"rarityEpic",legendary:"rarityLegendary"};
let project=deepCopy(window.MW_STARTER);
let selectedId="art";
let activeRightTab="fields";
let activeLeftTab="cards";
let collapsed = new Set();
let zoom=0.52;
let zoomManual=false;
let dragging=null;
let ready=false, loadErrors=[], textWarnings=[], dirty=false, autosaveTimer=null, db=null, saveError=null;
let undoStack=[], redoStack=[];
let sources=window.MW_ASSETS || {};
let imageCache={};
let currentArt=null;
let toastTimer=null;
const ASSET_CATEGORIES={frames:"Рамки",icons:"Иконки",decor:"Декор",art:"Арты",flags:"Флаги"};
const BUILTIN_ASSET_GROUPS={
  frame:"frames",ovalRim:"frames",panel:"frames",titlePlaque:"frames",subtypePlaque:"frames",
  costMedallion:"icons",classMedallion:"icons",classSwords:"icons",dayMedallion:"icons",nightMedallion:"icons",
  humanMedallion:"icons",attackMedallion:"icons",healthMedallion:"icons",
  rarityCommon:"icons",rarityStandard:"icons",rarityRare:"icons",rarityEpic:"icons",rarityLegendary:"icons",
  topLegendary:"decor",flavorDivider:"decor",sideLeft:"decor",sideRight:"decor",bottomLeft:"decor",bottomRight:"decor",
  classCloth:"flags",flagCloth:"flags",flagEmblem:"flags",flagOriginal:"flags",classOriginal:"flags",
  creatureReference:"art",spellBase:"frames",weaponBase:"frames",
  editorBaseCreatureDefault:"frames",editorBaseSpellDefault:"frames",editorBaseWeaponDefault:"frames",
  editorBaseCreatureAlt:"frames",editorBaseSpellAlt:"frames",editorBaseWeaponAlt:"frames",
  editorTitleBanner:"frames"
};
const BUILTIN_LABELS={
  frame:"Рамка",ovalRim:"Овальная оправа",panel:"Пергамент",titlePlaque:"Плашка названия",
  subtypePlaque:"Плашка подтипа",costMedallion:"Стоимость",classMedallion:"Оправа класса",
  classSwords:"Мечи",classCloth:"Полотно класса",dayMedallion:"Дзень",nightMedallion:"Ноч",
  humanMedallion:"Чалавек",attackMedallion:"Атака",healthMedallion:"Здоровье",rarityCommon:"Обычная",
  rarityStandard:"Стандартная",rarityRare:"Редкая",rarityEpic:"Эпическая",rarityLegendary:"Легендарная",
  topLegendary:"Папоротник",flagCloth:"Стяг",flagEmblem:"Герб",flavorDivider:"Разделитель",
  sideLeft:"Левый орнамент",sideRight:"Правый орнамент",bottomLeft:"Нижний левый",
  bottomRight:"Нижний правый",flagOriginal:"Исходный флаг",classOriginal:"Исходный декор",
  creatureReference:"Референс существа",spellBase:"Основа заклинания",weaponBase:"Основа оружия",
  editorBaseCreatureDefault:"Существо · основной фон",editorBaseSpellDefault:"Заклинание · основной фон",
  editorBaseWeaponDefault:"Оружие · основной фон",editorBaseCreatureAlt:"Существо · серый фон",
  editorBaseSpellAlt:"Заклинание · серый фон",editorBaseWeaponAlt:"Оружие · серый фон",
  editorTitleBanner:"Оригинальная плашка названия (пользователь)"
};
let userLibrary=new Map(), assetCategoryFilter="all", assetSearchFilter="", lastAssetRef="";
const CARD_TYPES={creature:"Существа",spell:"Заклинания",weapon:"Оружие"};
let cardLibrary=new Map(), cardFilter="all", cardSearch="", activeLibraryCardId=null, libraryWorkingDirty=false, cardDialogOpen=false;
let selectedCardIds=new Set(), cardsCsvPlan=[], cardBatchBusy=false;
const workflow=()=>window.MW_CARD_WORKFLOW;
const STAGE_NAMES={draft:"Черновик",review:"На проверке",approved:"Утверждена"};
let layerDialogOpen=false, librarySaveFailure=false, shortcutDialogOpen=false, copiedImageLayer=null;


const safeNum=(x, fallback=0) => Number.isFinite(Number(x))?Number(x):fallback;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const escapeHTML=x=>String(x).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const fmt=v => Number.isFinite(v)?Math.round(v*100)/100:0;
const nodeById=id=>{
    let result=null, parent=null, index=-1;
    function search(arr,p){arr.some((n,i)=>{
       if(n.id===id){result=n;parent=p;index=i;return true;}
       if(n.children)search(n.children,n);
       return result!==null;
    });}
    search(project.cardPresentation.layers,null);
    return {node:result,parent,index};
};
const getArtNode=()=>nodeById("art").node;
const getData=()=>project.cardDefinition;
const assetUrl=(key)=>{
    if (key?.startsWith("library:")) return project.assets.embeddedLibrary?.[key.slice(8)]?.dataUrl || userLibrary.get(key.slice(8))?.dataUrl || null;
    if (key?.startsWith("custom:")) return project.assets.customImages?.[key.slice(7)] || null;
    return window.MW_IMAGE_DATA?.[key] || sources[key] || null;
};
function loadImage(url) {
  return new Promise((resolve,reject)=>{
    if(!url){reject(new Error("Путь не задан"));return;}
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Не загружено: "+String(url).slice(0,100)));
    img.src=url;
  });
}
async function ensureImage(key){
    if (imageCache[key])return imageCache[key];
    const url=assetUrl(key);
    try {const im=await loadImage(url); imageCache[key]=im;return im;}
    catch(e){if (!loadErrors.includes(key))loadErrors.push(key); console.error("Asset error",key,e);return null;}
}
async function ensureArt(){
    const hasArt=!!project.assets?.customArtData;
    const builtin=window.MW_WARLOCK_ART?.get(project.cardDefinition?.cardId);
  const url=hasArt?project.assets.customArtData
        :(builtin||(project.assets?.allowDefaultArt===false?null:
          (window.MW_IMAGE_DATA?.defaultArt || project.assets?.defaultArt)));
    if(!url){currentArt=null;return null;}
    const key=hasArt?"custom-art":"default-art";
    if(currentArt?.key===key && currentArt?.src===url) return currentArt.image;
    try {const image=await loadImage(url);currentArt={image,key,src:url};return image;}
    catch(e){if(!loadErrors.includes("art"))loadErrors.push("art");currentArt=null;return null;}
}
async function prepareImages(){
   loadErrors=[];
   const selectedResources=[];
   const collect=(items)=>items.forEach(node=>{
      if(node.kind==="image" && node.assetId)selectedResources.push(node.assetId);
      if(node.children)collect(node.children);
   });
   collect(project.cardPresentation.layers);
   const keys=[...new Set([...Object.keys(sources),...selectedResources])];
   await Promise.all(keys.map(ensureImage));
   await ensureArt();
}
function isVisible(node) {
    if(node.visible===false)return false;
    if(node.id==="slot-7" && !String(getData().subtype||"").trim())return false;
    if(node.id==="slot-13" && getData().rarityId!=="legendary")return false;
    if(node.id==="flavorDivider" && !String(getData().flavor||"").trim())return false;
    return true;
}
function textValue(binding){
   const d=getData();
   if(binding==="subtype") return d.subtype || "";
   if(binding==="ability")return d.ability || "";
   if(binding==="flavor")return d.flavor || "";
   return d[binding] === null || d[binding] === undefined?"":String(d[binding]);
}
function fitLines(ctx,text,width){
   const rows=[];
   const paragraphs=String(text).split(/\r?\n/);
   for(const paragraph of paragraphs){
      if(!paragraph){rows.push("");continue;}
      let line="";
      for(const w of paragraph.split(/\s+/)){
         const next=line?line+" "+w:w;
         if (ctx.measureText(next).width<=width || !line){line=next;continue;}
         rows.push(line);line=w;
      }
      if(line)rows.push(line);
   }
   return rows;
}
/* Unicode-aware title on a circular arc. Same renderer for preview and PNG. */
function renderCurvedText(ctx,l,value,report){
    const letters=Array.from(String(value).replace(/\s+/g," ").trim());
    if(!letters.length)return;
    const radius=clamp(safeNum(l.curveRadius,820),250,2200);
    const maxWidth=Math.max(40,safeNum(l.w,560)-34);
    const maxArc=2*radius*Math.asin(Math.min(.98,maxWidth/(2*radius)));
    const fontName=l.fontFamily||"Georgia, serif";
    const style=l.fontStyle==="italic"?"italic ":"";
    const weight=l.fontWeight==="bold"?"700 ":"400 ";
    let fontSize=clamp(safeNum(l.fontSize,48),6,240);
    const minSize=l.autoFit?clamp(safeNum(l.minFontSize,17),6,fontSize):fontSize;
    let spacing=clamp(safeNum(l.letterSpacing,0),-4,10),sizes=[],advance=0;
    const measure=()=>{
      ctx.font=style+weight+fontSize+"px "+fontName;
      sizes=letters.map(ch=>ctx.measureText(ch).width);
      advance=sizes.reduce((a,b)=>a+b,0)+Math.max(0,letters.length-1)*spacing;
    };
    measure();
    if(l.autoFit){
      while(advance>maxArc&&fontSize>minSize){fontSize=Math.max(minSize,fontSize-1);measure();}
      while(advance>maxArc&&spacing>-3){spacing=Math.max(-3,spacing-.5);measure();}
    }
    const fullSpan=advance/radius;
    const drop=radius*(1-Math.cos(Math.min(1.45,fullSpan/2)));
    const lift=clamp(safeNum(l.curveLift,0),-90,90);
    const baseY=(l.h-drop)/2+lift;
    const safe=advance<=maxArc+0.2 && baseY-fontSize*.7>=0 && baseY+drop+fontSize*.7<=l.h;
    if(!safe&&report)report.push("Название не помещается на плашке. Уменьшите шрифт, радиус/изгиб или сократите название.");
    ctx.save();ctx.beginPath();ctx.rect(0,0,l.w,l.h);ctx.clip();
    ctx.fillStyle=l.color||"#34231a";ctx.textBaseline="middle";ctx.textAlign="center";ctx.lineJoin="round";
    let pos=-advance/2;
    for(let i=0;i<letters.length;i++){
      const midpoint=pos+sizes[i]/2, a=midpoint/radius;
      const x=l.w/2+radius*Math.sin(a), y=baseY+radius*(1-Math.cos(a));
      ctx.save();ctx.translate(x,y);ctx.rotate(a);
      if(l.stroke){ctx.lineWidth=Math.max(1.5,Math.min(fontSize*.07,6));ctx.strokeStyle=l.stroke;ctx.strokeText(letters[i],0,0);}
      ctx.fillText(letters[i],0,0);ctx.restore();
      pos+=sizes[i]+spacing;
    }
    ctx.restore();
}
function renderText(ctx,l,report){
   const value=textValue(l.binding);
   if(!value)return;
   if(l.curveEnabled)return renderCurvedText(ctx,l,value,report);
   // Only opt-in templates shrink overlong headings/body text; legacy layers are unchanged.
   let fontSize=clamp(safeNum(l.fontSize,36),6,240);
   const lineFactor=clamp(safeNum(l.lineHeight,1.15),0.8,2);
   const style=l.fontStyle==="italic"?"italic ":"";
   const weight=l.fontWeight==="bold"?"700 ":"400 ";
   const fontName=l.fontFamily||"Georgia,serif";
   let lh,lines,overflow;
   const minSize=l.autoFit?clamp(safeNum(l.minFontSize,16),6,fontSize):fontSize;
   do{
      ctx.font=style+weight+fontSize+"px "+fontName;
      lh=fontSize*lineFactor;
      lines=fitLines(ctx,value,l.w-12);
      overflow=lines.length*lh>l.h || lines.some(line=>ctx.measureText(line).width>l.w-8);
      if(!overflow || fontSize<=minSize)break;
      fontSize=Math.max(minSize,fontSize-1);
   }while(true);
   ctx.textAlign=l.align||"center";
   ctx.textBaseline="middle";
   ctx.fillStyle=l.color||"#222";
   ctx.lineJoin="round";
   if(overflow&&report)report.push("Переполнение текстового слоя: "+l.name+". Увеличьте область или уменьшите шрифт.");
   const anchorX= l.align==="left"?6:l.align==="right"?l.w-6:l.w/2;
   const startY=(l.h-lines.length*lh)/2+lh/2;
   ctx.beginPath();ctx.rect(0,0,l.w,l.h);ctx.clip();
   lines.forEach((line,i)=>{
      if(l.stroke){ctx.lineWidth=Math.max(2,Math.min(fontSize*.095,9));ctx.strokeStyle=l.stroke;ctx.strokeText(line,anchorX,startY+i*lh);}
      ctx.fillText(line,anchorX,startY+i*lh);
   });
}
function renderArt(ctx,l){
   const image=currentArt?.image;
   ctx.save();
   ctx.beginPath();
   if(l.maskShape==="rectangle"){
      const r=clamp(safeNum(l.maskRadius,0),0,Math.min(l.w,l.h)/2);
      if(ctx.roundRect)ctx.roundRect(0,0,l.w,l.h,r);
      else ctx.rect(0,0,l.w,l.h);
   }else if(l.maskShape==="circle"){
      const radius=Math.max(1,Math.min(l.w,l.h)/2);
      ctx.arc(l.w/2,l.h/2,radius,0,Math.PI*2);
   }else{
      ctx.ellipse(l.w/2,l.h/2,Math.max(1,l.w/2),Math.max(1,l.h/2),0,0,Math.PI*2);
   }
   ctx.clip();
   if(image){
     const factor=Math.max(l.w/image.naturalWidth,l.h/image.naturalHeight)*safeNum(l.zoom,1);
     const iw=image.naturalWidth*factor,ih=image.naturalHeight*factor;
     ctx.drawImage(image,(l.w-iw)/2+safeNum(l.offsetX), (l.h-ih)/2+safeNum(l.offsetY), iw,ih);
   }else{
     ctx.fillStyle="#3d3040";ctx.fillRect(0,0,l.w,l.h);
     ctx.fillStyle="#fff";ctx.font="28px Georgia";ctx.textAlign="center";ctx.fillText("Арт не загружен",l.w/2,l.h/2);
   }
   ctx.restore();
}
/* Nine-slice scaling keeps parchment corners readable when height changes. */
function renderNineSlice(ctx,im,l){
  const n=l.nineSlice||{},iw=im.naturalWidth,ih=im.naturalHeight;
  const left=clamp(safeNum(n.left,65),1,iw/2-1),right=clamp(safeNum(n.right,65),1,iw/2-1);
  const top=clamp(safeNum(n.top,70),1,ih/2-1),bottom=clamp(safeNum(n.bottom,70),1,ih/2-1);
  const sx=[0,left,iw-right,iw],sy=[0,top,ih-bottom,ih];
  const dx=[0,Math.min(left,l.w/2),Math.max(l.w-right,l.w/2),l.w];
  const dy=[0,Math.min(top,l.h/2),Math.max(l.h-bottom,l.h/2),l.h];
  for(let y=0;y<3;y++)for(let x=0;x<3;x++)
    ctx.drawImage(im,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],
      dx[x],dy[y],Math.max(.01,dx[x+1]-dx[x]),Math.max(.01,dy[y+1]-dy[y]));
}
function renderNode(ctx,l,report) {
  if(!isVisible(l))return;
  ctx.save();
  ctx.translate(safeNum(l.x),safeNum(l.y));
  if(l.rotation) {ctx.translate((l.w||0)/2,(l.h||0)/2);ctx.rotate(safeNum(l.rotation)*Math.PI/180);ctx.translate(-(l.w||0)/2,-(l.h||0)/2);}
  ctx.globalAlpha*=clamp(safeNum(l.opacity,1),0,1);
  if(l.kind==="group"){
      (l.children||[]).forEach(child=>renderNode(ctx,child,report));
  }else if(l.kind==="image"){
      const im=imageCache[l.assetId];
      if(im){if(l.nineSlice)renderNineSlice(ctx,im,l);else ctx.drawImage(im,0,0,l.w,l.h);}
      else if(report) report.push("Не найден графический ресурс: "+l.assetId);
  }else if(l.kind==="art")renderArt(ctx,l);
  else if(l.kind==="text")renderText(ctx,l,report);
  ctx.restore();
}
function renderCard(target,report=[]){
   const ctx=target.getContext("2d");
   ctx.clearRect(0,0,CW,CH);
   project.cardPresentation.layers.forEach(l=>renderNode(ctx,l,report));
   return report;
}
/* Рамка выделения — восемь интерактивных маркеров.
   Все координаты ниже в логических пикселях холста, зум меняет только отображение. */
const RESIZE_HANDLES=["nw","n","ne","e","se","s","sw","w"];
const HANDLE_UV={nw:[0,0],n:[.5,0],ne:[1,0],e:[1,.5],se:[1,1],s:[.5,1],sw:[0,1],w:[0,.5]};
const OPPOSITE_HANDLE={nw:"se",n:"s",ne:"sw",e:"w",se:"nw",s:"n",sw:"ne",w:"e"};
const HANDLE_CURSORS={nw:"nwse-resize",n:"ns-resize",ne:"nesw-resize",e:"ew-resize",se:"nwse-resize",s:"ns-resize",sw:"nesw-resize",w:"ew-resize"};
const aspectLocked=n=>n?.lockWidth===true?false:n?.lockAspect!==false;
const angleRad=n=>safeNum(n?.rotation,0)*Math.PI/180;
const handleRadius=()=>clamp(7/Math.max(zoom,.1),9,22);
function getSelectionBox(){
    const {node}=nodeById(selectedId);
    if(!node||!isVisible(node))return null;
    const rect=globalRect(selectedId);
    if(!rect||rect.w<=0||rect.h<=0)return null;
    return{node,rect,angle:node.kind==="group"?0:angleRad(node)};
}
function rotatePoint(x,y,cx,cy,angle){
    const dx=x-cx,dy=y-cy,c=Math.cos(angle),s=Math.sin(angle);
    return{x:cx+dx*c-dy*s,y:cy+dx*s+dy*c};
}
function handlesForBox(rect,angle=0){
    const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2;
    return Object.fromEntries(RESIZE_HANDLES.map(h=>{
       const [u,v]=HANDLE_UV[h];
       return[h,rotatePoint(rect.x+u*rect.w,rect.y+v*rect.h,cx,cy,angle)];
    }));
}
function findResizeHandle(p){
    if(!$("guidesSwitch").checked)return null;
    const selection=getSelectionBox();
    if(!selection||selectedIsLocked(selection.node))return null;
    const handles=handlesForBox(selection.rect,selection.angle);
    const radius=handleRadius()+7/Math.max(zoom,.15);
    for(const h of RESIZE_HANDLES.filter(h=>h.length===2)){
       if(Math.hypot(handles[h].x-p.x,handles[h].y-p.y)<=radius)return h;
    }
    for(const h of RESIZE_HANDLES.filter(h=>h.length===1)){
       if(Math.hypot(handles[h].x-p.x,handles[h].y-p.y)<=radius)return h;
    }
    return null;
}
function drawOverlay(){
    const overlay=$("overlayCanvas"),ctx=overlay.getContext("2d");
    ctx.clearRect(0,0,CW,CH);
    if(!$("guidesSwitch").checked)return;
    const selection=getSelectionBox();if(!selection)return;
    const {node,rect,angle}=selection;
    ctx.save();
    ctx.translate(rect.x+rect.w/2,rect.y+rect.h/2);
    ctx.rotate(angle);
    ctx.strokeStyle=selectedIsLocked(node)?"#e1b777":"#85cff2";
    ctx.lineWidth=clamp(1.7/Math.max(zoom,.1),2,4);
    ctx.setLineDash([13,8]);
    if(node.kind==="art"){
       ctx.beginPath();ctx.ellipse(0,0,Math.max(1,rect.w/2),Math.max(1,rect.h/2),0,0,Math.PI*2);ctx.stroke();
    }
    ctx.strokeRect(-rect.w/2,-rect.h/2,rect.w,rect.h);
    ctx.restore();
    if(!selectedIsLocked(node)){
       const handles=handlesForBox(rect,angle),r=handleRadius();
       ctx.save();ctx.setLineDash([]);
       for(const h of RESIZE_HANDLES){
         const pt=handles[h],corner=h.length===2;
         ctx.lineWidth=clamp(1.5/Math.max(zoom,.1),2,3);
         ctx.strokeStyle="#195a74";ctx.fillStyle=corner?"#eafaff":"#a8dcf2";
         ctx.beginPath();
         if(corner)ctx.rect(pt.x-r,pt.y-r,2*r,2*r);
         else ctx.arc(pt.x,pt.y,r*.82,0,Math.PI*2);
         ctx.fill();ctx.stroke();
       }
       ctx.restore();
    }
}
/* Геометрия нового прямоугольника задаётся фиксированной противоположной
   точкой (или серединой противоположной стороны) с учётом поворота. */
function resizedBox(base,handle,p,locked,angle=0){
    const min=12,max=6000,oldW=base.w,oldH=base.h,ratio=oldW/Math.max(1,oldH);
    const points=handlesForBox(base,angle),anchor=points[OPPOSITE_HANDLE[handle]];
    const dx=p.x-anchor.x,dy=p.y-anchor.y,c=Math.cos(angle),s=Math.sin(angle);
    const localX=dx*c+dy*s,localY=-dx*s+dy*c;
    const ix=handle.includes("e")?1:handle.includes("w")?-1:0;
    const iy=handle.includes("s")?1:handle.includes("n")?-1:0;
    let w=ix?clamp(localX*ix,min,max):oldW;
    let h=iy?clamp(localY*iy,min,max):oldH;
    if(locked){
       if(ix && iy){
          if(Math.abs(w/oldW-1)>=Math.abs(h/oldH-1)){h=clamp(w/ratio,min,max);w=clamp(h*ratio,min,max);}
          else{w=clamp(h*ratio,min,max);h=clamp(w/ratio,min,max);}
       }else if(ix){h=clamp(w/ratio,min,max);w=clamp(h*ratio,min,max);}
       else if(iy){w=clamp(h*ratio,min,max);h=clamp(w/ratio,min,max);}
    }
    // Offset from anchor to rectangle centre, in axes of the rotated object.
    const cxLocal=ix>0?w/2:ix<0?-w/2:0;
    const cyLocal=iy>0?h/2:iy<0?-h/2:0;
    const centreX=anchor.x+cxLocal*c-cyLocal*s,centreY=anchor.y+cxLocal*s+cyLocal*c;
    return {x:centreX-w/2,y:centreY-h/2,w,h};
}
/* Независимая правка одной стороны; связь размеров использует текущие,
   а не исходные пропорции ассета. */
function setLayerDimension(node,key,val){
    if(!node||node.kind==="group"||!(key==="w"||key==="h"))return false;
    if(key==="w"&&node.lockWidth===true)return false;
    const next=clamp(safeNum(val,1),1,6000);
    if(key==="h"&&node.lockWidth===true){node.h=next;return true;}
    const w=Math.max(1,safeNum(node.w,1)),h=Math.max(1,safeNum(node.h,1));
    if((key==="w"?w:h)===next)return false;
    const ratio=w/h;
    if(key==="w"){node.w=next;if(aspectLocked(node))node.h=clamp(Math.round(next/ratio),1,6000);}
    else{node.h=next;if(aspectLocked(node))node.w=clamp(Math.round(next*ratio),1,6000);}
    return true;
}
function render(){
   if(!ready)return;
   const errors=[];
   renderCard($("cardCanvas"),errors);
   textWarnings=[...new Set(errors)].filter(v=>!v.includes("графический ресурс"));
   drawOverlay();
   renderWarnings(errors);
}
function globalRect(id){
   function walk(arr,dx,dy){
      for(const n of arr){
         const x=dx+safeNum(n.x),y=dy+safeNum(n.y);
         if(n.id===id){
            if(n.kind==="group"){const children=n.children||[];
               const bounds=children.map(ch=>({x:x+ch.x,y:y+ch.y,w:ch.w||0,h:ch.h||0}));
               if(!bounds.length)return{x,y,w:0,h:0};
               const minx=Math.min(...bounds.map(r=>r.x)),miny=Math.min(...bounds.map(r=>r.y)),maxx=Math.max(...bounds.map(r=>r.x+r.w)),maxy=Math.max(...bounds.map(r=>r.y+r.h));
               return{x:minx,y:miny,w:maxx-minx,h:maxy-miny};
            }
            return{x,y,w:n.w||0,h:n.h||0};
         }
         if(n.children){const f=walk(n.children,x,y);if(f)return f;}
      }return null;
   }
   return walk(project.cardPresentation.layers,0,0);
}
function pickLayer(x,y){
   function visit(arr,dx,dy,hidden){
      for(let i=arr.length-1;i>=0;i--){
         const l=arr[i],unavailable=hidden||!isVisible(l);
         if(unavailable || l.locked)continue;
         const gx=dx+safeNum(l.x),gy=dy+safeNum(l.y);
         if(l.children){
            const chosen=visit(l.children,gx,gy,unavailable);if(chosen)return chosen;
         } else {
            const local=l.rotation
                ?rotatePoint(x,y,gx+l.w/2,gy+l.h/2,-angleRad(l))
                :{x,y};
            const rx=local.x-gx,ry=local.y-gy;
            if(rx>=0&&ry>=0&&rx<=l.w&&ry<=l.h){
                if(l.kind==="art"){
                   const a=(rx-l.w/2)/(l.w/2),b=(ry-l.h/2)/(l.h/2);
                   if(a*a+b*b>1)continue;
                }
                return l;
            }
         }
      }return null;
   }
   return visit(project.cardPresentation.layers,0,0,false);
}
function setStatus(label,kind="ok"){
   $("saveStatus").innerHTML='<span class="status-dot '+(kind==="busy"?"busy":kind==="error"?"error":"")+'"></span>'+escapeHTML(label);
}
function toast(message){
   const t=$("toast");t.textContent=message;t.classList.add("show");
   clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),3800);
}
function snapshot(){return deepCopy({cardDefinition:project.cardDefinition,cardPresentation:project.cardPresentation,assets:project.assets});}
function captureUndo(){
   undoStack.push(snapshot());if(undoStack.length>24)undoStack.shift();
   redoStack=[];updateUndoButtons();
}
function restoreSnapshot(s){
   project.cardDefinition=s.cardDefinition;project.cardPresentation=s.cardPresentation;project.assets=s.assets;
   const at=getArtNode();if(!at){selectedId="slot-5";} else currentArt=null;
   syncDataFields();syncCropFields();renderTree();renderInspector();handleDerivedIcons();updateUndoButtons();
   ensureArt().then(render);
}
function undo(){
   if(!undoStack.length)return;redoStack.push(snapshot());
   restoreSnapshot(undoStack.pop());markChanged(false);updateUndoButtons();
}
function redo(){
   if(!redoStack.length)return;undoStack.push(snapshot());
   restoreSnapshot(redoStack.pop());markChanged(false);updateUndoButtons();
}
function updateUndoButtons(){$("undoBtn").disabled=!undoStack.length;$("redoBtn").disabled=!redoStack.length;}
function markChanged(redraw=true){
   dirty=true;libraryWorkingDirty=true;setStatus("Есть изменения · не в библиотеке","busy");
   project.metadata.updatedAt=new Date().toISOString();
   if(redraw){render();renderTree();}
   clearTimeout(autosaveTimer);
   autosaveTimer=setTimeout(()=>saveToLocal(false),850);
}
function syncDataFields(){
   document.querySelectorAll("[data-field]").forEach(el=>{
       const v=getData()[el.dataset.field];el.value=(v===null||v===undefined)?"":v;
   });
   $("cardIdentity").textContent=getData().cardId||"Нет ID";
    const type=getData().cardType||"creature";
    const typeName=window.MW_TEMPLATES?.TYPE_NAMES?.[type]||type;
    $("cardTypeIdentity").textContent=typeName;
    $("currentCardId").textContent=getData().cardId||"—";
    $("currentCardName").textContent=getData().name||"Без названия";
    $("canvasTypePill").textContent=String(typeName).toUpperCase();
    $("canvasTemplateName").textContent=getData().templateId||"—";
    document.querySelectorAll("[data-card-types]").forEach(el=>{
       el.classList.toggle("hidden",!el.dataset.cardTypes.split(",").includes(type));
    });
    $("costLabel").textContent=getData().costType==="corpses"?"Трупы":"Мана";
    $("healthLabel").textContent=type==="weapon"?"Прочность":"Здоровье";
    $("healthField").dataset.field=type==="weapon"?"durability":"health";
    $("healthField").value=getData()[type==="weapon"?"durability":"health"]??"";
    $("artMaskName").textContent={creature:"Овал",spell:"Прямоугольник",weapon:"Круг"}[type]||"";
}
function syncCropFields(){
    const art=getArtNode();if(!art)return;
    $("cropZoom").value=art.zoom||1;
    $("cropZoomValue").textContent=Math.round((art.zoom||1)*100)+"%";
    $("cropX").value=art.offsetX||0;$("cropY").value=art.offsetY||0;
    $("artName").textContent=project.assets.customArtName||
        (project.assets.allowDefaultArt===false?"Арт не загружен":"Молодой дружиник.png");
    if($("artSourceGuide")){
       const w=Math.round(art.w),h=Math.round(art.h);
       $("artSourceGuide").textContent="Окно арта: "+w+" × "+h+" px · рекомендуемый исходник: "+(w*2)+" × "+(h*2)+" px";
    }
}
/* v2.1F · per-zone visual controls. All changes are saved in cardPresentation.
   No canonical card-definition fields are generated here. */
function isNewEditorPreset(){return !!window.MW_EDITOR_LAYOUT?.isIntegrated(project);}
function syncEditorControls(){
    const d=getData(), integrated=isNewEditorPreset();
    const theme=d.presentationOverrides?.editorTheme||"default";
    const themePicker=$("frameThemeSelect");
    if(themePicker){themePicker.value=integrated?theme:"legacy";}
    const preview=$("themePreviewImage"), description=$("themeDescription");
    if(preview){
      const frame=nodeById("frame").node,asset=frame?.assetId;
      preview.src=integrated?window.MW_ASSETS?.[window.MW_EDITOR_LAYOUT.BASES[d.cardType]?.[theme]||asset]||"":
        (asset&&window.MW_ASSETS?.[asset]||"");
    }
    if(description)description.textContent=integrated
      ?(theme==="alt"?"Альтернативный набор: серые подложки.":"Основной набор: светлые пергаментные подложки.")
      :"Классический проект: его оформление не меняется автоматически.";
    const notice=$("editorPresetNotice");
    if(notice)notice.textContent=integrated
      ?"Эта карта использует присланные готовые подложки. Тексты и значки — отдельные слои; параметры игры не изменяются."
      :"Старая карта сохранена в исходном виде. Чтобы применить новую основу, создайте новый проект с выбранным дизайном.";
    const title=nodeById("cardName").node,desc=nodeById("abilityText").node;
    const set=(id,value)=>{const el=$(id);if(el&&value!==undefined&&value!==null)el.value=String(value);};
    set("titleCurveEnabled",title?.curveEnabled?"true":"false");
    set("titleFontFamily",title?.fontFamily||"Georgia, 'Times New Roman', serif");
    set("titleFontSize",title?.fontSize??48);
    set("titleLetterSpacing",title?.letterSpacing??0);
    set("titleCurveRadius",title?.curveRadius??820);
    set("titleCurveLift",title?.curveLift??0);
    if($("titleAutoFit"))$("titleAutoFit").checked=!!title?.autoFit;
    set("descHeight",desc?.h??190);
    set("descY",desc?.y??1217);
    set("descFontSize",desc?.fontSize??34);
    set("descFontFamily",desc?.fontFamily||"'Trebuchet MS', Verdana, Arial, sans-serif");
    set("descLineHeight",desc?.lineHeight??1.21);
    if($("descAutoFit"))$("descAutoFit").checked=!!desc?.autoFit;
    if($("descHeightValue"))$("descHeightValue").textContent=Math.round(desc?.h||0)+" px";
    if($("descWidthValue"))$("descWidthValue").textContent=Math.round(desc?.w||0)+" px";
    if($("descLineHeightValue"))$("descLineHeightValue").textContent=Number(desc?.lineHeight??1.21).toFixed(2);
    document.querySelectorAll("[data-decor-toggle]").forEach(el=>{
      const node=nodeById(el.dataset.decorToggle).node;
      el.disabled=!node;el.checked=node?.visible!==false&&!!node;
    });
    const status=$("titleFitStatus");
    if(status){
      const bad=textWarnings.find(x=>x.includes("Название")||x.includes("Плашк")||x.includes("cardName"));
      status.textContent=bad?"⚠ "+bad:(title?.curveEnabled?"✓ Текст расположен по дуге; при экспорте проверяется переполнение.":"Название расположено прямой строкой.");
      status.classList.toggle("warn",!!bad);
    }
}
function setEditorTheme(theme){
   if(!isNewEditorPreset()){
      if($("frameThemeSelect"))$("frameThemeSelect").value="legacy";
      toast("Старый проект сохранён без изменений. Для нового дизайна создайте карту по шаблону.");
      return false;
   }
   if(!["default","alt"].includes(theme))return false;
   if(getData().presentationOverrides?.editorTheme===theme)return true;
   captureUndo();
   window.MW_EDITOR_LAYOUT.applyTheme(project,theme);
   prepareImages().then(()=>{render();syncEditorControls();});
   markChanged(false);syncEditorControls();return true;
}
function adaptDescriptionPanelForHeight(height){
    const panel=nodeById("descriptionPanel").node;
    if(!panel||!isNewEditorPreset())return;
    const panelHeight=clamp(Math.max(410,Math.round(height+185)),410,575);
    panel.h=panelHeight;panel.y=1494-panelHeight;
    panel.w=827;panel.lockWidth=true;panel.lockAspect=false;
}
function setLayoutOption(key,value){
    const title=nodeById("cardName").node,desc=nodeById("abilityText").node;
    const isTitle=key.startsWith("title")||["curveEnabled","letterSpacing","curveRadius","curveLift"].includes(key);
    const node=isTitle?title:desc;if(!node)return false;
    const props={
      curveEnabled:"curveEnabled",titleFontFamily:"fontFamily",
      titleFontSize:"fontSize",letterSpacing:"letterSpacing",
      curveRadius:"curveRadius",curveLift:"curveLift",
      titleAutoFit:"autoFit",descriptionHeight:"h",descriptionY:"y",
      descriptionFontSize:"fontSize",descriptionFontFamily:"fontFamily",
      descriptionLineHeight:"lineHeight",descriptionAutoFit:"autoFit"
    };
    const prop=props[key];if(!prop)return false;
    let next=value;
    if(["curveEnabled","titleAutoFit","descriptionAutoFit"].includes(key)){
       next=(value===true||value==="true");
    }else if(!key.endsWith("Family")){
       const bounds={
         titleFontSize:[16,100],letterSpacing:[-4,10],curveRadius:[250,2200],
         curveLift:[-90,90],descriptionHeight:[100,480],descriptionY:[100,1550],
         descriptionFontSize:[16,72],descriptionLineHeight:[.9,1.8]
       };
       const [lo,hi]=bounds[key]||[-1e5,1e5];next=clamp(safeNum(value,0),lo,hi);
    }
    if(node[prop]===next)return true;
    captureUndo();node[prop]=next;
    if(key==="descriptionHeight")adaptDescriptionPanelForHeight(next);
    render();syncEditorControls();renderInspector();markChanged(false);
    return true;
}
function handleDerivedIcons(){
   const d=getData();
   const time=nodeById("timeSymbol").node;
   const rarity=nodeById("rarityGem").node;
   if(time){time.assetId=d.timeAffinityId==="Ноч"?"nightMedallion":"dayMedallion";time.visible=!!d.timeAffinityId;}
   if(rarity){rarity.assetId=rarityAssets[d.rarityId]||rarityAssets.common;rarity.visible=!!d.rarityId;}
    const classSlot=nodeById("slot-2").node;
    const typeSlot=nodeById("slot-4").node;
    if(classSlot&&d.cardType==="creature")classSlot.visible=d.classId==="Воин";
    if(typeSlot&&d.cardType==="creature")typeSlot.visible=d.creatureTypeId==="Чалавек";
   // Легендарный знак показывается только при соответствующей редкости, без изменения координат
   const legend=nodeById("slot-13").node;
   if(legend)legend.visible=d.rarityId==="legendary";
}
function updateData(field,value){
   if(["costValue","attack","health","durability"].includes(field)){
      if(value==="") value=null;
      else value=clamp(Math.trunc(safeNum(value)),0,999);
   }
   if(field==="subtype") getData().subtypeIds=value?[value]:[];
   if(getData()[field]===value)return;
   captureUndo();getData()[field]=value;
   if(["name","ability","flavor"].includes(field)){
      getData().localizations.be=getData().localizations.be||{};
      const k=field==="ability"?"text":field;getData().localizations.be[k]=value;
   }
   handleDerivedIcons();
   render();markChanged(false);renderTree();syncEditorControls();
    if(field==="name"||field==="cardId"){
       $("cardIdentity").textContent=getData().cardId||"Нет ID";
       $("currentCardId").textContent=getData().cardId||"—";
       $("currentCardName").textContent=getData().name||"Без названия";
    }
}
function requiredAssetErrors(){
   const missing=new Set();
   const walk=(items,parentVisible=true)=>items.forEach(l=>{
      const visible=parentVisible&&isVisible(l);
      if(!visible)return;
      if(l.kind==="image" && l.assetId && !imageCache[l.assetId])missing.add(l.assetId);
      if(l.children)walk(l.children,visible);
   });
   walk(project.cardPresentation.layers);
   if(!currentArt?.image)missing.add("art");
   return [...missing];
}
function renderWarnings(renderErrors=[]){
   const warnings=[];
   if(loadErrors.length)warnings.push({bad:true,text:"Не загрузились исходные изображения: "+loadErrors.join(", ")});
   if(!currentArt?.image)warnings.push({bad:true,text:"Арт отсутствует. Экспорт карты заблокирован."});
   if(getData().cardType==="creature"&&getData().classId&&getData().classId!=="Воин")warnings.push({text:"Для выбранного класса нет отдельной утверждённой символики в этом шаблоне."});
   if(getData().cardType==="creature"&&getData().creatureTypeId&&getData().creatureTypeId!=="Чалавек")warnings.push({text:"Для выбранного вида существа нет отдельного утверждённого значка в этом шаблоне."});
    if(!getData().cardId||/^LOCAL-/.test(getData().cardId))warnings.push({text:"Локальный черновой ID. Перед обменом с основной библиотекой назначьте утверждённый cardId."});
   if(getData().costType!=="mana")warnings.push({text:"Иконка альтернативного ресурса стоимости для этого шаблона не подключена."});
   for(const e of [...new Set(renderErrors)])warnings.push({bad:e.includes("не найден")||e.includes("Не найден"),text:e});
   if(!warnings.length)warnings.push({ok:true,text:"Все обязательные изображения загружены. Переполнений текста нет."});
   $("warnings").innerHTML=warnings.map(w=>'<div class="warning '+(w.ok?"ok":w.bad?"bad":"")+'">'+(w.ok?"✓ ":"⚠ ")+escapeHTML(w.text)+'</div>').join("");
}
function renderTree(){
   const entries=[];
   let num=0;
   for(const gp of project.cardPresentation.layers){
     num++;
     const hasChildren=!!gp.children?.length;
     const expanded=!collapsed.has(gp.id);
     const badge=gp.slot>0?"":'<span class="slot-count">'+(gp.id==="user-layers"?"новые":"основа")+'</span>';
     entries.push('<div class="group-row '+(selectedId===gp.id?"selected":"")+'" data-select="'+escapeHTML(gp.id)+'"><span class="tree-toggle" data-toggle="'+escapeHTML(gp.id)+'">'+(expanded?"▾":"▸")+'</span><span class="tree-icon">▦</span><span class="row-label" title="'+escapeHTML(gp.name)+'">'+escapeHTML(gp.name)+'</span>'+badge+'<button class="tree-button '+(!gp.visible?"inactive":"")+'" data-visibility="'+escapeHTML(gp.id)+'" title="Видимость">◉</button></div>');
     if(expanded&&hasChildren){
        for(const l of gp.children){
           entries.push('<div class="layer-row '+(selectedId===l.id?"selected":"")+'" data-select="'+escapeHTML(l.id)+'"><span class="tree-icon">'+(l.kind==="text"?"T":l.kind==="art"?"◈":"▣")+'</span><span class="row-label" title="'+escapeHTML(l.name)+'">'+escapeHTML(l.name)+'</span><button class="tree-button '+(l.visible===false?"inactive":"")+'" data-visibility="'+escapeHTML(l.id)+'" title="Видимость">'+(l.visible===false?"○":"◉")+'</button><button class="tree-button '+(l.locked?"inactive":"")+'" data-lock="'+escapeHTML(l.id)+'" title="Блокировка">'+(l.locked?"▣":"▫")+'</button></div>');
        }
     }
   }
   $("layerTree").innerHTML=entries.join("");
   $("layerCount").textContent="("+num+" групп)";
}
function setSelected(id){
   const res=nodeById(id);
   if(!res.node)return;
   selectedId=id;
   renderTree();renderInspector();drawOverlay();
}
function addInputRow(label,key,field,type="number",attr=""){
   const value=field[key]??"";
   return '<label class="prop-field">'+label+'<input data-prop="'+key+'" type="'+type+'" '+attr+' value="'+escapeHTML(value)+'"></label>';
}
function renderInspector(){
   const {node,parent}=nodeById(selectedId);
   if(!node){$("selectedLayerName").textContent="Ничего не выбрано";$("layerInspector").innerHTML="";return;}
   $("selectedLayerName").textContent=node.name;
   $("selectedLayerId").textContent=node.id+" · "+node.kind+(parent?" · "+parent.name:"");
   let html='<div class="property-heading">ТРАНСФОРМАЦИЯ</div><div class="prop-grid">';
   html+=addInputRow("X", "x",node)+addInputRow("Y","y",node);
   if(node.kind!=="group"){html+=node.lockWidth?'<label class="prop-field">Ширина (фиксирована)<input type="number" value="'+node.w+'" disabled></label>':addInputRow("Ширина","w",node);html+=addInputRow("Высота","h",node);}
   html+=addInputRow("Поворот °","rotation",node);
   html+='<label class="prop-field">Прозрачность, %<input data-prop="opacityPercent" type="number" min="0" max="100" value="'+Math.round((node.opacity??1)*100)+'"></label>';
   html+='</div>';
   html+='<div class="aspect-row"><label><input type="checkbox" data-check="lockAspect" '+(aspectLocked(node)?"checked":"")+'> <span>🔗 Сохранять пропорции</span></label><span class="aspect-hint">Shift — временно переключить</span></div>';
   html+='<div class="prop-check"><label><input type="checkbox" data-check="visible" '+(node.visible!==false?"checked":"")+'> Видимый</label><label><input type="checkbox" data-check="locked" '+(node.locked?"checked":"")+'> Заблокирован</label></div>';
   if(node.kind==="text"){
      html+='<div class="property-heading">ТЕКСТОВЫЙ СЛОЙ</div>';
      if(node.lockWidth)html+='<div class="inspector-hint">Ширина текста зафиксирована. Меняйте только высоту.</div>';
      html+='<div class="prop-grid">'+addInputRow("Размер шрифта","fontSize",node)+
           '<label class="prop-field">Интерлиньяж<input type="number" data-prop="lineHeight" step="0.05" min="0.7" max="2" value="'+(node.lineHeight||1.15)+'"></label></div>';
      html+='<div class="prop-grid"><label class="prop-field">Цвет текста<input data-prop="color" type="color" value="'+escapeHTML(node.color||"#111111")+'"></label>';
      html+='<label class="prop-field">Выравнивание<select data-prop="align">'+["left","center","right"].map(s=>'<option value="'+s+'" '+(node.align===s?"selected":"")+'>'+({left:"Слева",center:"По центру",right:"Справа"}[s])+'</option>').join("")+'</select></label></div>';
      html+='<div class="mono-small">Привязка: '+escapeHTML(node.binding||"")+'</div>';
   }
   if(node.kind==="art"){
      html+='<div class="property-heading">КАДРИРОВАНИЕ</div><div class="prop-grid">';
      html+=addInputRow("Сдвиг X","offsetX",node)+addInputRow("Сдвиг Y","offsetY",node);
      html+='<label class="prop-field">Масштаб<input data-prop="zoom" type="number" min="0.2" max="5" step="0.05" value="'+fmt(node.zoom)+'"></label></div><div class="inspector-hint">При перетаскивании арта изменяется положение изображения <b>внутри</b> овальной маски.</div>';
   }
   if(node.kind==="image"){
      const currentSrc=node.assetId||"";
      html+='<div class="property-heading">ИЗОБРАЖЕНИЕ</div><div class="mono-small" style="margin-bottom:12px">Ресурс: '+escapeHTML(currentSrc)+'</div>';
      html+='<button class="btn btn-outline btn-block" id="replaceLayerButton">↑ Заменить изображение слоя</button>';
   }
   if(node.userCreated){
       html+='<div class="property-heading">МОЙ СЛОЙ</div><label class="prop-field">Название<input data-prop="name" type="text" maxlength="120" value="'+escapeHTML(node.name)+'"></label>';
       html+='<button type="button" class="btn btn-outline btn-block inspector-delete" id="deleteUserLayerBtn">Удалить слой</button>';
   }
   if(parent&&parent.children){
      html+='<div class="inspector-buttons"><button class="btn btn-outline" id="moveLayerUp">↑ Выше</button><button class="btn btn-outline" id="moveLayerDown">↓ Ниже</button></div>';
   }
   $("layerInspector").innerHTML=html;
}
function moveLayer(delta){
  const {node,parent,index}=nodeById(selectedId);
  if(!node)return;
  const list=parent?.children||project.cardPresentation.layers;
  const target=clamp(index+delta,0,list.length-1);
  if(index===target)return;captureUndo();list.splice(index,1);list.splice(target,0,node);
  renderTree();render();markChanged(false);
}

/* --- Общая локальная библиотека: пользовательские файлы живут отдельно от карт --- */
const categoryName=id=>ASSET_CATEGORIES[id]||ASSET_CATEGORIES.decor;
function allAssetEntries(){
    const builtin=Object.keys(sources).filter(k=>BUILTIN_ASSET_GROUPS[k]).map(key=>({
        ref:key, id:key, name:BUILTIN_LABELS[key]||key,
        category:BUILTIN_ASSET_GROUPS[key], builtIn:true, url:assetUrl(key)
    }));
    const custom=[...userLibrary.values()].map(entry=>({
        ...entry,ref:"library:"+entry.id,builtIn:false,url:entry.dataUrl
    })).sort((a,b)=>String(b.importedAt||"").localeCompare(String(a.importedAt||"")));
    return [...custom,...builtin];
}
const assetEntryByRef=ref=>allAssetEntries().find(entry=>entry.ref===ref)||null;
function updateLibraryStorageLabel(error){
    const e=$("libraryStorageState");
    const count=userLibrary.size;
    if(error)librarySaveFailure=true;
    e.textContent=db && !librarySaveFailure
        ? "✓ Локальная библиотека: "+count+" ваших ассетов. Хранится отдельно от проектов."
        : "⚠ Часть или все ассеты могут храниться только в этом сеансе. Скачайте резервную копию библиотеки.";
    e.classList.toggle("warn",!db||librarySaveFailure);
}
function buildAssetsGrid(){
    const entries=allAssetEntries();
    const filter=assetCategoryFilter,search=assetSearchFilter.trim().toLocaleLowerCase("ru");
    $("assetCategoryFilters").innerHTML=[["all","Все"],...Object.entries(ASSET_CATEGORIES)].map(([id,title])=>
        '<button type="button" class="category-chip '+(filter===id?"active":"")+'" data-category-filter="'+id+'">'+title+'</button>').join("");
    const filtered=entries.filter(x=>(filter==="all"||x.category===filter)&&
        (!search||x.name.toLocaleLowerCase("ru").includes(search)));
    $("assetResultCount").textContent="Ресурсов: "+filtered.length+" / "+entries.length+
        " · ваших: "+userLibrary.size;
    $("assetsGrid").innerHTML=filtered.length?filtered.map(x=>{
        const ref=escapeHTML(x.ref), name=escapeHTML(x.name);
        const dims=x.builtIn?"В комплекте":"Ваш файл · "+(x.width||"?")+"×"+(x.height||"?");
        const chooser=x.builtIn?"":'<div class="category-edit">'+
           '<select aria-label="Категория '+name+'" data-asset-category="'+ref+'">'+
           Object.entries(ASSET_CATEGORIES).map(([id,title])=>'<option value="'+id+'" '+(x.category===id?"selected":"")+'>'+title+'</option>').join("")+
           '</select><button type="button" data-asset-delete="'+ref+'" title="Удалить из библиотеки">×</button></div>';
        return '<div class="asset-item"><button type="button" class="asset-preview" data-asset-replace="'+ref+'" title="Заменить изображение выделенного слоя">'+
          '<img src="'+escapeHTML(x.url||"")+'" loading="lazy" alt="">'+
          '<span class="asset-name" title="'+name+'">'+name+'</span></button>'+
          '<div class="asset-subline">'+escapeHTML(dims)+'</div>'+
          '<div class="asset-action-row">'+
          '<button type="button" class="add-layer-action" data-asset-add="'+ref+'" title="Создать новый слой с этим изображением">＋ Слой</button>'+
          '<button type="button" data-asset-replace="'+ref+'" title="Заменить изображение выбранного слоя">Заменить</button></div>'+chooser+'</div>';
    }).join(""):'<div class="asset-empty">В этой категории нет ассетов. Нажмите «Добавить ассеты» или выберите другую категорию.</div>';
    updateLibraryStorageLabel();
}
function makeAssetId(){
    const uuid=typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"
        ?crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
    return "mw-"+uuid;
}
function fileDataUri(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(file);
    });
}
function validImageMime(mime,filename=""){
    if(["image/png","image/jpeg","image/webp"].includes(mime))return mime;
    const ext=(filename.toLowerCase().match(/\.(png|jpe?g|webp)$/)||[])[1];
    return {png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp"}[ext]||null;
}
async function importAssetFiles(files,category){
    const targetCategory=ASSET_CATEGORIES[category]?category:"art";
    const batch=Array.from(files||[]), imported=[], errors=[], duplicates=[];
    if(!batch.length)return imported;
    for(const file of batch){
       try{
           const mime=validImageMime(file.type,file.name);
           if(!mime)throw new Error("нужен PNG, JPG или WEBP");
           if(file.size>25*1024*1024)throw new Error("размер более 25 МБ");
           if(!file.size)throw new Error("пустой файл");
           const dataUrl=await fileDataUri(file);
           const same=[...userLibrary.values()].find(x=>x.dataUrl===dataUrl);
           if(same){duplicates.push(file.name);imported.push(same);continue;}
           const image=await loadImage(dataUrl);
           const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
           if(!width||!height||width>16384||height>16384)throw new Error("недопустимое разрешение");
           const entry={
              id:makeAssetId(),name:String(file.name).slice(0,180),
              category:targetCategory,mime,size:file.size,width,height,
              importedAt:new Date().toISOString(),dataUrl
           };
           if(db){
               try{await dbPutLibrary(entry);}
               catch(e){
                   console.warn("Asset library store failed",e);
                   updateLibraryStorageLabel(true);
                   errors.push(file.name+": не удалось сохранить в локальную базу; файл останется в сеансе");
               }
           }
           userLibrary.set(entry.id,entry);
           imageCache["library:"+entry.id]=image;
           imported.push(entry);
       }catch(e){errors.push(file.name+": "+e.message);}
    }
    buildAssetsGrid();
    if(layerDialogOpen)refreshNewLayerAssetOptions(imported[0]?"library:"+imported[0].id:null);
    const added=imported.length-duplicates.length;
    toast("Библиотека: добавлено "+added+", уже существовало "+duplicates.length+
       (errors.length?", ошибки: "+errors.length:"")+".");
    if(errors.length)console.warn("Import notes:",errors);
    return imported;
}
function usedByCurrentProject(ref){
   let used=false;
   const walk=nodes=>nodes.forEach(n=>{if(n.assetId===ref)used=true;if(n.children)walk(n.children);});
   walk(project.cardPresentation.layers);
   return used;
}
async function changeAssetCategory(ref,category){
   const id=ref.slice("library:".length),entry=userLibrary.get(id);
   if(!entry||!ASSET_CATEGORIES[category])return;
   const old=entry.category;entry.category=category;
   try{if(db)await dbPutLibrary(entry);}
   catch(e){entry.category=old;toast("Не удалось изменить категорию в хранилище.");}
   buildAssetsGrid();
}
async function deleteLibraryAsset(ref){
   if(!ref.startsWith("library:"))return;
   const id=ref.slice(8),entry=userLibrary.get(id);if(!entry)return;
   if(usedByCurrentProject(ref)){
      toast("Ресурс используется на карте. Сначала замените или удалите соответствующий слой.");
      return;
   }
   if(!confirm('Удалить «'+entry.name+'» из общей библиотеки? Сохранённые проекты с вложенными копиями останутся редактируемыми.'))return;
   try{if(db)await dbDeleteLibrary(id);}
   catch(e){toast("Ошибка удаления из локальной базы.");return;}
   userLibrary.delete(id);delete imageCache[ref];
   buildAssetsGrid();if(layerDialogOpen)refreshNewLayerAssetOptions();
   toast("Ассет удалён из общей библиотеки.");
}
function embedAssetInProject(ref){
   if(!ref.startsWith("library:"))return;
   const id=ref.slice(8),entry=userLibrary.get(id)||project.assets.embeddedLibrary?.[id];
   if(!entry)throw new Error("Ассет отсутствует в библиотеке");
   project.assets.embeddedLibrary=project.assets.embeddedLibrary||{};
   project.assets.embeddedLibrary[id]={
       id, name:entry.name, category:entry.category, mime:entry.mime,
       width:entry.width, height:entry.height, size:entry.size||0,
       importedAt:entry.importedAt||new Date().toISOString(),dataUrl:entry.dataUrl
   };
}
async function assignAssetToSelected(ref){
   const {node}=nodeById(selectedId);
   if(!node||!["image","art"].includes(node.kind)){
       toast("Выберите графический слой или арт. Для добавления нажмите «＋ Слой».");return false;
   }
   if(!assetUrl(ref)){toast("Этот ассет недоступен.");return false;}
   const im=await ensureImage(ref);
   if(!im){toast("Не удалось загрузить графический ресурс.");return false;}
   captureUndo();
   if(node.kind==="art"){
       project.assets.customArtData=assetUrl(ref);
       project.assets.customArtName=assetEntryByRef(ref)?.name||ref;
       currentArt=null;await ensureArt();syncCropFields();
   }else{
       embedAssetInProject(ref);
       node.assetId=ref;
   }
   render();renderInspector();renderTree();markChanged(false);
   toast("Ресурс применён к выбранному слою.");
   return true;
}
async function addAssetAsNewLayer(ref,parentId="user-layers",name=""){
    const asset=assetEntryByRef(ref);
    if(!asset){toast("Сначала выберите ресурс.");return false;}
    const im=await ensureImage(ref);
    if(!im){toast("Изображение не удалось прочитать.");return false;}
    let parent=nodeById(parentId).node;
    if(parent && parent.kind!=="group"){toast("Выберите группу для нового слоя.");return false;}
    const width=im.naturalWidth||im.width,height=im.naturalHeight||im.height;
    if(!width||!height){toast("Изображение имеет недопустимый размер.");return false;}
    const maxW=asset.category==="frames"?900:asset.category==="art"?580:450;
    const maxH=asset.category==="frames"?1300:asset.category==="art"?760:450;
    const scale=Math.min(1,maxW/width,maxH/height);
    const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
    const node={
        id:"user-layer-"+makeAssetId(),kind:"image",
        name:String(name||asset.name).trim().slice(0,120)||"Новый графический слой",
        assetId:ref, x:Math.round((CW-w)/2),y:Math.round((CH-h)/2),
        w,h,rotation:0,opacity:1,visible:true,locked:false,userCreated:true
    };
    captureUndo();
    if(!parent){
       parent={id:"user-layers",kind:"group",name:"Пользовательские слои",
           slot:0,x:0,y:0,w:0,h:0,rotation:0,opacity:1,visible:true,locked:false,children:[]};
       project.cardPresentation.layers.push(parent);
    }
    project.assets=project.assets||{};
    embedAssetInProject(ref);
    parent.children.push(node);
    selectedId=node.id;
    collapsed.delete(parent.id);
    setLeftTab("layers");setRightTab("properties");
    renderTree();renderInspector();render();markChanged(false);
    toast("Создан новый независимый графический слой.");
    return true;
}
function refreshNewLayerParentOptions(){
    const p=$("newLayerParent"),prev=p.value||"user-layers";
    const entries=[{id:"user-layers",name:"Пользовательские слои (поверх карты)"},
      ...project.cardPresentation.layers.filter(x=>x.kind==="group"&&x.id!=="user-layers").map(x=>({id:x.id,name:x.name}))];
    p.innerHTML=entries.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join("");
    p.value=entries.some(x=>x.id===prev)?prev:"user-layers";
}
function refreshNewLayerAssetOptions(preferRef=null){
    const filter=$("newLayerCategory").value||"all",list=allAssetEntries().filter(x=>filter==="all"||x.category===filter);
    const select=$("newLayerAsset"),prev=preferRef||select.value||lastAssetRef;
    select.innerHTML='<option value="">— Выберите ассет —</option>'+list.map(x=>
       '<option value="'+escapeHTML(x.ref)+'">'+escapeHTML(categoryName(x.category))+' / '+escapeHTML(x.name)+'</option>').join("");
    select.value=list.some(x=>x.ref===prev)?prev:"";
    updateNewLayerPreview();
}
function updateNewLayerPreview(){
    const ref=$("newLayerAsset").value;
    const asset=assetEntryByRef(ref),im=$("newLayerPreview");
    if(asset){
       im.src=asset.url||"";
       $("newLayerAssetInfo").textContent=asset.name+
           (asset.width?" · "+asset.width+"×"+asset.height:"")+
           " · "+categoryName(asset.category);
       if(!$("newLayerName").value.trim())$("newLayerName").value=asset.name;
    }else{
       im.removeAttribute("src");
       $("newLayerAssetInfo").textContent="Выберите изображение из библиотеки.";
    }
    $("createNewLayerBtn").disabled=!asset;
}
function showNewLayerDialog(ref=""){
    layerDialogOpen=true;
    $("newLayerDialog").classList.remove("hidden");
    $("newLayerName").value="";
    $("newLayerCategory").value="all";
    refreshNewLayerParentOptions();
    refreshNewLayerAssetOptions(ref);
    $("newLayerAsset").focus();
}
function closeNewLayerDialog(){
    layerDialogOpen=false;$("newLayerDialog").classList.add("hidden");
}
async function createNewLayerFromDialog(){
    const ref=$("newLayerAsset").value;
    const ok=await addAssetAsNewLayer(ref,$("newLayerParent").value,$("newLayerName").value);
    if(ok)closeNewLayerDialog();
}
function exportLibraryBackup(){
    const entries=[...userLibrary.values()];
    const backup={format:"mythical-wars-asset-library",version:1,createdAt:new Date().toISOString(),entries};
    downloadFile(new Blob([JSON.stringify(backup)],{type:"application/json"}),
        "MW_Assets_Library_Backup.json");
    toast("Резервная копия библиотеки: "+entries.length+" ресурсов.");
}
async function importLibraryBackup(file){
    if(!file)return;
    if(file.size>250*1024*1024){toast("Резервная копия слишком велика (более 250 МБ).");return;}
    let backup;
    try{backup=JSON.parse(await file.text());}
    catch(e){toast("Некорректный JSON библиотеки.");return;}
    if(backup?.format!=="mythical-wars-asset-library"||!Array.isArray(backup.entries)){
       toast("Файл не является резервной копией библиотеки.");return;
    }
    if(backup.entries.length>2000){toast("Слишком много ресурсов в одном файле.");return;}
    let count=0,skip=0,errors=0;
    for(const raw of backup.entries){
       try{
          if(!raw||!ASSET_CATEGORIES[raw.category]||
             typeof raw.dataUrl!=="string"||!/^data:image\/(png|jpeg|webp);base64,/.test(raw.dataUrl)||
             raw.dataUrl.length>35*1024*1024)throw new Error("Недопустимый ресурс");
          let id=String(raw.id||"");
          if(!/^[a-z0-9_-]{3,110}$/i.test(id))id=makeAssetId();
          if(userLibrary.has(id)){
             if(userLibrary.get(id).dataUrl===raw.dataUrl){skip++;continue;}
             id=makeAssetId();
          }
          const im=await loadImage(raw.dataUrl);
          const width=im.naturalWidth||im.width,height=im.naturalHeight||im.height;
          if(!width||!height||width>16384||height>16384)throw new Error("Недопустимое изображение");
          const entry={id,name:String(raw.name||"Без названия").slice(0,180),
             category:raw.category,mime:raw.mime||"image/png",size:raw.size||0,
             width,height,importedAt:raw.importedAt||new Date().toISOString(),dataUrl:raw.dataUrl};
          if(db)await dbPutLibrary(entry);
          userLibrary.set(id,entry);
          imageCache["library:"+id]=im;
          count++;
       }catch(e){console.warn("Skip library backup entry",e);errors++;}
    }
    buildAssetsGrid();
    toast("Библиотека восстановлена: "+count+" добавлено, "+skip+" повторов, "+errors+" ошибок.");
}
async function hydrateEmbeddedLibraryInGlobal(){
    const values=Object.entries(project.assets?.embeddedLibrary||{});
    for(const [id,raw] of values){
       if(userLibrary.has(id)||!raw?.dataUrl||!/^[a-z0-9_-]{3,110}$/i.test(id))continue;
       const entry={...raw,id};
       userLibrary.set(id,entry);
       try{if(db)await dbPutLibrary(entry);}
       catch(e){console.warn("Cannot restore embedded library resource:",id,e);}
    }
    buildAssetsGrid();
}
function deleteSelectedUserLayer(){
   const {node,parent,index}=nodeById(selectedId);
   if(!node?.userCreated||!parent?.children){toast("Удалять можно только добавленные вами слои.");return;}
   if(!confirm('Удалить слой «'+node.name+'»? Можно отменить действие через Ctrl+Z.'))return;
   captureUndo();
   parent.children.splice(index,1);
   selectedId=parent.id;
   renderTree();renderInspector();render();markChanged(false);
   toast("Пользовательский слой удалён.");
}
function zoomTo(value,manual=true){
   zoom=clamp(value,0.18,1.4);zoomManual=manual;
   const stage=$("cardStage"),scaled=$("cardScaled");
   stage.style.width=(CW*zoom)+"px";stage.style.height=(CH*zoom)+"px";
   scaled.style.transform="scale("+zoom+")";
   $("zoomDisplay").textContent=Math.round(zoom*100)+"%";
}
function fitViewport(){
    const v=$("canvasViewport");const w=v.clientWidth-70,h=v.clientHeight-60;
    zoomTo(Math.min(w/CW,h/CH,0.84),false);
}
function overlayPosition(ev){
  const bounds=$("overlayCanvas").getBoundingClientRect();
  return{x:(ev.clientX-bounds.left)*(CW/bounds.width),y:(ev.clientY-bounds.top)*(CH/bounds.height)};
}
function groupHasLockedDescendants(node){
    return !!node?.children?.some(child=>child.locked||groupHasLockedDescendants(child));
}
function selectedIsLocked(node){
    return !!node?.locked || (node?.kind==="group"&&groupHasLockedDescendants(node));
}
function globalOrigin(id){
    let result=null;
    function visit(arr,x,y){
        for(const n of arr){
            const nx=x+safeNum(n.x),ny=y+safeNum(n.y);
            if(n.id===id){result={x:nx,y:ny};return;}
            if(n.children){visit(n.children,nx,ny);if(result)return;}
        }
    }
    visit(project.cardPresentation.layers,0,0);return result||{x:0,y:0};
}
function scaledChildren(dstChildren,srcChildren,sx,sy,startMinX,startMinY,firstLevel){
    srcChildren.forEach((src,i)=>{
        const dst=dstChildren[i];if(!dst)return;
        const fx=firstLevel?startMinX:0,fy=firstLevel?startMinY:0;
        dst.x=Math.round(fx+(safeNum(src.x)-fx)*sx);
        dst.y=Math.round(fy+(safeNum(src.y)-fy)*sy);
        if(src.kind!=="group"){
            dst.w=Math.max(1,Math.round(safeNum(src.w)*sx));
            dst.h=Math.max(1,Math.round(safeNum(src.h)*sy));
            if(src.kind==="text")dst.fontSize=clamp(Math.round(safeNum(src.fontSize,32)*Math.min(sx,sy)),6,240);
            if(src.kind==="art"){
                dst.offsetX=Math.round(safeNum(src.offsetX)*sx);
                dst.offsetY=Math.round(safeNum(src.offsetY)*sy);
            }
        }
        if(src.children)scaledChildren(dst.children||[],src.children,sx,sy,0,0,false);
    });
}
function applyResizedNode(node,d,target,proportional){
    const start=d.startRect,src=d.original;
    if(node.kind==="group"){
        const sx=target.w/start.w,sy=target.h/start.h;
        node.x=Math.round(src.x+target.x-start.x);node.y=Math.round(src.y+target.y-start.y);
        const minX=start.x-d.origin.x,minY=start.y-d.origin.y;
        scaledChildren(node.children,src.children,sx,sy,minX,minY,true);
    }else{
        node.x=node.lockWidth===true?src.x:Math.round(src.x+target.x-start.x);
        node.y=Math.round(src.y+target.y-start.y);
        node.w=node.lockWidth===true?src.w:Math.max(1,Math.round(target.w));
        node.h=Math.max(1,Math.round(target.h));
        // При пропорциональном растягивании шрифт растёт вместе с текстом.
        // При свободном растягивании изменяется только текстовое поле.
        if(node.kind==="text"&&proportional)
            node.fontSize=clamp(Math.round(safeNum(src.fontSize,32)*target.w/start.w),6,240);
    }
}
function onPointerDown(ev){
    if(ev.button!==0)return;
    const p=overlayPosition(ev);
    const handle=findResizeHandle(p);
    let node=null,mode="move";
    if(handle){node=nodeById(selectedId).node;mode="resize";}
    else {
        const picked=pickLayer(p.x,p.y);
        if(!picked)return;
        setSelected(picked.id);node=picked;
    }
    if(!node||selectedIsLocked(node))return;
    dragging={id:node.id,mode,handle,point:p,original:deepCopy(node),
       startRect:globalRect(node.id),origin:globalOrigin(node.id),
       changed:false,undoCaptured:false, pointerId:ev.pointerId};
    $("overlayCanvas").classList.add("dragging");
    if(mode==="resize")$("overlayCanvas").style.cursor=HANDLE_CURSORS[handle];
    try{$("overlayCanvas").setPointerCapture(ev.pointerId);}catch(e){}
    ev.preventDefault();
}
function onPointerMove(ev){
    const p=overlayPosition(ev);
    if(!dragging){
       const h=findResizeHandle(p);
       $("overlayCanvas").style.cursor=h?HANDLE_CURSORS[h]:"grab";
       return;
    }
    if(ev.pointerId!==dragging.pointerId)return;
    const d=dragging,node=nodeById(d.id).node;if(!node)return;
    if(d.mode==="resize"){
        const proportional=aspectLocked(node)!==!!ev.shiftKey;
        const rect=resizedBox(d.startRect,d.handle,p,proportional,node.kind==="group"?0:angleRad(node));
        const changed=Math.abs(rect.x-d.startRect.x)>.4||Math.abs(rect.y-d.startRect.y)>.4
           ||Math.abs(rect.w-d.startRect.w)>.4||Math.abs(rect.h-d.startRect.h)>.4;
        if(!changed&&!d.changed)return;
        if(!d.undoCaptured){captureUndo();d.undoCaptured=true;}
        applyResizedNode(node,d,rect,proportional);
        d.changed=true;
    }else{
        const dx=Math.round(p.x-d.point.x),dy=Math.round(p.y-d.point.y);
        if(!dx&&!dy&&!d.changed)return;
        if(!d.undoCaptured){captureUndo();d.undoCaptured=true;}
        if(node.kind==="art"){
            node.offsetX=safeNum(d.original.offsetX)+dx;
            node.offsetY=safeNum(d.original.offsetY)+dy;
        }else{
            node.x=safeNum(d.original.x)+dx;
            node.y=safeNum(d.original.y)+dy;
        }
        d.changed=true;
    }
    if(node.id==="abilityText")adaptDescriptionPanelForHeight(node.h);
    render();if(activeRightTab==="properties")renderInspector();
    if(node.kind==="art")syncCropFields();
    if(node.id==="abilityText")syncEditorControls();
    ev.preventDefault();
}
function onPointerUp(ev){
    if(!dragging||ev.pointerId!==dragging.pointerId)return;
    const changed=dragging.changed;
    dragging=null;$("overlayCanvas").classList.remove("dragging");
    $("overlayCanvas").style.cursor="grab";
    try{$("overlayCanvas").releasePointerCapture(ev.pointerId);}catch(e){}
    if(changed)markChanged(false);
}
function setRightTab(which){
  activeRightTab=which;
  document.querySelectorAll("[data-right-tab]").forEach(b=>b.classList.toggle("active",b.dataset.rightTab===which));
  const panels={fields:"fieldsTab",art:"artTab",title:"titleTab",stats:"statsTab",description:"descriptionTab",icons:"iconsTab",properties:"propertiesTab",export:"exportTab"};
  Object.entries(panels).forEach(([tab,id])=>$(id)?.classList.toggle("hidden",which!==tab));
  if(which==="properties")renderInspector();
  if(["fields","title","description","icons","export"].includes(which))syncEditorControls();
}
function setLeftTab(which){
  activeLeftTab=which;
  document.querySelectorAll("[data-left-tab]").forEach(b=>b.classList.toggle("active",b.dataset.leftTab===which));
  $("layersTab").classList.toggle("hidden",which!=="layers");
  $("assetsTab").classList.toggle("hidden",which!=="assets");
  $("cardsTab").classList.toggle("hidden",which!=="cards");
  if(which==="cards")renderCardsLibrary();
}
async function openDB(){
    if(!("indexedDB" in window))throw new Error("IndexedDB не поддерживается");
    return new Promise((resolve,reject)=>{
       const req=indexedDB.open("MW_Card_Editor_Offline_v1",3);
       req.onupgradeneeded=()=>{
         const d=req.result;
         if(!d.objectStoreNames.contains("projects"))d.createObjectStore("projects");
         if(!d.objectStoreNames.contains("library"))d.createObjectStore("library",{keyPath:"id"});
          if(!d.objectStoreNames.contains("cards"))d.createObjectStore("cards",{keyPath:"cardId"});
       };
       req.onblocked=()=>reject(new Error("База занята в другой вкладке. Закройте остальные окна редактора."));
       req.onerror=()=>reject(req.error||new Error("Не удалось открыть локальное хранилище"));
       req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
    });
}
function dbGet(key){
   return new Promise((resolve,reject)=>{
      const tx=db.transaction("projects","readonly");
      const req=tx.objectStore("projects").get(key);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
   });
}
function dbPut(key,value){
   return new Promise((resolve,reject)=>{
      const tx=db.transaction("projects","readwrite");
      tx.objectStore("projects").put(value,key);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
   });
}
function dbGetAllLibrary(){
   return new Promise((resolve,reject)=>{
      const tx=db.transaction("library","readonly"),req=tx.objectStore("library").getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
   });
}
function dbPutLibrary(entry){
   return new Promise((resolve,reject)=>{
      const tx=db.transaction("library","readwrite");
      tx.objectStore("library").put(entry);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
   });
}
function dbDeleteLibrary(id){
   return new Promise((resolve,reject)=>{
      const tx=db.transaction("library","readwrite");
      tx.objectStore("library").delete(id);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
   });
}
async function saveToLocal(showToast=true){
   clearTimeout(autosaveTimer);
   if(!db){setStatus("Только ручной экспорт","error");if(showToast)toast("Автосохранение недоступно: сохраните файл проекта JSON.");return;}
   try{
      await dbPut("last",project);
      dirty=false;saveError=null;setStatus(libraryWorkingDirty?"Черновик автосохранён":"Сохранено в библиотеке");
      if(showToast)toast("Рабочий черновик сохранён на этом устройстве.");
   }catch(e){saveError=e;setStatus("Ошибка локального сохранения","error");if(showToast)toast("Локальное сохранение недоступно. Экспортируйте проект JSON.");}
}
async function downloadFile(blob,filename){
   const url=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function exportProject(){
   project.metadata.updatedAt=new Date().toISOString();
   const str=JSON.stringify(project,null,2);
   downloadFile(new Blob([str],{type:"application/json;charset=utf-8"}), getData().cardId+".mwcard.json");
   toast("Редактируемый проект сохранён в JSON.");
}
async function exportPNG(){
   if(!ready){toast("Изображения ещё загружаются.");return;}
   if(requiredAssetErrors().length){toast("Есть недоступные ресурсы. PNG не экспортирован.");return;}
   const issues=[];renderCard($("cardCanvas"),issues);
   if(issues.length){toast("Исправьте ошибки: "+issues[0]);renderWarnings(issues);return;}
   try{
      const blob=await new Promise((resolve,reject)=>$("cardCanvas").toBlob(x=>x?resolve(x):reject(new Error("Не удалось создать PNG")),"image/png"));
      await downloadFile(blob,(getData().cardId||"MW_CARD")+"_1024x1536.png");
      toast("PNG 1024×1536 экспортирован.");
   }catch(e){toast("Ошибка экспорта: "+e.message);console.error(e);}
}
async function loadProjectFile(file){
   if(!file)return;
   let obj;
   try{obj=JSON.parse(await file.text());}
   catch(e){toast("Файл не является корректным JSON.");return;}
   if(!isCardProject(obj)){
      toast("Формат, тип карты или ID проекта не поддерживается.");return;
   }
   if(!canLeaveCurrentCard())return;
   try{await activateProject(obj,null,true);toast("Проект загружен: "+getData().cardId);}
   catch(e){console.error(e);toast("Ошибка открытия JSON: "+e.message);}
}
async function loadArtFile(file){
   if(!file)return;
   const list=await importAssetFiles([file],"art");
   if(!list.length)return;
   const entry=list[0];
   captureUndo();
   project.assets.customArtData=entry.dataUrl;
   project.assets.customArtName=entry.name;
   project.metadata=project.metadata||{};
   project.metadata.artStatus="test";
   project.metadata.artSource="user";
   currentArt=null;
   await ensureArt();syncCropFields();render();markChanged(false);updateArtQualityReport();
   toast("Арт добавлен в общую библиотеку и применён к карте.");
}
async function loadLayerImage(file){
   if(!file)return;
   const {node}=nodeById(selectedId);
   if(!node || node.kind!=="image"){toast("Сначала выберите графический слой.");return;}
   const assets=await importAssetFiles([file],$("uploadCategory").value||"decor");
   if(assets.length)await assignAssetToSelected("library:"+assets[0].id);
}
function adjustCrop(k,value){
  const art=getArtNode();if(!art)return;
  if(art[k]===value)return;captureUndo();art[k]=value;
  syncCropFields();render();markChanged(false);
}
/* Горячие клавиши и действия над пользовательскими слоями. */
function getUserLayerGroup(){
    let parent=nodeById("user-layers").node;
    if(!parent){
       parent={id:"user-layers",kind:"group",name:"Пользовательские слои",slot:0,
          x:0,y:0,w:0,h:0,rotation:0,opacity:1,visible:true,locked:false,children:[]};
       project.cardPresentation.layers.push(parent);
    }
    return parent;
}
function copySelectedImage(){
    const node=nodeById(selectedId).node;
    if(!node||node.kind!=="image"){toast("Копировать можно графические слои.");return false;}
    copiedImageLayer={node:deepCopy(node),rect:globalRect(node.id)};
    toast("Изображение скопировано в буфер редактора.");
    return true;
}
function pasteImageLayer(){
    if(!copiedImageLayer){toast("Сначала скопируйте графический слой (Ctrl+C).");return false;}
    const src=copiedImageLayer.node,rect=copiedImageLayer.rect;
    const node=deepCopy(src);
    node.id="user-layer-"+makeAssetId();
    node.name=("Копия · "+src.name).slice(0,120);
    node.x=Math.round(rect.x+20);
    node.y=Math.round(rect.y+20);
    node.visible=true;node.locked=false;node.userCreated=true;
    captureUndo();
    project.assets=project.assets||{};
    embedAssetInProject(node.assetId);
    const parent=getUserLayerGroup();parent.children.push(node);collapsed.delete(parent.id);
    selectedId=node.id;setLeftTab("layers");setRightTab("properties");
    renderTree();renderInspector();render();markChanged(false);
    toast("Копия добавлена отдельным слоем.");
    return true;
}
function duplicateSelectedImage(){return copySelectedImage()&&pasteImageLayer();}
function nudgeSelected(key,step){
    const node=nodeById(selectedId).node;
    if(!node||selectedIsLocked(node))return false;
    const dx=(key==="ArrowLeft"?-1:key==="ArrowRight"?1:0)*step;
    const dy=(key==="ArrowUp"?-1:key==="ArrowDown"?1:0)*step;
    if(!dx&&!dy)return false;
    captureUndo();
    if(node.kind==="art"){
       node.offsetX=safeNum(node.offsetX)+dx;node.offsetY=safeNum(node.offsetY)+dy;syncCropFields();
    }else{node.x=safeNum(node.x)+dx;node.y=safeNum(node.y)+dy;}
    render();renderInspector();markChanged(false);return true;
}
function setShortcutsDialog(open){
    shortcutDialogOpen=!!open;
    $("shortcutsDialog").classList.toggle("hidden",!open);
    if(open)$("closeShortcutsBtn").focus();
}
function clearSelection(){
    selectedId=null;renderTree();renderInspector();drawOverlay();
}
function handleEditorShortcut(e){
    if(document.body.dataset.mode && document.body.dataset.mode!=="editor")return;
    const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
    // Ctrl-команды должны работать и при активной русской раскладке.
    const letter=/^Key[A-Z]$/.test(e.code||"")?e.code.slice(3).toLowerCase():key;
    const typing=!!e.target?.closest?.("input,textarea,select,[contenteditable='true']");
    if(e.key==="Escape"){
       if(shortcutDialogOpen){e.preventDefault();setShortcutsDialog(false);return;}
       if(layerDialogOpen){e.preventDefault();closeNewLayerDialog();return;}
        if(cardDialogOpen){e.preventDefault();closeNewCardDialog();return;}
       if(!typing){e.preventDefault();clearSelection();}return;
    }
    if(shortcutDialogOpen||layerDialogOpen||cardDialogOpen)return;
    if(mod){
       if(letter==="s"&&e.shiftKey){e.preventDefault();saveCardToLibrary();return;}
       if(letter==="s"){e.preventDefault();exportProject();return;}
       if(letter==="n"&&!e.shiftKey&&!typing){e.preventDefault();openNewCardDialog();return;}
       if(letter==="o"){e.preventDefault();$("projectFile").click();return;}
       if(letter==="e"){e.preventDefault();exportPNG();return;}
       if(key==="0"){e.preventDefault();fitViewport();return;}
       if(typing)return; // Ctrl+Z/C/V внутри полей редактирует текст.
       if(letter==="z"){e.preventDefault();e.shiftKey?redo():undo();return;}
       if(letter==="y"){e.preventDefault();redo();return;}
       if(letter==="d"){e.preventDefault();duplicateSelectedImage();return;}
       if(letter==="c"){if(nodeById(selectedId).node?.kind==="image"){e.preventDefault();copySelectedImage();}return;}
       if(letter==="v"){if(copiedImageLayer){e.preventDefault();pasteImageLayer();}return;}
       if(e.shiftKey&&key==="n"){e.preventDefault();showNewLayerDialog(lastAssetRef);return;}
       if(key==="]"||key==="ъ"||e.code==="BracketRight"){e.preventDefault();moveLayer(1);return;}
       if(key==="["||key==="х"||e.code==="BracketLeft"){e.preventDefault();moveLayer(-1);return;}
       return;
    }
    if(typing)return;
    if(e.key==="F1"||e.key==="?"){e.preventDefault();setShortcutsDialog(true);return;}
    if(e.key==="Delete"||e.key==="Backspace"){
       const node=nodeById(selectedId).node;
       if(node?.userCreated){e.preventDefault();deleteSelectedUserLayer();}
       return;
    }
    if(e.key.startsWith("Arrow")){
       e.preventDefault();nudgeSelected(e.key,e.shiftKey?10:1);return;
    }
    if(key==="+"||key==="="){e.preventDefault();zoomTo(zoom+.08);return;}
    if(key==="-"){e.preventDefault();zoomTo(zoom-.08);return;}
    if(key==="0"){e.preventDefault();fitViewport();return;}
}

/* --- v1.3: библиотека готовых карт. Отдельна от библиотеки графических ассетов. --- */
const cardTypeName=t=>CARD_TYPES[t]||"Неизвестный тип";
const validCardId=id=>/^[\p{L}\p{N}_-][\p{L}\p{N}_.-]{1,79}$/u.test(String(id||""));
const isCardProject=p=>p?.format==="mythical-wars-card-project"&&
  p?.cardPresentation?.canvas?.width===CW&&p?.cardPresentation?.canvas?.height===CH&&
  Array.isArray(p?.cardPresentation?.layers)&&validCardId(p?.cardDefinition?.cardId)&&
  !!CARD_TYPES[p.cardDefinition.cardType];
function dbGetAllCards(){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("cards","readonly"),r=tx.objectStore("cards").getAll();
    r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);
  });
}
function dbPutCard(entry){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("cards","readwrite");
    tx.objectStore("cards").put(entry);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
function dbDeleteCard(cardId){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("cards","readwrite");
    tx.objectStore("cards").delete(cardId);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
function canLeaveCurrentCard(){
  if(!libraryWorkingDirty&&!dirty)return true;
  return confirm("Есть изменения, не сохранённые в библиотеку карт. Переключиться и потерять эти правки? Можно сначала нажать «Сохранить в библиотеку».");
}
function makePreviewThumbnail(){
  const canvas=$("cardCanvas"),out=document.createElement("canvas");
  out.width=240;out.height=360;
  const c=out.getContext("2d");
  c.fillStyle="#1b2734";c.fillRect(0,0,240,360);
  c.drawImage(canvas,0,0,240,360);
  return out.toDataURL("image/jpeg",.76);
}
function makeCardLibraryEntry(p,thumbnail=null,stage=null){
  const d=p.cardDefinition;
  const finalStage=STAGE_NAMES[stage]?stage:
    STAGE_NAMES[p.metadata?.workflowStage]?p.metadata.workflowStage:"draft";
  return {cardId:d.cardId,cardType:d.cardType,name:String(d.name||"Без названия"),
    rarityId:d.rarityId??null,updatedAt:new Date().toISOString(),stage:finalStage,
    thumbnail:thumbnail||null,artStatus:p.metadata?.artStatus||"test",artSource:p.metadata?.artSource||"user",project:deepCopy(p)};
}
/* v2.1I — Virtual art pack cards: preinstalled CHR visuals stay separate from
   user IndexedDB records. Never overwrite previously saved card projects.
   All bundled artwork is TEST, regardless of card workflow stage. */
function buildWarlockTestEntry(card){
  const api=window.MW_WARLOCK_ART;
  if(!api?.has(card.cardId)||!window.MW_EDITOR_LAYOUT?.makeNewCard)return null;
  const p=window.MW_EDITOR_LAYOUT.makeNewCard(card.cardType,card.cardId,card.name,"default");
  const fields=["cardId","name","cardType","classId","rarityId","costType","costValue",
    "attack","health","durability","timeAffinityId","creatureTypeId","subtype",
    "ability","schoolId","spellForm"];
  for(const k of fields)if(Object.prototype.hasOwnProperty.call(card,k))p.cardDefinition[k]=card[k];
  p.cardDefinition.keywords=Array.isArray(card.keywords)?[...card.keywords]:
    String(card.keywords||"").split(/[;,]/).map(x=>x.trim()).filter(Boolean);
  const info=api.meta(card.cardId);
  p.metadata={...p.metadata,workflowStage:"draft",artStatus:"test",artSource:info.source,
    artPack:"warlock-v2.1I",artSourceVersion:info.sourceVersion};
  p.assets={...p.assets,customArtData:api.get(card.cardId),
    customArtName:card.cardId+"_art.png · Тестовая версия"};
  const entry=makeCardLibraryEntry(p,api.preview(card.cardId),"draft");
  entry.builtinArt=true;
  entry.artStatus="test";
  entry.artSource=info.source;
  entry.updatedAt="2026-11-09T00:00:00.000Z";
  return entry;
}
function seedWarlockTestCards(){
  const api=window.MW_WARLOCK_ART;
  if(!api)return 0;
  let count=0;
  for(const c of window.MW_CANONICAL_CARDS||[]){
    if(!api.has(c.cardId)||cardLibrary.has(c.cardId))continue;
    const e=buildWarlockTestEntry(c);
    if(e){cardLibrary.set(c.cardId,e);count++;}
  }
  return count;
}
function renderCardsLibrary(){
  const all=[...cardLibrary.values()];
  const grouped=["all","creature","spell","weapon"];
  $("cardCategoryFilters").innerHTML=grouped.map(k=>
    '<button type="button" class="category-chip '+(cardFilter===k?"active":"")+
    '" data-card-filter="'+k+'">'+(k==="all"?"Все":cardTypeName(k))+
    ' <span>'+all.filter(x=>k==="all"||x.cardType===k).length+'</span></button>'
  ).join("");
  const query=cardSearch.trim().toLocaleLowerCase();
  const items=all.filter(x=>(cardFilter==="all"||x.cardType===cardFilter)&&
      (!query||(x.name+" "+x.cardId).toLocaleLowerCase().includes(query)))
    .sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  $("cardLibraryCount").textContent=items.length+" из "+all.length+" сохранённых карт"+
      (db?"":" · память сеанса — сделайте экспорт резервной копии");
  $("cardsGrid").innerHTML=items.map(item=>{
    const current=activeLibraryCardId===item.cardId;
    const name=escapeHTML(item.name),id=escapeHTML(item.cardId),type=escapeHTML(cardTypeName(item.cardType));
    const preview=item.thumbnail?'<img src="'+escapeHTML(item.thumbnail)+'" alt="">':
        '<div class="card-no-thumbnail">✦<small>Превью появится после сохранения</small></div>';
    return '<article class="saved-card '+(current?"current-card":"")+'">'+
       '<button type="button" class="saved-card-preview" data-card-open="'+id+'" title="Открыть карту '+name+'">'+preview+'</button>'+
       '<div class="saved-card-body"><span class="saved-card-type">'+type+'</span>'+
       '<strong title="'+name+'">'+name+'</strong><span class="saved-card-id">'+id+'</span>'+
       '<span class="saved-card-stage">'+escapeHTML(STAGE_NAMES[item.stage]||"Черновик")+'</span>'+
       '<span class="saved-card-stage mw-art-test-badge">Арт · тестовая версия</span>'+
       '<label class="saved-card-selector"><input type="checkbox" data-card-select="'+id+'" '+(selectedCardIds.has(item.cardId)?"checked":"")+' aria-label="Включить '+name+' в пакетную выгрузку"> В пакет</label>'+
       '<div class="saved-card-actions"><button type="button" data-card-open="'+id+'">Открыть</button>'+
       (item.builtinArt?'': '<button type="button" data-card-delete="'+id+'" title="Удалить пользовательскую версию">✕</button>')+
       '</div></div></article>';
  }).join("")||'<div class="card-empty">Здесь пока нет сохранённых карт выбранного типа. Нажмите «＋ Новая карта», создайте карточку и сохраните её в библиотеку.</div>';
  showBatchStatus();
}
async function saveCardToLibrary(){
  const id=String(getData().cardId||"").trim();
  if(!validCardId(id)){toast("Введите корректный ID карты (2–80 символов, без пробелов).");return false;}
  if(!CARD_TYPES[getData().cardType]){toast("Неизвестный тип карты.");return false;}
  if(!db&&!confirm("Постоянное хранилище недоступно. Карта сохранится лишь до закрытия вкладки. Продолжить? Затем обязательно экспортируйте резервную копию."))return false;
  const existing=cardLibrary.get(id);
  if(existing&&activeLibraryCardId!==id&&!confirm('Карта с ID '+id+' уже есть. Заменить её сохранённую версию?'))return false;
  if(!ready){toast("Ресурсы ещё загружаются.");return false;}
  const issues=[];renderCard($("cardCanvas"),issues); // один рендерер для списка, предпросмотра и PNG
  if(issues.length){renderWarnings(issues);toast("Предупреждение: "+issues[0]);}
  const stage=$("cardStageSelect")?.value||"draft";
  if(stage==="approved"&&(issues.length||(!project.assets?.customArtData&&project.assets?.allowDefaultArt===false))){
    toast("Нельзя утвердить карту: есть проблемы с текстом, графикой или отсутствует арт.");
    return false;
  }
  project.metadata.updatedAt=new Date().toISOString();
  project.metadata.workflowStage=stage;
  const entry=makeCardLibraryEntry(project,makePreviewThumbnail(),stage);
  try{if(db)await dbPutCard(entry);}
  catch(e){console.error(e);toast("Не удалось сохранить карту: база недоступна или переполнена.");return false;}
  cardLibrary.set(id,entry);
  activeLibraryCardId=id;libraryWorkingDirty=false;
  if(db){try{await dbPut("last",project);dirty=false;}catch(e){console.warn("Last project save failed",e);}}
  setStatus(db?"Карта сохранена в библиотеке":"Сохранено в памяти сеанса",db?"ok":"error");
  renderCardsLibrary();renderTree();window.dispatchEvent(new Event("mw-card-library-updated"));
  toast('В библиотеке: '+(getData().name||id)+' · '+cardTypeName(getData().cardType)+'.');
  return true;
}
async function activateProject(p,libraryId=null,unsaved=false){
  if(!isCardProject(p))throw new Error("Некорректная карта или тип");
  clearTimeout(autosaveTimer);
  project=deepCopy(p);project.assets=project.assets||{};project.metadata=project.metadata||{};
  Object.keys(imageCache).filter(k=>k.startsWith("custom:")||k.startsWith("library:")).forEach(k=>delete imageCache[k]);
  undoStack=[];redoStack=[];selectedId="art";currentArt=null;collapsed.clear();
  activeLibraryCardId=libraryId;libraryWorkingDirty=unsaved;dirty=false;
  await hydrateEmbeddedLibraryInGlobal();
  handleDerivedIcons();await prepareImages();
  $("cardStageSelect").value=STAGE_NAMES[p.metadata?.workflowStage]?p.metadata.workflowStage:
    STAGE_NAMES[cardLibrary.get(libraryId)?.stage]?cardLibrary.get(libraryId).stage:"draft";
  syncDataFields();syncCropFields();renderTree();renderInspector();render();updateUndoButtons();syncEditorControls();
  updateArtQualityReport();
  setLeftTab("cards");setRightTab("fields");
  setStatus(unsaved?"Проект открыт · не в библиотеке":db?"Карта из библиотеки":"Сеанс без постоянного хранения",unsaved?"busy":db?"ok":"error");
  if(db)try{await dbPut("last",project);}catch(e){console.warn("Cannot save last working project",e);}
}
async function openCardFromLibrary(id){
  const e=cardLibrary.get(id);if(!e)return false;
  if(!canLeaveCurrentCard())return false;
  try{await activateProject(e.project,id,false);toast("Открыта карта: "+e.name);return true;}
  catch(err){console.error(err);toast("Ошибка открытия карты: "+err.message);return false;}
}
/* v2.1M.1 — open canonical entry as a draft without changing the saved library.
   Always retain the editor's protection against discarding unsaved edits. */
async function openCatalogCard(id){
  if(cardLibrary.has(id))return openCardFromLibrary(id);
  const canonical=(window.MW_CANONICAL_CARDS||[]).find(x=>x.cardId===id);
  if(!canonical)return false;
  if(!canLeaveCurrentCard())return false;
  try{
    const p=window.MW_EDITOR_LAYOUT.makeNewCard(
      canonical.cardType,canonical.cardId,canonical.name,"default");
    const fields=["cardId","name","cardType","classId","rarityId","costType",
      "costValue","attack","health","durability","timeAffinityId","creatureTypeId",
      "subtype","ability","keywords","schoolId","spellForm","maxCopies","status"];
    for(const field of fields){
      if(Object.prototype.hasOwnProperty.call(canonical,field))
        p.cardDefinition[field]=canonical[field];
    }
    p.metadata=p.metadata||{};
    p.metadata.workflowStage="draft";
    p.metadata.createdFrom="collection-v2.1M.1-canonical";
    await activateProject(p,null,true);
    toast("Черновик из каталога: "+canonical.cardId+". Чтобы сохранить, нажмите «Сохранить текущую карту».");
    return true;
  }catch(err){console.error(err);toast("Ошибка открытия карты из каталога: "+err.message);return false;}
}
async function deleteCardFromLibrary(id){
  const e=cardLibrary.get(id);if(!e)return;
  if(!confirm('Удалить «'+e.name+'» ('+id+') из библиотеки? Операция не отменяется.'))return;
  try{if(db)await dbDeleteCard(id);}catch(err){toast("Не удалось удалить карту из базы.");return;}
  cardLibrary.delete(id);selectedCardIds.delete(id);
  const canonical=(window.MW_CANONICAL_CARDS||[]).find(c=>c.cardId===id);
  if(canonical&&window.MW_WARLOCK_ART?.has(id)){
    const builtin=buildWarlockTestEntry(canonical);
    if(builtin)cardLibrary.set(id,builtin);
  }
  if(activeLibraryCardId===id){activeLibraryCardId=null;libraryWorkingDirty=true;}
  renderCardsLibrary();toast("Карта удалена из библиотеки. Текущий холст не очищен.");
}
function openNewCardDialog(){
  cardDialogOpen=true;
  $("newCardDialog").classList.remove("hidden");
  $("newCardType").value="creature";
  if($("newCardVariant"))$("newCardVariant").value="integrated";
   if($("newCardTheme"))$("newCardTheme").value="default";
  if($("creatureVariantField"))$("creatureVariantField").hidden=false;
  $("newCardId").value="";
  $("newCardName").value="";
  $("newCardType").focus();
}
function closeNewCardDialog(){cardDialogOpen=false;$("newCardDialog").classList.add("hidden");}
function createLocalDraftId(){
  return "LOCAL-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
}
async function createNewCard(){
  const type=$("newCardType").value, name=$("newCardName").value.trim(),
      requested=$("newCardId").value.trim(), id=requested||createLocalDraftId();
  if(!CARD_TYPES[type]||!validCardId(id)){toast("Укажите допустимый тип и ID (2–80 символов, без пробелов).");return;}
  if(cardLibrary.has(id)){
     toast("ID уже занят в библиотеке. Для изменений откройте существующую карту.");return;
  }
  if(!canLeaveCurrentCard())return;
  const variant=$("newCardVariant")?.value||"integrated";
  const theme=$("newCardTheme")?.value||"default";
  const p=variant==="integrated"
      ?window.MW_EDITOR_LAYOUT.makeNewCard(type,id,name,theme)
      :variant==="figma"&&type==="creature"
         ?window.MW_FIGMA_CREATURE.makeNewCard(id,name)
         :window.MW_TEMPLATES.makeNewCard(type,id,name);
  try{await activateProject(p,null,true);closeNewCardDialog();
      toast("Новая карта: "+cardTypeName(type)+". Заполните поля и сохраните в библиотеку.");}
  catch(e){console.error(e);toast("Ошибка нового шаблона: "+e.message);}
}
function exportCardsLibraryBackup(){
  const cards=[...cardLibrary.values()];
  downloadFile(new Blob([JSON.stringify({format:"mythical-wars-cards-library",
      version:1,createdAt:new Date().toISOString(),cards})],
      {type:"application/json;charset=utf-8"}),"MW_Cards_Library_Backup.json");
  toast("Резервная копия сохранённых карт: "+cards.length+".");
}
async function importCardsLibraryBackup(file){
  if(!file)return;
  if(file.size>300*1024*1024){toast("Резервная копия слишком велика.");return;}
  let backup;
  try{backup=JSON.parse(await file.text());}catch(e){toast("Резервная копия карт повреждена.");return;}
  if(backup?.format!=="mythical-wars-cards-library"||!Array.isArray(backup.cards)||
      backup.cards.length>5000){toast("Неизвестный формат библиотеки карт.");return;}
  let count=0,skipped=0,failed=0;
  for(const item of backup.cards){
     try{
       if(!isCardProject(item?.project)||item.project.cardDefinition.cardId!==item.cardId){failed++;continue;}
       if(cardLibrary.has(item.cardId)){skipped++;continue;} // никогда не перезаписывать существующее
       const entry=makeCardLibraryEntry(item.project,
         typeof item.thumbnail==="string"&&/^data:image\/(png|jpeg|webp);base64,/.test(item.thumbnail)?item.thumbnail:null,
         STAGE_NAMES[item.stage]?item.stage:"draft");
       if(db)await dbPutCard(entry);
       cardLibrary.set(entry.cardId,entry);count++;
     }catch(err){console.warn("Card backup item failed",err);failed++;}
  }
  renderCardsLibrary();
  toast("Карты: добавлено "+count+", пропущено совпадений "+skipped+", ошибок "+failed+".");
}


/* v2.1G: Batch PNG export, versioned CSV exchange and art-quality guidance.
   Pure CSV/ZIP algorithms live in card-workflow-v2.1G.js and have Node tests. */
function showBatchStatus(message=null,kind=""){
  const el=$("cardBatchStatus");if(!el)return;
  el.className="workflow-message"+(kind?" "+kind:"");
  if(message!==null){el.textContent=message;return;}
  const count=[...selectedCardIds].filter(id=>cardLibrary.has(id)).length;
  el.textContent=count?`Отмечено ${count} карт. ZIP и CSV включат только их.`:
    `Выбор пуст: экспортируются все карты библиотеки (${cardLibrary.size}).`;
}
function entriesToExport(){
  const chosen=[...selectedCardIds].filter(id=>cardLibrary.has(id));
  return(chosen.length?chosen:[...cardLibrary.keys()]).map(id=>cardLibrary.get(id))
    .sort((a,b)=>String(a.cardId).localeCompare(String(b.cardId),"ru"));
}
function downloadCardsCSV(){
  const entries=entriesToExport();
  if(!entries.length){toast("Библиотека пуста.");return;}
  downloadFile(new Blob([workflow().toCardsCSV(entries)],{type:"text/csv;charset=utf-8"}),
    "MW_Cards_for_Google_Sheets.csv");
  showBatchStatus(`CSV: ${entries.length} карт. Для импорта обратно сохраните столбцы cardId и updatedAt.`,"success");
}
function csvOfDecks(decks){
  return workflow().encodeCSV([["deckId","name","classId","updatedAt"],
    ...decks.map(d=>[d.deckId,d.name,d.classId,d.updatedAt||""])]);
}
function csvOfDeckCards(decks){
  const rows=[["deckId","cardId","quantity"]];
  for(const deck of decks)for(const [cardId,quantity] of Object.entries(deck.counts||{}))
    if(Number(quantity)>0)rows.push([deck.deckId,cardId,quantity]);
  return workflow().encodeCSV(rows);
}
async function exportSheetsPack(){
  const allCards=[...cardLibrary.values()];
  const decks=window.MW_DECK_SHEET_BRIDGE?.snapshot()||[];
  const guide=`Мифические войны · CSV для Google Sheets\n`+
    `1) Создайте в Google Sheets листы Карты, Колоды, Состав_колод.\n`+
    `2) Импортируйте соответствующий CSV на каждый лист, не меняя заголовки.\n`+
    `3) Для возврата данных используйте раздел ⇅ Google Sheets в редакторе.\n`+
    `4) Не удаляйте cardId, deckId и updatedAt: они нужны для безопасного сопоставления версий.\n`+
    `5) Арты/слои хранятся в локальной библиотеке и JSON, не в CSV.\n`+
    `6) Это ручной обмен CSV, НЕ автоматическая сетевая синхронизация.\n`+
    `7) Не изменяйте канонические 162 карты через этот обмен.\n`;
  try{
    const zip=await workflow().makeZip([
      {name:"Карты.csv",data:workflow().toCardsCSV(allCards)},
      {name:"Колоды.csv",data:csvOfDecks(decks)},
      {name:"Состав_колод.csv",data:csvOfDeckCards(decks)},
      {name:"README_SHEETS.txt",data:guide}
    ]);
    downloadFile(zip,"MW_Google_Sheets_Exchange.zip");
    showBatchStatus(`Подготовлены 3 CSV: ${allCards.length} карт и ${decks.length} колод.`,"success");
  }catch(e){showBatchStatus("Экспорт Sheets: "+e.message,"error");}
}
async function renderSavedPngBlob(entry){
  const old={project,currentArt,imageCache,loadErrors};
  try{
    project=entry.project;
    currentArt=null;loadErrors=[];
    imageCache=Object.fromEntries(Object.entries(old.imageCache)
      .filter(([key])=>!key.startsWith("library:")&&!key.startsWith("custom:")));
    const keys=new Set();
    const walk=layers=>(layers||[]).forEach(n=>{
      if(n.kind==="image"&&n.assetId&&n.visible!==false)keys.add(n.assetId);
      if(n.children)walk(n.children);
    });
    walk(project.cardPresentation.layers);
    await Promise.all([...keys].map(ensureImage));
    await ensureArt();
    const canvas=document.createElement("canvas");canvas.width=CW;canvas.height=CH;
    const issues=[];renderCard(canvas,issues);
    if(issues.length)throw Error(issues[0]);
    if(!project.assets?.customArtData&&project.assets?.allowDefaultArt===false)
      throw Error("Арт не загружен.");
    return await new Promise((resolve,reject)=>canvas.toBlob(
      blob=>blob?resolve(blob):reject(Error("Браузер не создал PNG")),"image/png"));
  }finally{
    project=old.project;currentArt=old.currentArt;imageCache=old.imageCache;loadErrors=old.loadErrors;
  }
}
async function exportCardPngZip(){
  if(cardBatchBusy){toast("Экспорт уже выполняется.");return;}
  const entries=entriesToExport();
  if(!entries.length){toast("В библиотеке нет карт.");return;}
  if(entries.length>100){showBatchStatus("В одном ZIP до 100 карт. Выделите нужные карты флажками.","error");return;}
  cardBatchBusy=true;document.body.classList.add("mw-export-busy");
  const images=[],failures=[];
  try{
    for(let i=0;i<entries.length;i++){
      const e=entries[i];
      showBatchStatus(`Экспорт PNG: ${i+1}/${entries.length} · ${e.cardId}`);
      try{
        const png=await renderSavedPngBlob(e);
        images.push({name:"cards/"+String(e.cardId).replace(/[^\p{L}\p{N}_.-]/gu,"_")+"_1024x1536.png",data:png});
      }catch(err){failures.push(e.cardId+": "+err.message);}
    }
    const list=entries.map(e=>({cardId:e.cardId,name:e.name,stage:e.stage||"draft",
      exported:images.some(f=>f.name.includes("/"+e.cardId+"_")),updatedAt:e.updatedAt}));
    const manifest=JSON.stringify({format:"mythical-wars-png-batch",version:1,
      date:new Date().toISOString(),exported:images.length,errors:failures,cards:list},null,2);
    const zip=await workflow().makeZip([...images,
      {name:"manifest.json",data:manifest},
      {name:"Карты.csv",data:workflow().toCardsCSV(entries)}]);
    await downloadFile(zip,"MW_Cards_"+new Date().toISOString().slice(0,10)+".zip");
    showBatchStatus(`ZIP: ${images.length}/${entries.length} PNG. ${failures.length?
       "Пропущены: "+failures.slice(0,4).join("; "):"Ошибок нет."}`,failures.length?"error":"success");
  }catch(err){console.error(err);showBatchStatus("Ошибка пакетного экспорта: "+err.message,"error");}
  finally{cardBatchBusy=false;document.body.classList.remove("mw-export-busy");render();}
}
function updateArtQualityReport(){
  const el=$("artQualityReport"),api=workflow();
  if(!el||!api)return;
  const type=getData().cardType,mask=window.MW_EDITOR_LAYOUT?.HOLES||{};
  const img=currentArt?.image;
  const fallback=mask[type];
  if(!fallback){el.textContent="Для старого шаблона размеры арта определяются его маской.";return;}
  if(!img){
    el.className="art-quality-report";
    el.textContent=`${cardTypeName(type)}: PNG/JPG/WebP (до 25 МБ). Область ${fallback.w}×${fallback.h} px; рекомендуем ${fallback.w*2}×${fallback.h*2} px.`;
    return;
  }
  const result=api.inspectArt(img.naturalWidth,img.naturalHeight,type,mask);
  el.className="art-quality-report"+(result.warning?" warn":"");
  const label=project.assets?.customArtData?"Загруженный арт":"Стандартный арт";
  el.textContent=`${label} ${img.naturalWidth}×${img.naturalHeight} px. Маска ${fallback.w}×${fallback.h} px;`+
    ` рекомендуемый размер ${result.recommended.width}×${result.recommended.height} px.`+
    (result.warning?" ⚠ "+result.warning:" ✓ Размер достаточный.");
}
function planCardsCsv(){
  const field=$("cardsCsvPreview");
  try{
    const canonical=(window.MW_CANONICAL_CARDS||[]).map(c=>c.cardId);
    cardsCsvPlan=workflow().planCardsImport($("cardsCsvPaste").value,[...cardLibrary.values()],canonical);
    const counts={new:0,update:0,unchanged:0,protected:0,conflict:0,error:0};
    for(const p of cardsCsvPlan)counts[p.kind]=(counts[p.kind]||0)+1;
    field.className="workflow-message";
    field.textContent=`Всего: ${cardsCsvPlan.length}. Новых: ${counts.new}, изменений: ${counts.update},`+
      ` без изменений: ${counts.unchanged}, защищены: ${counts.protected}, конфликты: ${counts.conflict}, ошибки: ${counts.error}.`+
      `\n`+cardsCsvPlan.filter(p=>p.reason).slice(0,9)
         .map(p=>`${p.id||"строка "+p.line}: ${p.reason}`).join("\n");
    $("applyCardsCsvBtn").disabled=!(counts.new+counts.update);
  }catch(e){
    cardsCsvPlan=[];field.className="workflow-message error";field.textContent=e.message;
    $("applyCardsCsvBtn").disabled=true;
  }
}
async function applyCardsCsv(){
  if(!cardsCsvPlan.length||cardBatchBusy)return;
  const selected=cardsCsvPlan.filter(x=>x.kind==="new"||x.kind==="update");
  if(!selected.length)return;
  if(!db&&!confirm("IndexedDB недоступен. Изменения останутся только до закрытия вкладки. Продолжить в памяти сеанса и скачать резервную копию?"))return;
  if(!confirm(`Применить ${selected.length} изменений из CSV? Канонические карты и конфликты будут пропущены. Перед продолжением будет экспортирована резервная копия JSON.`))return;
  exportCardsLibraryBackup();
  const failures=[];let added=0,updated=0;
  cardBatchBusy=true;
  try{
    for(const p of selected){
      try{
        const old=cardLibrary.get(p.id);
        if(old&&activeLibraryCardId===p.id&&libraryWorkingDirty){
          failures.push(p.id+": есть несохранённые правки в редакторе; импорт пропущен.");
          continue;
        }
        const newProject=old?deepCopy(old.project):
          window.MW_EDITOR_LAYOUT.makeNewCard(p.values.cardType,p.id,p.values.name,"default");
        Object.assign(newProject.cardDefinition,p.values);
        newProject.metadata=newProject.metadata||{};
        newProject.metadata.workflowStage=p.stage||"draft";
        const entry=makeCardLibraryEntry(newProject,null,p.stage);
        if(db)await dbPutCard(entry);
        cardLibrary.set(p.id,entry);
        if(old&&activeLibraryCardId===p.id){
          activeLibraryCardId=null;libraryWorkingDirty=true;
          setStatus("Карта обновлена из CSV · откройте её заново","busy");
        }
        if(old)updated++;else added++;
      }catch(e){failures.push(p.id+": "+e.message);}
    }
  }finally{cardBatchBusy=false;}
  cardsCsvPlan=[];$("applyCardsCsvBtn").disabled=true;
  $("cardsCsvPreview").textContent=`Применено: новых ${added}, обновлено ${updated}, ошибок ${failures.length}. `+
    `Для обновлённых карт откройте их и сохраните, чтобы перерисовать миниатюру.`+
    (failures.length?" "+failures.slice(0,3).join("; "):"");
  renderCardsLibrary();
  window.dispatchEvent(new Event("mw-card-library-updated"));
}


let decksCsvPlan=[];
async function planDecksCsv(){
  const a=$("decksCsvInput").files[0],b=$("deckCardsCsvInput").files[0],out=$("decksCsvPreview");
  const api=window.MW_DECK_SHEET_BRIDGE;
  if(!api){out.textContent="Конструктор колод ещё не готов.";return;}
  if(!a||!b){out.textContent="Выберите оба CSV-файла.";return;}
  if(a.size>5*1024*1024||b.size>5*1024*1024){out.textContent="Файл CSV больше 5 МБ.";return;}
  try{
    decksCsvPlan=api.plan(await a.text(),await b.text());
    const counts={new:0,update:0,unchanged:0,protected:0,conflict:0,error:0};
    for(const p of decksCsvPlan)counts[p.kind]=(counts[p.kind]||0)+1;
    const model=window.MW_DECK_IMPORT_ADAPTER?.model,
      catalog=window.MW_DECK_IMPORT_ADAPTER?.catalog();
    let drafts=0;for(const item of decksCsvPlan.filter(x=>["new","update"].includes(x.kind))){
      if(model&&!model.validateDeck(item.deck,catalog).ok)drafts++;
    }
    out.className="workflow-message";
    out.textContent=`Колоды: ${decksCsvPlan.length}. Новые: ${counts.new}, обновления: ${counts.update},`+
      ` без изменений: ${counts.unchanged}, конфликты: ${counts.conflict},`+
      ` защищены: ${counts.protected}, ошибки: ${counts.error}.`+
      (drafts?`\n${drafts} колод содержат ошибки состава и будут сохранены как черновики, не готовые к игре.`:"")+
      "\n"+decksCsvPlan.filter(x=>x.reason).slice(0,8).map(x=>x.id+": "+x.reason).join("\n");
    $("applyDecksCsvBtn").disabled=!(counts.new+counts.update);
  }catch(e){
    decksCsvPlan=[];out.className="workflow-message error";out.textContent=e.message;
    $("applyDecksCsvBtn").disabled=true;
  }
}
async function applyDecksCsv(){
  const plan=decksCsvPlan.filter(x=>["new","update"].includes(x.kind));
  if(!plan.length)return;
  if(!confirm(`Импортировать ${plan.length} колод из CSV? Защищённые колоды и конфликты будут пропущены. Перед импортом скачивается резервная копия.`))return;
  $("deckExportBtn")?.click(); // saved JSON backup, no destructive operation
  try{
    const answer=await window.MW_DECK_SHEET_BRIDGE.apply(decksCsvPlan);
    $("decksCsvPreview").textContent=`Сохранено: новых ${answer.added}, обновлено ${answer.updated}, пропущено ${answer.skipped}.`;
    decksCsvPlan=[];$("applyDecksCsvBtn").disabled=true;
  }catch(e){$("decksCsvPreview").textContent="Ошибка импорта колод: "+e.message;}
}

function wireEvents(){
    $("newCardTopBtn").onclick=openNewCardDialog;
    $("saveCardBtn").onclick=saveCardToLibrary;
    $("newCardBtn").onclick=openNewCardDialog;
    $("saveLibraryCardBtn").onclick=saveCardToLibrary;
    $("cardsGrid").addEventListener("change",e=>{
       const box=e.target.closest("[data-card-select]");
       if(!box)return;
       box.checked?selectedCardIds.add(box.dataset.cardSelect):selectedCardIds.delete(box.dataset.cardSelect);
       showBatchStatus();
    });
    $("cardsGrid").addEventListener("click",e=>{
       const open=e.target.closest("[data-card-open]");
       if(open){openCardFromLibrary(open.dataset.cardOpen);return;}
       const del=e.target.closest("[data-card-delete]");
       if(del){deleteCardFromLibrary(del.dataset.cardDelete);return;}
    });
    $("cardCategoryFilters").addEventListener("click",e=>{
       const b=e.target.closest("[data-card-filter]");
       if(b){cardFilter=b.dataset.cardFilter;renderCardsLibrary();}
    });
    $("cardSearch").addEventListener("input",e=>{cardSearch=e.target.value;renderCardsLibrary();});
    $("cardStageSelect").onchange=e=>{
       project.metadata.workflowStage=e.target.value;
       libraryWorkingDirty=true;markChanged(false);
    };
    $("selectAllCardsBtn").onclick=()=>{selectedCardIds=new Set(cardLibrary.keys());renderCardsLibrary();};
    $("clearSelectedCardsBtn").onclick=()=>{selectedCardIds.clear();renderCardsLibrary();};
    $("exportSelectedPngZipBtn").onclick=exportCardPngZip;
    $("exportCardsCsvBtn").onclick=downloadCardsCSV;
    $("exportSheetsPackBtn").onclick=exportSheetsPack;
    $("pickCardsCsvFileBtn").onclick=()=>$("cardsCsvFile").click();
    $("cardsCsvFile").onchange=async e=>{
      const file=e.target.files[0];e.target.value="";if(!file)return;
      if(file.size>10*1024*1024){toast("CSV больше 10 МБ.");return;}
      $("cardsCsvPaste").value=await file.text();cardsCsvPlan=[];
      $("applyCardsCsvBtn").disabled=true;planCardsCsv();
    };
    $("cardsCsvPaste").addEventListener("input",()=>{
      cardsCsvPlan=[];$("applyCardsCsvBtn").disabled=true;
      $("cardsCsvPreview").textContent="Данные изменены. Нажмите «Предпросмотр».";
    });
    $("planCardsCsvBtn").onclick=planCardsCsv;
    $("applyCardsCsvBtn").onclick=applyCardsCsv;
    $("planDecksCsvBtn").onclick=planDecksCsv;
    $("applyDecksCsvBtn").onclick=applyDecksCsv;
    for(const id of ["decksCsvInput","deckCardsCsvInput"])
      $(id).addEventListener("change",()=>{decksCsvPlan=[];$("applyDecksCsvBtn").disabled=true;});
    $("exportCardsBtn").onclick=exportCardsLibraryBackup;
    $("importCardsBtn").onclick=()=>$("cardsImportFile").click();
    $("cardsImportFile").onchange=async e=>{await importCardsLibraryBackup(e.target.files[0]);e.target.value="";};
    $("closeNewCardBtn").onclick=closeNewCardDialog;
    $("cancelNewCardBtn").onclick=closeNewCardDialog;
    $("createNewCardBtn").onclick=createNewCard;
    $("newCardType").addEventListener("change",()=>{
       const creature=$("newCardType").value==="creature";
       const option=$("newCardVariant").querySelector('option[value="figma"]');
       if(option)option.disabled=!creature;
       if(!creature&&$("newCardVariant").value==="figma")$("newCardVariant").value="integrated";
    });
    $("newCardDialog").addEventListener("click",e=>{if(e.target===$("newCardDialog"))closeNewCardDialog();});
    $("openProjectBtn").onclick=()=>$("projectFile").click();
    $("saveProjectBtn").onclick=exportProject;
    $("exportPngBtn").onclick=exportPNG;
    $("undoBtn").onclick=undo;$("redoBtn").onclick=redo;
    $("projectFile").onchange=async e=>{await loadProjectFile(e.target.files[0]);e.target.value="";};
    $("loadArtBtn").onclick=()=>$("artFile").click();
    $("artFile").onchange=async e=>{await loadArtFile(e.target.files[0]);e.target.value="";};
    $("layerFile").onchange=async e=>{await loadLayerImage(e.target.files[0]);e.target.value="";};
    $("resetBtn").onclick=async ()=>{
      if(!canLeaveCurrentCard())return;
      await activateProject(window.MW_STARTER,null,true);
      toast("Открыта исходная карта KNZ-002. Для добавления в каталог нажмите «В библиотеку».");
    };
    document.querySelectorAll("[data-right-tab]").forEach(b=>b.onclick=()=>setRightTab(b.dataset.rightTab));
    document.querySelectorAll("[data-left-tab]").forEach(b=>b.onclick=()=>setLeftTab(b.dataset.leftTab));
    $("frameThemeSelect").onchange=e=>setEditorTheme(e.target.value);
    $("openNewPresetBtn").onclick=openNewCardDialog;
    $("exportPanelPng").onclick=exportPNG;$("exportPanelJson").onclick=exportProject;
    $("selectTitleLayerBtn").onclick=()=>{setSelected("cardName");setRightTab("properties");setLeftTab("layers");};
    $("selectDescriptionLayerBtn").onclick=()=>{setSelected("abilityText");setRightTab("properties");setLeftTab("layers");};
    $("openFigmaLayerTree").onclick=()=>{setRightTab("properties");setLeftTab("layers");};
    document.querySelectorAll("[data-layout-control]").forEach(el=>{
      el.addEventListener("change",()=>setLayoutOption(el.dataset.layoutControl,
        el.type==="checkbox"?el.checked:el.value));
      if(el.type==="range")el.addEventListener("input",()=>{
        const key=el.dataset.layoutControl;
        if(key==="descriptionHeight")$("descHeightValue").textContent=el.value+" px";
        if(key==="descriptionLineHeight")$("descLineHeightValue").textContent=Number(el.value).toFixed(2);
      });
    });
    document.querySelectorAll("[data-decor-toggle]").forEach(el=>el.onchange=()=>{
      const node=nodeById(el.dataset.decorToggle).node;
      if(!node)return;captureUndo();node.visible=el.checked;render();renderTree();
      markChanged(false);syncEditorControls();
    });
    document.querySelectorAll("[data-field]").forEach(el=>{
       el.addEventListener("change",()=>updateData(el.dataset.field,el.value));
       if(el.tagName==="TEXTAREA" || (el.type==="text"&&el.dataset.field!=="cardId"))
           el.addEventListener("input",()=>updateData(el.dataset.field,el.value));
    });
    $("cropZoom").onchange=e=>adjustCrop("zoom",safeNum(e.target.value,1));
    $("cropZoom").oninput=e=>{const l=getArtNode();l.zoom=safeNum(e.target.value,1);$("cropZoomValue").textContent=Math.round(l.zoom*100)+"%";render();};
    $("cropX").onchange=e=>adjustCrop("offsetX",safeNum(e.target.value));
    $("cropY").onchange=e=>adjustCrop("offsetY",safeNum(e.target.value));
    $("resetCropBtn").onclick=()=>{captureUndo();const l=getArtNode();Object.assign(l,{zoom:1,offsetX:0,offsetY:0});syncCropFields();render();markChanged(false);};
    $("layerTree").addEventListener("click",e=>{
        const toggle=e.target.closest("[data-toggle]");
        if(toggle){const id=toggle.dataset.toggle;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderTree();e.stopPropagation();return;}
        const vis=e.target.closest("[data-visibility]");
        if(vis){const l=nodeById(vis.dataset.visibility).node;if(l){captureUndo();l.visible=!l.visible;renderTree();render();markChanged(false);}return;}
        const lock=e.target.closest("[data-lock]");
        if(lock){const l=nodeById(lock.dataset.lock).node;if(l){captureUndo();l.locked=!l.locked;renderTree();markChanged(false);}return;}
        const row=e.target.closest("[data-select]");if(row)setSelected(row.dataset.select);
    });
    $("assetsGrid").addEventListener("click",async e=>{
        const add=e.target.closest("[data-asset-add]");
        if(add){lastAssetRef=add.dataset.assetAdd;showNewLayerDialog(lastAssetRef);return;}
        const replace=e.target.closest("[data-asset-replace]");
        if(replace){lastAssetRef=replace.dataset.assetReplace;await assignAssetToSelected(lastAssetRef);return;}
        const remove=e.target.closest("[data-asset-delete]");
        if(remove){await deleteLibraryAsset(remove.dataset.assetDelete);return;}
    });
    $("assetsGrid").addEventListener("change",async e=>{
        const select=e.target.closest("[data-asset-category]");
        if(select)await changeAssetCategory(select.dataset.assetCategory,select.value);
    });
    $("assetCategoryFilters").addEventListener("click",e=>{
        const b=e.target.closest("[data-category-filter]");
        if(b){assetCategoryFilter=b.dataset.categoryFilter;buildAssetsGrid();}
    });
    $("assetSearch").addEventListener("input",e=>{assetSearchFilter=e.target.value;buildAssetsGrid();});
    $("importAssetsBtn").onclick=()=>$("assetImportFile").click();
    $("assetImportFile").onchange=async e=>{
        const category=layerDialogOpen && ASSET_CATEGORIES[$("newLayerCategory").value]
            ? $("newLayerCategory").value : $("uploadCategory").value;
        const list=await importAssetFiles(e.target.files,category);
        if(layerDialogOpen&&list.length){
            $("newLayerCategory").value="all";
            refreshNewLayerAssetOptions("library:"+list[0].id);
            $("newLayerName").value=list[0].name;
        }
        e.target.value="";
    };
    $("assetDropzone").addEventListener("dragover",e=>{
        e.preventDefault();e.currentTarget.classList.add("drag-over");
    });
    $("assetDropzone").addEventListener("dragleave",e=>e.currentTarget.classList.remove("drag-over"));
    $("assetDropzone").addEventListener("drop",async e=>{
        e.preventDefault();e.currentTarget.classList.remove("drag-over");
        await importAssetFiles(e.dataTransfer?.files,$("uploadCategory").value);
    });
    $("assetDropzone").addEventListener("keydown",e=>{
        if(e.key==="Enter"||e.key===" "){e.preventDefault();$("assetImportFile").click();}
    });
    $("exportLibraryBtn").onclick=exportLibraryBackup;
    $("importLibraryBtn").onclick=()=>$("libraryImportFile").click();
    $("libraryImportFile").onchange=async e=>{
        await importLibraryBackup(e.target.files[0]);e.target.value="";
    };
    $("newLayerBtn").onclick=()=>showNewLayerDialog(lastAssetRef);
    $("closeNewLayerBtn").onclick=closeNewLayerDialog;
    $("cancelNewLayerBtn").onclick=closeNewLayerDialog;
    $("newLayerDialog").addEventListener("click",e=>{
        if(e.target===$("newLayerDialog"))closeNewLayerDialog();
    });
    $("newLayerAsset").addEventListener("change",e=>{
        lastAssetRef=e.target.value;
        $("newLayerName").value=assetEntryByRef(lastAssetRef)?.name||"";
        updateNewLayerPreview();
    });
    $("newLayerCategory").addEventListener("change",()=>refreshNewLayerAssetOptions());
    $("newLayerImportBtn").onclick=()=>$("assetImportFile").click();
    $("createNewLayerBtn").onclick=createNewLayerFromDialog;
    $("layerInspector").addEventListener("change",e=>{
       const el=e.target;
       const {node}=nodeById(selectedId);if(!node)return;
       if(el.dataset.prop){
          const key=el.dataset.prop;
          let value=el.value;
          if(!["color","align","name"].includes(key))value=safeNum(value);
          if(key==="name")value=String(value).trim().slice(0,120)||"Новый слой";
          if(key==="opacityPercent"){value=clamp(value,0,100)/100;}
          const prop=key==="opacityPercent"?"opacity":key;
          if(node[prop]===value)return;
          if((prop==="w"||prop==="h")&&node.kind!=="group"){
              captureUndo();setLayerDimension(node,prop,value);
          }else{
              captureUndo();node[prop]=value;
              if(prop==="fontSize")node[prop]=clamp(value,6,240);
          }
          if(node.id==="abilityText"&&prop==="h")adaptDescriptionPanelForHeight(node.h);
          render();renderInspector();renderTree();markChanged(false);
          if(node.kind==="art")syncCropFields();
          if(node.id==="abilityText"||node.id==="cardName")syncEditorControls();
       }
       if(el.dataset.check){
          captureUndo();node[el.dataset.check]=el.checked;render();renderTree();markChanged(false);
       }
    });
    $("layerInspector").addEventListener("click",e=>{
       if(e.target.id==="replaceLayerButton")$("layerFile").click();
       if(e.target.id==="moveLayerUp")moveLayer(1);
       if(e.target.id==="moveLayerDown")moveLayer(-1);
       if(e.target.id==="deleteUserLayerBtn")deleteSelectedUserLayer();
    });
    $("collapseAllBtn").onclick=()=>{
       if(collapsed.size)collapsed.clear();else project.cardPresentation.layers.forEach(g=>collapsed.add(g.id));
       renderTree();
    };
    $("overlayCanvas").addEventListener("pointerdown",onPointerDown);
    $("overlayCanvas").addEventListener("pointermove",onPointerMove);
    $("overlayCanvas").addEventListener("pointerup",onPointerUp);
    $("overlayCanvas").addEventListener("pointercancel",onPointerUp);
    $("overlayCanvas").addEventListener("pointerleave",()=>{
        if(!dragging)$("overlayCanvas").style.cursor="grab";
    });
    $("guidesSwitch").onchange=drawOverlay;
    $("zoomOutBtn").onclick=()=>zoomTo(zoom-0.08);
    $("zoomInBtn").onclick=()=>zoomTo(zoom+0.08);
    $("fitBtn").onclick=fitViewport;
    $("shortcutsBtn").onclick=()=>setShortcutsDialog(true);
    $("closeShortcutsBtn").onclick=()=>setShortcutsDialog(false);
    $("shortcutsDialog").onclick=e=>{if(e.target===$("shortcutsDialog"))setShortcutsDialog(false);};
    document.addEventListener("keydown",handleEditorShortcut);
    window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
    window.addEventListener("resize",()=>{if(!zoomManual)fitViewport();});
}
async function init(){
   wireEvents();updateUndoButtons();
   setStatus("Загрузка ресурсов…","busy");
   try{
      db=await openDB();
      const entries=await dbGetAllLibrary();
      entries.forEach(x=>userLibrary.set(x.id,x));
      const savedCards=await dbGetAllCards();
      savedCards.filter(x=>isCardProject(x.project)).forEach(x=>cardLibrary.set(x.cardId,x));
      const alreadySeeded=await dbGet("cardsInitialized");
      if(!alreadySeeded){
         if(!cardLibrary.has("KNZ-002")){
            const entry=makeCardLibraryEntry(window.MW_STARTER,null);
            await dbPutCard(entry);cardLibrary.set("KNZ-002",entry);
         }
         await dbPut("cardsInitialized",true);
      }
      const last=await dbGet("last");
      if(last&&isCardProject(last)){project=last;}
   }catch(e){console.warn("IndexedDB unavailable",e);db=null;}
   seedWarlockTestCards();
   project.assets=project.assets||{};
   activeLibraryCardId=cardLibrary.has(project.cardDefinition.cardId)?project.cardDefinition.cardId:null;
   libraryWorkingDirty=activeLibraryCardId?
       JSON.stringify(cardLibrary.get(activeLibraryCardId).project)!==JSON.stringify(project):false;
   await hydrateEmbeddedLibraryInGlobal();
   handleDerivedIcons();
   await prepareImages();
   ready=true;fitViewport();syncDataFields();syncCropFields();renderTree();renderInspector();render();renderCardsLibrary();syncEditorControls();
   window.dispatchEvent(new Event("mw-card-library-updated"));
   $("cardStageSelect").value=STAGE_NAMES[project.metadata?.workflowStage]?project.metadata.workflowStage:
     STAGE_NAMES[cardLibrary.get(activeLibraryCardId)?.stage]?cardLibrary.get(activeLibraryCardId).stage:"draft";
   updateArtQualityReport();
   setStatus(db?"Локальная библиотека готова":"Хранилище недоступно · экспортируйте резервные копии",db?"ok":"error");
   window.MW_EDITOR_READY=true;
}
window.MW_CARD_BRIDGE={
  getSavedCards:()=>[...cardLibrary.values()].map(({cardId,name,cardType,rarityId,thumbnail,project,artStatus})=>({
    cardId,name,cardType,rarityId,thumbnail,
    artImage:project?.assets?.customArtData||window.MW_WARLOCK_ART?.get(cardId)||null,
    artStatus:artStatus||project?.metadata?.artStatus||"test",
    project,definition:deepCopy(project?.cardDefinition||{})})),
  openCard:openCardFromLibrary,
  openCatalogCard,
  hasCard:id=>cardLibrary.has(id),
  currentCard:()=>deepCopy(project.cardDefinition)
};
window.MW_EDITOR_TEST={
   getState:()=>deepCopy(project),
   getWarnings:()=>[...textWarnings],
   renderDataUrl:()=>{const x=[];renderCard($("cardCanvas"),x);return{x,dataUrl:$("cardCanvas").toDataURL("image/png")};},
   exportPng:exportPNG, saveProject:exportProject, setData:updateData, setSelected, reset:()=>$("resetBtn").click(),
   getLayer:id=>deepCopy(nodeById(id).node),
   listAssets:()=>allAssetEntries().map(x=>({id:x.id,ref:x.ref,name:x.name,category:x.category,builtIn:x.builtIn})),
   addLayer:addAssetAsNewLayer, assignAsset:assignAssetToSelected,
   deleteAsset:deleteLibraryAsset, importAssets:importAssetFiles,
   exportLibrary:exportLibraryBackup,
   setLayerDimension:(id,dim,value)=>{const n=nodeById(id).node;if(!n)return false;captureUndo();const changed=setLayerDimension(n,dim,value);render();renderInspector();markChanged(false);return changed;},
   getHandles:()=>{const b=getSelectionBox();return b?handlesForBox(b.rect,b.angle):null;},
   resizeRect:resizedBox, duplicate:duplicateSelectedImage,
   keydown:handleEditorShortcut,
    listCards:()=>[...cardLibrary.values()].map(x=>({id:x.cardId,name:x.name,type:x.cardType,
       builtInTest:!!x.builtinArt,artStatus:x.artStatus||x.project?.metadata?.artStatus||"test"})),
    warlockArtReport:()=>({count:window.MW_WARLOCK_ART?.count()||0,
       available:[...cardLibrary.values()].filter(x=>window.MW_WARLOCK_ART?.has(x.cardId)).length,
       fromPack:[...cardLibrary.values()].filter(x=>x.builtinArt).length}),
    makeCard:async(type,id,name)=>{const p=window.MW_TEMPLATES.makeNewCard(type,id,name);await activateProject(p,null,true);},
    makeFigmaCreature:async(id,name)=>{const p=window.MW_FIGMA_CREATURE.makeNewCard(id,name);await activateProject(p,null,true);},
    makeIntegratedCard:async(type,id,name,theme="default")=>{const p=window.MW_EDITOR_LAYOUT.makeNewCard(type,id,name,theme);await activateProject(p,null,true);},
    setEditorTheme,setLayoutOption,setRightTab,
    saveCard:saveCardToLibrary,openCard:openCardFromLibrary,deleteCard:deleteCardFromLibrary,
    backupCards:exportCardsLibraryBackup, restoreCards:importCardsLibraryBackup,
    getActiveCard:()=>activeLibraryCardId,
    csvPlan:txt=>workflow().planCardsImport(txt,[...cardLibrary.values()],
      (window.MW_CANONICAL_CARDS||[]).map(x=>x.cardId)),
    exportPngZip:exportCardPngZip,exportSheetsPack,
    selectedCards:()=>[...selectedCardIds],
    setSelectedCards:ids=>{selectedCardIds=new Set(ids);renderCardsLibrary();},
    getCardEntries:()=>[...cardLibrary.values()].map(x=>({id:x.cardId,stage:x.stage,updatedAt:x.updatedAt})),
    artReport:updateArtQualityReport
};
init().catch(e=>{console.error(e);setStatus("Ошибка запуска","error");toast("Редактор не запущен: "+e.message);});
})();
