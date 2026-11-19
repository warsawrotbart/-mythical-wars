/* Militia v01 sources. Augments catalogs without replacing earlier art mappings. */
(function(root){
 "use strict";
 const previous=root.MW_TEST_ART_CATALOG,ready=root.MW_READY_ART;
 const newIds=Object.freeze(["NEU-045","NEU-046","NEU-047","NEU-048","NEU-049"]);
 const records=Object.freeze(Object.fromEntries(newIds.map(id=>[id,Object.freeze({
   path:"assets/"+id+"_art_v01.png",version:"v01",status:"integration-test",
   source:"Google Drive / ART / Арты / Нейтральные",
   crop:Object.freeze({x:0.48,y:0,zoom:1,verified:false})
 })])));
 const lookup=id=>previous?.get?.(id)||records[id]||null;
 const ids=Object.freeze([...new Set([...(previous?.ids||[]),...newIds])]);
 root.MW_TEST_ART_CATALOG=Object.freeze({
   count:ids.length,ids,get:lookup,has:id=>!!lookup(id),
   url:id=>lookup(id)?.path||"",preview:id=>lookup(id)?.path||"",status:"test"
 });
 root.MW_READY_ART=Object.freeze({
   version:"v05A-militia-20261119",
   ids:Object.freeze([...new Set([...(ready?.ids||[]),...newIds])]),
   get:id=>ready?.get?.(id)||records[id]||null,
   cropFor:id=>ready?.cropFor?.(id)||records[id]?.crop||null
 });
 root.MW_MILITIA_ART=Object.freeze({version:"2026-11-19",ids:newIds,get:id=>records[id]||null});
})(typeof window!=="undefined"?window:globalThis);
