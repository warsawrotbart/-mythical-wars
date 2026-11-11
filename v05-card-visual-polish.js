/* MW v05.13.1 — non-destructive visual polish. Original v05 manifest stays unchanged. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MW_V05_CARD_POLISH=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const side=new Set(["Common_Gold_Side_Left","Common_Gold_Side_Right"]);
  const upper=new Set(["Creature_Weapon_Gold_Flourish_Top","Creature_Weapon_Inset_Top_Color","Creature_Weapon_Inset_Top_Shadow","Creature_Weapon_Inset_Top_Highlight"]);
  function skipLayer(part,type){return type==="Creature"&&part?.kind==="asset"&&side.has(part.key)}
  function liftTop(part,type){return type==="Creature"&&part?.kind==="asset"&&upper.has(part.key)?-24:0}
  function titlePositions(ctx,text,anchor,maxWidth){
    const chars=(typeof Intl!=="undefined"&&Intl.Segmenter)?
      [...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(text)].map(x=>x.segment):Array.from(text);
    const widths=chars.map(ch=>ctx.measureText(ch).width),sum=widths.reduce((a,b)=>a+b,0);
    if(!sum||!Number.isFinite(sum))return [];
    const scale=Math.min(1,(maxWidth-14)/sum),total=sum*scale;
    let used=anchor[0]-total/2;
    return chars.map((ch,i)=>{
      const w=widths[i]*scale,x=used+w/2;used+=w;
      const u=(x-anchor[0])/(maxWidth/2);
      return {text:ch,x,y:anchor[1]-12+32*u*u,angle:Math.atan(64*u/(maxWidth/2)),scale};
    });
  }
  function drawCurvedTitle(ctx,text,anchor,maxWidth){
    const points=titlePositions(ctx,text,anchor,maxWidth);
    for(const p of points){if(!p.text.trim())continue;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.scale(p.scale,1);
      ctx.strokeText(p.text,0,0);ctx.fillText(p.text,0,0);ctx.restore();
    }
    return points;
  }
  function makeArtCrown(doc,maskedArt){
    // Feathered top slice over the INNER rim; do not paint the opaque full background beyond the frame.
    const c=doc.createElement("canvas");c.width=maskedArt.width;c.height=maskedArt.height;
    const ctx=c.getContext("2d");
    ctx.drawImage(maskedArt,0,-28);
    ctx.globalCompositeOperation="destination-in";
    const gradient=ctx.createLinearGradient(0,95,0,240);
    gradient.addColorStop(0,"rgba(0,0,0,1)");
    gradient.addColorStop(.52,"rgba(0,0,0,.92)");
    gradient.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=gradient;ctx.fillRect(270,55,484,185);
    ctx.globalCompositeOperation="source-over";
    return c;
  }
  return {skipLayer,liftTop,titlePositions,drawCurvedTitle,makeArtCrown};
});
