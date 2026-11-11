/* Mythical Wars 2.1C — offline, hybrid approved-template card renderer.
 * Source of truth: saved card-project layers / MW_STARTER / MW_TEMPLATES; gameplay state is
 * never mutated by presentation. Canvas contains static artwork, text and decoration;
 * battlefield attack/health/status remain live DOM overlays. No external requests.
 */
(function(global){
"use strict";
const SCHEMA_W=1024,SCHEMA_H=1536;
const MAX_ENTRIES=72;
const imagePromises=new Map(),facePromises=new Map();
let savedCache=null;
const counters={drawn:0,cacheHit:0,failed:0};
let lastGame=null,lastPlayMarker=null,showTimer=0;
const clone=x=>JSON.parse(JSON.stringify(x));
const sane=v=>String(v??"");
const cleanImg=s=>typeof s==="string"&&(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(s)||
 /^assets\/[A-Za-z0-9_.-]+\.(?:png|jpeg|webp)$/i.test(s)||
 /^test-art\/[A-Z]{3}-\d{3}\.webp$/.test(s)||
 /^v05\/[A-Z]{3}-\d{3}\/[A-Z]{3}-\d{3}_art_source\.png$/.test(s))?s:"";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function getSavedById(){
 if(savedCache)return savedCache;
 const entries=global.MW_CARD_BRIDGE?.getSavedCards?.()||[];
 savedCache=new Map(entries.filter(e=>e?.cardId&&e.project).map(e=>[e.cardId,e]));
 return savedCache;
}
function makeProject(c,saved){
 if(saved?.project?.cardPresentation?.layers && saved.project.cardDefinition?.cardType===c.cardType){
   return clone(saved.project);
 }
 if(c.cardType==="creature"){
   if(!global.MW_STARTER)return null;
   const p=clone(global.MW_STARTER);
   const art=p.cardPresentation.layers.flatMap(x=>x.children||[]).find(x=>x.id==="art");
   if(art){art.zoom=1;art.offsetX=0;art.offsetY=0;art.maskShape="oval";}
   p.assets={customArtData:null,allowDefaultArt:false,embeddedLibrary:{}};
   return p;
 }
 if(!global.MW_TEMPLATES?.makeNewCard)return null;
 return global.MW_TEMPLATES.makeNewCard(c.cardType,c.cardId,c.name||"");
}
function extractContext(c,costOverride){
 const saved=getSavedById().get(c.cardId);
 const p=makeProject(c,saved);
 if(!p)return null;
 const d=p.cardDefinition;
 for(const key of ["cardId","name","cardType","classId","rarityId","costValue","attack","health",
                   "durability","subtype","ability","flavor","schoolId","timeAffinityId","creatureTypeId"]){
   if(Object.prototype.hasOwnProperty.call(c,key)) d[key]=c[key];
 }
 if(Number.isFinite(Number(costOverride))&&costOverride!==null&&costOverride!=="")d.costValue=Number(costOverride);
 // Only a saved card's image or the approved KNZ-002 example is used. No invented art.
 // Bundled CHR test art is a fallback even if an IndexedDB entry is old, blank,
 // or the card-library bridge was queried before its asynchronous initialization.
 // Explicit user artwork always wins.
 let art=cleanImg(c.artImage)||cleanImg(p.assets?.customArtData)||
   cleanImg(global.MW_TEST_ART_CATALOG?.url(c.cardId))||
   cleanImg(global.MW_WARLOCK_ART?.get(c.cardId))||
   (c.cardId==="KNZ-002" ? cleanImg(global.MW_IMAGE_DATA?.defaultArt)||"assets/art_malady_druzhynnik.png":"");
 if(!art && c.cardId==="KNZ-002" && p.assets?.allowDefaultArt!==false)
   art=cleanImg(global.MW_IMAGE_DATA?.defaultArt);
 return {project:p,definition:d,art};
}
function revision(c,view,extra,art){
 const projectDate=sane(c.updatedAt||c.source||"");
 const a=sane(art);
 return [sane(c.cardId),sane(c.cardType),view,sane(extra),sane(c.name),
         sane(c.rarityId),sane(c.costValue),sane(c.attack),sane(c.health),sane(c.durability),
         sane(c.ability),sane(c.subtype),projectDate,a.length,a.slice(0,48),a.slice(-36)].join("|");
}
function assetSource(id,p){
 const assets=p?.assets||{};
 if(id?.startsWith("library:"))return cleanImg(assets.embeddedLibrary?.[id.slice(8)]?.dataUrl);
 if(id?.startsWith("custom:"))return cleanImg(assets.customImages?.[id.slice(7)]);
 return cleanImg(global.MW_IMAGE_DATA?.[id])||cleanImg(global.MW_ASSETS?.[id])||"";
}
function load(src){
 if(!src)return Promise.resolve(null);
 if(imagePromises.has(src))return imagePromises.get(src);
 const promise=new Promise(resolve=>{
   const image=new Image();
   image.onload=()=>resolve(image);
   image.onerror=()=>resolve(null);
   image.src=src;
 });
 imagePromises.set(src,promise);
 if(imagePromises.size>120){
   const oldest=imagePromises.keys().next().value;
   imagePromises.delete(oldest);
 }
 return promise;
}
function roundedRect(ctx,x,y,w,h,r){
 ctx.beginPath();
 if(typeof ctx.roundRect==="function")ctx.roundRect(x,y,w,h,Math.max(0,r));
 else ctx.rect(x,y,w,h);
}
function lineBreaks(ctx,string,maxWidth){
 const lines=[];
 for(const paragraph of sane(string).split(/\r?\n/)){
  if(!paragraph){lines.push("");continue;}
  let current="";
  for(const word of paragraph.split(/\s+/)){
   const next=current?current+" "+word:word;
   if(ctx.measureText(next).width<=maxWidth||!current)current=next;
   else {lines.push(current);current=word;}
  }
  if(current)lines.push(current);
 }
 return lines;
}
function drawText(ctx,node,value){
 if(value===null||value===undefined||value==="")return;
 const w=Math.max(1,num(node.w,100)),h=Math.max(1,num(node.h,60));
 const maxSize=clamp(num(node.fontSize,40),12,180);
 const minSize=clamp(num(node.minFontSize,14),12,maxSize);
 const family=node.fontFamily||"Georgia, serif";
 const weight=node.fontWeight==="bold"?"700 ":"400 ";
 const italic=node.fontStyle==="italic"?"italic ":"";
 const factor=clamp(num(node.lineHeight,1.15),.85,1.85);
 function layout(size){
  ctx.font=italic+weight+size+"px "+family;
  const lines=lineBreaks(ctx,value,w-18);
  return {lines,size,step:size*factor,
    fits:lines.length*size*factor<=h-10&&lines.every(x=>ctx.measureText(x).width<=w-12)};
 }
 let best=layout(minSize),low=minSize,high=maxSize;
 if(best.fits){
  // Largest non-clipped font that fills the available description space.
  for(let k=0;k<18;k++){
   const mid=(low+high)/2,test=layout(mid);
   if(test.fits){best=test;low=mid;}else high=mid;
  }
 }else best=layout(minSize);
 const {lines,step}=best;
 ctx.font=italic+weight+best.size+"px "+family;
 ctx.fillStyle=node.color||"#fff4d8";
 ctx.strokeStyle=node.stroke||"#2c1a15";
 ctx.lineWidth=Math.min(9,Math.max(2,best.size*.083));
 ctx.textAlign=node.align==="left"?"left":node.align==="right"?"right":"center";
 ctx.textBaseline="middle";
 const x=node.align==="left"?8:node.align==="right"?w-8:w/2;
 const y0=(h-lines.length*step)/2+step/2;
 ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
 lines.forEach((row,i)=>{
  const y=y0+i*step;
  if(node.stroke)ctx.strokeText(row,x,y,w-12);
  ctx.fillText(row,x,y,w-12);
 });
 ctx.restore();
}
function artClip(ctx,node){
 const w=num(node.w,100),h=num(node.h,100);
 ctx.beginPath();
 if(node.maskShape==="circle"){
  ctx.arc(w/2,h/2,Math.min(w,h)/2,0,Math.PI*2);
 }else if(node.maskShape==="rectangle"){
  roundedRect(ctx,0,0,w,h,clamp(num(node.maskRadius),0,Math.min(w,h)/2));
 }else{
  ctx.ellipse(w/2,h/2,w/2,h/2,0,0,2*Math.PI);
 }
 ctx.clip();
}
function drawArt(ctx,image,node,fit="editor"){
 const w=num(node.w,100),h=num(node.h,100);
 ctx.save();artClip(ctx,node);
 if(image){
  const factor=(fit==="contain"?Math.min:Math.max)(w/image.naturalWidth,h/image.naturalHeight)*
       (fit==="editor"?Math.max(.2,num(node.zoom,1)):1);
  const iw=image.naturalWidth*factor,ih=image.naturalHeight*factor;
  ctx.drawImage(image,(w-iw)/2+(fit==="editor"?num(node.offsetX):0),
    (h-ih)/2+(fit==="editor"?num(node.offsetY):0),iw,ih);
 }else{
  ctx.fillStyle="#252a31";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#bca17d";ctx.textAlign="center";ctx.font="30px Georgia,serif";
  ctx.fillText("АРТ НЕ ЗАГРУЖЕН",w/2,h/2,Math.max(30,w-12));
 }
 ctx.restore();
}
function assetName(node,d){
 if(node.id==="rarityGem")return "rarity"+({standard:"Standard",rare:"Rare",epic:"Epic",legendary:"Legendary",common:"Common"}[d.rarityId]||"Common");
 if(node.id==="timeSymbol")return d.timeAffinityId==="Ноч"?"nightMedallion":"dayMedallion";
 if(node.id==="classSwords"&&d.classId!=="Воин")return "";
 if(node.id==="classBanner"&&d.classId!=="Воин")return "";
 if(node.id==="factionHeraldry"&&d.classId!=="Воин")return "";
 if(node.id==="typeSymbol"&&d.creatureTypeId!=="Чалавек")return "";
 return node.assetId;
}
function visible(node,d){
 if(node.visible===false)return false;
 if(node.id==="slot-7"&&!sane(d.subtype).trim())return false;
 if(node.id==="slot-13"&&d.rarityId!=="legendary")return false;
 if(node.id==="flavorDivider"&&!sane(d.flavor).trim())return false;
 return true;
}
function visit(node,fn){
 fn(node);for(const child of node.children||[])visit(child,fn);
}
async function renderFull(ctxObj){
 const {project:p,definition:d,art}=ctxObj;
 const keys=new Set();
 for(const node of p.cardPresentation.layers)visit(node,n=>{
  if(n.kind==="image"&&visible(n,d)){
    const name=assetName(n,d);
    if(name)keys.add(name);
  }
 });
 const imgs=new Map();
 await Promise.all([...keys].map(async key=>imgs.set(key,await load(assetSource(key,p)))));
 const imgArt=await load(art);
 const canvas=document.createElement("canvas");
 canvas.width=320;canvas.height=480;
 const ctx=canvas.getContext("2d",{alpha:true});
 ctx.scale(canvas.width/SCHEMA_W,canvas.height/SCHEMA_H);
 function paint(node){
  if(!visible(node,d))return;
  ctx.save();
  ctx.translate(num(node.x),num(node.y));
  if(node.rotation){
   ctx.translate(num(node.w)/2,num(node.h)/2);
   ctx.rotate(num(node.rotation)*Math.PI/180);
   ctx.translate(-num(node.w)/2,-num(node.h)/2);
  }
  ctx.globalAlpha*=clamp(num(node.opacity,1),0,1);
  if(node.kind==="group"){
   (node.children||[]).forEach(paint);
  }else if(node.kind==="image"){
   const name=assetName(node,d),image=imgs.get(name);
   if(image)ctx.drawImage(image,0,0,num(node.w),num(node.h));
  }else if(node.kind==="art")drawArt(ctx,imgArt,node,"editor");
  else if(node.kind==="text"){
   const value=d[node.binding];
   drawText(ctx,node,value);
  }
  ctx.restore();
 }
 for(const node of p.cardPresentation.layers)paint(node);
 return canvas.toDataURL("image/png");
}
async function renderCompact(ctxObj,fit){
 const d=ctxObj.definition;
 const [art,rim,plaque,frame]=await Promise.all([
  load(ctxObj.art),load(assetSource("ovalRim",ctxObj.project)),
  load(assetSource("titlePlaque",ctxObj.project)),
  load(assetSource("frame",ctxObj.project))
 ]);
 const can=document.createElement("canvas");can.width=256;can.height=304;
 const ctx=can.getContext("2d");
 const grad=ctx.createLinearGradient(0,0,256,304);
 grad.addColorStop(0,"#614932");grad.addColorStop(.45,"#273039");grad.addColorStop(1,"#15212b");
 ctx.fillStyle=grad;ctx.fillRect(0,0,256,304);
 ctx.save();ctx.translate(16,12);
 drawArt(ctx,art,{w:223,h:222,maskShape:"oval",offsetX:0,offsetY:0,zoom:1},fit||"contain");
 ctx.restore();
 // Shift artwork from local clipping frame to its display location.
 // The artClip above starts at (0,0); present within a bordered motif.
 ctx.save();
 ctx.beginPath();ctx.rect(0,0,256,244);ctx.clip();
 if(rim)ctx.drawImage(rim,7,4,242,246);
 else if(frame)ctx.drawImage(frame,10,4,238,286);
 ctx.restore();
 if(plaque)ctx.drawImage(plaque,2,215,252,85);
 ctx.fillStyle="#f6e1bb";ctx.strokeStyle="#21140b";ctx.lineWidth=3.5;
 ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="700 22px Georgia,serif";
 const nm=sane(d.name).toLocaleUpperCase();
 const rows=lineBreaks(ctx,nm,222).slice(0,2);
 rows.forEach((row,i)=>{
  const y=244+(i-(rows.length-1)/2)*23;
  ctx.strokeText(row,128,y,228);ctx.fillText(row,128,y,228);
 });
 // No baked attack/health here: active battlefield values are separate overlays.
 return can.toDataURL("image/png");
}
async function renderWeapon(ctxObj){
 const art=await load(ctxObj.art),base=await load(assetSource("weaponBase",ctxObj.project));
 const can=document.createElement("canvas");can.width=256;can.height=256;
 const ctx=can.getContext("2d");
 ctx.fillStyle="#26303d";ctx.beginPath();ctx.arc(128,128,116,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.translate(21,17);
 drawArt(ctx,art,{w:214,h:214,maskShape:"circle",zoom:1},"contain");
 ctx.restore();
 if(base)ctx.drawImage(base,0,0,1024,940,1,0,254,254);
 return can.toDataURL("image/png");
}
function request(card,view,options={}){
 // One visual source of truth for game / initial hand / 3D / editor.
 // Legacy hybrid is retained only as a guarded technical fallback.
 if(global.MW_V05_BATTLE_CARD?.request){
   return global.MW_V05_BATTLE_CARD.request(card,view,options).then(url=>
     url||requestLegacy(card,view,options));
 }
 return requestLegacy(card,view,options);
}
function requestLegacy(card,view,options={}){
 if(!card||!["creature","spell","weapon"].includes(card.cardType))return Promise.resolve("");
 const ctxObj=extractContext(card,options.cost);
 if(!ctxObj)return Promise.resolve("");
 const layoutSig=(ctxObj.project?.cardPresentation?.layers||[]).map(x=>[
   x.id,x.visible,x.rotation,(x.children||[]).map(c=>[c.id,c.x,c.y,c.w,c.h,c.assetId,c.zoom,c.offsetX,c.offsetY,c.visible].join(":")).join(";")
 ]).join("|");
 const key=revision(ctxObj.definition,view,options.fit||"editor",ctxObj.art)+"|"+layoutSig;
 if(facePromises.has(key)){counters.cacheHit++;return facePromises.get(key);}
 const result=(view==="compact"?renderCompact(ctxObj,options.fit):view==="weapon"?renderWeapon(ctxObj):renderFull(ctxObj))
  .then(data=>{counters.drawn++;return data;}).catch(err=>{
   counters.failed++;console.warn("MW hybrid card render:",err);return "";
  });
 facePromises.set(key,result);
 if(facePromises.size>MAX_ENTRIES){const first=facePromises.keys().next().value;facePromises.delete(first);}
 return result;
}
function addFace(node,source,view,params){
 if(!node||node.dataset.mwRenderPending==="1")return;
 node.dataset.mwRenderPending="1";
 const renderToken=String((Number(node.dataset.mwRenderToken)||0)+1);
 node.dataset.mwRenderToken=renderToken;
 request(source,view,params).then(url=>{
  if(!url||!node.isConnected||node.dataset.mwRenderToken!==renderToken)return;
  let image=node.querySelector(":scope > .mw-template-face");
  if(!image){image=document.createElement("img");image.className="mw-template-face";
   image.alt="";image.draggable=false;image.decoding="async";node.append(image);}
  image.src=url;
  node.classList.toggle("mw-hybrid-hand",view==="full");
  node.classList.toggle("mw-hybrid-minion",view==="compact");
  node.classList.add("mw-hybrid-ready");
 }).catch(err=>{console.warn("MW battle face:",err);}).finally(()=>{
   // Failed promises or a detached DOM node must never permanently lock hydration.
   if(node.dataset.mwRenderToken===renderToken)node.dataset.mwRenderPending="0";
 });
}
function hydrate(game,root=document){
 if(!game)return;
 const saved=getSavedById();
 root.querySelectorAll(".battle-card[data-mw-template-type]").forEach(node=>{
  const type=node.dataset.mwTemplateType;
  if(!["creature","spell","weapon"].includes(type))return;
  const id=node.dataset.mwCardId,card=game.cards?.[id];
  if(!card)return;
  const kind=node.classList.contains("minion")?"compact":"full";
  const cost=node.dataset.mwCost;
  const artFit=global.document.getElementById("battleWorkspace")?.dataset.artFit||"contain";
  addFace(node,card,kind,{cost:kind==="full"?cost:null,fit:kind==="compact"?artFit:"editor"});
 });
 for(let o=0;o<2;o++)hydrateWeapon(game,o);
 observePlay(game);
}
function hydrateWeapon(game,o){
 const container=global.document.getElementById(o===0?"myEquippedWeapon":"botEquippedWeapon");
 if(!container)return;
 const weapon=game.players?.[o]?.weapon;
 if(!weapon){
  container.hidden=true;container.replaceChildren();container.dataset.weaponId="";return;
 }
 const source=game.cards?.[weapon.cardId];
 container.hidden=false;
 const identity=sane(weapon.cardId);
 if(container.dataset.weaponId!==identity){
  container.dataset.weaponId=identity;
  container.replaceChildren();
  const img=document.createElement("img");img.className="mw-weapon-icon";
  img.alt="";img.draggable=false;container.append(img);
  // v05.11: the equipment slot shows the illustration, not a miniature printed card.
  // extractContext retains the same custom-art > embedded-art precedence as battle faces.
  const art=source?cleanImg(extractContext(source,null)?.art):"";
  if(art)img.src=art;
  else if(source)request(source,"weapon").then(url=>{if(container.dataset.weaponId===identity&&url)img.src=url;});
 }
 let badge=container.querySelector(".mw-weapon-values");
 if(!badge){badge=document.createElement("span");badge.className="mw-weapon-values";container.append(badge);}
 badge.textContent="⚔ "+sane(weapon.attack)+" · "+sane(weapon.durability)+" ◈";
 container.title=sane(source?.name||weapon.name)+" · оружие "+weapon.attack+"/"+weapon.durability;
 container.setAttribute("aria-label",container.title);
}
function hydrateInspect(game,owner,kind,uid){
 const node=document.getElementById("battleInspectTemplate");if(!node||!game)return;
 const item=kind==="hand"?game.players[owner].hand.find(x=>x.uid===uid):
                           game.players[owner].board.find(x=>x.uid===uid);
 const card=item&&game.cards?.[item.cardId];
 node.replaceChildren();
 if(!card||!["creature","spell","weapon"].includes(card.cardType)){
  if(item?.cardId==="__coin__"){
   node.hidden=false;
   const face=document.createElement("div");face.className="mw-inspect-coin";
   const emblem=document.createElement("span");emblem.textContent="1";
   const caption=document.createElement("strong");caption.textContent="МОНЕТКА";
   const effect=document.createElement("small");effect.textContent="+1 мана на этот ход";
   face.append(emblem,caption,effect);node.append(face);
  }else{node.hidden=true;}
  return;
 }
 node.hidden=false;
 const img=document.createElement("img");img.alt="Полная карта";img.draggable=false;
 node.append(img);
 request(card,"full",{cost:kind==="hand"&&owner===0?item?.cost??card.costValue:null}).then(url=>{
   if(node.contains(img)&&url)img.src=url;
 });
}
function observePlay(game){
 const entries=game?.events||[];
 const lastIdx=entries.findLastIndex?.(e=>e?.kind==="play"&&game.cards?.[e.cardId]?.cardType==="spell")??-1;
 const e=lastIdx>=0?entries[lastIdx]:null;
 const marker=e?String(lastIdx)+"|"+e.cardId+"|"+sane(e.text||e.message||""):"";
 if(lastGame!==game){lastGame=game;lastPlayMarker=marker;return;}
 if(!marker||marker===lastPlayMarker)return;
 lastPlayMarker=marker;
 const panel=document.getElementById("battleSpellReveal");
 if(!panel)return;
 const card=game.cards[e.cardId];
 panel.replaceChildren();
 const name=document.createElement("strong");name.textContent=card.name||e.cardId;panel.append(name);
 panel.hidden=false;
 request(card,"full").then(url=>{
   if(!panel.isConnected||panel.hidden||!url)return;
   const img=document.createElement("img");img.src=url;img.alt="";
   panel.prepend(img);
 });
 panel.classList.remove("mw-flash-play");void panel.offsetWidth;panel.classList.add("mw-flash-play");
 clearTimeout(showTimer);showTimer=setTimeout(()=>{panel.hidden=true;panel.replaceChildren();},1100);
}
function clear(){
 facePromises.clear();
 savedCache=null;
 // Keep built-in artwork decoding cached; a user-made project image is keyed by its source URL.
}
global.MW_BATTLE_CARD_RENDERER={request,hydrate,hydrateInspect,clear,stats:()=>({...counters,cacheSize:facePromises.size})};
})(window);
