/* v05.4: opt-in Sheets sync UI. No auto-networking, no stored credentials. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const api=window.MW_V05_LIBRARY_API;
if(!$('syncRead')||!api)return;
let remoteRevision=null,remoteWrite=false,lastOperation=null,uploadPlan=null,plannedLocal=null,busy=false;
// Do not offer an outbound plan until the current remote library was accepted locally.
// A later deliberate file import is allowed only after the remote baseline is accepted.
let acceptedRevision=null,lastRemoteSheets=null;
const el=$('syncStatus');
const setStatus=(message,isError=false)=>{el.textContent=message;el.classList.toggle('bad',isError)};
function baseURL(){
 const value=$('syncBase').value.trim();if(!value)throw Error('Введите адрес доверенного сервера.');
 const u=new URL(value);
 const loopback=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
 if(u.protocol!=='https:'&&!(loopback&&u.protocol==='http:'))throw Error('Разрешён только HTTPS либо локальный сервер http://127.0.0.1.');
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Указывайте только адрес сервера, без пути, логина и параметров.');
 return u.origin;
}
async function request(route,body){
 const token=$('syncToken').value;
 if(!token||token.trim().length<32)throw Error('Введите ключ доступа к серверу (не менее 32 символов).');
 const response=await fetch(baseURL()+'/api/v05/'+route,{method:body?'POST':'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',
  headers:{'Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();
 if(!response.ok)throw Error(`${data.message||'Сервер отклонил запрос'} (HTTP ${response.status})`);
 return data;
}
function textValue(value){return value===null||value===undefined||value===''?'∅':String(value)}
function previewText(lines){$('syncPreview').textContent=lines.join('\n')}
function meta(){
 const node=$('syncMeta');node.replaceChildren();
 for(const item of [remoteRevision?'Версия '+remoteRevision.slice(0,12):'Нет соединения',
   remoteWrite?'Запись разрешена на сервере':'Только чтение',lastOperation?'Последняя операция '+lastOperation.id.slice(0,8):'Нет подтверждённых записей']){
  const chip=document.createElement('span');chip.className='stat';chip.textContent=item;node.append(chip);
 }
}
function buttons(){
 $('syncRead').disabled=busy;
 $('syncPlan').disabled=busy||!remoteRevision||acceptedRevision!==remoteRevision;
 $('syncConfirm').disabled=busy||!remoteWrite||!remoteRevision||(!uploadPlan&&!canRollback());
 $('syncPush').disabled=busy||!uploadPlan||!remoteWrite||acceptedRevision!==remoteRevision||!$('syncConfirm').checked;
 $('syncRollback').disabled=busy||!canRollback()||!$('syncConfirm').checked;
}
function canRollback(){return remoteWrite&&lastOperation?.type==='push'&&lastOperation?.status==='committed'&&lastOperation?.afterRevision===remoteRevision}
async function run(action){
 if(busy)return;
 busy=true;buttons();try{await action()}catch(error){setStatus(error.message||String(error),true)}finally{busy=false;buttons()}
}
$('syncConfirm').addEventListener('change',buttons);
for(const field of ['syncBase','syncToken'])$(field).addEventListener('input',()=>{
 remoteRevision=null;remoteWrite=false;lastOperation=null;uploadPlan=null;plannedLocal=null;
 acceptedRevision=null;lastRemoteSheets=null;
 $('syncConfirm').checked=false;meta();buttons();
});
window.addEventListener('mw-v05-library-changed',event=>{
 const origin=event.detail?.origin;
 if(origin==='undo')acceptedRevision=null;
 if(origin==='remote'&&remoteRevision&&lastRemoteSheets){
  try{
   const comparison=window.MW_V05_LIBRARY_CORE.prepare(api.getCurrent(),lastRemoteSheets,window.MW_V05_MANIFEST);
   acceptedRevision=comparison.ready&&comparison.changed===0?remoteRevision:null;
  }catch(_){acceptedRevision=null}
 }
 // Any local change invalidates previously built outbound plan.
 uploadPlan=null;plannedLocal=null;$('syncConfirm').checked=false;
 if(origin==='remote'&&acceptedRevision===remoteRevision){
  setStatus('Актуальная Google Sheets принята локально. Теперь можно импортировать свои изменения и построить план отправки.');
 }else if(origin==='undo'){
  setStatus('Локальный снимок восстановлен: для записи снова примите удалённую версию.');
 }
 buttons();
});
async function refreshHistory(){
 const state=await request('history');$('syncHistory').replaceChildren();
 if(!state.history.length){$('syncHistory').textContent='Операций пока нет.';return}
 for(const item of state.history){
  const node=document.createElement('div');
  node.textContent=`${item.at} · ${item.type==='push'?'Запись':'Откат'} · ${item.status} · ${item.id.slice(0,8)} · ${item.changedRecords} записей / ${item.changedCells} полей`;
  $('syncHistory').append(node);
 }
 if(state.needsReview){const node=document.createElement('p');node.textContent='Есть незавершённая запись: сервер заблокирует новую запись до проверки администратором.';$('syncHistory').prepend(node)}
}
$('syncRead').addEventListener('click',()=>run(async()=>{
 setStatus('Чтение Google Sheets через авторизованный сервер…');
 remoteRevision=null;acceptedRevision=null;lastRemoteSheets=null;uploadPlan=null;plannedLocal=null;
 $('syncConfirm').checked=false;buttons();
 const state=await request('snapshot');
 const diff=api.stageRemote(state.sheets);
 if(diff.errors)throw Error(`В Google Sheets ${diff.errors} ошибок: исходящие операции заблокированы.`);
 remoteRevision=state.revision;remoteWrite=Boolean(state.writeEnabled);lastOperation=state.lastOperation;
 lastRemoteSheets=state.sheets;acceptedRevision=diff.changed===0?remoteRevision:null;
 uploadPlan=null;plannedLocal=null;$('syncConfirm').checked=false;meta();
 previewText([`Google Sheets: ${state.counts.cards} карт и ${state.counts.tokens} токенов.`,
  `Версия SHA-256: ${remoteRevision}`,`Локальный предпросмотр: ${diff.changed} изменённых записей, ${diff.errors} ошибок.`,
  `Предупреждения: ${diff.issues}.`,
  'Для загрузки данных в локальную библиотеку проверьте diff в панели выше и нажмите «Применить локально».',
  acceptedRevision===remoteRevision?'Локальная и удалённая базы совпадают: можно готовить исходящую отправку.':
    'ВАЖНО: сначала сохраните локальную копию JSON и примените удалённый снимок в панели импорта. До этого отправка заблокирована.',
  state.needsReview?'ВНИМАНИЕ: журнал требует проверки администратора.':'']);
 await refreshHistory();setStatus(acceptedRevision===remoteRevision?
  'Удалённая версия прочитана. Локальная база совпадает; запись не выполнялась.':
  'Удалённая версия новее/отличается. Сначала примените её локально после проверки diff; запись заблокирована.');
}));
$('syncPlan').addEventListener('click',()=>run(async()=>{
 if(!remoteRevision)throw Error('Сначала прочитайте Google Sheets.');
 if(acceptedRevision!==remoteRevision)throw Error('Сначала примите текущую удалённую версию в локальную библиотеку.');
 setStatus('Проверка исходящих изменений без записи в Sheets…');
 const current=api.getCurrent(),plan=await request('plan',{baseRevision:remoteRevision,snapshot:current});
 uploadPlan=plan;plannedLocal=JSON.stringify(current);$('syncConfirm').checked=false;
 const lines=[`План отправки · ${plan.changedRecords} изменённых записей, ${plan.changedCells} полей.`,
  `Исходная версия: ${plan.revision.slice(0,12)} · ${plan.writeEnabled?'запись разрешена':'сервер только для чтения'}.`,
  `Диагностика: ${plan.issues.filter(x=>x.severity==='error').length} ошибок, ${plan.issues.filter(x=>x.severity==='warning').length} предупреждений.`,
  '']
 for(const record of plan.diff.slice(0,80)){
  lines.push(`${record.kind==='tokens'?'Токен':'Карта'} ${record.id} — ${record.diff.length} полей`);
  for(const entry of record.diff){
   const oldText=textValue(entry.before),newText=textValue(entry.after);
   lines.push(`  ${entry.label}: ${oldText.slice(0,100)} → ${newText.slice(0,100)}`);
  }
 }
 if(plan.diff.length>80)lines.push(`... ещё ${plan.diff.length-80} записей. Проверяйте полный diff локально.`);
 previewText(lines);
 setStatus(plan.changedCells? 'План готов. Для отправки отметьте отдельное подтверждение.':'Различий нет: отправлять нечего.');
 if(!plan.changedCells)uploadPlan=null;
}));
$('syncPush').addEventListener('click',()=>run(async()=>{
 if(!uploadPlan||!$('syncConfirm').checked)throw Error('Нет подтверждённого плана отправки.');
 const snapshot=api.getCurrent();
 if(JSON.stringify(snapshot)!==plannedLocal)throw Error('Локальная библиотека изменилась после предпросмотра; постройте план заново.');
 const result=await request('push',{baseRevision:remoteRevision,snapshot,confirm:true});
 remoteRevision=result.revision;acceptedRevision=result.revision;uploadPlan=null;plannedLocal=null;$('syncConfirm').checked=false;
 lastOperation={id:result.operationId,type:'push',status:'committed',afterRevision:result.revision};
 meta();previewText([`Google Sheets обновлена: ${result.changedRecords} записей, ${result.changedCells} полей.`,
  `Новая версия: ${remoteRevision}`,`Операция журнала: ${result.operationId}`,
  'Рекомендуется прочитать таблицу повторно и проверить дифф.']);
 await refreshHistory();setStatus('Запись подтверждена повторным чтением Google Sheets; операцию можно отменить до следующего изменения таблицы.');
}));
$('syncRollback').addEventListener('click',()=>run(async()=>{
 if(!canRollback()||!$('syncConfirm').checked)throw Error('Откат доступен только для последней завершённой записи и после подтверждения.');
 const id=lastOperation.id;
 const result=await request('rollback',{baseRevision:remoteRevision,operationId:id,confirm:true});
 remoteRevision=result.revision;acceptedRevision=null;lastRemoteSheets=null;
 lastOperation={id:result.operationId,type:'rollback',status:'committed',afterRevision:result.revision};
 uploadPlan=null;plannedLocal=null;$('syncConfirm').checked=false;meta();
 previewText([`Последняя серверная запись ${id} отменена.`,
  `Новая версия: ${result.revision}`,`Откаченная операция: ${result.operationId}`,
  'Локальная библиотека и арт не менялись. Для сравнения снова прочитайте Google Sheets.']);
 await refreshHistory();setStatus('Откат на сервере подтверждён. Локальные изменения сохранены.');
}));
$('syncBase').value=(location.protocol==='http:'||location.protocol==='https:')?location.origin+'/':'http://127.0.0.1:8765/';
meta();buttons();
})();
