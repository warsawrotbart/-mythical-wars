/* Private, browser-local v05 illustration/crop store. Never touches game storage. */
(function(root,factory){
 const api=factory(); if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.MW_V05_ART_STORE=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const DB_NAME="MW_v05_card_art_stage3",STORE="profiles";
let promise;
function database(){
 if(promise)return promise;
 promise=new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined"){reject(Error("IndexedDB недоступен"));return}
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:"id"})};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error("База артов не открылась"));
 });
 return promise;
}
async function read(id){
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).get(id);
  r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
 });
}
async function write(profile){
 if(!profile||typeof profile.id!=="string")throw Error("ID профиля арта обязателен");
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(profile);
  tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error||Error("Не удалось сохранить арт"));
 });
}
return {read,write};
});
