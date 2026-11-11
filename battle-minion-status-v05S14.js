/* MW v05.14 Stage 2 — read-only combat presentation for creatures and tokens.
 * Deathrattle IDs mirror the implemented deathrattle() switch in battle-engine.js.
 * Never changes the combat engine, card library, or serialized battle state.
 */
(function(root,factory){
"use strict";
const api=factory();
if(typeof module==="object"&&module.exports)module.exports=api;
if(root)root.MW14_BOARD_STATUS=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const DEATHRATTLE_IDS=Object.freeze([
 "CHR-002","CHR-023","CHR-034","KNZ-010","CHR-030",
 "NEU-003","NEU-005","NEU-037","NEU-042","ZAV-004","NCR-002","NCR-013"
]);
const DEATHRATTLE_SET=new Set(DEATHRATTLE_IDS);
const TOKEN_ID=/^TKN-\d{3}$/;
function cardDefinition(game,unit,tokenDefs){
 if(!unit?.cardId)return null;
 const direct=game?.cards?.[unit.cardId];
 if(direct)return direct;
 if(tokenDefs?.[unit.cardId])return tokenDefs[unit.cardId];
 if(!unit.token&&!TOKEN_ID.test(unit.cardId))return null;
 // Visual-only definition for older saves and special hero-power tokens:
 // no new ability or gameplay information is invented.
 return {cardId:unit.cardId,name:unit.name||unit.cardId,
  cardType:"creature",origin:"token",
  attack:Number.isFinite(+unit.attack)?+unit.attack:0,
  health:Number.isFinite(+unit.maxHealth)?+unit.maxHealth:Number(unit.health)||0,
  timeAffinityId:unit.affinity||"",creatureTypeId:unit.creatureType||"",
  subtype:unit.subtype||"",ability:""};
}
function boardUnit(game,identifier){
 if(typeof identifier!=="string")return null;
 const pos=identifier.indexOf("|");if(pos<1)return null;
 const owner=Number(identifier.slice(0,pos));
 if(owner!==0&&owner!==1)return null;
 const uid=identifier.slice(pos+1);
 return game?.players?.[owner]?.board?.find(unit=>String(unit.uid)===uid)||null;
}
function statusIcons(unit){
 if(!unit)return [];
 const r=[];
 if(DEATHRATTLE_SET.has(unit.cardId))r.push({id:"deathrattle",glyph:"☠",label:"Предсмертный хрип"});
 if(unit.charge)r.push({id:"charge",glyph:"➤",label:"Рывок"});
 if(unit.stealth)r.push({id:"stealth",glyph:"◉",label:"Маскировка"});
 if(unit.reborn)r.push({id:"reborn",glyph:"✧",label:"Перерождение"});
 if(unit.timed?.some(x=>x?.kind==="frozen"))r.push({id:"frozen",glyph:"❄",label:"Заморозка"});
 return r;
}
function guardActive(unit){return unit?.taunt===true;}
return Object.freeze({DEATHRATTLE_IDS,cardDefinition,boardUnit,statusIcons,guardActive});
});
