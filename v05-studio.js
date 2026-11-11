/* Mythical Wars, v05 Stage 1: authoritative layered reference viewer.
 * No persistence or game-state mutations. The individual layer files come from
 * the supplied v05 package, not an earlier template or flattened imitation.
 */
(function(){
"use strict";
const meta=window.MW_V05_META;
const $=id=>document.getElementById(id);
if(!meta || meta.version!=="v05" || meta.control_cards.length!==3){
  $("verifyMessage").textContent="Ошибка: схема v05 не найдена или неполна.";return;
}
const state={card:0,layerElements:[],token:0};
const tags={Creature:"Существо",Weapon:"Оружие",Spell:"Заклинание"};
$("sourceStatus").textContent=`Манифест ${meta.version} · ${meta.assets_checked} проверенных элементов`;
function setNotice(msg,bad=false){$("verifyMessage").textContent=msg;$("verifyMessage").classList.toggle("warning",bad)}
const loadImg=src=>new Promise((resolve,reject)=>{
  const img=new Image();img.decoding="async";
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error("Не удалось загрузить: "+src));img.src=src;
});
function updateButtons(){
  const list=$("cards");list.textContent="";
  meta.control_cards.forEach((card,index)=>{
    const button=document.createElement("button");button.type="button";
    button.className="card-choice"+(index===state.card?" selected":"");
    const image=document.createElement("img");image.src=card.reference;image.alt="";
    const content=document.createElement("span");
    const a=document.createElement("strong");a.textContent=card.id;
    const b=document.createElement("small");b.textContent=tags[card.type]+" · "+card.name;
    content.append(a,b);button.append(image,content);
    button.addEventListener("click",()=>selectCard(index));list.append(button);
  });
}
function buildLayers(card){
  const stack=$("layerStack");stack.textContent="";
  const listing=$("layerList");listing.textContent="";
  state.layerElements=[];
  for(const [idx,layer] of card.layers.entries()){
    const im=document.createElement("img");
    im.src=layer.path;im.alt="";im.dataset.layer=String(idx);
    im.style.zIndex=String(idx+1);stack.append(im);
    const label=document.createElement("label");label.className="layer-item";
    const cb=document.createElement("input");cb.type="checkbox";cb.checked=true;
    cb.addEventListener("change",()=>{im.style.display=cb.checked?"":"none";
      setNotice("Изменена видимость слоёв. Нажми «Проверить совпадение» для сравнения.",true)});
    const name=document.createElement("span");name.textContent=layer.name;
    label.append(cb,name);listing.append(label);
    state.layerElements.push({img:im,checkbox:cb,path:layer.path});
  }
}
function selectCard(index){
  state.card=index;const token=++state.token;
  const card=meta.control_cards[index];
  updateButtons();
  $("selectedId").textContent=card.id+" · "+tags[card.type];
  $("selectedName").textContent=card.name;
  $("layersCount").textContent=card.layers.length+" слоёв";
  $("reference").src=card.reference;
  $("reference").alt=card.name+" — утверждённый PNG v05";
  $("downloadReference").href=card.reference;
  $("downloadReference").download=card.id+"_card_v05.png";
  $("facts").textContent="";
  for(const [key,value] of [["ID",card.id],["Тип",tags[card.type]],["Класс",card.class],
    ["Мана",card.cost],["Геометрия","1024 × 1536"],["Порядок",card.layers.length+" независимых слоёв"]]){
    const dt=document.createElement("dt"),dd=document.createElement("dd");
    dt.textContent=key;dd.textContent=value; $("facts").append(dt,dd);
  }
  buildLayers(card);
  setNotice("Слои загружаются. Для проверки наложения нажми «Проверить совпадение».",false);
  Promise.all(state.layerElements.map(el=>new Promise((res,rej)=>{
    if(el.img.complete){el.img.naturalWidth?res():rej()} else {
      el.img.addEventListener("load",res,{once:true});
      el.img.addEventListener("error",rej,{once:true});
    }}))).then(()=>{
      if(token===state.token)setNotice("Все "+card.layers.length+" слоёв загружены. Эталон и сборка расположены рядом.");
    }).catch(()=>{
      if(token===state.token)setNotice("Не все слои загрузились. Проверь целостность архива.",true)
    });
}
$("allLayersBtn").addEventListener("click",()=>{
  state.layerElements.forEach(el=>{el.checkbox.checked=true;el.img.style.display=""});
  setNotice("Все слои включены. Можно выполнить пиксельное сравнение.");
});
$("verifyBtn").addEventListener("click",async()=>{
  const token=state.token;const card=meta.control_cards[state.card];
  $("verifyBtn").disabled=true;setNotice("Сверяем каждый пиксель RGBA…");
  try{
    const imgs=await Promise.all(state.layerElements.map(el=>loadImg(el.path)));
    const ref=await loadImg(card.reference);
    if(token!==state.token)return;
    const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=1536;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    for(let i=0;i<imgs.length;i++){
      if(state.layerElements[i].checkbox.checked)ctx.drawImage(imgs[i],0,0);
    }
    const generated=ctx.getImageData(0,0,1024,1536).data;
    ctx.clearRect(0,0,1024,1536);ctx.drawImage(ref,0,0);
    const original=ctx.getImageData(0,0,1024,1536).data;
    let errors=0,max=0;
    for(let p=0;p<generated.length;p+=4){
      let bad=false;
      for(let c=0;c<4;c++){
        const d=Math.abs(generated[p+c]-original[p+c]);
        if(d){bad=true;if(d>max)max=d}
      }if(bad)errors++;
    }
    setNotice(errors===0?
      "✓ Пиксельное совпадение 100%: все 1 572 864 пикселя RGBA идентичны эталону.":
      "Найдены отличия: "+errors.toLocaleString("ru-RU")+" пикселей; максимальное отклонение "+max+".",errors!==0);
  }catch(err){
    // A file:// browser may taint canvas, so keep static viewer usable.
    setNotice("Браузер ограничил сравнение пикселей: "+err.message+
      ". Независимая проверка исходных слоёв зафиксирована в отчёте релиза.",true);
  }finally{$("verifyBtn").disabled=false}
});
selectCard(0);
})();
