/* «Мифические войны» — v05 dynamic compositor core, stage 2.
 * Pure functions for validation/layout. Authoritative geometry comes only from
 * production/editor_manifest.json (the embedded copy is generated from it).
 * This module does not modify card data, combat, decks or local storage.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.MW_V05_CORE=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const W=1024,H=1536;
const TYPES=["Creature","Weapon","Spell"];
const EMPTY=new Set(["", "—", "–", "-"]);
const numberFields=["cost","attack","health","durability","armor"];
const validKey=(v,look)=>v==null||v===""||Object.prototype.hasOwnProperty.call(look,v);
function maybe(v){return v==null||(typeof v==="string"&&EMPTY.has(v.trim()))?null:v}
function copyData(data){return JSON.parse(JSON.stringify(data))}
function issue(severity,code,message){return {severity,code,message}}
function validateCard(card,manifest,{hasArt=false}={}){
  const result=[];const bad=(code,msg)=>result.push(issue("error",code,msg));
  const warn=(code,msg)=>result.push(issue("warning",code,msg));
  if(!card||typeof card!=="object"||Array.isArray(card)){bad("card","Нет объекта карты");return result}
  if(typeof card.id!=="string"||!card.id.trim())bad("id","ID обязателен");
  if(typeof card.name!=="string"||!card.name.trim())bad("name","Название обязательно");
  if(!TYPES.includes(card.type)){bad("type","Неизвестный тип карты: "+String(card.type));return result}
  const type=card.type;
  if(!Object.prototype.hasOwnProperty.call(manifest.class_palettes,card.class_key))bad("class","Класс не найден в палитрах v05");
  if(!validKey(maybe(card.rarity_key),manifest.lookups.rarity_crystal))bad("rarity","Неизвестная редкость");
  for(const key of numberFields){
    const val=maybe(card[key]);
    if(val!=null&&(!Number.isSafeInteger(val)||val<0))bad("number-"+key,"Недопустимое целое неотрицательное число: "+key);
    if(val!=null&&val>99)bad("number-overflow-"+key,"Число "+key+" превышает поддержку двух цифр v05");
  }
  const required=type==="Creature"?["cost","attack","health"]:type==="Weapon"?["cost","attack","durability"]:["cost"];
  required.forEach(field=>{if(maybe(card[field])==null)bad("required-"+field,"Для "+type+" требуется "+field)});
  if(!validKey(maybe(card.race_icon_key),manifest.lookups.race_symbol))bad("race","Неизвестный значок вида существа");
  if(!validKey(maybe(card.time_key),manifest.lookups.time_art))bad("time","Неизвестный значок времени");
  if(!validKey(maybe(card.subtype_icon_key),manifest.lookups.subtype_symbol))bad("subtype","Неизвестный значок подтипа");
  // Stage 3: imported metadata must not silently render a different approved badge.
  if(card.type==="Creature"&&maybe(card.time)!=null&&maybe(card.time_key)==null)
    bad("time-icon-pending","Для значения времени «"+card.time+"» нет утверждённого значка v05");
  if(card.type==="Creature"&&maybe(card.race)!=null&&maybe(card.race_icon_key)==null)
    bad("race-icon-pending","Для принадлежности «"+card.race+"» нет утверждённого значка v05");
  if(maybe(card.resource)!=null&&!["Мана","Mana","mana"].includes(card.resource))
    bad("resource-icon-pending","Для ресурса «"+card.resource+"» нет утверждённого значка v05; нельзя показывать иконку маны");
  if(typeof card.id==="string"&&card.id.startsWith("TKN-"))
    bad("token-template-pending","Для токенов нет утверждённого отдельного шаблона v05: доступен только предпросмотр");
  if(type==="Creature"){
    if(maybe(card.subtype)!=null&&maybe(card.subtype_icon_key)==null)bad("missing-subtype-symbol","У подтипа нет утверждённого изображения");
  }else{
    if(maybe(card.subtype)!=null||maybe(card.subtype_icon_key)!=null){
      bad("subtype-layout-pending","Размещение подтипа у оружия и заклинаний не утверждено; финальный экспорт заблокирован");
    }
  }
  if(type!=="Creature"&&(maybe(card.race_icon_key)!=null||maybe(card.time_key)!=null))warn("not-applicable-badges","Значки вида/времени у этого типа не отображаются");
  if(typeof card.description!=="string")bad("description","Описание должно быть строкой");
  if(!hasArt)bad("art-missing","Для финального экспорта требуется иллюстрация");
  return result
}
function imagePlacement(srcW,srcH,viewport,crop){
  if(!Number.isFinite(srcW)||!Number.isFinite(srcH)||srcW<=0||srcH<=0)throw Error("Неверный размер изображения");
  const [x1,y1,x2,y2]=viewport,vw=x2-x1,vh=y2-y1;
  if(vw<=0||vh<=0)throw Error("Неверный viewport в манифесте");
  const zoom=Number(crop&&crop.zoom)||1;
  if(zoom<1||zoom>4)throw Error("Масштаб должен быть от 1 до 4");
  const cx=Number.isFinite(crop&&crop.x)?Math.min(1,Math.max(0,crop.x)):0.48;
  const cy=Number.isFinite(crop&&crop.y)?Math.min(1,Math.max(0,crop.y)):0.4;
  const sc=Math.max(vw/srcW,vh/srcH)*zoom;
  const rw=srcW*sc,rh=srcH*sc;
  return {dx:x1-(rw-vw)*cx,dy:y1-(rh-vh)*cy,dw:rw,dh:rh,
    viewport:viewport.slice(),x:cx,y:cy,zoom}
}
function componentVisible(name,card,manifest){
  const t=card.type,has=f=>maybe(card[f])!=null;
  switch(name){
    case "mana":return has("cost");
    case "class_badge":return t==="Creature"&&card.class_key!=="Neutral"&&!!manifest.lookups.class_symbol[card.class_key];
    case "subtype_badge":return t==="Creature"&&!!manifest.lookups.subtype_symbol[card.subtype_icon_key];
    case "race_badge":return t==="Creature"&&!!manifest.lookups.race_symbol[card.race_icon_key];
    case "time_badge":return t==="Creature"&&!!manifest.lookups.time_art[card.time_key];
    case "rarity":return !!manifest.lookups.rarity_crystal[card.rarity_key];
    case "rarity_side_decor":return t==="Weapon"||t==="Spell";
    case "creature_attack":return t==="Creature"&&has("attack");
    case "weapon_attack":return t==="Weapon"&&has("attack");
    case "health":return t==="Creature"&&has("health");
    case "durability":return t==="Weapon"&&has("durability");
    case "armor":return t==="Creature"&&has("armor");
    case "header_divider":case "lower_divider":return true;
    default:return false;
  }
}
function componentLayers(name,card,manifest){
  const c=manifest.components[name];if(!c)return [];
  const lookups={
    class_symbol:manifest.lookups.class_symbol[card.class_key],
    subtype_symbol:manifest.lookups.subtype_symbol[card.subtype_icon_key],
    subtype_background:manifest.lookups.subtype_background[card.subtype_icon_key],
    race_symbol:manifest.lookups.race_symbol[card.race_icon_key],
    time_art:manifest.lookups.time_art[card.time_key],
    rarity_crystal:manifest.lookups.rarity_crystal[card.rarity_key]
  };
  return c.layers_bottom_to_top.map(name=>lookups[name]||name).filter(name=>!!manifest.assets[name])
}
function drawPlan(card,manifest){
  const t=manifest.templates[card.type];
  if(!t)throw Error("Неизвестный тип шаблона");
  const layers=[];
  for(const key of t.base_layers_bottom_to_top){
    layers.push({kind:"asset",key,fullCanvas:true,tint:key.endsWith("_Color")});
    if(key===t.insert_art_after_layer)layers.push({kind:"art",mask:t.art_mask,viewport:t.art_viewport})
  }
  for(const component of manifest.component_draw_order){
    if(component==="dynamic_text")continue;
    if(!componentVisible(component,card,manifest))continue;
    const def=manifest.components[component];
    const slotName=def.slot_by_type?def.slot_by_type[card.type]:def.slot;
    const slot=manifest.slots[slotName];
    if(!slot)throw Error("Неизвестный слот "+slotName+" для "+component);
    for(const key of componentLayers(component,card,manifest)){
      layers.push({kind:"asset",key,component,slot,fullCanvas:false,tint:false})
    }
  }
  layers.push({kind:"dynamic_text"});
  return layers
}
function wrapText(ctx,raw,width){
  if(typeof raw!=="string"||raw==="")return [];
  const lines=[];
  for(const paragraph of raw.replace(/\r\n/g,"\n").split("\n")){
    if(paragraph===""){lines.push("");continue}
    const parts=paragraph.trim().split(/\s+/u);let line="";
    for(const word of parts){
      const next=line?line+" "+word:word;
      if(ctx.measureText(next).width<=width){line=next;continue}
      if(line){lines.push(line);line=word}else{lines.push(word);line=""}
    }
    if(line)lines.push(line);
  }
  return lines
}
function chooseTextLayout(ctx,text,{fontName,maxPx,minPx,maxWidth,maxHeight,lineRatio=1.18,maxLines=Infinity}){
  const isOne=maxLines===1;let fallback=null;
  for(let px=maxPx;px>=minPx;px--){
    ctx.font=`${fontName==="MW-DejaVu-Bold"?"bold ":fontName==="MW-DejaVu-Italic"?"italic ":""}${px}px "DejaVu Serif", Georgia, serif`;
    const lines=isOne?[text]:wrapText(ctx,text,maxWidth);
    const height=lines.length*px*lineRatio;
    const tooWide=lines.some(s=>ctx.measureText(s).width>maxWidth+0.1);
    const result={px,lines,height,overflow:tooWide||lines.length>maxLines||height>maxHeight};
    if(!result.overflow)return result;
    fallback=result;
  }
  return fallback||{px:minPx,lines:[],height:0,overflow:false}
}
function analyzeText(card,manifest,ctx){
  const errors=[],type=card.type;
  const regions=manifest.text_regions;
  const title=regions.title;
  const ti=chooseTextLayout(ctx,card.name||"",{fontName:"MW-DejaVu-Bold",maxPx:48,minPx:30,maxWidth:title[2]-title[0],maxHeight:title[3]-title[1],maxLines:1});
  if(ti.overflow)errors.push(issue("error","title-overflow","Название не помещается в одну строку (30–48 px)"));
  const r=regions.description_by_type[type];
  const body=chooseTextLayout(ctx,card.description||"",{fontName:"MW-DejaVu-Regular",maxPx:42,minPx:32,
    maxWidth:Math.min(manifest.text_anchors.description_wrap_width,r[2]-r[0]),
    maxHeight:r[3]-r[1],lineRatio:1.18});
  if(body.overflow)errors.push(issue("error","description-overflow","Описание не помещается; автоматическое сокращение запрещено"));
  let flavor=null;
  if(typeof card.flavor_text==="string"&&card.flavor_text.trim()){
    const fr=regions.flavor;
    flavor=chooseTextLayout(ctx,card.flavor_text,{fontName:"MW-DejaVu-Italic",maxPx:26,minPx:24,
      maxWidth:fr[2]-fr[0],maxHeight:fr[3]-fr[1],lineRatio:1.08,maxLines:2});
    if(flavor.overflow)errors.push(issue("error","flavor-overflow","Литературный текст не помещается в две строки"));
  }
  return {title:ti,description:body,flavor,issues:errors}
}
return {W,H,TYPES,maybe,copyData,validateCard,imagePlacement,componentVisible,componentLayers,drawPlan,wrapText,chooseTextLayout,analyzeText};
});
