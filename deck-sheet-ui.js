/* MW v1.8 — UI мастера XLSX/CSV. Данные остаются локальными. */
(() => {
"use strict";
const $=id=>document.getElementById(id), parser=window.MW_SHEET_IMPORT;
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let workbook=null,activeSheet=null,preview=null,busy=false;
const adapter=()=>window.MW_DECK_IMPORT_ADAPTER;
function selectedSheet(){return workbook?.sheets.find(s=>s.name===activeSheet)||null;}
function errorText(text){
 const e=$("sheetImportError");e.textContent=text||"";e.hidden=!text;
}
function setBusy(value){busy=!!value;$("sheetImportBusy").hidden=!busy;$("sheetDeckConfirm").disabled=busy||!preview?.ok;}
function open(){
 $("sheetDeckModal").hidden=false;$("sheetDeckFile").value="";
 if(workbook)renderCurrent();
 $("sheetPickButton").focus();
}
function close(){
 if(busy)return;
 $("sheetDeckModal").hidden=true;errorText("");
}
function fillSelect(id,items,value){
 const el=$(id);el.replaceChildren();
 for(const [v,label] of items){
  const opt=document.createElement("option");opt.value=String(v);opt.textContent=label;el.add(opt);
 }
 if(value!==undefined)el.value=String(value);
}
function chooseSheet(name){
 activeSheet=name;
 const sheet=selectedSheet();if(!sheet)return;
 const det=parser.detectHeader(sheet.rows);
 $("sheetDeckName").value=parser.guessDeckName(sheet.name);
 $("sheetDeckClass").value=parser.guessClass(sheet.name);
 const maxHeader=Math.min(36,sheet.rows.length);
 const headerOptions=Array.from({length:maxHeader},(_,i)=>[
   i,`${i+1} · ${(sheet.rows[i]||[]).filter(Boolean).slice(0,3).join(" | ").slice(0,100)}`
 ]);
 fillSelect("sheetDeckHeader",headerOptions,det.row);
 updateColumns(det.columns);
 updatePreview();
}
function updateColumns(choose){
 const sheet=selectedSheet();if(!sheet)return;
 const r=Number($("sheetDeckHeader").value),headers=sheet.rows[r]||[];
 const width=Math.min(35,Math.max(2,headers.length,...sheet.rows.slice(r+1,r+8).map(a=>a?.length||0)));
 const opts=Array.from({length:width},(_,i)=>[i,
   `${i+1} — ${String(headers[i]??"Без заголовка").slice(0,60)}`]);
 const guess=choose||parser.inferColumns(headers);
 fillSelect("sheetDeckIdColumn",opts,guess.id>=0?guess.id:Math.min(1,width-1));
 fillSelect("sheetDeckQtyColumn",opts,guess.qty>=0?guess.qty:0);
 fillSelect("sheetDeckNameColumn",[[-1,"Не использовать"],...opts],guess.name>=0?guess.name:-1);
}
function updatePreview(){
 const sheet=selectedSheet(),api=adapter();
 if(!sheet||!api)return;
 preview=parser.scanDeck(sheet,{
  header:$("sheetDeckHeader").value,
  idColumn:$("sheetDeckIdColumn").value,
  qtyColumn:$("sheetDeckQtyColumn").value,
  nameColumn:$("sheetDeckNameColumn").value,
  classId:$("sheetDeckClass").value
 },api.catalog(),api.model);
 const badge=preview.ok?'<span class="sheet-good">Проверка пройдена</span>':
                       '<span class="sheet-bad">Требует исправления</span>';
 $("sheetImportSummary").innerHTML=`${badge}<strong>${preview.total} / 30 карт</strong>
   <span>${preview.items.length} строк карт · ${preview.errors.length} ошибок · ${preview.warnings.length} замечаний</span>`;
 $("sheetImportRows").innerHTML=preview.items.map(x=>`<tr class="${x.found?"":"sheet-unmatched"}">
  <td>${x.line}</td><td>${x.qty}</td><td><code>${escapeHtml(x.id)}</code></td>
  <td>${escapeHtml(x.name)}</td><td>${x.found?'<span class="sheet-good">Найдена</span>':'<span class="sheet-bad">Нет в библиотеке</span>'}</td></tr>`).join("")||
  '<tr><td colspan="5">В выбранных столбцах нет строк с картами.</td></tr>';
 const MAX_ISSUES=15;
 const messages=[
  ...preview.errors.map(x=>({error:true,text:x})),
  ...preview.warnings.map(x=>({error:false,text:x}))
 ];
 $("sheetImportIssues").innerHTML=messages.slice(0,MAX_ISSUES)
   .map(x=>`<div class="${x.error?"sheet-issue-error":"sheet-issue-warning"}">${x.error?"⚠":"ⓘ"} ${escapeHtml(x.text)}</div>`).join("")+
   (messages.length>MAX_ISSUES?`<p>И ещё ${messages.length-MAX_ISSUES} замечаний…</p>`:"");
 $("sheetDeckConfirm").disabled=busy||!preview.ok;
}
function renderCurrent(){
 const names=workbook?.sheets.map(s=>[s.name,s.name])||[];
 fillSelect("sheetDeckSheet",names,activeSheet);
 $("sheetImportDetails").hidden=false;
 chooseSheet(activeSheet);
}
async function loadFile(file){
 if(!file)return;
 setBusy(true);errorText("");$("sheetImportDetails").hidden=true;preview=null;
 try{
  workbook=await parser.loadFile(file);
  // Prioritize the actual Google Sheets deck tabs, not the card catalog.
  const deckSheet=workbook.sheets.find(s=>/^колода\s*[—–-]/i.test(s.name));
  activeSheet=deckSheet?.name||workbook.sheets[0].name;
  renderCurrent();
 }catch(e){
  workbook=null;activeSheet=null;
  $("sheetImportDetails").hidden=true;
  errorText("Не удалось прочитать файл: "+e.message);
 }finally{setBusy(false);updatePreviewSafe();}
}
function updatePreviewSafe(){if(preview)$("sheetDeckConfirm").disabled=busy||!preview.ok;}
async function confirm(){
 if(busy||!preview?.ok)return;
 const api=adapter();
 if(!api){errorText("Модуль колод ещё не готов.");return;}
 setBusy(true);errorText("");
 try{
  const d=await api.importNew({
   name:$("sheetDeckName").value.trim()||parser.guessDeckName(activeSheet),
   classId:$("sheetDeckClass").value,
   counts:preview.counts,
   source:"Google Sheets / "+workbook.kind.toUpperCase()+" · "+activeSheet
  });
  $("sheetDeckModal").hidden=true;
  api.notify("Импортирована колода «"+d.name+"» · "+preview.total+" карт.");
 }catch(e){errorText(e.message);}
 finally{setBusy(false);}
}
function loadPasted(){
 errorText("");
 const txt=$("sheetPasteText").value;
 if(!txt.trim()){errorText("Вставьте строки из Google Sheets.");return;}
 try{
  const rows=parser.parseCSV(txt),det=parser.detectHeader(rows);
  if(det.score<8&&rows.length){
    const first=rows[0]||[],number=x=>/^\d+(?:[.,]0+)?$/.test(String(x??"").trim());
    const card=x=>/^[a-z]{2,8}-\d{1,5}$/i.test(String(x??"").trim());
    if(number(first[0])&&card(first[1]))rows.unshift(["Кол-во","ID","Название"]);
    else if(card(first[0])&&number(first[1]))rows.unshift(["ID","Кол-во","Название"]);
  }
  workbook={kind:"paste",sheets:[{name:"Скопировано из Google Sheets",rows}]};
  activeSheet=workbook.sheets[0].name;
  renderCurrent();
  $("sheetDeckName").value="Колода из Google Sheets";
 }catch(e){errorText("Не удалось прочитать вставленный список: "+e.message);}
}
function downloadExample(){
 const data="\uFEFFКол-во,ID,Название\n2,KNZ-002,МАЛАДЫ ДРУЖЫННІК\n2,KNZ-039,ДЗЁННЫ ВАРТАВЫ\n";
 const blob=new Blob([data],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="MW_Obrazec_Kolody_NePolny.csv";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function init(){
 $("deckSheetsBtn").onclick=open;
 $("sheetDeckClose").onclick=close;$("sheetDeckCancel").onclick=close;
 $("sheetDeckConfirm").onclick=confirm;
 $("sheetPickButton").onclick=e=>{e.stopPropagation();$("sheetDeckFile").click();};
 $("sheetDropZone").onclick=e=>{if(e.target.closest("button"))return;$("sheetDeckFile").click();};
 $("sheetDropZone").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("sheetDeckFile").click();}};
 $("sheetDeckFile").onchange=e=>{loadFile(e.target.files[0]);e.target.value="";};
 const zone=$("sheetDropZone");
 for(const name of ["dragenter","dragover"]){
  zone.addEventListener(name,e=>{e.preventDefault();zone.classList.add("over");});
 }
 for(const name of ["drop","dragleave"])zone.addEventListener(name,e=>{
  e.preventDefault();zone.classList.remove("over");
  if(name==="drop")loadFile(e.dataTransfer.files?.[0]);
 });
 $("sheetDownloadTemplate").onclick=downloadExample;
 $("sheetPasteCheck").onclick=loadPasted;
 $("sheetDeckSheet").onchange=e=>chooseSheet(e.target.value);
 $("sheetDeckHeader").onchange=()=>{updateColumns();updatePreview();};
 for(const id of ["sheetDeckIdColumn","sheetDeckQtyColumn","sheetDeckNameColumn","sheetDeckClass"])
  $(id).onchange=updatePreview;
 document.addEventListener("keydown",e=>{
  if(!$("sheetDeckModal").hidden&&e.key==="Escape"){
   e.preventDefault();e.stopImmediatePropagation();close();
  }
 },true);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
else init();
})();
