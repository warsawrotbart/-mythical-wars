/* v2.1E — opt-in Figma creature presentation (does NOT alter game data/rules). 
 * Coordinate placements are provisional: zip includes PNG sprites but no Figma x/y positions.
 * The original v2.1D creature, spell, weapon presets remain unchanged.
 */
(function(){
'use strict';
function figmaCreature(id,name=''){
  const project=window.MW_TEMPLATES.makeNewCard('creature',id,name);
  const layers=project.cardPresentation.layers;
  const slot=sid=>layers.find(g=>g.id===sid);
  const node=(sid,nid)=>slot(sid)?.children?.find(n=>n.id===nid);
  const pos=(n,x,y,w,h,extra={})=>{if(n)Object.assign(n,{x,y,w,h,...extra});};
  const image=(sid,nid,key,x,y,w,h,extra={})=>pos(node(sid,nid),x,y,w,h,{assetId:key,...extra});
  const text=(sid,nid,x,y,w,h,fontSize,extra={})=>pos(node(sid,nid),x,y,w,h,{fontSize,...extra});
  const base=slot('base');
  if(!base)throw new Error('Нет основы карты существа');
  const origFrame=node('base','frame');
  const panel=node('base','descriptionPanel');
  // Reuse the existing approved outer frame; Figma zip contains only a wireframe reference.
  pos(origFrame,56,18,912,1493,{locked:true});
  pos(panel,98,1084,827,410,{locked:true,assetId:'panel'});
  // Draw the outer frame behind the Figma parchment, not over its edges.
  base.children=[origFrame,panel];
  const art=node('slot-5','art');
  pos(art,153,127,718,911,{maskShape:'oval',zoom:1,offsetX:0,offsetY:0,lockAspect:true});
  // Independent oval rim sits above the art but below all dynamic medals and labels.
  const rim={
    id:'figma-oval-rim',kind:'group',name:'Figma · дополнительная оправа овала',
    slot:0,x:0,y:0,w:0,h:0,rotation:0,opacity:1,visible:true,locked:false,
    children:[{
      id:'figmaOvalRim',kind:'image',name:'Figma · овальная оправа (PNG)',
      assetId:'figmaOvalRim',x:136,y:112,w:752,h:933,rotation:0,
      opacity:1,visible:true,locked:true,lockAspect:true
    }]
  };
  layers.splice(layers.indexOf(base)+1,0,rim);
  // Figma red banner includes crossed swords. Hide entirely for other classes via existing handler.
  const klass=slot('slot-2');
  klass.children=[{
    id:'classBanner',kind:'image',name:'Figma · стяг Воина с мечами',assetId:'figmaWarriorBanner',
    x:53,y:178,w:204,h:571,rotation:0,opacity:1,visible:true,locked:false,lockAspect:true
  }];
  image('slot-1','costFrame','figmaMana',78,70,205,216);
  text('slot-1','costNumber',122,130,116,104,86,{color:'#fff6e4',stroke:'#28180f'});
  // Time-of-day indicator remains dynamic and unchanged, since no replacement is supplied.
  // Human badge is Figma's portrait medallion (NOT duplicated as a second class portrait).
  image('slot-4','typeSymbol','figmaHumanBadge',812,270,163,163);
  image('slot-6','namePlaque','figmaTitlePlaque',170,930,683,215);
  text('slot-6','cardName',235,978,554,73,36,{
    color:'#452817',stroke:null,autoFit:true,minFontSize:19,lineHeight:1.08
  });
  image('slot-7','subtypePlaque','figmaSubtypePlaque',339,1139,346,72);
  text('slot-7','subtypeText',374,1148,276,55,34,{
    color:'#f6e5c8',stroke:'#261910',autoFit:true,minFontSize:17
  });
  text('slot-8','abilityText',173,1231,678,153,33,{
    color:'#4a2b1b',stroke:null,fontWeight:'normal',lineHeight:1.12,autoFit:true,minFontSize:20
  });
  image('slot-8','flavorDivider','flavorDivider',326,1377,374,28);
  text('slot-8','flavorText',213,1410,596,54,27,{
    color:'#604837',stroke:null,fontWeight:'normal',fontStyle:'italic',
    lineHeight:1.05,autoFit:true,minFontSize:16
  });
  // Figma does not supply a faction flag; preserve the original group for manual re-enable.
  if(slot('slot-12'))slot('slot-12').visible=false;
  image('slot-9','attackFrame','figmaAttack',70,1285,218,233);
  text('slot-9','attackNumber',132,1357,100,109,89,{
    color:'#fff5e3',stroke:'#342115'
  });
  image('slot-11','healthFrame','figmaHealth',773,1320,203,193);
  text('slot-11','healthNumber',818,1359,100,110,89,{
    color:'#fff6e6',stroke:'#361612'
  });
  image('slot-10','rarityGem','rarityCommon',453,1404,117,130);
  project.cardDefinition.templateId='mw-creature-figma-png-v2.1E';
  project.cardDefinition.templateVersion=1;
  project.metadata.createdFrom='creature-figma-png-v2.1E';
  project.metadata.figmaCoordinateStatus='provisional-from-exports';
  // Crucial: do not add any class/rarity/game ability or source art not in the supplied project.
  return project;
}
window.MW_FIGMA_CREATURE={makeNewCard:figmaCreature,version:'v2.1E',canvas:{width:1024,height:1536},mask:{x:153,y:127,w:718,h:911}};
})();
