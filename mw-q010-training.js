/* Q010 approved training battle snapshot, source: campaign demo sheet "Составы" (19.11.2026).
 * This module does not grant rewards or alter saved campaigns. */
(function(root,factory){
 const data=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=data;
 root.MW_Q010_TRAINING=data;
})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 const Q010=Object.freeze({
  id:"Q010",hour:8,timerMs:0,opponentProfile:"PROFILE-TRAINING-DEMO",
  player:Object.freeze({deckId:"D_START_MILITIA",name:"Ополчение — старт",classId:"Воин",source:"Квесты демоверсии / Составы / Q010",counts:Object.freeze({"KNZ-004":2,"NEU-002":2,"NEU-003":2,"NEU-045":2,"KNZ-008":2,"KNZ-011":2,"NEU-011":2,"NEU-046":2,"KNZ-015":2,"KNZ-018":2,"NEU-006":2,"NEU-047":2,"KNZ-022":2,"NEU-048":2,"NEU-049":2})}),
  opponent:Object.freeze({deckId:"D_TRAINING_WARRIOR",name:"Міраслаў, настаўнік дружыны",classId:"Воин",source:"Квесты демоверсии / Составы / Q010",counts:Object.freeze({"KNZ-001":2,"KNZ-002":2,"KNZ-003":2,"KNZ-004":2,"KNZ-005":1,"KNZ-007":2,"KNZ-008":2,"KNZ-039":2,"KNZ-012":2,"KNZ-013":2,"KNZ-014":2,"KNZ-015":2,"KNZ-016":1,"KNZ-019":2,"KNZ-021":2,"KNZ-025":2})}),
  heroProfiles:Object.freeze(["campaign","campaign"]), // both hero powers disabled in training
  rewardSource:"Q000 after Q010 victory and completion of Q000 mandatory steps"
 });
 return Q010;
});
