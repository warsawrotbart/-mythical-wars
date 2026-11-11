/* MW v05.14 Stage 1 — isolated 2D minion portrait, no gameplay mutations. */
(function(root,factory){
"use strict";
const api=factory();
if(typeof module==="object"&&module.exports)module.exports=api;
if(root)root.MW14_BOARD_PORTRAIT=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const WIDTH=256,HEIGHT=304,clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function coverPlacement(w,h,crop={},r={x:14,y:12,w:228,h:265}){
  if(!(w>0&&h>0&&Number.isFinite(w)&&Number.isFinite(h)))return null;
  const x=clamp(Number.isFinite(+crop?.x)?+crop.x:.5,0,1);
  const y=clamp(Number.isFinite(+crop?.y)?+crop.y:.5,0,1);
  const zoom=clamp(Number.isFinite(+crop?.zoom)?+crop.zoom:1,1,4);
  const scale=Math.max(r.w/w,r.h/h)*zoom,dw=w*scale,dh=h*scale;
  return {dx:clamp(r.x+r.w/2-x*dw,r.x+r.w-dw,r.x),
          dy:clamp(r.y+r.h/2-y*dh,r.y+r.h-dh,r.y),dw,dh};
}
function render(doc,art,crop,sourceRim){
  const canvas=doc.createElement("canvas");canvas.width=WIDTH;canvas.height=HEIGHT;
  const g=canvas.getContext("2d",{alpha:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";
  const cx=128,cy=144,rx=112,ry=135;
  g.save();g.shadowColor="rgba(0,0,0,.7)";g.shadowBlur=15;g.shadowOffsetY=7;
  g.beginPath();g.ellipse(cx,cy,rx+5,ry+5,0,0,Math.PI*2);g.fillStyle="#261b15";g.fill();g.restore();
  g.save();g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);g.clip();
  const bg=g.createLinearGradient(0,5,0,285);bg.addColorStop(0,"#465b57");bg.addColorStop(1,"#1b2630");
  g.fillStyle=bg;g.fillRect(0,0,WIDTH,HEIGHT);
  if(art){
    const p=coverPlacement(art.naturalWidth||art.width,art.naturalHeight||art.height,crop);
    if(p)g.drawImage(art,p.dx,p.dy,p.dw,p.dh);
  }else{
    // Visible unavailable-art silhouette, never another card's art.
    g.fillStyle="#34454a";g.beginPath();g.ellipse(cx,119,45,47,0,0,Math.PI*2);g.fill();
    g.beginPath();g.ellipse(cx,276,92,108,0,0,Math.PI*2);g.fill();
  }
  const shade=g.createLinearGradient(0,10,0,290);
  shade.addColorStop(0,"rgba(10,19,26,.24)");
  shade.addColorStop(.48,"rgba(0,0,0,0)");
  shade.addColorStop(1,"rgba(6,10,18,.65)");
  g.fillStyle=shade;g.fillRect(0,0,WIDTH,HEIGHT);g.restore();
  if(sourceRim){
    g.save();g.globalAlpha=.48;
    g.drawImage(sourceRim,144,60,736,690,8,4,240,292);
    g.restore();
  }
  g.beginPath();g.ellipse(cx,cy,rx+2,ry+2,0,0,Math.PI*2);
  const gold=g.createLinearGradient(25,15,235,285);
  gold.addColorStop(0,"#f8dfa2");gold.addColorStop(.4,"#8b5c29");
  gold.addColorStop(.7,"#e9bd69");gold.addColorStop(1,"#654322");
  g.strokeStyle=gold;g.lineWidth=8;g.stroke();
  g.beginPath();g.ellipse(cx,cy,rx-5,ry-5,0,0,Math.PI*2);
  g.strokeStyle="rgba(21,18,15,.95)";g.lineWidth=3;g.stroke();
  g.beginPath();g.ellipse(cx,cy,rx+7,ry+7,0,0,Math.PI*2);
  g.strokeStyle="rgba(34,24,17,.9)";g.lineWidth=2;g.stroke();
  return canvas;
}
return Object.freeze({WIDTH,HEIGHT,coverPlacement,render});
});
