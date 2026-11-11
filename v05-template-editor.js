/* Mythical Wars v05.12 — interactive non-destructive layout editor.
 * Runs only in v05-dynamic.html; does not modify the battle engine or approved asset manifest.
 */
(function(){
"use strict";
const API=window.MW_V05_TEMPLATE_CORE;
if(!API)return;
const $=id=>document.getElementById(id);
const SHA=window.MW_V05_MANIFEST_SHA256||'';
const dbName='mw-v05-template-drafts';
function openDB(){return new Promise((ok,no)=>{
  if(!window.indexedDB){no(Error('IndexedDB недоступна'));return}
  const req=indexedDB.open(dbName,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('templates'))req.result.createObjectStore('templates')};
  req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error||Error('IndexedDB'));
})}
async function dbGet(type){const db=await openDB();return new Promise((ok,no)=>{
  const tx=db.transaction('templates','readonly');const req=tx.objectStore('templates').get(type);
  req.onsuccess=()=>ok(req.result||null);req.onerror=()=>no(req.error||Error('чтение'));tx.oncomplete=()=>db.close();
})}
async function dbSet(type,data){const db=await openDB();return new Promise((ok,no)=>{
  const tx=db.transaction('templates','readwrite');tx.objectStore('templates').put(data,type);
  tx.oncomplete=()=>{db.close();ok()};tx.onerror=()=>{db.close();no(tx.error||Error('запись'))};
})}
function download(filename,content){
  const blob=new Blob([content],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function create({manifest,requestPaint}){
  const c={layout:API.defaultLayout('Creature'),type:'Creature',selected:null,plan:[],history:[],future:[],drag:null,
    ready:false,revision:0,timer:null,edit:true};
  const memoryLayouts=new Map();const saveTimers=new Map();
  const overlay=$('templateSelectionCanvas');const octx=overlay.getContext('2d');
  function status(msg,error=false){const n=$('tplStatus');n.textContent=msg;n.classList.toggle('bad',error)}
  function snapshot(){return API.copy(c.layout)}
  function record(before){if(JSON.stringify(before)===JSON.stringify(c.layout))return;
    c.history.push(before);if(c.history.length>40)c.history.shift();c.future=[];scheduleSave();updateUndo()}
  function scheduleSave(){
    const rev=++c.revision,type=c.type,data=snapshot();
    memoryLayouts.set(type,data);
    if(saveTimers.has(type))clearTimeout(saveTimers.get(type));
    saveTimers.set(type,setTimeout(async()=>{
      saveTimers.delete(type);
      try{await dbSet(type,data);
        if(c.type===type&&c.revision===rev)status('Черновик шаблона '+type+' сохранён в браузере.');
      }catch(err){
        // IndexedDB can be denied in sandboxed, private or file:// contexts.
        // Keep the in-memory draft and attempt a nonessential localStorage fallback.
        let fallback=false;
        try{localStorage.setItem('MW_v05_template_v1_'+type,JSON.stringify(data));fallback=true}catch{}
        if(c.type===type&&c.revision===rev)status(fallback?
          'Черновик '+type+' сохранён в localStorage (IndexedDB недоступна).':
          'Черновик '+type+' сохранён только до закрытия вкладки: '+err.message,!fallback);
      }
    },300));
  }
  function updateUndo(){
    $('tplUndo').disabled=!c.history.length;$('tplRedo').disabled=!c.future.length;
    $('tplDelete').disabled=!(c.selected||'').startsWith('custom:');
  }
  function compose(plan,card){
    const descriptors=API.descriptors(plan,card,manifest);
    c.plan=API.compose(descriptors,c.layout);
    if(c.selected&&!c.plan.some(i=>i.id===c.selected))c.selected=null;
    refreshList();updateInspector();drawOverlay();return c.plan;
  }
  function chosen(){return c.plan.find(item=>item.id===c.selected)||null}
  function setOverride(id,delta){const prev=c.layout.overrides[id]||{};
    c.layout.overrides[id]={...prev,...delta};
  }
  function mutate(delta,committed=true){const item=chosen();if(!item)return;
    const before=committed?snapshot():null;
    setOverride(item.id,delta);
    if(committed)record(before);
    requestPaint();
    if(committed)updateInspector();
  }
  function choose(id){c.selected=id;refreshList();updateInspector();drawOverlay();}
  function description(item){return item.kind==='custom'?'Добавленный значок':
    item.kind==='asset'?'Слой оригинального шаблона':item.kind==='component'?'Группа оригинальных иконок':
    item.kind==='art'?'Арт с исходной маской':item.kind==='text'?'Текстовый слой':'Числовой показатель'}
  function refreshList(){
    const list=$('tplLayerList');if(!list)return;
    // A render never destroys the focused position input; only the layer list is rebuilt.
    list.replaceChildren();
    for(const item of [...c.plan].reverse()){
      const row=document.createElement('div');row.className='tpl-layer'+(item.id===c.selected?' selected':'');
      row.dataset.layerId=item.id;
      const select=document.createElement('button');select.type='button';select.className='tpl-layer-select';
      const sym=document.createElement('span');sym.className='tpl-layer-glyph';sym.textContent=({asset:'▦',art:'◉',component:'✦',text:'T',number:'#',custom:'✚'})[item.kind]||'•';
      const name=document.createElement('span');name.className='tpl-layer-name';name.textContent=item.label;
      name.title=item.id;
      select.append(sym,name);
      select.onclick=()=>choose(item.id);
      const vis=document.createElement('button');vis.className='tpl-layer-action';vis.type='button';
      vis.textContent=item.transform.visible?'◉':'○';vis.title=item.transform.visible?'Скрыть слой':'Показать слой';
      vis.setAttribute('aria-label',(item.transform.visible?'Скрыть ':'Показать ')+item.label);
      vis.onclick=()=>{const before=snapshot();setOverride(item.id,{visible:!item.transform.visible});record(before);requestPaint();updateInspector()};
      const lock=document.createElement('button');lock.className='tpl-layer-action';lock.type='button';
      lock.textContent=item.transform.locked?'🔒':'♧';lock.title=item.transform.locked?'Разблокировать':'Заблокировать';
      lock.setAttribute('aria-label',(item.transform.locked?'Разблокировать ':'Заблокировать ')+item.label);
      lock.onclick=()=>{const before=snapshot();setOverride(item.id,{locked:!item.transform.locked});record(before);requestPaint();updateInspector()};
      row.append(select,vis,lock);list.append(row);
    }
    $('tplLayerCount').textContent=c.plan.length+' слоёв';updateUndo();
  }
  function field(id,value){const el=$(id);if(el&&document.activeElement!==el)el.value=String(value)}
  function updateInspector(){
    const item=chosen();const disabled=!item;
    $('tplSelected').textContent=item?item.label:'Выберите слой в списке или на карте';
    $('tplSelectedInfo').textContent=item?description(item):'Перемещайте выделенный элемент мышью.';
    for(const id of ['tplX','tplY','tplScaleX','tplScaleY','tplRotate','tplOpacity'])$(id).disabled=disabled;
    for(const id of ['tplUp','tplDown','tplHide','tplLock'])$(id).disabled=disabled;
    $('tplDelete').disabled=!item||item.kind!=='custom';
    if(!item)return;
    const t=item.transform;
    field('tplX',Math.round(t.x));field('tplY',Math.round(t.y));
    field('tplScaleX',Math.round(t.scaleX*100));field('tplScaleY',Math.round(t.scaleY*100));
    field('tplRotate',Math.round(t.rotation));field('tplOpacity',Math.round(t.opacity*100));
    $('tplHide').textContent=t.visible?'Скрыть':'Показать';
    $('tplLock').textContent=t.locked?'Разблокировать':'Заблокировать';
  }
  function reorder(direction){const item=chosen();if(!item)return;const list=c.plan.map(x=>x.id),i=list.indexOf(item.id),j=i+direction;
    if(j<0||j>=list.length)return;const before=snapshot();[list[i],list[j]]=[list[j],list[i]];
    c.layout.order=list;record(before);requestPaint();status('Порядок слоёв изменён.');
  }
  function historyAction(redo){const from=redo?c.future:c.history,to=redo?c.history:c.future;if(!from.length)return;
    to.push(snapshot());c.layout=from.pop();scheduleSave();updateUndo();requestPaint();updateInspector();
  }
  function reset(){if(!confirm('Восстановить исходное расположение и убрать ВСЕ добавленные иконки для типа '+c.type+'?'))return;
    const before=snapshot();c.layout=API.defaultLayout(c.type);c.selected=null;record(before);requestPaint();updateInspector();
    status('Исходный шаблон восстановлен в черновике.');
  }
  function toCanvasPoint(ev){const r=overlay.getBoundingClientRect();return {
    x:(ev.clientX-r.left)/r.width*1024,y:(ev.clientY-r.top)/r.height*1536
  }}
  function nearCorner(pt,item){const p=API.polygon(item)[2];return Math.hypot(pt.x-p[0],pt.y-p[1])<45}
  function drawOverlay(){octx.clearRect(0,0,1024,1536);if(!c.edit)return;
    const item=chosen();if(!item||!item.transform.visible)return;
    const points=API.polygon(item);octx.save();octx.lineWidth=3.5;
    octx.strokeStyle='#77f0dc';octx.setLineDash([15,9]);octx.beginPath();
    points.forEach(([x,y],i)=>i?octx.lineTo(x,y):octx.moveTo(x,y));octx.closePath();octx.stroke();octx.setLineDash([]);
    octx.fillStyle='#e5bb74';for(const [x,y] of points){octx.fillRect(x-7,y-7,14,14)}
    octx.fillStyle='#0c2527';octx.fillRect(points[2][0]-18,points[2][1]-18,36,36);
    octx.strokeStyle='#e5bb74';octx.lineWidth=3;octx.strokeRect(points[2][0]-18,points[2][1]-18,36,36);
    octx.restore();
  }
  function onPointerDown(ev){if(!c.edit||ev.button!==0)return;
    const pt=toCanvasPoint(ev),selected=chosen();
    let item=selected&&nearCorner(pt,selected)?selected:API.hitTest(c.plan,pt.x,pt.y);
    if(!item){choose(null);return}
    choose(item.id);if(item.transform.locked){status('Слой заблокирован. Снимите блокировку.');return}
    c.drag={pointerId:ev.pointerId,mode:nearCorner(pt,item)?'resize':'move',pt,
      initial:API.copy(item.transform),before:snapshot(),itemId:item.id};
    try{overlay.setPointerCapture(ev.pointerId)}catch{}
    ev.preventDefault();
  }
  function onPointerMove(ev){const d=c.drag;if(!d||d.pointerId!==ev.pointerId)return;
    const pt=toCanvasPoint(ev),dx=pt.x-d.pt.x,dy=pt.y-d.pt.y;
    let next;
    if(d.mode==='resize'){
      const item=chosen();if(!item)return;
      const angle=-d.initial.rotation*Math.PI/180;
      const localX=dx*Math.cos(angle)-dy*Math.sin(angle),localY=dx*Math.sin(angle)+dy*Math.cos(angle);
      const factorX=Math.max(.1,(item.box.w*d.initial.scaleX+localX*2)/item.box.w);
      const factorY=Math.max(.1,(item.box.h*d.initial.scaleY+localY*2)/item.box.h);
      const sx=API.clamp(factorX,.1,5),sy=API.clamp(factorY,.1,5);
      next={scaleX:sx,scaleY:$('tplKeepRatio').checked?sx:sy};
    }else{
      const snap=$('tplSnap').checked?8:1;
      next={x:Math.round((d.initial.x+dx)/snap)*snap,y:Math.round((d.initial.y+dy)/snap)*snap};
    }
    setOverride(d.itemId,next);requestPaint();ev.preventDefault();
  }
  function onPointerUp(ev){const d=c.drag;if(!d||d.pointerId!==ev.pointerId)return;
    c.drag=null;try{overlay.releasePointerCapture(ev.pointerId)}catch{}
    record(d.before);requestPaint();updateInspector();ev.preventDefault();
  }
  overlay.addEventListener('pointerdown',onPointerDown);
  overlay.addEventListener('pointermove',onPointerMove);
  overlay.addEventListener('pointerup',onPointerUp);
  overlay.addEventListener('pointercancel',onPointerUp);
  for(const [id,key,mult] of [['tplX','x',1],['tplY','y',1],['tplScaleX','scaleX',.01],['tplScaleY','scaleY',.01],['tplRotate','rotation',1],['tplOpacity','opacity',.01]]){
    $(id).addEventListener('change',()=>{
      const item=chosen();if(!item)return;
      const raw=Number($(id).value);if(!Number.isFinite(raw)){updateInspector();return}
      let n=raw*mult;
      const limits={x:[-2048,3072],y:[-2048,3584],scaleX:[.1,5],scaleY:[.1,5],rotation:[-180,180],opacity:[0,1]};
      n=API.clamp(n,...limits[key]);const delta={[key]:n};
      if((key==='scaleX'||key==='scaleY')&&$('tplKeepRatio').checked){delta.scaleX=n;delta.scaleY=n}
      mutate(delta);
    });
  }
  $('tplUp').onclick=()=>reorder(1);$('tplDown').onclick=()=>reorder(-1);
  $('tplHide').onclick=()=>{const it=chosen();if(it)mutate({visible:!it.transform.visible})};
  $('tplLock').onclick=()=>{const it=chosen();if(it)mutate({locked:!it.transform.locked})};
  $('tplUndo').onclick=()=>historyAction(false);$('tplRedo').onclick=()=>historyAction(true);
  $('tplResetTemplate').onclick=reset;
  $('tplDelete').onclick=()=>{const it=chosen();if(!it||it.kind!=='custom')return;
    const before=snapshot();c.layout.custom=c.layout.custom.filter(x=>x.id!==it.id);
    delete c.layout.overrides[it.id];c.layout.order=c.layout.order.filter(x=>x!==it.id);
    c.selected=null;record(before);requestPaint();updateInspector();status('Пользовательская иконка удалена из черновика.');
  };
  $('tplEditMode').addEventListener('change',()=>{c.edit=$('tplEditMode').checked;overlay.style.pointerEvents=c.edit?'auto':'none';drawOverlay()});
  $('tplExport').onclick=()=>{
    const payload={...snapshot(),kind:'MW_v05_template_draft',sourceManifestSha:SHA,exportedAt:new Date().toISOString()};
    download('MW_v05.12_Template_'+c.type+'.json',JSON.stringify(payload,null,2));
    status('Шаблон '+c.type+' экспортирован в JSON (включая свои иконки).');
  };
  $('tplImport').addEventListener('change',async ev=>{
    const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
    try{
      if(file.size>48*1024*1024)throw Error('JSON превышает лимит 48 МиБ');
      const data=JSON.parse(await file.text());
      if(data.kind!=='MW_v05_template_draft')throw Error('Это не файл черновика шаблона v05');
      if(data.sourceManifestSha!==SHA)throw Error('SHA оригинального манифеста не совпадает');
      const next=API.normalize(data,c.type),before=snapshot();
      c.layout=next;c.selected=null;record(before);requestPaint();updateInspector();
      status('Шаблон импортирован для '+c.type+'.');
    }catch(err){status('Ошибка импорта: '+err.message,true)}
  });
  $('tplAddIcon').addEventListener('change',async ev=>{
    const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
    const targetType=c.type;
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Разрешены PNG, JPEG, WebP');
      if(file.size>8*1024*1024)throw Error('Файл иконки больше 8 МиБ');
      if(c.layout.custom.length>=24)throw Error('Максимум 24 свои иконки для одного шаблона');
      const url=URL.createObjectURL(file);let pic;
      try{pic=await new Promise((ok,no)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=()=>no(Error('Не удалось прочитать изображение'));img.src=url})}
      finally{URL.revokeObjectURL(url)}
      if(!pic.width||!pic.height||pic.width>8192||pic.height>8192)throw Error('Размер изображения некорректен');
      const ratio=Math.min(1,512/Math.max(pic.width,pic.height));
      const cvs=document.createElement('canvas');cvs.width=Math.max(1,Math.round(pic.width*ratio));cvs.height=Math.max(1,Math.round(pic.height*ratio));
      cvs.getContext('2d').drawImage(pic,0,0,cvs.width,cvs.height);
      const data=cvs.toDataURL('image/webp',.90);
      if(!API.dataURLok(data))throw Error('После обработки иконка превышает 2 МиБ');
      if(c.type!==targetType)throw Error('Во время загрузки выбран другой тип карты. Повторите загрузку.');
      const before=snapshot();
      const id='custom:'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,11);
      c.layout.custom.push({id,name:file.name.slice(0,80),src:data,width:160,height:Math.max(48,Math.round(160*pic.height/pic.width))});
      c.layout.order=[...c.plan.map(x=>x.id),id];
      c.selected=id;record(before);requestPaint();updateInspector();status('Иконка добавлена в '+c.type+'. Перетащите её на карте.');
    }catch(err){status('Добавление иконки: '+err.message,true)}
  });
  window.addEventListener('keydown',ev=>{
    const tag=ev.target?.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||ev.target?.isContentEditable)return;
    if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='z'){
      ev.preventDefault();historyAction(!!ev.shiftKey);return;
    }
    if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='y'){
      ev.preventDefault();historyAction(true);return;
    }
    const it=chosen();if(!c.edit||!it||it.transform.locked)return;
    const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(arrows[ev.key]){
      ev.preventDefault();const n=ev.shiftKey?10:1;const [dx,dy]=arrows[ev.key];
      mutate({x:it.transform.x+dx*n,y:it.transform.y+dy*n});
    }
  });
  async function onCard(card){
    if(!card||!API.TYPES.includes(card.type))return;
    if(c.type===card.type&&c.ready)return;
    // Keep the previous template even when IndexedDB is blocked.
    if(c.ready)memoryLayouts.set(c.type,snapshot());
    const token=++c.revision;c.type=card.type;
    const memory=memoryLayouts.get(c.type);
    c.layout=memory?API.copy(memory):API.defaultLayout(c.type);
    c.selected=null;c.ready=!!memory;c.history=[];c.future=[];
    status(memory?'Черновик '+card.type+' восстановлен из сеанса.':'Загрузка черновика '+card.type+'…');
    updateInspector();
    if(memory){requestPaint();return}
    try{
      const saved=await dbGet(card.type);
      if(token!==c.revision||c.type!==card.type)return;
      if(saved)c.layout=API.normalize(saved,card.type);
      memoryLayouts.set(card.type,snapshot());
      c.ready=true;status(saved?'Черновик '+card.type+' восстановлен из браузера.':'Исходный шаблон '+card.type+' без изменений.');
      requestPaint();
    }catch(err){
      if(token!==c.revision||c.type!==card.type)return;
      let saved=null;
      try{const raw=localStorage.getItem('MW_v05_template_v1_'+card.type);
        if(raw)saved=API.normalize(JSON.parse(raw),card.type)
      }catch{}
      if(saved)c.layout=saved;
      memoryLayouts.set(card.type,snapshot());
      c.ready=true;
      status(saved?'Черновик '+card.type+' восстановлен из localStorage.':
        'IndexedDB недоступна; черновик можно экспортировать в JSON.',!saved);
      requestPaint();
    }
  }
  function validation(){
    const violations=[];
    for(const item of c.plan){
      if(item.kind!=='custom'||!item.transform.visible)continue;
      if(!API.isInBounds(item))violations.push({severity:'warning',code:'template-bounds',message:'Своя иконка «'+item.label+'» выходит за границы карты'});
    }
    return violations;
  }
  updateInspector();updateUndo();
  return {compose,onCard,validation,status,select:choose,currentLayout:()=>snapshot(),refresh:()=>{requestPaint();updateInspector()},drawOverlay};
}
window.MW_V05_TEMPLATE_EDITOR={create};
})();
