/* Мифические войны: офлайн XLSX/CSV мастер импорта готовых колод.
   Без сторонних скриптов и без сетевых запросов. */
(function(root,factory){
 const api=factory();
 root.MW_SHEET_IMPORT=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const MAX_FILE=12*1024*1024,MAX_XML=18*1024*1024,MAX_SHEETS=40,MAX_ROWS=5000;
const normalized=v=>String(v??"").trim().toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[\s_\-.:()[\]]+/g,"");
const aliases={
 id:["id","cardid","idкарты","код","кодкарты","идентификатор","айдикарты"],
 qty:["колво","количество","количествокарт","копий","копии","шт","число","amount","count","qty","quantity"],
 name:["название","имя","названиекарты","cardname","name"]
};
function inferColumns(headers){
 const found={id:-1,qty:-1,name:-1};
 for(const [field,names] of Object.entries(aliases)){
   for(let i=0;i<headers.length;i++){
    if(names.includes(normalized(headers[i]))){found[field]=i;break;}
   }
 }
 return found;
}
function detectHeader(rows){
 let best={row:0,columns:{id:-1,qty:-1,name:-1},score:-1};
 for(let r=0;r<Math.min(35,rows.length);r++){
  const cols=inferColumns(rows[r]||[]);
  const score=(cols.id>=0?4:0)+(cols.qty>=0?4:0)+(cols.name>=0?1:0);
  if(score>best.score){best={row:r,columns:cols,score};}
  if(score===9)break;
 }
 return best;
}
function guessClass(sheetName){
 const s=normalized(sheetName);
 if(s.includes("чернокнижник"))return "Чернокнижник";
 if(s.includes("некромант")||s.includes("чернобог"))return "Некромант";
 if(s.includes("воин"))return "Воин";
 for(const c of ["Чародей","Ведун","Заклинатель","Разбойник"])if(s.includes(normalized(c)))return c;
 return "Воин";
}
function guessDeckName(sheetName){
 const m=String(sheetName||"").replace(/^колода\s*[—–-]\s*/i,"").trim();
 return m||"Импортированная колода";
}
function parseCSV(text){
 const raw=String(text??"").replace(/^\uFEFF/,"");
 const firstLines=raw.split(/\r?\n/).slice(0,8).filter(Boolean);
 const delimiters=[",",";","\t"],count=delim=>{
  let sums=0;
  for(const line of firstLines){
   let quoted=false;
   for(let i=0;i<line.length;i++){
    if(line[i]==='"'){if(quoted&&line[i+1]==='"'){i++;continue;}quoted=!quoted;}
    else if(!quoted&&line[i]===delim)sums++;
   }
  }
  return sums;
 };
 const sep=delimiters.sort((a,b)=>count(b)-count(a))[0];
 const rows=[];let row=[],field="",inQuotes=false;
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(c==='"'){
   if(inQuotes&&raw[i+1]==='"'){field+='"';i++;}
   else inQuotes=!inQuotes;
  }else if(c===sep&&!inQuotes){row.push(field);field="";}
  else if((c==="\n"||c==="\r")&&!inQuotes){
   if(c==="\r"&&raw[i+1]==="\n")i++;
   row.push(field);field="";
   if(row.some(x=>String(x).trim()))rows.push(row);
   row=[];
   if(rows.length>MAX_ROWS)throw new Error("Слишком много строк CSV (лимит 5000).");
  }else field+=c;
 }
 if(inQuotes)throw new Error("В CSV не закрыты кавычки.");
 row.push(field);
 if(row.some(x=>String(x).trim()))rows.push(row);
 return rows;
}
function zipEntries(buffer){
 const bytes=new Uint8Array(buffer),v=new DataView(buffer),len=bytes.length;
 let tail=-1;
 for(let pos=len-22;pos>=Math.max(0,len-65557);pos--){
  if(v.getUint32(pos,true)===0x06054b50){tail=pos;break;}
 }
 if(tail<0)throw new Error("Не удалось найти структуру XLSX. Это правильный Excel-файл?");
 const count=v.getUint16(tail+10,true),dirOffset=v.getUint32(tail+16,true);
 if(count>4000||dirOffset>=len)throw new Error("Слишком большой или повреждённый XLSX.");
 const dec=new TextDecoder("utf-8"),entries=new Map();
 let at=dirOffset;
 for(let j=0;j<count;j++){
  if(at+46>len||v.getUint32(at,true)!==0x02014b50)throw new Error("Ошибка структуры ZIP в XLSX.");
  const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),
        compressed=v.getUint32(at+20,true),uncompressed=v.getUint32(at+24,true),
        nameLen=v.getUint16(at+28,true),extraLen=v.getUint16(at+30,true),
        commentLen=v.getUint16(at+32,true),local=v.getUint32(at+42,true);
  const name=dec.decode(bytes.slice(at+46,at+46+nameLen)).replace(/\\/g,"/");
  if(flags&1)throw new Error("XLSX с паролем не поддерживается.");
  if(uncompressed>MAX_XML)throw new Error("Слишком большой лист XLSX.");
  if(local+30>len||v.getUint32(local,true)!==0x04034b50)throw new Error("Повреждённый XLSX.");
  const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
  if(start+compressed>len)throw new Error("Повреждены данные файла XLSX.");
  if(name.startsWith("xl/")||name==="[Content_Types].xml"){
   entries.set(name,{method,compressed:bytes.slice(start,start+compressed),size:uncompressed});
  }
  at+=46+nameLen+extraLen+commentLen;
 }
 return entries;
}
async function inflateXML(entries,path){
 const entry=entries.get(path);
 if(!entry)throw new Error("В XLSX отсутствует "+path+".");
 let data;
 if(entry.method===0)data=entry.compressed;
 else if(entry.method===8){
  if(typeof DecompressionStream==="undefined")throw new Error("Для XLSX необходим современный Edge или Chrome.");
  try{
   const stream=new Blob([entry.compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
   data=new Uint8Array(await new Response(stream).arrayBuffer());
  }catch(e){throw new Error("Не удалось распаковать XLSX: "+e.message);}
 }else throw new Error("Неподдерживаемый способ сжатия XLSX.");
 if(data.length>MAX_XML)throw new Error("Содержимое XLSX превышает лимит.");
 return new TextDecoder("utf-8").decode(data);
}
function readXML(xml){
 const doc=new DOMParser().parseFromString(xml,"text/xml");
 if(doc.getElementsByTagName("parsererror").length)throw new Error("Ошибка XML внутри XLSX.");
 return doc;
}
const children=(el,name)=>Array.from(el?.getElementsByTagNameNS("*",name)||[]);
function cellCol(ref){
 const s=/^[A-Z]+/i.exec(ref||"");
 if(!s)return -1;
 let idx=0;
 for(const c of s[0].toUpperCase())idx=idx*26+(c.charCodeAt(0)-64);
 return idx-1;
}
function worksheetRows(xml,shared){
 const doc=readXML(xml),rows=[];
 const all=children(doc,"sheetData")[0];
 if(!all)return rows;
 for(const xmlrow of children(all,"row")){
   const rNum=Number(xmlrow.getAttribute("r"))||rows.length+1;
   if(rNum>MAX_ROWS)break;
   const row=[];
   for(const cell of children(xmlrow,"c")){
    const col=cellCol(cell.getAttribute("r"));
    if(col<0||col>100)continue;
    const type=cell.getAttribute("t"),value=children(cell,"v")[0]?.textContent??"";
    let out;
    if(type==="s"){const ix=Number(value);out=shared[ix]??"";}
    else if(type==="inlineStr")out=children(cell,"t").map(x=>x.textContent||"").join("");
    else if(type==="e")out=""; // XLSX formula errors aren't deck quantities
    else out=value;
    row[col]=out;
   }
   rows[rNum-1]=row;
 }
 return rows;
}
async function parseXlsx(buffer){
 const entries=zipEntries(buffer);
 const workbook=readXML(await inflateXML(entries,"xl/workbook.xml"));
 const rels=readXML(await inflateXML(entries,"xl/_rels/workbook.xml.rels"));
 const relationship=new Map(children(rels,"Relationship").map(r=>[r.getAttribute("Id"),{
  target:r.getAttribute("Target")||"",external:r.getAttribute("TargetMode")==="External"
 }]));
 let shared=[];
 if(entries.has("xl/sharedStrings.xml")){
  const doc=readXML(await inflateXML(entries,"xl/sharedStrings.xml"));
  shared=children(doc,"si").map(si=>children(si,"t").map(t=>t.textContent||"").join(""));
 }
 const sheetElements=children(workbook,"sheet");
 if(sheetElements.length>MAX_SHEETS)throw new Error("В файле более 40 листов.");
 const sheets=[];
 for(const sheet of sheetElements){
  const id=sheet.getAttribute("r:id")||sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
  const rel=relationship.get(id);
  if(!rel||rel.external)continue;
  let target=rel.target.replace(/\\/g,"/");
  if(target.startsWith("/"))target=target.replace(/^\/+/,"");
  else if(target.startsWith("xl/"))target=target;
  else{
   const parts=["xl",...target.split("/")],stack=[];
   for(const p of parts){if(p==="..")stack.pop();else if(p&&p!==".")stack.push(p);}
   target=stack.join("/");
  }
  if(!target.startsWith("xl/worksheets/"))continue;
  const name=sheet.getAttribute("name")||"Лист";
  const rows=worksheetRows(await inflateXML(entries,target),shared);
  sheets.push({name,rows});
 }
 if(!sheets.length)throw new Error("В XLSX не найдены доступные листы.");
 return {kind:"xlsx",sheets};
}
async function loadFile(file){
 if(!file)throw new Error("Файл не выбран.");
 if(file.size>MAX_FILE)throw new Error("Файл слишком большой (максимум 12 МБ).");
 if(/\.xlsx$/i.test(file.name))return parseXlsx(await file.arrayBuffer());
 if(/\.(csv|tsv|txt)$/i.test(file.name)){
  const bytes=new Uint8Array(await file.arrayBuffer());
  let text;
  if(bytes[0]===0xff&&bytes[1]===0xfe)text=new TextDecoder("utf-16le").decode(bytes);
  else text=new TextDecoder("utf-8").decode(bytes);
  return {kind:"csv",sheets:[{name:file.name.replace(/\.(csv|tsv|txt)$/i,""),rows:parseCSV(text)}]};
 }
 throw new Error("Выберите XLSX, CSV или TSV.");
}
function scanDeck(sheet,opts,catalog,model){
 const rows=sheet?.rows||[],header=Math.max(0,Number(opts.header)||0);
 const idColumn=Number(opts.idColumn),qtyColumn=Number(opts.qtyColumn),
       nameColumn=Number(opts.nameColumn);
 const issues=[],items=[],counts={};
 let total=0;
 if(!Number.isInteger(idColumn)||idColumn<0||!Number.isInteger(qtyColumn)||qtyColumn<0||idColumn===qtyColumn)
   return {counts,items,total:0,errors:["Укажите разные столбцы «ID» и «Кол-во»."],warnings:[],ok:false};
 for(let r=header+1;r<Math.min(rows.length,MAX_ROWS);r++){
  const row=rows[r]||[];
  const id=String(row[idColumn]??"").trim();
  const qtyRaw=String(row[qtyColumn]??"").trim().replace(/\s/g,"");
  if(!id&&!qtyRaw)continue;
  // Стандартные итоговые строки Google Sheets: не являются картами.
  if(/^(всегокарт|средняямана|проверка|уникальныхкарт|итого|total|сумма)/.test(normalized(row[qtyColumn])))continue;
  // Longer explanatory notes below the deck have no ID and aren't card rows.
  if(!id&&!/^\d/.test(qtyRaw)&&qtyRaw.length>12)continue;
  // Ignore summary/footer notes only when neither column resembles a card row.
  if(!id||!qtyRaw){issues.push({level:"error",line:r+1,description:"Пропущен ID или количество."});continue;}
  const quantity=Number(qtyRaw.replace(",","."));
  if(!/^\d+(?:[.,]0+)?$/.test(qtyRaw)||!Number.isInteger(quantity)||quantity<1||quantity>30){
   issues.push({level:"error",line:r+1,description:"Количество должно быть целым от 1 до 30."});continue;
  }
  const qty=quantity,card=catalog.get(id);
  if(!/^[\w-]{2,90}$/.test(id)){
   issues.push({level:"error",line:r+1,description:"Некорректный ID: "+id.slice(0,40)});continue;
  }
  counts[id]=(counts[id]||0)+qty;
  total+=qty;
  const enteredName=nameColumn>=0?String(row[nameColumn]??"").trim():"";
  const name=card?.name||enteredName||"Неизвестная карта";
  if(!card)issues.push({level:"error",line:r+1,description:`Карта ${id} не найдена в библиотеке.`});
  else if(enteredName&&normalized(enteredName)!==normalized(card.name))
   issues.push({level:"warning",line:r+1,description:`${id}: название отличается; используется имя из библиотеки.`});
  items.push({line:r+1,id,qty,name,found:!!card});
 }
 if(!items.length)issues.push({level:"error",line:header+1,description:"Не найдено ни одной записи карты."});
 const cls=opts.classId||"Воин";
 const draft={counts,classId:cls};
 const validation=model.validateDeck(draft,catalog);
 const errors=[...issues.filter(i=>i.level==="error").map(i=>`Строка ${i.line}: ${i.description}`),...validation.errors];
 const warnings=[...issues.filter(i=>i.level==="warning").map(i=>`Строка ${i.line}: ${i.description}`)];
 return {counts,items,total,errors,warnings,ok:errors.length===0,validation};
}
return {parseCSV,detectHeader,inferColumns,guessClass,guessDeckName,scanDeck,parseXlsx,loadFile};
});
