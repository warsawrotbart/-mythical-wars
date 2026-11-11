/* MW v05.17 — one approved test art, one special visual adapter.
 * SYS-001 is the library ID. __coin__ remains the engine's internal hand ID.
 * Do not add the service card to deck construction or change its mechanics.
 */
(function(root,factory){
 const api=factory(root);
 root.MW_SYS001_COIN=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(root){
 "use strict";
 const runtimeId="__coin__",cardId="SYS-001";
 // Fields taken from the live «Библиотека карт» > «Токены», 2026-11-11.
 // The old v05 embedded 7-token snapshot does not yet contain SYS-001.
 const verifiedSnapshot=Object.freeze({
   cardId,name:"МАНЕТКА",cardType:"spell",classId:"Нейтральная",
   rarityId:null,costValue:0,costType:"mana",origin:"special",
   ability:"Атрымайце 1 дадатковы запоўнены крышталь маны да канца гэтага ходу. Ён не павялічвае пастаянны максімум маны."
 });
 const isCoin=id=>id===runtimeId||id===cardId;
 const definition=()=>verifiedSnapshot;
 const visualId=id=>id===runtimeId?cardId:id;
 return Object.freeze({runtimeId,cardId,isCoin,visualId,definition});
});
