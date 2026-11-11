/* Approved independent card-type presets from MW_CCG.zip.
   These are editor templates, NOT gameplay rules; unprovided card fields remain empty.
   Creature KNZ-002 stays an untouched separately selectable starter project. */
(function(){
"use strict";
const copy=o=>JSON.parse(JSON.stringify(o));
const TYPE_NAMES={creature:"Существо",spell:"Заклинание",weapon:"Оружие"};
const rect=(id,kind,name,x,y,w,h,extra={})=>({
 id,kind,name,x,y,w,h,rotation:0,opacity:1,visible:true,locked:false,...extra
});
const grp=(id,name,slot,children,extra={})=>({
 id,kind:"group",name,slot,x:0,y:0,w:0,h:0,rotation:0,opacity:1,visible:true,locked:false,children,...extra
});
const img=(id,name,assetId,x,y,w,h,extra={})=>rect(id,"image",name,x,y,w,h,{assetId,...extra});
const txt=(id,name,binding,x,y,w,h,fontSize=45,extra={})=>rect(id,"text",name,x,y,w,h,{
 binding,fontSize,fontFamily:"Georgia, 'Times New Roman', serif",
 fontWeight:"bold",fontStyle:"normal",lineHeight:1.15,
 align:"center",color:"#f6e5c7",stroke:"#3a2413",...extra
});
const commonDefinition=(type,cardId,name)=>({
 cardId,schemaVersion:1,cardType:type,name:name||"",
 classId:null,factionId:null,creatureTypeId:null,subtypeIds:[],subtype:"",
 timeAffinityId:null,schoolId:null,rarityId:null,costType:"mana",costValue:null,
 attack:null,health:null,durability:null,ability:"",flavor:"",
 keywords:[],localizations:{be:{name:name||"",text:"",flavor:""}},
 source:null,templateId:`mw-${type}-base-v1`,templateVersion:1,presentationOverrides:{}
});
function makeNewCard(type,cardId,name=""){
 if(!TYPE_NAMES[type])throw new Error("Неизвестный тип карты");
 const pr=copy(window.MW_STARTER),d=commonDefinition(type,cardId,name);
 pr.cardDefinition=d;
 pr.metadata={createdFrom:"blank-"+type,updatedAt:new Date().toISOString(),author:"MW Card Editor"};
 pr.assets={defaultArt:null,allowDefaultArt:false,customArtData:null,customArtName:null,embeddedLibrary:{}};
 if(type==="creature"){
    d.templateId="mw-creature-oval-01";
    const art=pr.cardPresentation.layers.find(g=>g.id==="slot-5")?.children?.find(n=>n.id==="art");
    if(art)Object.assign(art,{zoom:1,offsetX:0,offsetY:0,maskShape:"oval"});
    return pr;
 }
 const weapon=type==="weapon";
 const artRect=weapon?[148,133,730,735]:[139,192,743,677];
 const shape=weapon?"circle":"rectangle";
 const cardArt=rect("art","art","Арт — кадрирование",...artRect,
    {zoom:1,offsetX:0,offsetY:0,maskShape:shape,maskRadius:weapon?0:32});
 const base=weapon?"weaponBase":"spellBase";
 const groups=[
    grp("slot-5",`05 · Арт (${weapon?"круг":"прямоугольник"})`,5,[cardArt]),
    grp("base","Утверждённая основа",0,[img("frame",`Основа ${weapon?"оружия":"заклинания"}`,base,0,0,1024,1536,{locked:true})]),
    grp("slot-1","01 · Стоимость",1,[
       img("costFrame","Оправа стоимости","costMedallion",60,56,169,169),
       txt("costNumber","Стоимость","costValue",90,89,107,110,91,{color:"#fff5e2",stroke:"#1d1615"})
    ]),
 ];
 if(!weapon){
    groups.push(grp("slot-3","03 · Школа заклинания",3,[
       txt("schoolText","Школа","schoolId",724,106,229,87,39,{color:"#fff1d5",stroke:"#281c13"})
    ]));
 }
 groups.push(
   grp("slot-6","06 · Название",6,[
     txt("cardName","Название","name",153,910,718,85,52,{color:"#f1d19a",stroke:"#251613"})
   ]),
   grp("slot-8","08 · Текст карты",8,[
     txt("abilityText","Описание / способности","ability",155,1138,714,250,51,{color:"#e6d2ac",stroke:null,fontWeight:"normal"}),
     txt("flavorText","Литературный текст","flavor",166,1402,690,58,25,{color:"#c1ad8d",stroke:null,fontWeight:"normal",fontStyle:"italic"})
   ])
 );
 if(weapon){
   groups.push(grp("slot-9","09 · Атака",9,[
      img("attackFrame","Оправа атаки","attackMedallion",61,1312,178,175),
      txt("attackNumber","Атака","attack",99,1336,99,115,91,{color:"#fff5e6",stroke:"#291616"})
   ]));
   groups.push(grp("slot-11","11 · Прочность",11,[
      img("durabilityFrame","Оправа прочности","healthMedallion",789,1310,173,176),
      txt("durabilityNumber","Прочность","durability",819,1337,113,110,91,{color:"#fff5e6",stroke:"#291616"})
   ]));
 }
 groups.push(grp("slot-10","10 · Редкость",10,[
    img("rarityGem","Кристалл редкости","rarityCommon",446,1398,133,134,{visible:false})
 ]));
 groups.push(grp("slot-13","13 · Легендарный знак",13,[
    img("legendaryMark","Папоротник легендарности","topLegendary",452,15,120,144)
 ],{visible:false}));
 groups.push(grp("user-layers","Пользовательские слои",0,[]));
 pr.cardPresentation={canvas:{width:1024,height:1536},layers:groups};
 return pr;
}
window.MW_TEMPLATES={TYPE_NAMES,makeNewCard};
window.MW_ASSETS.spellBase="assets/spellBase.png";
window.MW_ASSETS.weaponBase="assets/weaponBase.png";
})();