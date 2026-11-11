/* Mythical Wars v05.12 — non-destructive visual template layer model.
 * Saved layouts are browser-local editor drafts; the approved v05 manifest stays immutable.
 */
(function(root, factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.MW_V05_TEMPLATE_CORE=api;
})(typeof window!=='undefined'?window:null,function(){
"use strict";
const VERSION=1;
const TYPES=['Creature','Weapon','Spell'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
const copy=v=>JSON.parse(JSON.stringify(v));
const boxFromArray=a=>({x:a[0],y:a[1],w:a[2]-a[0],h:a[3]-a[1]});
const center=box=>[box.x+box.w/2,box.y+box.h/2];
const nameFor={mana:'Мана',class_badge:'Класс',subtype_badge:'Подтип',race_badge:'Раса',time_badge:'Время',rarity:'Редкость',rarity_side_decor:'Декор редкости',creature_attack:'Атака существа',weapon_attack:'Атака оружия',health:'Здоровье',durability:'Прочность',armor:'Броня',header_divider:'Разделитель заголовка',lower_divider:'Разделитель описания'};
const numberFor={cost:'Стоимость',attack:'Атака',health:'Здоровье',durability:'Прочность',armor:'Броня'};
function descriptors(plan,card,manifest){
  const entries=[];
  for(const part of plan){
    if(part.kind==='asset' && part.component){
      const prev=entries[entries.length-1];
      if(prev && prev.id==='component:'+part.component){prev.parts.push(part);continue}
      const box={x:part.slot[0],y:part.slot[1],w:part.slot[2],h:part.slot[3]};
      entries.push({id:'component:'+part.component,label:'Иконка · '+(nameFor[part.component]||part.component),kind:'component',box,parts:[part]});
    }else if(part.kind==='asset'){
      const a=manifest.assets[part.key];
      const b=a?.alpha_bbox||[0,0,1024,1536];
      entries.push({id:'base:'+part.key,label:'Слой · '+part.key.replaceAll('_',' '),kind:'asset',box:boxFromArray(b),parts:[part]});
    }else if(part.kind==='art'){
      const b=part.viewport;
      entries.push({id:'art',label:'Иллюстрация (маска)',kind:'art',box:boxFromArray(b),parts:[part]});
    }else if(part.kind==='dynamic_text'){
      const r=manifest.text_regions;
      entries.push({id:'text:title',label:'Текст · Название',kind:'text',subtype:'title',box:boxFromArray(r.title)});
      entries.push({id:'text:description',label:'Текст · Описание',kind:'text',subtype:'description',box:boxFromArray(r.description_by_type[card.type])});
      if(typeof card.flavor_text==='string'&&card.flavor_text.trim()){
        entries.push({id:'text:flavor',label:'Текст · Литературный',kind:'text',subtype:'flavor',box:boxFromArray(r.flavor)});
      }
      for(const bind of manifest.number_bindings){
        if(!bind.types.includes(card.type)||card[bind.field]==null)continue;
        const [x,y]=bind.center,size=bind.font_px*1.38;
        entries.push({id:'number:'+bind.field,label:'Число · '+(numberFor[bind.field]||bind.field),kind:'number',field:bind.field,bind,box:{x:x-size/2,y:y-size/2,w:size,h:size}});
      }
    }
  }
  return entries;
}
function defaultLayout(type){
  if(!TYPES.includes(type))throw Error('Недопустимый тип шаблона');
  return {version:VERSION,type,order:[],overrides:{},custom:[]};
}
function safeOverrides(raw){
  const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  for(const [id,value] of Object.entries(raw).slice(0,250)){
    if(typeof id!=='string'||id.length>120||!value||typeof value!=='object'||Array.isArray(value))continue;
    out[id]={};
    for(const [field,a,b,def] of [['x',-2048,3072,512],['y',-2048,3584,768],['scaleX',.1,5,1],['scaleY',.1,5,1],['rotation',-180,180,0],['opacity',0,1,1]]){
      if(Object.hasOwn(value,field))out[id][field]=clamp(finite(value[field],def),a,b);
    }
    if(Object.hasOwn(value,'visible'))out[id].visible=value.visible!==false;
    if(Object.hasOwn(value,'locked'))out[id].locked=value.locked===true;
  }
  return out;
}
const dataURLok=s=>typeof s==='string'&&s.length<=2*1024*1024&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(s);
function normalize(input,type){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Ожидается объект шаблона JSON');
  if(!TYPES.includes(type)||input.type!==type)throw Error('Тип шаблона не совпадает с выбранной картой');
  if(input.version!==VERSION)throw Error('Неподдерживаемая версия шаблона');
  const out=defaultLayout(type);
  out.order=Array.isArray(input.order)?[...new Set(input.order.filter(x=>typeof x==='string'&&x.length<128))].slice(0,240):[];
  out.overrides=safeOverrides(input.overrides);
  if(!Array.isArray(input.custom))throw Error('Отсутствует массив пользовательских иконок');
  if(input.custom.length>24)throw Error('Максимум 24 собственные иконки');
  const ids=new Set();
  for(const c of input.custom){
    if(!c||typeof c!=='object'||typeof c.id!=='string'||!/^custom:[a-z0-9_-]{8,48}$/.test(c.id)||ids.has(c.id))throw Error('Неверный ID новой иконки');
    if(!dataURLok(c.src))throw Error('Иконка должна быть встроенным PNG, JPEG или WebP до 2 МиБ');
    ids.add(c.id);
    out.custom.push({id:c.id,name:String(c.name||'Своя иконка').slice(0,80),src:c.src,
      width:clamp(finite(c.width,160),16,1024),height:clamp(finite(c.height,160),16,1024)});
  }
  return out;
}
function compose(descriptors,layout){
  const built=descriptors.map((d,i)=>({...d,defaultIndex:i}));
  const extra=(layout.custom||[]).map((c,i)=>({id:c.id,label:'Своя иконка · '+c.name,kind:'custom',src:c.src,
    box:{x:512-c.width/2,y:768-c.height/2,w:c.width,h:c.height},defaultIndex:built.length+i}));
  const list=built.concat(extra);
  const saved=new Map((layout.order||[]).map((id,i)=>[id,i]));
  list.sort((a,b)=>{
    const ia=saved.has(a.id)?saved.get(a.id):10000+a.defaultIndex;
    const ib=saved.has(b.id)?saved.get(b.id):10000+b.defaultIndex;
    return ia-ib;
  });
  for(const item of list){
    const [cx,cy]=center(item.box);const ov=layout.overrides?.[item.id]||{};
    item.transform={x:clamp(finite(ov.x,cx),-2048,3072),y:clamp(finite(ov.y,cy),-2048,3584),
      scaleX:clamp(finite(ov.scaleX,1),.1,5),scaleY:clamp(finite(ov.scaleY,1),.1,5),
      rotation:clamp(finite(ov.rotation,0),-180,180),opacity:clamp(finite(ov.opacity,1),0,1),
      visible:ov.visible!==false,locked:ov.locked===true};
  }
  return list;
}
function polygon(item){
  const b=item.box,t=item.transform,a=t.rotation*Math.PI/180;
  const ca=Math.cos(a),sa=Math.sin(a),hw=b.w*t.scaleX/2,hh=b.h*t.scaleY/2;
  return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y])=>[t.x+x*ca-y*sa,t.y+x*sa+y*ca]);
}
function hitTest(list,x,y){
  for(let i=list.length-1;i>=0;i--){
    const it=list[i];if(!it.transform.visible||it.transform.locked)continue;
    const p=polygon(it);let odd=false;
    for(let a=0,b=p.length-1;a<p.length;b=a++){
      if(((p[a][1]>y)!==(p[b][1]>y))&&(x<(p[b][0]-p[a][0])*(y-p[a][1])/(p[b][1]-p[a][1])+p[a][0]))odd=!odd;
    }
    if(odd)return it;
  }
  return null;
}
function applyCanvasTransform(ctx,item){
  const [cx,cy]=center(item.box),t=item.transform;
  ctx.translate(t.x,t.y);ctx.rotate(t.rotation*Math.PI/180);ctx.scale(t.scaleX,t.scaleY);ctx.translate(-cx,-cy);
  ctx.globalAlpha*=t.opacity;
}
function isInBounds(item){
  const points=polygon(item);
  return points.every(([x,y])=>x>=0&&x<=1024&&y>=0&&y<=1536);
}
return {VERSION,TYPES,clamp,center,descriptors,defaultLayout,normalize,compose,polygon,hitTest,applyCanvasTransform,isInBounds,copy,dataURLok};
});
