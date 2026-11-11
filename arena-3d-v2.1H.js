/* Mythical Wars v2.1H — experimental 3D arena.
 * Native WebGL 1, no CDN, no library installs, no network requests.
 * The engine remains the only authority. This module reads state and sends
 * gestures through MW_BATTLE_VIEW_BRIDGE; it never changes gameplay data.
 */
(function(global){
"use strict";
const M=global.MW_3D_MATH,$=id=>document.getElementById(id);
const stage=document.createElement("section");
stage.id="mw3dStage";stage.hidden=true;stage.setAttribute("aria-label","Экспериментальное трёхмерное поле");
stage.innerHTML=`
 <canvas id="mw3dCanvas" tabindex="0" aria-label="3D-поле. Стрелки выбирают карту, Enter выполняет действие, I открывает карту, Escape отменяет выбор."></canvas>
 <div class="mw3d-top">
  <div class="mw3d-brand"><span>МИФИЧЕСКИЕ ВОЙНЫ</span><b>Объёмная арена</b><small>3D ПРОТОТИП · v2.1K</small></div>
  <div class="mw3d-controls">
   <label>Анимации <select id="mw3dMotion"><option value="normal">Плавные</option><option value="fast">Быстрые</option><option value="off">Без движения</option></select></label>
   <label>Качество <select id="mw3dQuality"><option value="low">Экономное</option><option value="normal" selected>Обычное</option><option value="high">Высокое</option></select></label>
   <button type="button" id="mw3dBack">Вернуться в 2D</button>
  </div>
 </div>
 <div id="mw3dLabels" class="mw3d-labels" aria-hidden="true"></div>
 <div class="mw3d-clock" id="mw3dClock" aria-label="Игровые часы">
   <div class="mw3d-clock-face"><div class="mw-art-clock mw3d-art-clock" aria-hidden="true">
     <div class="mw-art-clock-disc"></div><div class="mw-art-clock-frame"></div>
     <div id="mw3dMarks" class="mw3d-marks"></div><div class="mw-art-clock-pointer" id="mw3dHand"></div>
   </div></div>
   <div class="mw3d-clock-caption"><strong id="mw3dTime">12:00</strong><span id="mw3dPhase">День</span></div>
 </div>
 <div class="mw3d-turn">
   <span id="mw3dTurnLabel">Начните партию</span>
   <button type="button" id="mw3dEnd"><span>Завершить<br>ход</span></button>
   <button type="button" id="mw3dCancel" hidden>Отменить выбор</button>
 </div>
 <div class="mw3d-deck-panel enemy" id="mw3dEnemyDeckPanel">
    <strong id="mw3dEnemyDeckCount">Колода · —</strong>
    <span id="mw3dEnemyMana">Мана · —</span>
    <div class="mw3d-deck-footer"><button type="button" id="mw3dEnemyGrave" class="mw3d-grave-icon" aria-label="Кладбище противника: 0" title="Кладбище противника: 0">0</button><span id="mw3dEnemyCorpses" class="mw3d-corpse-icon" aria-label="Трупы противника: 0" title="Трупы противника: 0">0</span></div>
 </div>
 <div class="mw3d-deck-panel own" id="mw3dMyDeckPanel">
    <strong id="mw3dMyDeckCount">Колода · —</strong>
    <span id="mw3dMyMana">Мана · —</span>
    <div class="mw3d-deck-footer"><button type="button" id="mw3dMyGrave" class="mw3d-grave-icon" aria-label="Моё кладбище: 0" title="Моё кладбище: 0">0</button><span id="mw3dMyCorpses" class="mw3d-corpse-icon" aria-label="Мои трупы: 0" title="Мои трупы: 0">0</span></div>
 </div>
 <div class="mw3d-hero-summary enemy"><b id="mw3dEnemyName">БОТ · Противник</b><span id="mw3dEnemyResources">30 ♥</span></div>
 <div class="mw3d-hero-power enemy" id="mw3dEnemyPower" aria-label="Способность героя противника">Сила героя</div>
 <div class="mw3d-hero-summary own"><b id="mw3dMyName">ИГРОК</b><span id="mw3dMyResources">30 ♥</span></div>
 <button class="mw3d-hero-power own" type="button" id="mw3dPower">Сила героя</button>
 <div class="mw3d-bottom"><span id="mw3dHint" role="status">Выберите колоды и начните партию.</span><span class="mw3d-help">Перенос / клик · ПКМ: карта · Esc: отмена</span></div>
 <div class="mw3d-hover" id="mw3dPreview" hidden><img alt=""><strong></strong><p></p><small>ПКМ или I — открыть карту</small></div>
 <svg id="mw3dAim" class="mw3d-aim" aria-hidden="true"><defs><marker id="mw3dArrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0 0L9 4L0 8" fill="#f7dc91"/></marker></defs><path fill="none" stroke="#f7dc91" stroke-width="3" marker-end="url(#mw3dArrow)"></path></svg>
 <div id="mw3dEmpty" class="mw3d-empty"><b>Одна партия. Два вида.</b><p>Редактор, карты и правила сохранены.<br>Начните бой с выбранными колодами.</p><button type="button" id="mw3dStart">Начать бой</button></div>
`;
const workspace=$("battleWorkspace"),layout=workspace?.querySelector(".battle-layout");
if(!layout||!M)return;
layout.prepend(stage);
// A persistent, visible 3D action now lives next to Start/Resume.
const toggle=$("battle3DToggle")||document.createElement("button");
if(!toggle.id)toggle.id="battle3DToggle";
toggle.type="button";toggle.classList.add("btn","btn-outline");
toggle.textContent="◇ 3D-прототип";toggle.setAttribute("aria-pressed","false");
if(!toggle.isConnected)workspace.querySelector(".battle-quick-actions")?.prepend(toggle);
const canvas=$("mw3dCanvas"),labels=$("mw3dLabels"),B=()=>global.MW_BATTLE_VIEW_BRIDGE,E=()=>global.MW_GAME_ENGINE;
const reduced=global.matchMedia?.("(prefers-reduced-motion: reduce)");
let enabled=false,gl=null,program=null,geo=null,uniforms=null,attributes=null;
let game=null,lastGame=null,nodes=new Map(),ghosts=[],textures=new Map(),failedTextures=0,frame=0,raf=0;
let vp=M.I(),inv=M.I(),cw=1,ch=1,brightness=1,lastStamp=0;
let hover=null,focusKey=null,pointer=null,drag=null,attack=null,lockUntil=0;
let stateErrors=[],frameCount=0,textureRequests=0,contextLossCount=0;
let motion="normal",quality="normal",ready=false,artRevision=0,heroRevision=0;
const pendingHeroArt=new Set();
try{
 const m=localStorage.getItem("mw-3d-motion-v2.1H"),q=localStorage.getItem("mw-3d-quality-v2.1H");
 if(["normal","fast","off"].includes(m))motion=m;
 if(["low","normal","high"].includes(q))quality=q;
}catch(_){}
$("mw3dMotion").value=motion;$("mw3dQuality").value=quality;
const time=()=>performance.now();
const duration=()=>motion==="off"||reduced?.matches?0:motion==="fast"?135:300;
const active=()=>enabled&&!workspace.hidden&&!document.hidden;
const escapeText=s=>String(s??""); // all data is inserted via textContent, never HTML
function notice(text){
 $("mw3dHint").textContent=String(text||"");
}
function fail(error){
 stateErrors.push(String(error?.message||error));
 setEnabled(false);
 const old=$("deckNotice");
 if(old){old.textContent="3D недоступен. Продолжайте в 2D: "+String(error?.message||error);old.classList.add("visible");}
 toggle.title="3D недоступен: "+String(error?.message||error);
}
function shader(type,source){
 const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
 if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){
  const message=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw Error(message||"Ошибка шейдера.");
 }
 return sh;
}
function initGL(){
 if(ready&&gl&&!gl.isContextLost())return;
 gl=canvas.getContext("webgl",{alpha:false,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false});
 if(!gl)throw Error("Браузер не предоставил WebGL.");
 const vs=shader(gl.VERTEX_SHADER,`
 attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV;
 uniform mat4 uVP; uniform mat4 uModel;
 varying vec3 vNormal; varying vec2 vUV; varying vec3 vWorld;
 void main(){ vec4 p=uModel*vec4(aPos,1.0);vWorld=p.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUV=aUV;gl_Position=uVP*p; }
 `);
 const fs=shader(gl.FRAGMENT_SHADER,`
 precision mediump float;
 varying vec3 vNormal; varying vec2 vUV; varying vec3 vWorld;
 uniform sampler2D uTexture; uniform vec4 uColor; uniform float uUseTexture; uniform float uDay; uniform float uUnlit;
 void main(){
  vec4 base=uColor;
  if(uUseTexture>0.5)base*=texture2D(uTexture,vUV);
  if(base.a<0.025)discard;
  float diffuse=max(dot(normalize(vNormal),normalize(vec3(-0.4,1.0,0.5))),0.0);
  vec3 tint=mix(vec3(0.66,0.80,1.03),vec3(1.03,0.97,0.86),uDay);
  float light=0.63+0.37*diffuse;
  vec3 lit=mix(base.rgb*tint*light,base.rgb,uUnlit);
  gl_FragColor=vec4(lit,base.a);
 }
 `);
 program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
 gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||"Ошибка программы WebGL.");
 attributes={p:gl.getAttribLocation(program,"aPos"),n:gl.getAttribLocation(program,"aNormal"),uv:gl.getAttribLocation(program,"aUV")};
 uniforms=Object.fromEntries(["VP","Model","Color","UseTexture","Texture","Day","Unlit"].map(n=>[n,gl.getUniformLocation(program,"u"+n)]));
 // One unit box, six independent faces; top is drawn separately for card faces.
 const v=[],quad=(a,b,c,d,n)=>{
  for(const [p,uv] of [[a,[0,0]],[b,[1,0]],[c,[1,1]],[a,[0,0]],[c,[1,1]],[d,[0,1]]])v.push(...p,...n,...uv);
 };
 quad([-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5],[0,1,0]); // top, v=1 is image top with UNPACK_FLIP_Y_WEBGL
 quad([-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[0,-1,0]);
 quad([-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[0,0,1]);
 quad([.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[0,0,-1]);
 quad([-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-1,0,0]);
 quad([.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[1,0,0]);
 geo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,geo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.STATIC_DRAW);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 // Cull disabled intentionally: projected ornament/transparent card face planes have two visible sides.
 gl.useProgram(program);gl.uniform1i(uniforms.Texture,0);ready=true;
 textures.clear();
 addTexture("white",paint(2,2,c=>{c.fillStyle="#fff";c.fillRect(0,0,2,2);}));
 addTexture("wood",paint(1024,1024,c=>{
  c.fillStyle="#59412b";c.fillRect(0,0,1024,1024);
  let seed=84011;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<1024;y+=128){
   c.fillStyle=y%256===0?"#66472e":"#60432e";c.fillRect(0,y,1024,126);
   c.fillStyle="rgba(17,12,9,.55)";c.fillRect(0,y,1024,3);
   for(let i=0;i<65;i++){
    c.strokeStyle=`rgba(${rnd()>.5?"226,177,115":"22,14,9"},${.025+rnd()*.075})`;
    c.beginPath();let yy=y+5+rnd()*115;c.moveTo(0,yy);
    c.bezierCurveTo(320,yy+12*rnd(),720,yy-12*rnd(),1024,yy+5*rnd());c.stroke();
   }
  }
  const g=c.createRadialGradient(512,512,90,512,512,720);g.addColorStop(0,"rgba(190,146,80,.08)");g.addColorStop(1,"rgba(0,0,0,.5)");
  c.fillStyle=g;c.fillRect(0,0,1024,1024);
 }));
 addTexture("felt",paint(512,512,c=>{
  c.fillStyle="#183a39";c.fillRect(0,0,512,512);
  c.strokeStyle="rgba(188,166,99,.10)";c.lineWidth=1;
  for(let x=-512;x<1024;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x+512,512);c.stroke();}
  c.strokeStyle="rgba(193,166,109,.45)";c.lineWidth=3;c.strokeRect(15,15,482,482);
  c.strokeStyle="rgba(193,166,109,.18)";c.strokeRect(23,23,466,466);
 }));
 addTexture("back",paint(256,384,c=>{
  c.fillStyle="#102d35";c.fillRect(0,0,256,384);
  c.strokeStyle="#c4a565";c.lineWidth=5;c.strokeRect(10,10,236,364);c.lineWidth=1;c.strokeRect(18,18,220,348);
  c.save();c.translate(128,192);
  for(let i=0;i<4;i++){c.rotate(Math.PI/4);c.strokeRect(-64,-64,128,128);}
  c.restore();c.fillStyle="#e5cd94";c.font="bold 48px Georgia";c.textAlign="center";c.fillText("MW",128,208);
 }));
 addTexture("coin",paint(256,384,c=>{
  c.fillStyle="#162c35";c.fillRect(0,0,256,384);c.strokeStyle="#cbaa67";c.lineWidth=6;c.strokeRect(8,8,240,368);
  const g=c.createRadialGradient(112,145,8,128,160,80);g.addColorStop(0,"#f6dfa0");g.addColorStop(1,"#8a602b");
  c.fillStyle=g;c.beginPath();c.arc(128,160,76,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle="#3d2b18";c.font="bold 84px Georgia";c.textAlign="center";c.fillText("1",128,190);
  c.fillStyle="#f5e6bd";c.font="bold 25px Arial";c.fillText("МОНЕТКА",128,275);
  c.font="18px Arial";c.fillText("+1 временная мана",128,310);
 }));
 addTexture("hero",paint(256,256,c=>{
  const g=c.createRadialGradient(128,100,8,128,128,125);g.addColorStop(0,"#2b5b64");g.addColorStop(1,"#0f222b");
  c.fillStyle=g;c.beginPath();c.arc(128,128,121,0,Math.PI*2);c.fill();
  c.strokeStyle="#c6a976";c.lineWidth=9;c.stroke();c.lineWidth=2;c.beginPath();c.arc(128,128,105,0,Math.PI*2);c.stroke();
  c.strokeStyle="#e1cf9c";c.lineWidth=5;c.beginPath();c.moveTo(128,59);c.lineTo(177,100);c.lineTo(166,155);c.lineTo(128,190);c.lineTo(90,155);c.lineTo(79,100);c.closePath();c.stroke();
 }));
 addTexture("shadow",paint(128,128,c=>{
  const g=c.createRadialGradient(64,64,16,64,64,64);g.addColorStop(0,"rgba(0,0,0,.5)");g.addColorStop(1,"rgba(0,0,0,0)");c.fillStyle=g;c.fillRect(0,0,128,128);
 }));
 resize();
}
function paint(w,h,draw){const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"));return c;}
function addTexture(id,image){
 if(!gl||gl.isContextLost())return null;
 let entry=textures.get(id);if(entry)gl.deleteTexture(entry.t);
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
 entry={t,used:time()};textures.set(id,entry);
 if(textures.size>100){
  const used=new Set([...nodes.values(),...ghosts].map(n=>n.tex));
  const candidate=[...textures.entries()].filter(([key])=>key.startsWith("face:")&&!used.has(key)).sort((a,b)=>a[1].used-b[1].used)[0];
  if(candidate){gl.deleteTexture(candidate[1].t);textures.delete(candidate[0]);}
 }
 return t;
}
const pendingTextures=new Set(),faceFailures=new Map();
function genericFace(definition,kind){
 const c=document.createElement("canvas");c.width=256;c.height=384;
 const x=c.getContext("2d");
 x.fillStyle="#162d31";x.fillRect(0,0,c.width,c.height);
 x.strokeStyle="#d7b478";x.lineWidth=9;x.strokeRect(7,7,242,370);
 x.fillStyle="#432730";x.fillRect(10,174,236,68);
 x.fillStyle="#f9ddaa";x.textAlign="center";x.textBaseline="middle";
 x.font="bold 23px Georgia,serif";
 const name=String(definition?.name||"Карта");
 const words=name.split(/\s+/),lines=[],max=17;
 let line="";
 for(const word of words){
  const next=line?line+" "+word:word;
  if(next.length>max&&line){lines.push(line);line=word;}else line=next;
 }
 if(line)lines.push(line);
 lines.slice(0,2).forEach((t,i)=>x.fillText(t,128,197+i*24,224));
 x.fillStyle="#b8c5bb";x.font="17px Georgia,serif";
 x.fillText("Загрузка лицевой стороны…",128,294,228);
 return c;
}
function requestFace(n,definition,cost){
 if(!definition||n.kind==="back")return;
 const signature=JSON.stringify([definition.cardId,definition.name,definition.ability,definition.attack,definition.health,definition.costValue,cost]);
 const id="face:"+artRevision+":"+(n.kind==="minion"?"compact:":"full:")+signature;
 n.tex=id;
 if(pendingTextures.has(id))return;
 if(textures.has(id)&&!faceFailures.has(id))return;
 if((faceFailures.get(id)||0)>=2)return;
 pendingTextures.add(id);textureRequests++;
 const context=gl;
 // Distinguish a temporary, readable front from the actual opponent's card back.
 if(gl&&!gl.isContextLost()&&!textures.has(id))addTexture(id,genericFace(definition,n.kind));
 const renderer=global.MW_BATTLE_CARD_RENDERER;
 if(!renderer?.request){pendingTextures.delete(id);return;}
 renderer.request(definition,n.kind==="minion"?"compact":"full",{cost})
 .then(url=>new Promise((resolve,reject)=>{
   if(!url){reject(Error("Empty v05 face"));return;}
   const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error("Failed to decode v05 face"));img.src=url;
 })).then(img=>{
   if(img&&gl===context&&!gl?.isContextLost()){
      addTexture(id,img);faceFailures.delete(id);wake();
   }
 }).catch(err=>{
   failedTextures++;
   // Placeholder remains visible; allow a later render to retry after transient failures.
   faceFailures.set(id,(faceFailures.get(id)||0)+1);
   console.warn("MW 3D card face:",definition.cardId,err);
 }).finally(()=>pendingTextures.delete(id));
}
 /* v2.1K: hero portraits are dynamic independent textures, never snapshots of HUD
  * frames, counters or abilities. Uploaded user portraits take precedence.
  */
 function requestHeroArtTexture(node,cls,phase){
  const src=global.MW_HERO_PORTRAIT_BRIDGE?.get(node.owner,cls,phase)||
    global.MW_HERO_ART?.portraitFor(cls,phase)||"";
  if(!src){node.tex="hero";node.heroSource="";return;}
  const id="hero:"+heroRevision+":"+node.owner+":"+cls+":"+phase;
  node.heroSource=src;node.heroTextureId=id;
  node.tex=textures.has(id)?id:"hero";
  if(textures.has(id)||pendingHeroArt.has(id))return;
  pendingHeroArt.add(id);
  const context=gl;
  const picture=new Image();
  picture.onload=()=>{
    pendingHeroArt.delete(id);
    if(gl!==context||gl?.isContextLost()||!id.startsWith("hero:"+heroRevision+":"))return;
    addTexture(id,picture);
    for(const current of nodes.values()){
      if(current.kind==="hero"&&current.heroTextureId===id&&current.heroSource===src)current.tex=id;
    }
    wake();
  };
  picture.onerror=()=>{
    pendingHeroArt.delete(id);
    failedTextures++;
  };
  picture.src=src;
 }
 function invalidateHeroes(){
  heroRevision++;
  if(gl&&!gl.isContextLost())for(const [key,entry] of textures){
    if(key.startsWith("hero:")){gl.deleteTexture(entry.t);textures.delete(key);}
  }
  for(const node of nodes.values())if(node.kind==="hero")node.tex="hero";
  if(enabled&&game)render(game);
 }
function drawBox(p,size,color=[1,1,1,1],texture=null,ry=0,rx=0,top=false,unlit=0){
 const model=M.model(p,size,ry,rx);
 gl.uniformMatrix4fv(uniforms.Model,false,model);
 gl.uniform4fv(uniforms.Color,color);
 const entry=textures.get(texture)||textures.get("white");
 if(entry){gl.bindTexture(gl.TEXTURE_2D,entry.t);entry.used=time();}
 gl.uniform1f(uniforms.UseTexture,texture&&textures.has(texture)?1:0);
 gl.uniform1f(uniforms.Unlit,unlit);
 gl.drawArrays(gl.TRIANGLES,0,top?6:36);
 return model;
}
/* v2.1J: screen-space HUD is anchored to the projected board and its objects.
   No changes to the underlying battle engine or targeting coordinates. */
function positionHUD(){
 if(!cw||!ch||!vp)return;
 const point=p=>M.project(p,vp,cw,ch);
 const corners=[[-8.9,.05,-6.9],[8.9,.05,-6.9],[8.9,.05,6.9],[-8.9,.05,6.9]].map(point).filter(Boolean);
 if(corners.length!==4)return;
 const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x));
 const top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
 const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
 const clock=$("mw3dClock"),turn=stage.querySelector(".mw3d-turn");
 // v2.1L: anchor both HUD controls to the projected battlefield, not the window edge.
 // The screen-space width of each control is reduced on narrow viewports so neither
 // one covers the playable board after the camera is brought closer.
 const clockW=clock.offsetWidth||132,turnW=turn.offsetWidth||118;
 const clockScale=bound((left-12)/clockW,.48,1);
 const turnScale=bound((cw-right-12)/turnW,.48,1);
 clock.style.transformOrigin="left center";
 turn.style.transformOrigin="right center";
 clock.style.scale=String(clockScale);
 turn.style.scale=String(turnScale);
 clock.style.left=bound(left-clockW*clockScale-6,3,cw-clockW*clockScale-3)+"px";
 turn.style.right=bound(cw-right-turnW*turnScale-6,3,cw-turnW*turnScale-3)+"px";
 const centerPoint=point([0,.12,0]);
 const centerY=bound((centerPoint?.y??(top+bottom)/2)-8,112,ch-100);
 // Centre the artwork face (not its caption) and the circular button
 // (not the "Ваш ход" label) on the projected playing-field midpoint.
 const faceH=clock.querySelector(".mw3d-clock-face")?.offsetHeight||126;
 const clockBias=Math.max(0,(clock.offsetHeight-faceH)/2);
 const turnBias=(( $("mw3dTurnLabel")?.offsetHeight||24)+7)/2;
 clock.style.top=bound(centerY+clockBias,108,ch-95)+"px";
 turn.style.top=bound(centerY-turnBias,108,ch-95)+"px";
 for(const owner of [0,1]){
  const own=owner===0,selector=own?"My":"Enemy";
  const hero=point([0,.32,own?3.55:-3.55]);
  if(hero){
   const chip=stage.querySelector(".mw3d-hero-summary."+(own?"own":"enemy"));
   const power=$("mw3d"+(own?"Power":"EnemyPower"));
   const grouped=stage.querySelector(".mw11-stage-hud."+(own?"own":"enemy"));
   if(grouped){
     const w=grouped.offsetWidth||410,h=grouped.offsetHeight||94;
     // Keep the larger unified HUD in the side gutter, outside the main 3D combat grid when space permits.
     grouped.style.left=bound(left-w-12,8,cw-w-8)+"px";
     grouped.style.top=bound(hero.y-h/2,72,ch-h-24)+"px";
   }else{
     chip.style.left=bound(hero.x-(chip.offsetWidth||175)-104,5,cw-180)+"px";
     chip.style.top=bound(hero.y-23,72,ch-92)+"px";
     power.style.left=bound(hero.x+105,5,cw-(power.offsetWidth||130)-6)+"px";
     power.style.top=bound(hero.y-15,72,ch-80)+"px";
   }
  }
  const deck=point(deckAnchor(owner));
  const panel=$("mw3d"+selector+"DeckPanel");
  if(deck&&panel){
   const pw=panel.offsetWidth||182;
   panel.style.left=bound(deck.x-(own?55:10),6,cw-pw-6)+"px";
   panel.style.top=bound(deck.y+28,76,ch-105)+"px";
  }
 }
}
function resize(){
 if(!ready)return;
 const top=stage.getBoundingClientRect().top;
 const desired=Math.max(440,Math.min(1000,global.innerHeight-top-10));
 if(Math.abs(stage.getBoundingClientRect().height-desired)>2)stage.style.height=desired+"px";
 const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;
 cw=r.width;ch=r.height;
 const dpr=Math.min(global.devicePixelRatio||1,quality==="low"?1:quality==="high"?2:1.5);
 const w=Math.round(cw*dpr),h=Math.round(ch*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 gl.viewport(0,0,w,h);
 const aspect=cw/ch,comp=Math.max(1,1.45/aspect);
 // v2.1L: 6-10% larger tabletop, raised framing; 2D/3D game coordinates do not change.
 // On narrower viewports we preserve enough room for the clock and end-turn button.
 const zoom=cw>=1400?(ch>=630?.76:.84):cw>=1050?(ch>=600?.845:.91):1.04;
 vp=M.mul(M.perspective(42*Math.PI/180,aspect,.1,110),M.lookAt([0,15.8*comp*zoom,15.0*comp*zoom],[0,0,1.0]));
 inv=M.inverse(vp);
 positionHUD();
}
function topPolygon(p,w,d,ry,rx=0,thickness=.09){
 const m=M.model(p,[w,thickness,d],ry,rx);
 return [[-.5,.51,-.5],[.5,.51,-.5],[.5,.51,.5],[-.5,.51,.5]].map(v=>{
  const world=M.transform(m,[...v,1]);return M.project(world.slice(0,3),vp,cw,ch);
 });
}
function deckAnchor(owner){return [7.08,.40,owner===0?2.05:-3.80];}
function table(){
 drawBox([0,-.57,0],[17.5,.76,13.65],[.28,.18,.10,1],"wood");
 drawBox([0,-.15,0],[17.15,.12,13.3],[1,1,1,1],"wood",0,0,true);
 // raised wooden and brass border, a single central divider
 for(const x of [-8.4,8.4]){
  drawBox([x,-.02,0],[.35,.28,13.45],[.42,.28,.14,1],"wood");
  drawBox([x,.13,0],[.07,.035,13.45],[.74,.57,.29,1]);
 }
 for(const z of [-6.6,6.6]){
  drawBox([0,-.02,z],[16.8,.28,.33],[.42,.28,.14,1],"wood");
  drawBox([0,.13,z],[16.8,.035,.07],[.74,.57,.29,1]);
 }
 drawBox([0,.01,0],[13.3,.015,6.0],[.93,.97,.96,1],"felt",0,0,true);
 drawBox([0,.06,0],[16,.055,.085],[.68,.53,.28,1]);
 // engraved places, not gameplay slots; layout stays centred dynamically
 for(const owner of [0,1])for(const loc of M.layout(7,"board",owner)){
  drawBox([loc.p[0],.035,loc.p[2]],[1.50,.008,2.0],[.22,.33,.31,.48],null,0,0,true);
  drawBox([loc.p[0],.043,loc.p[2]],[1.43,.008,1.91],[.07,.16,.16,.8],null,0,0,true);
 }
 // deck stacks: depth is visible, counts are live HTML labels
 for(const owner of [0,1]){
  const [x,,z]=deckAnchor(owner);
  const count=game?.players?.[owner]?.deck?.length||0;
  const stack=Math.min(9,Math.ceil(count/4));
  drawBox([x,.02,z],[1.42,.13,2.0],[.33,.25,.15,1]);
  for(let i=0;i<stack;i++){
   drawBox([x,.14+i*.055,z],[1.12,.04,1.68],[.77,.69,.51,1]);
   drawBox([x,.167+i*.055,z],[1.12,.003,1.68],[1,1,1,1],"back",0,0,true);
  }
 }
 // small brass corner studs, real geometry, no invented character artwork
 for(const x of [-8.15,8.15])for(const z of [-6.32,6.32]){
  drawBox([x,.13,z],[.26,.12,.26],[.8,.62,.34,1],null,Math.PI/4);
 }
}
function makeLabel(key){
 const n=document.createElement("div");n.className="mw3d-object-label";n.dataset.key=key;labels.append(n);return n;
}
function nodeTarget(kind,owner,uid){
 return {kind,owner,...(uid?{uid}:{})};
}
function updateNodes(s){
 const next=new Map(),fresh=s!==lastGame,now=time(),d=duration();
 const add=(kind,owner,item,loc)=>{
  const key=M.key(kind,owner,item?.uid),old=fresh?null:nodes.get(key);
  const n=old||{key,kind,owner,uid:item?.uid,p:[...loc.p],target:[...loc.p],ry:loc.ry||0,w:loc.w,d:loc.d,label:makeLabel(key),opacity:1};
  const hp=kind==="hero"?s.players[owner].health:kind==="minion"?item.health:null;
  if(old&&hp!==null&&old.lastHealth!=null&&hp!==old.lastHealth&&old.screen){
    const delta=document.createElement("span");delta.className="mw3d-delta"+(hp>old.lastHealth?" heal":"");
    delta.textContent=(hp>old.lastHealth?"+":"")+String(hp-old.lastHealth);
    delta.style.transform=`translate(${old.screen.x}px,${old.screen.y-15}px)`;
    labels.append(delta);setTimeout(()=>delta.remove(),duration()?740:180);
  }
  n.lastHealth=hp;
  n.target=[...loc.p];n.w=loc.w;n.d=loc.d;n.targetRy=loc.ry||0;n.item=item||{};n.retiring=false;
  n.definition=item?.cardId?s.cards[item.cardId]:null;
  if(!old&&!fresh&&d){
   const removedHand=[...nodes.values()].find(x=>x.kind==="hand"&&x.owner===owner&&x.item.cardId===item?.cardId&&!s.players[owner].hand.some(h=>h.uid===x.uid));
   n.p=kind==="minion"&&removedHand?[...removedHand.p]:
      (kind==="hand"||kind==="back")?[deckAnchor(owner)[0],.65,deckAnchor(owner)[2]]:[loc.p[0],1.1,loc.p[2]];
   n.ry=n.targetRy;
  }
  if(kind==="hand"&&item.cardId==="__coin__")n.tex="coin";
  else if(kind==="hand"||kind==="minion")requestFace(n,n.definition,kind==="hand"?E().currentCost(s,owner,item):null);
  else if(kind==="hero")requestHeroArtTexture(n,s.players[owner].classId,E().isBright(s.time)?"day":"night");
   else n.tex="back";
  if(kind==="hero"){
   n.label.textContent=(owner===0?"ВЫ":"БОТ")+"  ♥ "+s.players[owner].health+(s.players[owner].armor?"  ◇ "+s.players[owner].armor:"");
   n.label.className="mw3d-object-label hero-label "+(owner===0?"own":"enemy");
  }else if(kind==="minion"){
   const atk=E().effectiveAttack(s,item);
   n.label.textContent=atk+" ⚔  "+item.health+" ♥";
   n.label.className="mw3d-object-label stats "+(owner===0?"own":"enemy");
   n.label.title=escapeText(item.name||n.definition?.name);
  }else if(kind==="hand"){
   n.label.textContent=String(E().currentCost(s,owner,item));
   n.label.className="mw3d-object-label mana-label";
  }else n.label.hidden=true;
  next.set(key,n);
 };
 if(fresh){for(const n of nodes.values())n.label.remove();ghosts.forEach(n=>n.label.remove());ghosts=[];}
 for(const owner of [0,1]){
  const pl=s.players[owner];
  const board=M.layout(pl.board.length,"board",owner);
  pl.board.forEach((m,i)=>add("minion",owner,m,board[i]));
  const hands=M.layout(pl.hand.length,"hand",owner);
  pl.hand.forEach((h,i)=>add(owner===0?"hand":"back",owner,owner===0?h:{uid:"hidden-"+i},hands[i]));
  add("hero",owner,{uid:"",health:pl.health},{p:[0,.22,owner===0?3.55:-3.55],w:2.02,d:1.82,ry:0});
 }
 if(!fresh)for(const [key,n] of nodes)if(!next.has(key)){
  n.label.remove();
  if(d&&n.kind==="minion"){n.retiring=true;n.end=now+d;n.start=now;ghosts.push(n);}
 }
 nodes=next;lastGame=s;
}
function updateHUD(){
 const s=game;
 $("mw3dEmpty").hidden=!!s;
 $("mw3dEnd").disabled=!s||s.phase!=="battle"||s.turn!==0||B()?.ui().busy;
 if(!s)return;
 const ck=M.clock(s.time),phase=ck.day?"day":"night";
 stage.dataset.phase=phase;
 $("mw3dTime").textContent=ck.label;$("mw3dPhase").textContent=ck.phase;
 const art=stage.querySelector(".mw3d-art-clock");
 art.style.setProperty("--mw-hour-angle",(ck.hour%12)*30+"deg");
 $("mw3dClock").setAttribute("aria-label",`${ck.label}, ${ck.phase}. Прошло ${ck.elapsed} из 12 часов фазы.`);
 const marks=$("mw3dMarks");
 if(!marks.children.length)for(let i=0;i<12;i++){
  const el=document.createElement("span");
  const a=i*Math.PI/6;
  el.dataset.index=String(i);el.style.left=(50+40*Math.sin(a))+"%";
  el.style.top=(50-40*Math.cos(a))+"%";marks.append(el);
 }
 [...marks.children].forEach((el,i)=>{
  el.className="mw-art-clock-marker "+phase+" "+(i<ck.elapsed?"on":"off");
  el.title=`${i+1}-й час: ${i<ck.elapsed?"пройден":"ожидается"}`;
 });
 for(const owner of [0,1]){
  const p=s.players[owner],pref=owner===0?"My":"Enemy";
  const info=E().heroPowerStatus(s,owner);
  $("mw3d"+pref+"Name").textContent=(owner===0?"ИГРОК":"БОТ")+" · "+p.classId;
  $("mw3d"+pref+"Resources").textContent=p.health+" ♥"+(p.armor?" · ◇ "+p.armor:"");
  $("mw3d"+pref+"DeckCount").textContent="Колода · "+p.deck.length+" карт";
  $("mw3d"+pref+"Mana").textContent="Мана · "+p.mana+"/"+p.maxMana;
  const corpseNode=$("mw3d"+pref+"Corpses"),graveNode=$("mw3d"+pref+"Grave");
  const corpseCount=Number(p.corpses)||0,graveCount=p.graveyard?.length||0;
  corpseNode.textContent=String(corpseCount);
  corpseNode.title="Трупы: "+corpseCount;
  corpseNode.setAttribute("aria-label","Трупы: "+corpseCount);
  graveNode.textContent=String(graveCount);
  graveNode.title="Кладбище: "+graveCount+" карт";
  graveNode.setAttribute("aria-label","Кладбище: "+graveCount+" карт");
  const abilityImage=global.MW_HERO_ART?.abilityFor(p.classId)||"";
  const powerNode=$("mw3d"+(owner===0?"Power":"EnemyPower"));
  powerNode.classList.toggle("mw3d-hero-ability-art",!!abilityImage);
  if(abilityImage)powerNode.style.setProperty("--mw-ability-image",`url("${abilityImage}")`);
  else powerNode.style.removeProperty("--mw-ability-image");
  if(owner===1){
   $("mw3dEnemyPower").textContent="✦ "+info.name+" · "+info.cost;
   $("mw3dEnemyPower").title="Сила героя противника";
  }
 }
 const ui=B()?.ui()||{},power=E().heroPowerStatus(s,0);
 $("mw3dPower").textContent="✦ "+power.name+" · "+power.cost;
 $("mw3dPower").disabled=!power.ok||ui.busy;
 $("mw3dPower").title=power.reason||"Использовать силу героя";
 $("mw3dCancel").hidden=!ui.pending&&!drag;
 $("mw3dTurnLabel").textContent=s.phase==="ended"?(s.winner==="draw"?"Ничья":s.winner===0?"Победа игрока":"Победа бота"):s.phase==="mulligan"?"Замена карт":s.turn===0?"Ваш ход":"Ход бота";
 notice(ui.pending?"Выберите допустимую цель. Esc — отмена.":s.turn===1?"Бот выбирает действия…":"Перенесите карту на своё поле или нажмите на неё. ПКМ — прочитать.");
 global.MW_HERO_HUD_V0511?.render3D(s);
 positionHUD();
}
function invalidateCards(){
 artRevision++;
 if(gl&&!gl.isContextLost())for(const [id,entry] of textures){
  if(id.startsWith("face:")){gl.deleteTexture(entry.t);textures.delete(id);}
 }
 if(enabled&&game)render(game);
}
function render(s){
 game=s||null;
 if(!enabled)return;
 try{
  if(!ready)initGL();
  if(game)updateNodes(game);
  else {for(const n of nodes.values())n.label.remove();nodes.clear();lastGame=null;}
  updateHUD();resize();wake();
 }catch(err){fail(err);}
}
function setEnabled(value){
 enabled=!!value;stage.hidden=!enabled;workspace.classList.toggle("mw3d-active",enabled);
 toggle.textContent=enabled?"◇ 3D: включено":"◇ 3D-прототип";toggle.setAttribute("aria-pressed",String(enabled));
 hover=null;focusKey=null;drag=null;pointer=null;attack=null;lockUntil=0;$("mw3dPreview").hidden=true;
 if(!enabled){cancelAnimationFrame(raf);raf=0;return false;}
 try{initGL();render(B()?.state()||game);return true;}catch(err){fail(err);return false;}
}
function validTarget(n){
 const ui=B()?.ui(),pending=ui?.pending;
 if(!game||!pending||ui.busy)return false;
 const t=nodeTarget(n.kind,n.owner,n.uid);
 if(pending.kind==="spell"){
  const h=game.players[0].hand.find(x=>x.uid===pending.uid);
  return !!h&&E().targetValid(game,0,h.cardId,t);
 }
 if(pending.kind==="hero-power")return E().heroPowerTargetValid(game,0,t);
 return E().eligibleAttackTargets(game,0).some(x=>x.kind===t.kind&&x.owner===t.owner&&(t.kind==="hero"||x.uid===t.uid));
}
function tick(stamp){
 raf=0;if(!active()||!ready||gl.isContextLost())return;
 const dt=Math.min(.05,(stamp-lastStamp)/1000||.016);lastStamp=stamp;
 const d=duration(),blend=d?1-Math.exp(-dt/(d/1000/4)):1;
 brightness+=(game&&E().isBright(game.time)?1-brightness:-brightness)*(d?Math.min(1,dt*5):1);
 gl.clearColor(.026+.025*brightness,.047+.017*brightness,.065+.006*brightness,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
 gl.bindBuffer(gl.ARRAY_BUFFER,geo);
 for(const [loc,size,offset] of [[attributes.p,3,0],[attributes.n,3,12],[attributes.uv,2,24]]){
  gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offset);
 }
 gl.uniformMatrix4fv(uniforms.VP,false,vp);gl.uniform1f(uniforms.Day,brightness);
 table();
 const now=time();
 const ordered=[...nodes.values(),...ghosts].sort((a,b)=>a.p[2]-b.p[2]);
 const ui=B()?.ui()||{};
 for(const n of ordered){
  const hovered=(hover===n.key||focusKey===n.key)&&!drag;
  const desired=[...n.target];
  if(hovered&&n.kind==="hand")desired[1]+=.65;
  if(drag?.key===n.key&&drag.world){desired[0]=drag.world[0];desired[1]=1.4;desired[2]=drag.world[2];}
  if(n.retiring){desired[1]+=1.0;n.opacity=M.clamp((n.end-now)/(n.end-n.start),0,1);}
  for(let j=0;j<3;j++)n.p[j]+=(desired[j]-n.p[j])*(drag?.key===n.key?1:blend);
  n.ry+=(n.targetRy-n.ry)*blend;
  const pos=[...n.p];
  if(attack&&attack.key===n.key){
   const f=(now-attack.start)/attack.duration;
   if(f>=1)attack=null;
   else{
    const a=Math.sin(Math.PI*f)*.58;
    pos[0]+=(attack.to[0]-attack.from[0])*a;pos[2]+=(attack.to[2]-attack.from[2])*a;pos[1]+=.45*Math.sin(Math.PI*f);
   }
  }
  const size=hovered&&n.kind==="hand"?1.10:1,w=n.w*size,depth=n.d*size;
  const targeted=validTarget(n);
  const selected=ui.pending?.uid===n.uid&&n.owner===0&&ui.pending?.uid!=null ||
    (ui.pending?.hero&&n.kind==="hero"&&n.owner===0);
  const readyUnit=n.kind==="minion"&&n.owner===0&&n.item.ready&&!n.item.attacked&&game?.turn===0;
  if(targeted||selected||hovered||readyUnit){
   const color=targeted?[.46,.90,.74,.72]:selected?[1,.80,.35,.85]:hovered?[.95,.83,.52,.65]:[.35,.65,.59,.36];
   drawBox([pos[0],.08,pos[2]],[w+.15,.02,depth+.15],color,null,n.ry,0,true,1);
  }
  drawBox([pos[0]+.09,.085,pos[2]+.11],[w*1.2+pos[1]*.15,.002,depth*1.2],[1,1,1,n.opacity*.65],"shadow",n.ry,0,true,1);
  const body=n.kind==="hero"?[.58,.44,.22,n.opacity]:n.kind==="minion"?[.54,.43,.27,n.opacity]:[.80,.74,.59,n.opacity];
  drawBox(pos,[w,n.kind==="hero"?.16:.075,depth],body,null,n.ry);
  const topPos=[pos[0],pos[1]+(n.kind==="hero"?.085:.041),pos[2]];
  drawBox(topPos,[w*.988,.001,depth*.988],[1,1,1,n.opacity],textures.has(n.tex)?n.tex:"back",n.ry,0,true,n.kind==="hero"?.1:.4);
  n.drawPos=pos;n.poly=topPolygon(topPos,w,depth,n.ry);n.screen=M.project(pos,vp,cw,ch);
  if(n.kind==="minion"&&n.poly[0]&&n.poly[1]){
   const projectedWidth=Math.abs(n.poly[1].x-n.poly[0].x);
   n.label.style.fontSize=Math.max(10,Math.min(14,projectedWidth/4.8))+"px";
   n.label.style.padding="3px 5px";
  }
  if(n.label.isConnected&&n.screen){
   const badgePoint=M.project([pos[0],pos[1]+.09,pos[2]+(n.kind==="hand"?-.9:n.kind==="hero"?-.12:depth*.40)],vp,cw,ch);
   if(badgePoint){n.label.style.transform=`translate(${badgePoint.x}px,${badgePoint.y}px) translate(-50%,-50%)`;n.label.hidden=n.kind==="back"||n.retiring;}
  }
 }
 ghosts=ghosts.filter(n=>n.end>now);
 const aim=$("mw3dAim"),path=aim.querySelector(":scope > path");
 if(drag?.source&&pointer){
  const source=nodes.get(drag.key),p=source?.screen;
  if(p){aim.style.display="block";path.setAttribute("d",`M ${p.x} ${p.y} Q ${(p.x+pointer.x)/2} ${Math.min(p.y,pointer.y)-40} ${pointer.x} ${pointer.y}`);}
 }else aim.style.display="none";
 frameCount++;frame=stamp;
 raf=requestAnimationFrame(tick);
}
function wake(){if(active()&&!raf)raf=requestAnimationFrame(tick);}
function animateAttack(source,target){
 if(!enabled||!duration())return;
 const from=nodes.get(M.key(source.kind,source.owner,source.uid))||ghosts.find(n=>n.key===M.key(source.kind,source.owner,source.uid));
 const to=nodes.get(M.key(target.kind,target.owner,target.uid))||ghosts.find(n=>n.key===M.key(target.kind,target.owner,target.uid));
 if(from&&to){
  attack={key:from.key,from:[...from.p],to:[...to.p],start:time(),duration:duration()};
  lockUntil=time()+duration();
 }
}
function pick(x,y){
 return [...nodes.values()].filter(n=>n.kind!=="back"&&M.inside(x,y,n.poly))
   .sort((a,b)=>(a.screen?.depth||0)-(b.screen?.depth||0))[0]||null;
}
function sourceFor(n){
 return n&&((n.kind==="hand")||(n.kind==="minion"&&n.owner===0))?nodeTarget(n.kind,n.owner,n.uid):null;
}
function targetAt(x,y,source){
 const n=pick(x,y),p=M.rayPlane(x,y,cw,ch,inv,.1);
 if(n?.kind==="hero")return nodeTarget("hero",n.owner);
 if(n?.kind==="minion")return nodeTarget("minion",n.owner,n.uid);
 if(p&&Math.abs(p[0])<=8&&Math.abs(p[2])<=6.5)return {kind:"board",owner:p[2]>=0?0:1};
 return null;
}
function run(action){
 if(time()<lockUntil){notice("Дождитесь завершения текущего движения.");return {ok:false,reason:"Анимация действия."};}
 const result=B()?.dispatch(action)||{ok:false,reason:"Игра ещё загружается."};
 if(!result.ok)notice(result.reason||"Действие недоступно.");
 else if(result.changed&&duration())lockUntil=time()+duration();
 wake();return result;
}
function activate(n){
 if(!n)return;
 if(n.kind==="hand")run({type:"hand",uid:n.uid});
 else if(n.kind==="minion")run({type:"minion",owner:n.owner,uid:n.uid});
 else if(n.kind==="hero")run({type:"hero",owner:n.owner});
}
let previewToken=0;
function preview(n){
 const panel=$("mw3dPreview"),token=++previewToken;
 if(!n?.definition||drag){panel.hidden=true;return;}
 panel.hidden=false;panel.querySelector("strong").textContent=n.definition.name||"";
 panel.querySelector("p").textContent=n.definition.ability||"Без описания способности.";
 panel.querySelector("img").removeAttribute("src");
 global.MW_BATTLE_CARD_RENDERER.request(n.definition,"full").then(url=>{
  if(token===previewToken&&url)panel.querySelector("img").src=url;
 });
}
function position(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener("pointerdown",e=>{
 if(e.button!==0)return;
 const p=position(e),n=pick(p.x,p.y);
 pointer={...p,startX:p.x,startY:p.y,id:e.pointerId,key:n?.key||null};
 canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});
});
canvas.addEventListener("pointermove",e=>{
 const p=position(e);
 if(pointer&&pointer.id===e.pointerId){
  pointer.x=p.x;pointer.y=p.y;
  const original=nodes.get(pointer.key),source=sourceFor(original);
  if(!drag&&source&&Math.hypot(p.x-pointer.startX,p.y-pointer.startY)>7&&time()>=lockUntil){
   drag={key:original.key,source,world:null};$("mw3dPreview").hidden=true;
  }
  if(drag){
   drag.world=M.rayPlane(p.x,p.y,cw,ch,inv,1.4);
   // Hide the dragged card from hit tests so the destination is not itself.
   const own=nodes.get(drag.key),poly=own?.poly;if(own)own.poly=null;
   const target=targetAt(p.x,p.y,drag.source);if(own)own.poly=poly;
   const plan=B()?.plan(drag.source,target);
   notice(plan?.ok?"Отпустите карту: действие допустимо.":plan?.reason||"Перенесите на допустимую цель.");
  }
 }else{
  const n=pick(p.x,p.y),key=n?.key||null;
  if(hover!==key){hover=key;preview(n);}
  canvas.style.cursor=n?"pointer":"default";
 }
});
canvas.addEventListener("pointerup",e=>{
 if(!pointer||e.pointerId!==pointer.id)return;
 const p=position(e),key=pointer.key,wasDrag=drag;
 if(wasDrag){
  const n=nodes.get(wasDrag.key),poly=n?.poly;if(n)n.poly=null;
  const target=targetAt(p.x,p.y,wasDrag.source);if(n)n.poly=poly;
  drag=null;pointer=null;
  run({type:"drop",source:wasDrag.source,target});
 }else{
  pointer=null;
  const n=pick(p.x,p.y);
  if(n?.key===key)activate(n);
 }
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
});
const abortPointer=()=>{drag=null;pointer=null;hover=null;$("mw3dPreview").hidden=true;wake();};
canvas.addEventListener("pointercancel",abortPointer);
canvas.addEventListener("lostpointercapture",()=>{if(pointer)abortPointer();});
canvas.addEventListener("pointerleave",()=>{if(!pointer){hover=null;$("mw3dPreview").hidden=true;}});
canvas.addEventListener("contextmenu",e=>{
 e.preventDefault();const p=position(e),n=pick(p.x,p.y);
 if(n&&["hand","minion"].includes(n.kind)){B()?.inspect(n.owner,n.kind,n.uid);$("mw3dPreview").hidden=true;}
});
canvas.addEventListener("keydown",e=>{
 if(e.key==="Escape"){abortPointer();run({type:"cancel"});e.preventDefault();}
 const list=[...nodes.values()].filter(n=>n.kind!=="back");
 if(["ArrowRight","ArrowLeft","ArrowDown","ArrowUp"].includes(e.key)){
  const i=list.findIndex(n=>n.key===focusKey),step=["ArrowRight","ArrowDown"].includes(e.key)?1:-1;
  const n=list[(i+step+list.length)%list.length];if(n){focusKey=n.key;preview(n);notice(n.definition?.name||"Герой");}
  e.preventDefault();
 }
 const n=nodes.get(focusKey);
 if(e.key==="Enter"&&n){activate(n);e.preventDefault();}
 if(e.key.toLowerCase()==="i"&&n&&["hand","minion"].includes(n.kind))B()?.inspect(n.owner,n.kind,n.uid);
});
canvas.addEventListener("webglcontextlost",e=>{
 e.preventDefault();contextLossCount++;ready=false;fail(Error("Контекст WebGL потерян. Состояние партии не изменено; возвращён 2D-режим."));
});
canvas.addEventListener("webglcontextrestored",()=>{ready=false;nodes.forEach(n=>{n.tex=null;});});
toggle.onclick=()=>setEnabled(!enabled);
$("mw3dBack").onclick=()=>setEnabled(false);
$("mw3dStart").onclick=()=>B()?.start();
$("mw3dEnd").onclick=()=>run({type:"endTurn"});
$("mw3dCancel").onclick=()=>{abortPointer();lockUntil=0;run({type:"cancel"});};
$("mw3dPower").onclick=()=>run({type:"power"});
$("mw3dMyGrave").onclick=()=>B()?.graveyard(0);$("mw3dEnemyGrave").onclick=()=>B()?.graveyard(1);
$("mw3dMotion").onchange=e=>{
 motion=e.target.value;try{localStorage.setItem("mw-3d-motion-v2.1H",motion);}catch(_){}
 if(!duration()){lockUntil=0;attack=null;}wake();
};
$("mw3dQuality").onchange=e=>{quality=e.target.value;try{localStorage.setItem("mw-3d-quality-v2.1H",quality);}catch(_){}resize();wake();};
const observer=new ResizeObserver(()=>{if(enabled){resize();wake();}});observer.observe(stage);
new MutationObserver(()=>{if(workspace.hidden){cancelAnimationFrame(raf);raf=0;}else if(enabled){resize();wake();}}).observe(workspace,{attributes:true,attributeFilter:["hidden"]});
document.addEventListener("visibilitychange",()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
function onBridge(){
 if(global.location.hash==="#arena3d"){
  // Opening this link only selects the mode, never starts or overwrites a saved match.
  document.querySelector('[data-app-mode="battle"]')?.click();setEnabled(true);
 }
}
global.addEventListener("mw-battle-view-ready",onBridge);
global.MW_ARENA_3D={
 render,setEnabled,animateAttack,invalidateCards,invalidateHeroes,
 stats:()=>({enabled,ready,webgl:!!gl&&!gl.isContextLost(),renderer:"WebGL 1",nodes:nodes.size,
  textures:textures.size,artRevision,heroRevision,textureRequests,failedTextures,frames:frameCount,contextLossCount,
  animation:motion,reducedMotion:!!reduced?.matches,quality,errors:[...stateErrors],clock:game?M.clock(game.time):null}),
 pointFor:(kind,owner,uid="")=>{
  const n=nodes.get(M.key(kind,owner,uid));
  if(!n?.screen)return null;
  const r=canvas.getBoundingClientRect();return {x:r.left+n.screen.x,y:r.top+n.screen.y};
 },
 boardPoint:owner=>{
  const p=M.project([owner===0?0:0,.2,owner===0?2.4:-2.4],vp,cw,ch),r=canvas.getBoundingClientRect();
  return p?{x:r.left+p.x,y:r.top+p.y}:null;
 },
 debugNodes:()=>[...nodes.values()].map(n=>({key:n.key,kind:n.kind,owner:n.owner,cardId:n.definition?.cardId||null,p:[...n.p],screen:n.screen,bounds:n.poly?.every(Boolean)?{left:Math.min(...n.poly.map(p=>p.x)),right:Math.max(...n.poly.map(p=>p.x)),top:Math.min(...n.poly.map(p=>p.y)),bottom:Math.max(...n.poly.map(p=>p.y))}:null,hasTexture:textures.has(n.tex)})),
 isAnimating:()=>time()<lockUntil,
 // Tests can force a graphics-loss event; the resulting handler uses the same safe fallback as a real loss.
 context:()=>gl
};
})(window);
