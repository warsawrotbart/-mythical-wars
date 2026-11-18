/* v05A presentation for the approved v05 layers and card data. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.MW_V05_CARD_FINISH=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const cache=new WeakMap();
const lenses={
 Creature:{scaleX:1.043,scaleY:1.072,x:-22,y:-38,curve:[282,162,344,47,679,47,742,162],top:73},
 Weapon:{scaleX:1.036,scaleY:1.067,x:-18.4,y:-55,curve:[303,160,370,93,654,93,721,160],top:107},
 Spell:{scaleX:1.03,scaleY:1.06,x:-15.4,y:-64,curve:[196,169,206,124,818,124,828,169],top:130}
};
const badges={
 Creature:{attack:["Attack_Creature",144,149],health:["Health_Durability",128,115]},
 Weapon:{attack:["Attack",128,128],durability:["Weapon_Durability",128,114]}
};
function anchor(slot,px,py){
 const [x,y,w,h]=slot,s=Math.min(w,h);
 return [x+(w-s)/2+s*px/256,y+(h-s)/2+s*py/256];
}
function manifest(base){
 if(cache.has(base))return cache.get(base);
 const slots={...base.slots,Health_Durability:base.slots.Health_Durability.slice(),
  Weapon_Durability:base.slots.Health_Durability.slice()};
 for(const pair of Object.values(badges)){
  const [attack,second]=Object.values(pair);
  const slot=slots[second[0]];
  slot[1]+=anchor(slots[attack[0]],...attack.slice(1))[1]-anchor(slot,...second.slice(1))[1];
 }
 const components={...base.components,durability:{...base.components.durability,slot:"Weapon_Durability"}};
 const number_bindings=base.number_bindings.map(binding=>{
  const spec=badges[binding.types[0]]?.[binding.field];
  if(!spec)return binding;
  return {...binding,center:anchor(slots[spec[0]],...spec.slice(1)),font_px:102,two_digit_font_px:88};
 });
 const layout={...base,slots,components,number_bindings,text_regions:{...base.text_regions,title:[150,751,874,850]}};
 cache.set(base,layout);cache.set(layout,layout);
 return layout;
}
function drawPlan(core,card,layout){
 const plan=core.drawPlan(card,layout);
 const inner=card.type+"_Inner_Art_Frame";
 const topDetails=part=>/^(Creature_Weapon|Spell)_(Gold_Flourish|Inset)_Top/.test(part.key||"");
 const upper=plan.filter(topDetails);
 const portrait=plan.filter(part=>part.kind==="art"||part.key===inner)
  .map(part=>({...part,lens:lenses[card.type]}));
 const rest=plan.filter(part=>part.kind!=="art"&&part.key!==inner&&!topDetails(part));
 const ribbon=rest.findIndex(part=>part.key==="Common_Title_Curl_Left_Color");
 if(ribbon<0||portrait.length!==2)return plan;
 rest.splice(ribbon,0,...upper,...portrait);
 return rest;
}
function drawLens(ctx,surface,lens,rim=false){
 if(!lens){ctx.drawImage(surface,0,0);return;}
 ctx.save();
 if(rim){ctx.shadowOffsetY=14;ctx.shadowBlur=21;ctx.shadowColor="rgba(20,10,5,.78)";}
 ctx.translate(lens.x,lens.y);ctx.scale(lens.scaleX,lens.scaleY);
 ctx.drawImage(surface,0,0);
 ctx.restore();
}
function extendCrown(ctx,photo,placement,lens){
 if(!lens||!photo)return;
 const [x,y,...curve]=lens.curve;
 ctx.save();ctx.globalCompositeOperation="destination-over";
 ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(...curve);ctx.closePath();ctx.clip();
 const top=Math.min(lens.top,placement.dy);
 ctx.drawImage(photo,placement.dx,top,placement.dw,placement.dh+placement.dy-top);
 ctx.restore();
}
function analyzeText(core,card,layout,ctx){
 const base=core.analyzeText(card,layout,ctx);
 const [x,y,r,b]=layout.text_regions.title;
 const title=core.chooseTextLayout(ctx,card.name,{fontName:"MW-DejaVu-Bold",maxPx:56,minPx:36,
  maxWidth:r-x,maxHeight:b-y,maxLines:1});
 const region=layout.text_regions.description_by_type[card.type];
 const description=core.chooseTextLayout(ctx,card.description,{fontName:"MW-DejaVu-Regular",maxPx:66,minPx:32,
  maxWidth:680,maxHeight:region[3]-region[1]+26,lineRatio:1.22});
 const issues=base.issues.filter(issue=>!["title-overflow","description-overflow"].includes(issue.code));
 if(title.overflow)issues.push({severity:"error",code:"title-overflow",message:"Название не помещается в одну строку."});
 if(description.overflow)issues.push({severity:"error",code:"description-overflow",message:"Описание не помещается в отведённую область."});
 return {...base,title,description,issues};
}
function drawDescription(ctx,body,center,fontFamily){
 const [x,y]=center;
 const step=body.px*1.22,top=y-(body.lines.length-1)*step/2;
 ctx.save();ctx.fillStyle="#221810";ctx.textBaseline="middle";
 ctx.textAlign=body.lines.length>1?"left":"center";
 ctx.font=body.px+"px "+fontFamily;
 body.lines.forEach((line,i)=>ctx.fillText(line,body.lines.length>1?172:x,top+i*step));
 ctx.restore();
}
function drawNumber(ctx,text,binding,layout,fontFamily){
 const [cx,cy]=binding.center;
 const size=text.length>1?binding.two_digit_font_px:binding.font_px;
 ctx.save();ctx.textAlign="center";ctx.textBaseline="alphabetic";
 ctx.font="700 "+size+"px "+fontFamily;
 const m=ctx.measureText(text);
 const x=cx+((m.actualBoundingBoxLeft??m.width/2)-(m.actualBoundingBoxRight??m.width/2))/2;
 const y=cy+((m.actualBoundingBoxAscent??size*.72)-(m.actualBoundingBoxDescent??size*.09))/2;
 const ink=layout.text_rules.numbers;
 ctx.fillStyle=ink.fill;ctx.strokeStyle=ink.outline;ctx.lineWidth=ink.outline_px*2;ctx.lineJoin="round";
 ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.restore();
}
return {manifest,drawPlan,drawLens,extendCrown,analyzeText,drawDescription,drawNumber};
});
