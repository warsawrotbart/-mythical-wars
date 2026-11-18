/* Necromancer illustrations from the user-confirmed Drive folder. Visual data only. */
(function(root){
 'use strict';
 const old=root.MW_TEST_ART_CATALOG,ready=root.MW_READY_ART;
 const newIds=["NCR-007","NCR-008","NCR-009","NCR-010","NCR-011","NCR-012","NCR-013","NCR-014","NCR-015","NCR-017","NCR-018","NCR-019","NCR-020","NCR-021","NCR-022","NCR-023","NCR-024","NCR-025","NCR-026","NCR-027","NCR-028","NCR-029","NCR-030"];
 const records=Object.freeze(Object.fromEntries(newIds.map(id=>[id,Object.freeze({
  path:'test-art/'+id+'.webp',version:'v01',status:'approved-test',
  source:'Necromancer art import 2026-11-18'
 })])));
 const added=id=>records[id]||null;
 const get=id=>old?.get(id)||added(id);
 const ids=Object.freeze([...new Set([...(old?.ids||[]),...newIds])]);
 root.MW_TEST_ART_CATALOG=Object.freeze({count:ids.length,ids,get,has:id=>!!get(id),url:id=>get(id)?.path||'',preview:id=>get(id)?.path||'',status:'test'});
 root.MW_READY_ART=Object.freeze({version:'v05A-necromancer-20261118',
  ids:Object.freeze([...new Set([...(ready?.ids||[]),...newIds])]),
  get:id=>ready?.get(id)||added(id),
  cropFor:id=>ready?.cropFor(id)||(added(id)?{x:0.48,y:0,zoom:1}:null)
 });
 root.MW_NECROMANCER_ART=Object.freeze({version:'2026-11-18',ids:Object.freeze(newIds),get:added});
})(typeof window!=='undefined'?window:globalThis);
