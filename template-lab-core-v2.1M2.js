/* Mythical Wars v2.1M.2 — three shared card template DRAFTS with class inheritance.
   Stage 2 does not apply templates to any saved cards or to the battle renderer.
   Pure data module: safe to require from Node for regression tests. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(root)root.MW_TEMPLATE_LAB=api;
  if(typeof module!=="undefined" && module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const SCHEMA="mw-class-template-drafts-v2.1M2";
  const TYPES=Object.freeze(["creature","spell","weapon"]);
  const CLASSES=Object.freeze(["Воин","Чернокнижник","Некромант","Нейтральная"]);
  const LABELS=Object.freeze({creature:"Существо",spell:"Заклинание",weapon:"Оружие"});
  const FIELDS=Object.freeze(["frameVariant","accentColor","nameColor","bodyColor","nameSize",
    "bodySize","nameY","descriptionY","descriptionHeight","titleWidth"]);
  const RANGES=Object.freeze({
    nameSize:[28,80],bodySize:[20,70],nameY:[865,1110],
    descriptionY:[1110,1350],descriptionHeight:[90,310],titleWidth:[480,827]
  });
  const DEFAULT_BASE=Object.freeze({
    frameVariant:"default", accentColor:"#af7536",nameColor:"#3b2116",bodyColor:"#35271d",
    nameSize:46,bodySize:43,nameY:994,descriptionY:1174,
    descriptionHeight:196,titleWidth:714
  });
  const WINDOWS=Object.freeze({
    creature:Object.freeze({x:132,y:106,w:752,h:964,shape:"oval"}),
    spell:Object.freeze({x:120,y:176,w:784,h:672,shape:"rectangle"}),
    weapon:Object.freeze({x:117,y:114,w:784,h:790,shape:"circle"})
  });
  const copy=x=>JSON.parse(JSON.stringify(x));
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
  const hasType=x=>TYPES.includes(x);
  const hasClass=x=>CLASSES.includes(x);
  const normalizeClass=x=>(x==="Нейтральные"||x==="Нейтральный"||x==null)?"Нейтральная":x;
  const isHex=x=>typeof x==="string" && /^#[\da-fA-F]{6}$/.test(x);
  function assertType(t){if(!hasType(t))throw new Error("Неизвестный тип карты: "+t);}
  function assertClass(c){if(!hasClass(normalizeClass(c)))throw new Error("Неизвестный класс: "+c);}
  function validate(field,value){
    if(!FIELDS.includes(field))throw new Error("Неизвестный параметр шаблона: "+field);
    if(field==="frameVariant"){
      if(value!=="default"&&value!=="alt")throw new Error("Недопустимый вариант рамки");
      return value;
    }
    if(field.endsWith("Color")){
      if(!isHex(value))throw new Error("Некорректный цвет "+field);
      return value.toLowerCase();
    }
    const n=typeof value==="number"?value:(typeof value==="string"&&value.trim()?Number(value):NaN);
    if(!Number.isInteger(n)||n<RANGES[field][0]||n>RANGES[field][1])
      throw new Error("Параметр "+field+" должен быть от "+RANGES[field][0]+" до "+RANGES[field][1]);
    return n;
  }
  function create(){
    const base={};
    for(const type of TYPES)base[type]=copy(DEFAULT_BASE);
    return {schema:SCHEMA,version:2,base,overrides:{},revision:0,updatedAt:null};
  }
  function normalize(input){
    if(!input || input.schema!==SCHEMA||input.version!==2)
      throw new Error("Неподдерживаемый формат шаблонов");
    const result=create();
    const data=input.base||{};
    for(const type of TYPES){
      for(const field of FIELDS){
        if(own(data[type],field))result.base[type][field]=validate(field,data[type][field]);
      }
    }
    for(const type of TYPES){
      for(const clazz of CLASSES){
        const raw=input.overrides?.[type]?.[clazz];
        if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
        const diff={};
        for(const field of FIELDS){
          if(!own(raw,field))continue;
          const v=validate(field,raw[field]);
          if(v!==result.base[type][field])diff[field]=v;
        }
        if(Object.keys(diff).length)(result.overrides[type]??={})[clazz]=diff;
      }
    }
    result.revision=Number.isSafeInteger(input.revision)&&input.revision>=0?input.revision:0;
    result.updatedAt=typeof input.updatedAt==="string" && input.updatedAt.length<50?input.updatedAt:null;
    return result;
  }
  function ensure(data){return data?normalize(data):create();}
  function resolve(data,type,clazz){
    assertType(type);assertClass(clazz);
    const state=ensure(data), c=normalizeClass(clazz);
    return {...state.base[type],...(state.overrides[type]?.[c]||{})};
  }
  function inherited(data,type,clazz,field){
    assertType(type);assertClass(clazz);validate(field,resolve(data,type,clazz)[field]);
    return !own(data?.overrides?.[type]?.[normalizeClass(clazz)],field);
  }
  function setBase(data,type,field,value){
    assertType(type);
    const next=ensure(data),v=validate(field,value);
    next.base[type][field]=v;
    // Class overrides that happen to match the new base now inherit it.
    for(const clazz of CLASSES){
      const o=next.overrides[type]?.[clazz];
      if(o && o[field]===v)delete o[field];
      if(o && !Object.keys(o).length)delete next.overrides[type][clazz];
    }
    if(next.overrides[type]&&!Object.keys(next.overrides[type]).length)delete next.overrides[type];
    next.revision++;
    return next;
  }
  function setClass(data,type,clazz,field,value){
    assertType(type);assertClass(clazz);
    const next=ensure(data),c=normalizeClass(clazz),v=validate(field,value);
    const o=(next.overrides[type]??={})[c]??={};
    if(v===next.base[type][field])delete o[field];
    else o[field]=v;
    if(!Object.keys(o).length)delete next.overrides[type][c];
    if(!Object.keys(next.overrides[type]).length)delete next.overrides[type];
    next.revision++;
    return next;
  }
  function resetClassField(data,type,clazz,field){
    assertType(type);assertClass(clazz);
    if(!FIELDS.includes(field))throw new Error("Неизвестное поле");
    const next=ensure(data),c=normalizeClass(clazz);
    if(next.overrides[type]?.[c]){
      delete next.overrides[type][c][field];
      if(!Object.keys(next.overrides[type][c]).length)delete next.overrides[type][c];
      if(!Object.keys(next.overrides[type]).length)delete next.overrides[type];
    }
    next.revision++;
    return next;
  }
  function resetClass(data,type,clazz){
    assertType(type);assertClass(clazz);
    const next=ensure(data);
    if(next.overrides[type]){
      delete next.overrides[type][normalizeClass(clazz)];
      if(!Object.keys(next.overrides[type]).length)delete next.overrides[type];
    }
    next.revision++;
    return next;
  }
  function assetFor(type,variant){
    assertType(type);
    const v=variant==="alt"?"alt":"default";
    return "assets/card-bases/"+type+"_"+v+".png";
  }
  function inspect(data){
    const state=ensure(data);
    let changedClasses=0,changedFields=0;
    for(const type of TYPES){
      for(const clazz of CLASSES){
        const n=Object.keys(state.overrides[type]?.[clazz]||{}).length;
        if(n){changedClasses++;changedFields+=n;}
      }
    }
    return {types:TYPES.length,classOptions:TYPES.length*CLASSES.length,changedClasses,changedFields,revision:state.revision};
  }
  function serialize(data){return JSON.stringify(ensure(data),null,2);}
  function deserialize(text){
    if(typeof text!=="string"||text.length>200000)throw new Error("Слишком большой или неверный JSON");
    return normalize(JSON.parse(text));
  }
  return Object.freeze({SCHEMA,TYPES,CLASSES,LABELS,FIELDS,WINDOWS,DEFAULT_BASE,
    create,normalize,normalizeClass,validate,resolve,inherited,setBase,setClass,
    resetClassField,resetClass,assetFor,inspect,serialize,deserialize});
});
