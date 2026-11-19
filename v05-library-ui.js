/* v05 Stage 3: browser-only XLSX/CSV library staging, explicit field-level diff,
 * controlled local commit and one-step rollback. Battle catalogue remains immutable.
 */
(function(){
"use strict";
const core=window.MW_V05_LIBRARY_CORE,parser=window.MW_SHEET_IMPORT;
const seed=window.MW_V05_LIBRARY_SEED,manifest=window.MW_V05_MANIFEST;
const editor=window.MW_V05_EDITOR_API;
const $=id=>document.getElementById(id);
const ACTIVE="MW_v05_stage3_library_active_v1",BACKUP="MW_v05_stage3_library_backup_v1";
if(!core||!parser||!seed||!manifest||!editor){
  $("libStatus").textContent="Не загрузился один из локальных модулей библиотеки.";$("libStatus").classList.add("bad");return;
}
let baseline,current,staged=null,selected=null,loadError=null;
function status(text,error=false){const el=$("libStatus");el.textContent=text;el.classList.toggle("bad",error)}
try{
 baseline=core.normalizeSeed(seed,manifest);
 const raw=localStorage.getItem(ACTIVE);
 current=raw?core.validateSnapshot(JSON.parse(raw),baseline):baseline;
}catch(error){
 current=baseline||{version:1,cards:[],tokens:[]};loadError=error;
 status("Локальные данные нельзя безопасно прочитать: "+error.message+". Исходная библиотека доступна без изменения сохранённых данных.",true);
}
const records=()=>[...current.cards.map(record=>({record,kind:"cards"})),...current.tokens.map(record=>({record,kind:"tokens"}))];
function storageGet(key){try{return localStorage.getItem(key)}catch(error){return null}}
function stats(){
 const stats=$("libStats");stats.replaceChildren();
 for(const value of [`Карты: ${current.cards.length}/162`,`Токены: ${current.tokens.length}/7`,
   storageGet(ACTIVE)?"Локальный снимок применён":"Исходная библиотека из архива"]){
   const el=document.createElement("span");el.className="stat";el.textContent=value;stats.append(el);
 }
 $("libUndo").disabled=!storageGet(BACKUP);
}
function updatePicker(){
 const query=core.key($("libSearch").value),sel=$("libSelect");
 const onlyArt=$("libOnlyWithArt").checked, catalog=window.MW_TEST_ART_CATALOG;
 const prior=sel.value;sel.replaceChildren();
 const list=records().filter(({record})=>(!onlyArt||!!catalog?.has(record.id))&&
   (!query||core.key(record.id+" "+record.name).includes(query)));
 for(const {record,kind} of list){
  const opt=document.createElement("option");opt.value=record.id;
  opt.textContent=`${catalog?.has(record.id)?"● Арт · ":"○ Нет арта · "}${kind==="tokens"?"[Токен] ":""}${record.id} · ${record.name||"Без названия"}`;
  sel.append(opt);
 }
 if(list.some(item=>item.record.id===prior))sel.value=prior;
 const total=records().length;
 const builtIn=records().filter(({record})=>!!catalog?.has(record.id)).length;
 $("builtinCoverage").textContent=`Встроенные арты: ${builtIn} из ${total} записей · показано ${list.length}. Все файлы находятся внутри архива; интернет не нужен.`;
}
function openRecord(record,staging){
 if(!record)return;
 editor.openLibraryRecord(core.toV05Card(record),{staged:!!staging});
 const preview=document.getElementById("cardCanvas");preview?.scrollIntoView?.({block:"center",behavior:"smooth"});
}
$("libSearch").addEventListener("input",updatePicker);
$("libOnlyWithArt").addEventListener("change",updatePicker);
$("libSelect").addEventListener("change",()=>{
 const entry=records().find(x=>x.record.id===$("libSelect").value);
 if(entry)openRecord(entry.record,false);
});
function valueDisplay(value){return value===null||value===undefined||value===""?"∅ (пусто)":String(value)}
function detail(row){
 const target=$("libFieldDiff");target.replaceChildren();
 if(!row){target.textContent="Выберите запись для сравнения полей.";$("libShowCard").disabled=true;return;}
 const top=document.createElement("strong");top.textContent=`${row.id} · ${row.name} · ${row.changed?row.diff.length+" изменений":"Без изменений"}`;target.append(top);
 if(!row.changed){
  const p=document.createElement("p");p.textContent="Нормализованные поля совпадают с текущей локальной библиотекой.";target.append(p);
 }else{
  const table=document.createElement("table"),head=document.createElement("tr");
  for(const label of ["Поле","Прежнее","Новое"]){const th=document.createElement("th");th.textContent=label;head.append(th)}
  table.append(head);
  for(const d of row.diff){
   const tr=document.createElement("tr");
   for(const text of [d.label,valueDisplay(d.before),valueDisplay(d.after)]){const td=document.createElement("td");td.textContent=text;tr.append(td)}
   table.append(tr);
  }
  target.append(table);
 }
 selected=row;$("libShowCard").disabled=false;
}
function updateDiff(){
 const list=$("libDiffList");list.replaceChildren();
 if(!staged){$("libDiffSummary").textContent="Выберите файл для сравнения.";detail(null);return}
 const total=staged.diff.length,changes=staged.diff.filter(x=>x.changed),
  errors=staged.errors.length,warnings=staged.issues.length-errors;
 $("libDiffSummary").textContent=`${changes.length} изменено из ${total} · ошибок ${errors} · предупреждений ${warnings}`;
 const filter=$("libFilter").value;
 const filtered=staged.diff.filter(x=>filter==="all"||filter==="changed"&&x.changed||filter==="cards"&&x.kind==="cards"||filter==="tokens"&&x.kind==="tokens");
 if(!filtered.length){const empty=document.createElement("p");empty.className="muted";empty.textContent="По выбранному фильтру изменений нет.";list.append(empty)}
 for(const row of filtered){
  const btn=document.createElement("button");btn.type="button";btn.className="lib-diff-row";
  if(selected&&selected.id===row.id)btn.classList.add("selected");
  const left=document.createElement("div"),title=document.createElement("strong"),desc=document.createElement("span");
  title.textContent=row.id+" ";desc.textContent=row.name;
  const count=document.createElement("span");count.className="lib-count";count.textContent=row.changed?row.diff.length+" полей":"без изменений";
  left.append(title,desc);btn.append(left,count);
  btn.addEventListener("click",()=>{list.querySelectorAll("button").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");detail(row)});
  list.append(btn);
 }
 const highlighted=filtered.find(x=>selected&&x.id===selected.id)||filtered[0]||null;
 detail(highlighted);
}
$("libFilter").addEventListener("change",updateDiff);
function issuesDisplay(){
 const list=$("libIssueList");list.replaceChildren();
 if(!staged){$("libIssueSummary").textContent="Предупреждения и ошибки";return}
 const errors=staged.errors.length,warnings=staged.issues.length-errors;
 $("libIssueSummary").textContent=`Диагностика: ${errors} ошибок, ${warnings} предупреждений`;
 $("libIssueDetails").open=errors>0;
 if(!staged.issues.length){const p=document.createElement("p");p.textContent="Ошибок и предупреждений нет.";list.append(p)}
 for(const x of staged.issues.slice(0,180)){
  const item=document.createElement("div");item.className="lib-issue"+(x.severity==="error"?" error":"");
  item.textContent=(x.row?`Строка ${x.row}: `:"")+x.message;list.append(item);
 }
 if(staged.issues.length>180){const x=document.createElement("p");x.textContent=`И ещё ${staged.issues.length-180} предупреждений (загрузите JSON-отчёт для полной диагностики).`;list.append(x)}
}
function buttons(){
 $("libReport").disabled=!staged;
 $("libConfirm").disabled=!staged||!staged.ready||staged.changed===0;
 if($("libConfirm").disabled)$("libConfirm").checked=false;
 $("libApply").disabled=loadError!==null||!staged||!staged.ready||staged.changed===0||!$("libConfirm").checked;
 $("libShowCard").disabled=!selected;
}
$("libConfirm").addEventListener("change",buttons);
$("libShowCard").addEventListener("click",()=>{
 if(!staged||!selected)return;
 const record=staged.next[selected.kind].find(x=>x.id===selected.id);
 openRecord(record,true);
});
async function importFiles(files){
 if(loadError)throw Error("Локальное хранилище содержит ошибку; импорт нельзя применять до восстановления. "+loadError.message);
 if(!files.length)return;
 if(files.length>2)throw Error("Выберите один XLSX либо один/два CSV-файла.");
 if(files.some(f=>/\.xlsx$/i.test(f.name))&&files.length!==1)throw Error("XLSX загружайте отдельно, без дополнительных файлов.");
 const sheets=[];
 for(const file of files){
  const parsed=await parser.loadFile(file);
  const classified=core.classifyInput(parsed,file.name);
  sheets.push(...classified);
 }
 if(!sheets.length)throw Error("Нет листов «Карты» и «Токены». Экспортируйте их как XLSX или CSV.");
 staged=core.prepare(current,sheets,manifest);
 staged.files=files.map(x=>x.name);
 selected=null;$("libConfirm").checked=false;
 updateDiff();issuesDisplay();buttons();
 const scope=staged.included.map(x=>core.KIND_LABEL[x]).join(" + ");
 const changedCards=staged.diff.filter(x=>x.kind==="cards"&&x.changed).length,
 changedTokens=staged.diff.filter(x=>x.kind==="tokens"&&x.changed).length;
 status(`Проверены: ${scope}. Изменений: ${changedCards} карт и ${changedTokens} токенов. ${staged.errors.length?"Исправьте ошибки до применения.":staged.changed?"Просмотрите diff и подтвердите импорт.":"Новых изменений нет."}`,staged.errors.length>0);
}
$("libFiles").addEventListener("change",async event=>{
 const files=Array.from(event.target.files||[]);
 if(!files.length)return;
 staged=null;selected=null;buttons();status("Чтение и проверка XLSX/CSV без сохранения…");
 try{await importFiles(files)}catch(error){
  staged=null;selected=null;updateDiff();issuesDisplay();buttons();status("Предпросмотр не построен: "+error.message,true);
 }
 event.target.value="";
});
$("libApply").addEventListener("click",()=>{
 if(!staged||!staged.ready||staged.changed===0||!$("libConfirm").checked||loadError)return;
 try{
  // Two writes with failure handling: active snapshot is replaced only on success.
  localStorage.setItem(BACKUP,JSON.stringify(current));
  localStorage.setItem(ACTIVE,JSON.stringify(staged.next));
  current=staged.next;
  const changed=staged.changed;
  const origin=staged.files?.includes('Google Sheets (версия прочитана через сервер)')?'remote':'file';
  staged=null;selected=null;$("libConfirm").checked=false;
  updatePicker();updateDiff();issuesDisplay();stats();buttons();
  if(editor.updateOpenedLibraryCard){
   const entry=records().find(x=>x.record.id===editor.currentCardId());
   if(entry)editor.updateOpenedLibraryCard(core.toV05Card(entry.record));
  }
  window.dispatchEvent(new CustomEvent('mw-v05-library-changed',{detail:{origin}}));
  status(`Локально применены ${changed} изменённых записей. Контрольные исходники и арты не изменены. Можно откатить последнюю операцию.`);
 }catch(error){status("Импорт НЕ применён: браузер не разрешил локальное сохранение ("+error.message+")",true)}
});
$("libUndo").addEventListener("click",()=>{
 try{
  const backup=localStorage.getItem(BACKUP);if(!backup)throw Error("Нет предыдущего локального снимка");
  const previous=core.validateSnapshot(JSON.parse(backup),baseline);
  localStorage.setItem(ACTIVE,backup);localStorage.removeItem(BACKUP);
  current=previous;staged=null;selected=null;$("libConfirm").checked=false;
  updatePicker();updateDiff();issuesDisplay();stats();buttons();
  const entry=records().find(x=>x.record.id===editor.currentCardId());
  if(entry&&editor.updateOpenedLibraryCard)editor.updateOpenedLibraryCard(core.toV05Card(entry.record));
  window.dispatchEvent(new CustomEvent('mw-v05-library-changed',{detail:{origin:'undo'}}));
  status("Предыдущий локальный снимок восстановлен. Арт и кадрирование остались на месте.");
 }catch(error){status("Откат не выполнен: "+error.message,true)}
});
function downloadJSON(name,data){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2500);
}
$("libReport").addEventListener("click",()=>{
 if(!staged)return;
 downloadJSON("MW_v05_stage3_import_diff.json",{format:"mw-v05-stage3-diff-v1",files:staged.files,
  included:staged.included,canApply:staged.ready,changed:staged.changed,issues:staged.issues,diff:staged.diff});
});
$("libDownload").addEventListener("click",()=>{
 downloadJSON("MW_v05_local_library_162_cards_7_tokens.json",{schema:"mw-v05-stage3-local-v1",exportedAt:new Date().toISOString(),...current});
});
window.MW_V05_LIBRARY_API=Object.freeze({
 getCurrent:()=>JSON.parse(JSON.stringify(current)),
 stageRemote:sheets=>{
  if(loadError)throw Error('Локальная библиотека требует восстановления: '+loadError.message);
  staged=core.prepare(current,sheets,manifest);
  staged.files=['Google Sheets (версия прочитана через сервер)'];
  selected=null;$('libConfirm').checked=false;
  updateDiff();issuesDisplay();buttons();
  status(`Google Sheets: предпросмотр ${staged.changed} изменённых записей, ${staged.errors.length} ошибок. Никаких локальных изменений пока нет.`);
  return {changed:staged.changed,errors:staged.errors.length,issues:staged.issues.length,ready:staged.ready};
 }
});
if(!loadError)status("Исходная библиотека загружена: 162 карты и 7 токенов. Выберите файл для сравнения.");
stats();updatePicker();updateDiff();issuesDisplay();buttons();
// Deep link from game collection: open a canonical ID in the only v05 editor.
try{
 const requested=new URLSearchParams(window.location.search).get("card");
 if(requested&&/^[A-Z]{3}-\d{3}$/.test(requested)){
  const entry=records().find(x=>x.record.id===requested);
  if(entry){$("libSelect").value=requested;editor.openLibraryRecord(core.toV05Card(entry.record),{staged:false});}
 }
}catch(error){console.warn("v05 editor deep link not opened",error)}
})();
