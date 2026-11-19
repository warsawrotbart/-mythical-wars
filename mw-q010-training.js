/* Q010 preview constraints. Campaign rewards are handled separately. */
(function(root,factory){
 const commonJS=typeof module!=="undefined"&&module.exports;
 const data=factory(commonJS?require("./mw-q010-data.js"):root.MW_Q010_DATA);
 if(commonJS)module.exports=data;
 root.MW_Q010_TRAINING=data;
})(typeof window!=="undefined"?window:globalThis,function(data){
 "use strict";
 const source="Игровые колоды для квестов / Составы / Q010";
 const deck=id=>Object.freeze({...data.decks.find(entry=>entry.deckId===id),source});
 return Object.freeze({
  id:data.questId,
  hour:data.hour,
  timerMs:0,
  opponentProfile:"PROFILE-TRAINING-DEMO",
  player:deck(data.playerDeckId),
  opponent:deck(data.enemyDeckId),
  heroProfiles:Object.freeze(["campaign","campaign"]),
  rewardSource:"Q000 after Q010 victory and completion of Q000 mandatory steps"
 });
});
