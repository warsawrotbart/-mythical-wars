/* Durable battle slots. Decks/art are never removed to make room for a battle. */
(function(root,factory){
 const api=factory();root.MW_BATTLE_STORAGE=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 const keys={current:"mw-active-battle-v2.0",previous:"mw-previous-battle-v2.0"};
 const copy=value=>value==null?null:JSON.parse(JSON.stringify(value));
 function indexedDBBackend(db){
  return {
   readAll(){return new Promise((resolve,reject)=>{
    const values={},tx=db.transaction("meta","readonly"),store=tx.objectStore("meta");
    for(const slot of Object.keys(keys)){
     const req=store.get(keys[slot]);req.onsuccess=()=>{values[slot]=req.result?.value||null;};
    }
    tx.oncomplete=()=>resolve(values);tx.onabort=tx.onerror=()=>reject(tx.error||new Error("Не удалось прочитать партию"));
   });},
   write(values){return new Promise((resolve,reject)=>{
    const tx=db.transaction("meta","readwrite"),store=tx.objectStore("meta");
    for(const [slot,value] of Object.entries(values))store.put({key:keys[slot],value});
    // Request success is not durability: a later request can still abort this transaction.
    tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new Error("Запись партии отменена"));
   });}
  };
 }
 function create({backend=null,legacy=null}={}){
  let slots={current:null,previous:null},queue=Promise.resolve();
  const enqueue=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const readLegacy=slot=>{try{return JSON.parse(legacy?.getItem(keys[slot])||"null");}catch(_){return null;}};
  return {
   async open(){
    if(backend){
     slots={...slots,...await backend.readAll()};
     const migrated={};
     for(const slot of Object.keys(keys))if(!slots[slot]){const old=readLegacy(slot);if(old)migrated[slot]=old;}
     if(Object.keys(migrated).length){
      await backend.write(migrated);Object.assign(slots,migrated);
     }
     // Only remove an exact legacy copy once its full value is durably committed.
     for(const slot of Object.keys(keys)){
      try{const old=legacy?.getItem(keys[slot]);if(old&&JSON.stringify(slots[slot])===old)legacy.removeItem(keys[slot]);}catch(_){}
     }
    }else slots={current:readLegacy("current"),previous:readLegacy("previous")};
    return this;
   },
   has(previous=false){return !!slots[previous?"previous":"current"];},
   read(previous=false){return copy(slots[previous?"previous":"current"]);},
   save(payload){
    const snapshot=copy(payload);
    return enqueue(async()=>{
     if(backend)await backend.write({current:snapshot});
     else{if(!legacy)throw new Error("Хранилище недоступно");legacy.setItem(keys.current,JSON.stringify(snapshot));}
     slots.current=snapshot;
    });
   },
   backup(){return enqueue(async()=>{
    if(!slots.current)return;
    const snapshot=copy(slots.current);
    if(backend)await backend.write({previous:snapshot});
    else{if(!legacy)throw new Error("Хранилище недоступно");legacy.setItem(keys.previous,JSON.stringify(snapshot));}
    slots.previous=snapshot;
   });},
   flush(){return queue;}
  };
 }
 return {create,indexedDBBackend,keys};
});
