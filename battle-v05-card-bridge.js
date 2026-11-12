/* Mythical Wars v05.10 RC: single non-authoritative presentation adapter.
 * Same 1024x1536 layered v05 manifest as the editor, for 2D / mulligan / 3D.
 * No edits to combat rules, game card data, production assets or approved manifest.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.MW_V05_BATTLE_CARD=api;
})(typeof window!=="undefined"?window:globalThis,function(root){
"use strict";
const MAX_IMAGES=165,MAX_FACES=92, WIDTH=1024,HEIGHT=1536;
const images=new Map(),faces=new Map(),profiles=new Map();
const stats={drawn:0,failed:0,hit:0};
const CLASS={"Воин":"Warrior","Чернокнижник":"Warlock","Некромант":"Necromancer",
 "Чародей":"Wizard","Ведун":"Seer","Заклинатель":"Conjurer","Разбойник":"Rogue",
 "Нейтральная":"Neutral","Нейтральные":"Neutral"};
const RARITY={common:"Common",standard:"Green",rare:"Blue",epic:"Purple",legendary:"Gold"};
const TYPE={creature:"Creature",spell:"Spell",weapon:"Weapon"};
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const read=x=>String(x??"");
const maybe=x=>x===undefined||x===null||x===""?null:x;
const validArt=s=>typeof s==="string"&&(
 /^test-art\/[A-Z]{3}-\d{3}\.webp$/.test(s)||
 /^v05\/[A-Z]{3}-\d{3}\/[A-Z]{3}-\d{3}_art_source\.png$/.test(s)||
 /^data:image\/(?:png|jpeg|webp);base64,[\w+/=]+$/i.test(s)||
 /^blob:https?:\/\//i.test(s)||
 /^assets\/[\w.-]+\.(?:png|jpg|jpeg|webp)$/.test(s)
)?s:"";
let sourceCards=null;
function sourceMap(){
 if(sourceCards)return sourceCards;
 const lib=root.MW_V05_LIBRARY_CORE,seed=root.MW_V05_LIBRARY_SEED,m=root.MW_V05_MANIFEST;
 if(!lib||!seed||!m)return null;
 try{const snapshot=lib.normalizeSeed(seed,m);
   sourceCards=new Map([...snapshot.cards,...snapshot.tokens].map(c=>[c.id,lib.toV05Card(c)]));
   return sourceCards;
 }catch(err){console.warn("MW v05 battle data normalization:",err);return null;}
}
function toV05(def,cost){
 if(!def)return null;
 const m=root.MW_V05_MANIFEST;
 if(!m)return null;
 const seed=sourceMap()?.get(def.cardId)||{};
 const type=TYPE[def.cardType]||seed.type;
 if(!["Creature","Spell","Weapon"].includes(type))return null;
 const classKey=CLASS[def.classId]||seed.class_key||"Neutral";
 const rarity=RARITY[def.rarityId]||seed.rarity_key||null;
 const num=(a,b)=>maybe(a)!==null&&Number.isFinite(Number(a))?Number(a):b;
 return {
  ...seed,id:def.cardId,name:read(def.name||seed.name||def.cardId),type,class_key:m.class_palettes[classKey]?classKey:"Neutral",
  rarity_key:rarity,cost:num(cost,num(def.costValue,seed.cost)),
  attack:num(def.attack,seed.attack??null),health:num(def.health,seed.health??null),
  durability:num(def.durability,seed.durability??null),armor:num(def.armor,seed.armor??null),
  description:read(def.ability!==undefined?def.ability:seed.description),
  flavor_text:seed.flavor_text??null,
  subtype:read(def.subtype||seed.subtype),
  race:read(def.creatureTypeId||seed.race),time:read(def.timeAffinityId||seed.time),
  resource:def.costType==="corpses"?"Трупы":seed.resource||"Мана"
 };
}
function profileFor(id){
 if(!profiles.has(id)){
  const getter=root.MW_V05_ART_STORE?.read;
  profiles.set(id,getter?getter(id).catch(()=>null):Promise.resolve(null));
 }
 return profiles.get(id);
}
function image(url){
 if(!url)return Promise.resolve(null);
 if(images.has(url))return images.get(url);
 const p=new Promise((resolve,reject)=>{
  const img=new Image();img.decoding="async";
  img.onload=()=>img.naturalWidth&&img.naturalHeight?resolve(img):reject(Error("Пустое изображение: "+url));
  img.onerror=()=>reject(Error("Нет файла изображения: "+url));img.src=url;
 });
 images.set(url,p);
 if(images.size>MAX_IMAGES)images.delete(images.keys().next().value);
 return p;
}
function asset(key){
 const file=root.MW_V05_MANIFEST?.assets?.[key]?.path;
 if(!file)return Promise.reject(Error("Отсутствует слой "+key));
 return image("v05/"+file);
}
function tint(pic,key,cls){
 const palette=root.MW_V05_MANIFEST.class_palettes[cls]||root.MW_V05_MANIFEST.class_palettes.Neutral;
 const c=document.createElement("canvas");c.width=pic.naturalWidth;c.height=pic.naturalHeight;
 const g=c.getContext("2d");g.drawImage(pic,0,0);g.globalCompositeOperation="source-in";
 g.fillStyle=`rgb(${palette[1].join(",")})`;g.fillRect(0,0,c.width,c.height);
 g.globalCompositeOperation="source-over";return c;
}
function contain(ctx,pic,slot){
 const [x,y,w,h]=slot,s=Math.min(w/pic.width,h/pic.height);
 const dw=pic.width*s,dh=pic.height*s;
 ctx.drawImage(pic,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
let fontPromise;
function fonts(){
 if(fontPromise)return fontPromise;
 fontPromise=(async()=>{
  if(!root.FontFace||!document.fonts)return;
  try{
   const regular=new FontFace("MWv05Text",'url("v05/production/fonts/DejaVuSerif.ttf")');
   const bold=new FontFace("MWv05Text",'url("v05/production/fonts/DejaVuSerif-Bold.ttf")',{weight:"700"});
   const loaded=await Promise.all([regular.load(),bold.load()]);loaded.forEach(f=>document.fonts.add(f));
  }catch(err){console.warn("MW v05 card font fallback:",err);}
 })();return fontPromise;
}
function inkCenteredNumber(ctx,text,bind,manifest){
 const [baseX,baseY]=bind.center;
 // Match attack, health, and weapon durability in one visual plane.
 // The approved numeric values and source icon assets are unchanged.
 const bottom=["attack","health","durability"].includes(bind.field);
 const px=bottom?(read(text).length>1?88:102):(read(text).length>1?bind.two_digit_font_px:bind.font_px);
 const y=bottom?1400:baseY;
 ctx.save();ctx.textAlign="center";ctx.textBaseline="alphabetic";
 ctx.font=`700 ${px}px "MWv05Text", "DejaVu Serif", Georgia, serif`;
 const metrics=ctx.measureText(text);
 const ascent=metrics.actualBoundingBoxAscent||px*.72;
 const descent=metrics.actualBoundingBoxDescent||px*.09;
 const baseline=y+(ascent-descent)/2;
 const left=Number.isFinite(metrics.actualBoundingBoxLeft)?metrics.actualBoundingBoxLeft:metrics.width/2;
 const right=Number.isFinite(metrics.actualBoundingBoxRight)?metrics.actualBoundingBoxRight:metrics.width/2;
 const x=baseX+(left-right)/2;
 ctx.fillStyle=manifest.text_rules.numbers.fill;
 ctx.strokeStyle=manifest.text_rules.numbers.outline;
 ctx.lineWidth=manifest.text_rules.numbers.outline_px*2;
 ctx.lineJoin="round";ctx.strokeText(text,x,baseline);ctx.fillText(text,x,baseline);
 ctx.restore();
}
function inkCenteredTitle(ctx,card,model,m){
 // Light lettering with a dark outline on every class-colored ribbon.
 ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.fillStyle="#ffdf9c";ctx.strokeStyle="#351920";ctx.lineJoin="round";
 ctx.lineWidth=3.5;ctx.font=`700 ${model.title.px}px "MWv05Text", "DejaVu Serif", Georgia, serif`;
 const [x,y]=m.text_anchors.title;
 const arc=root.MW_V05_CARD_POLISH;
 if(arc?.drawCurvedTitle)
   arc.drawCurvedTitle(ctx,card.name,[x,y],m.text_regions.title[2]-m.text_regions.title[0]);
 else{
   ctx.strokeText(card.name,x,y,m.text_regions.title[2]-m.text_regions.title[0]);
   ctx.fillText(card.name,x,y,m.text_regions.title[2]-m.text_regions.title[0]);
 }
 ctx.restore();
}
function drawLabels(ctx,card,m,core){
 const model=core.analyzeText(card,m,ctx);
 inkCenteredTitle(ctx,card,model,m);
 ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#2b2119";
 const lines=model.description.lines;
 const step=model.description.px*1.18;
 const [cx,cy]=m.text_anchors.description_center_by_type[card.type];
 const top=cy-(lines.length-1)*step/2;
 ctx.font=`${model.description.px}px "MWv05Text", "DejaVu Serif", Georgia, serif`;
 lines.forEach((txt,i)=>ctx.fillText(txt,cx,top+i*step,m.text_anchors.description_wrap_width));
 if(model.flavor){
  ctx.font=`italic ${model.flavor.px}px "DejaVu Serif", Georgia, serif`;
  model.flavor.lines.forEach((t,i)=>ctx.fillText(t,m.text_anchors.flavor_first_line_center[0],
      m.text_anchors.flavor_first_line_center[1]+i*m.text_anchors.flavor_line_step));
 }
 ctx.restore();
 for(const bind of m.number_bindings){
  if(bind.types.includes(card.type)&&Number.isSafeInteger(card[bind.field])&&card[bind.field]>=0){
   inkCenteredNumber(ctx,String(card[bind.field]),bind,m);
  }
 }
}
async function drawArt(ctx,part,artUrl,crop,missing){
 const m=root.MW_V05_MANIFEST;
 const mask=await image(`v05/runtime/${part.mask}_alpha.png`);
 if(!mask)throw Error("Нет маски арта: "+part.mask);
 const buffer=document.createElement("canvas");buffer.width=WIDTH;buffer.height=HEIGHT;
 const g=buffer.getContext("2d");g.imageSmoothingQuality="high";
 if(artUrl){
  const img=await image(artUrl);
  const d=root.MW_V05_CORE.imagePlacement(img.width,img.height,part.viewport,crop);
  g.drawImage(img,d.dx,d.dy,d.dw,d.dh);
 }else{
  // Explicit unavailable-art state, never reuses another card's illustration.
  const [x,y,w,h]=part.viewport;
  const gradient=g.createLinearGradient(x,y,x+w,y+h);
  gradient.addColorStop(0,"#34434a");gradient.addColorStop(1,"#1d242a");
  g.fillStyle=gradient;g.fillRect(x,y,w,h);
  g.textAlign="center";g.textBaseline="middle";g.fillStyle="#d6c09c";
  g.font='700 36px "MWv05Text", Georgia,serif';
  g.fillText("АРТ В РАЗРАБОТКЕ",x+w/2,y+h/2,w*.91);
 }
 g.globalCompositeOperation="destination-in";
 g.drawImage(mask,0,0);g.globalCompositeOperation="source-over";
 ctx.drawImage(buffer,0,0);
}
async function render(card,view="full",opt={}){
 const manifest=root.MW_V05_MANIFEST,core=root.MW_V05_CORE;
 if(!manifest||!core||!document?.createElement)return "";
 const c=toV05(card,opt.cost);
 if(!c)return "";
 const saved=await profileFor(c.id);
 const override=validArt(card.artImage)||validArt(root.MW_CARD_BRIDGE?.getSavedCards?.()?.find(e=>e.cardId===c.id)?.project?.assets?.customArtData);
 const artSource=override||(saved?.blob?URL.createObjectURL(saved.blob):"" )||validArt(root.MW_TEST_ART_CATALOG?.url(c.id));
 const crop=saved?.crop||(!override ? root.MW_READY_ART?.cropFor(c.id) : null)||{x:.48,y:.4,zoom:1};
 if(view==="boardPortrait"){
  // Only 2D boards request the separate portrait; hand and 3D stay unchanged.
  if(!root.MW14_BOARD_PORTRAIT)throw Error("MW14 portrait module missing");
  try{
   const [photo,rim]=await Promise.all([
    artSource?image(artSource):Promise.resolve(null),
    asset("Creature_Inner_Art_Frame").catch(()=>null)
   ]);
   return root.MW14_BOARD_PORTRAIT.render(document,photo,crop,rim).toDataURL("image/png");
  }finally{if(artSource.startsWith("blob:"))URL.revokeObjectURL(artSource);}
 }
 await fonts();
 const plan=core.drawPlan(c,manifest);
 const fileKeys=[...new Set(plan.filter(p=>p.kind==="asset").map(p=>p.key))];
 // Preload in parallel; lazy per-ID art, layers and mask remain local to the GitHub archive.
 await Promise.all([...fileKeys.map(asset),...plan.filter(p=>p.kind==="art").map(p=>image("v05/runtime/"+p.mask+"_alpha.png")),
   ...(artSource?[image(artSource)]:[])]);
 const canvas=document.createElement("canvas");canvas.width=WIDTH;canvas.height=HEIGHT;
 const ctx=canvas.getContext("2d",{alpha:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 const tinted=new Map();
 for(const part of plan){
  if(part.kind==="asset"){
   const pic=await asset(part.key);
   let item=pic;
   if(part.tint){
    if(!tinted.has(part.key))tinted.set(part.key,tint(pic,part.key,c.class_key));
    item=tinted.get(part.key);
   }
   if(part.fullCanvas)ctx.drawImage(item,0,0);
   else contain(ctx,item,part.slot);
  }else if(part.kind==="art"){
   await drawArt(ctx,part,artSource,crop,!artSource);
  }
 }
 drawLabels(ctx,c,manifest,core);
 const small=document.createElement("canvas");
 if(view==="compact"){
  small.width=256;small.height=304;
  const g=small.getContext("2d");g.fillStyle="#171f25";g.fillRect(0,0,256,304);
  const width=304*WIDTH/HEIGHT;
  g.drawImage(canvas,(256-width)/2,0,width,304);
 }else{
  small.width=512;small.height=768;
  small.getContext("2d").drawImage(canvas,0,0,512,768);
 }
 if(artSource.startsWith("blob:"))URL.revokeObjectURL(artSource);
 return small.toDataURL("image/png");
}
function safeCardFallback(card,view){
 try{
  const c=document.createElement("canvas");
  c.width=view==="compact"?256:512;c.height=view==="compact"?304:768;
  const g=c.getContext("2d");const w=c.width,h=c.height;
  g.fillStyle="#1a252c";g.fillRect(0,0,w,h);
  g.strokeStyle="#cb9f55";g.lineWidth=7;g.strokeRect(8,8,w-16,h-16);
  g.fillStyle="#4b2630";g.fillRect(13,Math.round(h*.46),w-26,Math.round(h*.12));
  g.textAlign="center";g.fillStyle="#ffe0a2";g.font=`700 ${Math.max(16,Math.round(w*.055))}px Georgia,serif`;
  const name=read(card.name||card.cardId);
  g.fillText(name,w/2,Math.round(h*.53),w-26);
  g.font=`${Math.max(13,Math.round(w*.031))}px Georgia,serif`;
  g.fillText(read(card.cardId)+" · арт временно недоступен",w/2,Math.round(h*.73),w-22);
  return c.toDataURL("image/png");
 }catch(_){return "";}
}
function request(card,view="full",opt={}){
 if(!card?.cardId)return Promise.resolve("");
 const key=[card.cardId,view,opt.cost??"",card.name,card.ability,card.attack,card.health,card.durability,card.costValue,card.artImage?.length||0].join("|");
 if(faces.has(key)){stats.hit++;return faces.get(key);}
 const promise=render(card,view,opt).then(data=>{if(data)stats.drawn++;return data;}).catch(e=>{
  stats.failed++;console.warn("MW v05 battle card fallback:",card.cardId,e);
  if(view==="boardPortrait"&&root.MW14_BOARD_PORTRAIT)
   return root.MW14_BOARD_PORTRAIT.render(document,null,null,null).toDataURL("image/png");
  return safeCardFallback(card,view);
 });
 faces.set(key,promise);
 if(faces.size>MAX_FACES)faces.delete(faces.keys().next().value);
 return promise;
}
function clear(){faces.clear();profiles.clear();}
return Object.freeze({toV05,request,clear,stats:()=>({...stats,cached:faces.size}),inkCenteredNumber});
});
