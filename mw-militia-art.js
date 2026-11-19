/* Approved militia illustrations from the original Drive PNG files. */
(function(root){
"use strict";
const previous=root.MW_TEST_ART_CATALOG,ready=root.MW_READY_ART;
const sourceIds={"NEU-045":"1LUTYPW55FxCDRyFGsw5DT_TMyugr_jtW","NEU-046":"1NKjoQlDKKjcP2PIvfNhvf6QXG_gttuaZ","NEU-047":"1jsuT90hRgb1obxCiefyrUOJxmb9rz5Id","NEU-048":"1FZT3-ao-8wTOK_UrEoDPRe4mq2AfBOQe","NEU-049":"1NKLB7i1wZO50SOX26eIKW5DJBGFqPWrh"};
const ids=Object.freeze(Object.keys(sourceIds));
const records=Object.freeze(Object.fromEntries(ids.map(id=>{
 const version=id==="NEU-045"?"v01":"v02";
 const path=version==="v01"?"test-art/"+id+".png":"assets/"+id+"_art_"+version+".png";
 return [id,Object.freeze({path,version,status:"source-approved",source:"Google Drive / ART / Арты / Нейтральные",driveId:sourceIds[id]})];
})));
const get=id=>records[id]||previous?.get(id)||null;
const allIds=Object.freeze([...new Set([...(previous?.ids||[]),...ids])]);
root.MW_TEST_ART_CATALOG=Object.freeze({count:allIds.length,ids:allIds,get,has:id=>!!get(id),url:id=>get(id)?.path||"",preview:id=>get(id)?.path||"",status:"test"});
root.MW_READY_ART=Object.freeze({version:"v05A-militia-v02",ids:Object.freeze([...new Set([...(ready?.ids||[]),...ids])]),get:id=>records[id]||ready?.get(id)||null,cropFor:id=>records[id]?{x:0.5,y:0,zoom:1}:ready?.cropFor(id)||null});
root.MW_MILITIA_ART=Object.freeze({version:"v02",ids,get});
})(typeof window!=="undefined"?window:globalThis);
