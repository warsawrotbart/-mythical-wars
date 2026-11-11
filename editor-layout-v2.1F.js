/* v2.1F — editor-only layouts for user-approved six backgrounds.
   No changes to battle data, effects, card catalogue or old saved projects. */
(function(){
"use strict";
const BASES={
  creature:{default:"editorBaseCreatureDefault",alt:"editorBaseCreatureAlt"},
  spell:{default:"editorBaseSpellDefault",alt:"editorBaseSpellAlt"},
  weapon:{default:"editorBaseWeaponDefault",alt:"editorBaseWeaponAlt"}
};
const HOLES={creature:{x:132,y:106,w:752,h:964,shape:"oval"},
 spell:{x:120,y:176,w:784,h:672,shape:"rectangle"},
 weapon:{x:117,y:114,w:784,h:790,shape:"circle"}};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function node(p,id){
 let result=null;
 function walk(items){
   for(const item of items||[]){
     if(item.id===id){result=item;return;}
     if(item.children)walk(item.children);
     if(result)return;
   }
 }
 walk(p.cardPresentation.layers);
 return result;
}
function makeImg(id,name,assetId,x,y,w,h,extra={}){
 return {id,kind:"image",name,assetId,x,y,w,h,
 rotation:0,opacity:1,visible:true,locked:false,...extra};
}
function configuredText(n,{x,y,w,h,size,color,font,style="normal",weight="bold",curve=false}){
 if(!n)return;
 Object.assign(n,{x,y,w,h,fontSize:size,minFontSize:17,autoFit:true,
 fontFamily:font,fontWeight:weight,fontStyle:style,
 color,stroke:null,lineHeight:1.16,align:"center",
 lockAspect:false,...(curve?{curveEnabled:true,curveRadius:820,curveLift:0,
   letterSpacing:0,lockWidth:true}: {})});
}
const TITLE_FONT="Georgia, 'Times New Roman', serif";
const BODY_FONT="'Trebuchet MS', Verdana, Arial, sans-serif";
function makeNewCard(type,id,name="",theme="default"){
 if(!BASES[type])throw Error("Недопустимый тип карты");
 theme=(theme==="alt")?"alt":"default";
 const p=type==="creature"
   ?window.MW_FIGMA_CREATURE.makeNewCard(id,name)
   :window.MW_TEMPLATES.makeNewCard(type,id,name);
 const base=node(p,"base"),art=node(p,"art");
 if(!base||!art)throw Error("Отсутствует слой основы или арта");
 const hole=HOLES[type];
 Object.assign(art,{x:hole.x,y:hole.y,w:hole.w,h:hole.h,
   maskShape:hole.shape,maskRadius:type==="spell"?38:0,
   zoom:1,offsetX:0,offsetY:0,lockAspect:true});
 let frame=node(p,"frame");
 if(!frame){
   frame=makeImg("frame","Подложка","",0,0,1024,1536,{locked:true});
   base.children.unshift(frame);
 }
 Object.assign(frame,{assetId:BASES[type][theme],x:0,y:0,w:1024,h:1536,
   name:"Подложка · "+type+" · "+theme,locked:true,lockAspect:true,visible:true});
 let panel=node(p,"descriptionPanel");
 if(!panel){
   panel=makeImg("descriptionPanel","Figma · пергамент описания","panel",
     98,1084,827,410,{locked:false,lockAspect:false,lockWidth:true});
   base.children.push(panel);
 }
 Object.assign(panel,{x:98,y:1084,w:827,h:410,
   assetId:"panel",visible:true,lockAspect:false,lockWidth:true,
   nineSlice:{left:75,right:75,top:70,bottom:70},
   name:"Figma · фон описания · высота изменяется"});
 if(type==="creature"){
   const rim=node(p,"figma-oval-rim");
   if(rim)rim.visible=false; // user-provided frame already contains the border
 }else{
   let titleGroup=node(p,"slot-6");
   if(titleGroup){
     titleGroup.children.unshift(makeImg("namePlaque",
       "Плашка названия · оригинал пользователя",
       "editorTitleBanner",155,925,714,215,{locked:false,lockAspect:true}));
   }
   if(type==="spell"){
     const cost=node(p,"costFrame");
     if(cost)Object.assign(cost,{assetId:"figmaMana",x:78,y:70,w:205,h:216});
   }
 }
 const namePlaque=node(p,"namePlaque");
 if(namePlaque)Object.assign(namePlaque,{assetId:"editorTitleBanner",
   x:155,y:925,w:714,h:215,visible:true});
 configuredText(node(p,"cardName"),{x:207,y:971,w:610,h:112,
   size:46,color:"#3b2116",font:TITLE_FONT,curve:true});
 const ability=node(p,"abilityText");
 configuredText(ability,{x:155,y:1156,w:714,h:232,
   size:51,color:"#35271d",font:BODY_FONT,weight:"normal"});
 if(ability)Object.assign(ability,{lockWidth:true,minFontSize:24,lineHeight:1.20});
 const flavor=node(p,"flavorText");
 configuredText(flavor,{x:166,y:1402,w:690,h:58,
   size:23,color:"#68513a",font:BODY_FONT,weight:"normal",style:"italic"});
 if(flavor)Object.assign(flavor,{minFontSize:16,lockWidth:true,lineHeight:1.1});
 if(type==="creature"){
   // All original Figma components are retained as independent layers.
   const subtype=node(p,"subtypeText");
   if(subtype)Object.assign(subtype,{fontFamily:BODY_FONT,
     fontSize:30,minFontSize:17,autoFit:true});
   const cost=node(p,"costNumber");
   if(cost)cost.fontSize=82;
 }
 p.cardDefinition.templateId=`mw-editor-${type}-v2.1F`;
 p.cardDefinition.templateVersion=1;
 p.cardDefinition.presentationOverrides=p.cardDefinition.presentationOverrides||{};
 p.cardDefinition.presentationOverrides.editorTheme=theme;
 p.metadata.createdFrom=`editor-v2.1F-${type}-${theme}`;
 p.metadata.editorBaseSource="user-six-bases-2026-11-08";
 return p;
}
window.MW_EDITOR_LAYOUT={
  BASES,HOLES,makeNewCard,
  isIntegrated:(p)=>/^mw-editor-(creature|spell|weapon)-v2\.1F$/.test(p?.cardDefinition?.templateId||""),
  applyTheme(p,theme){
    if(!this.isIntegrated(p))return false;
    const type=p.cardDefinition.cardType;
    if(!BASES[type]||!BASES[type][theme])return false;
    const frame=node(p,"frame");
    if(!frame)return false;
    frame.assetId=BASES[type][theme];
    p.cardDefinition.presentationOverrides=p.cardDefinition.presentationOverrides||{};
    p.cardDefinition.presentationOverrides.editorTheme=theme;
    return true;
  }
};
})();
