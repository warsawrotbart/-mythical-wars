/* Five approved militia illustrations, retained as original PNG; no changes to cards. */
(function(root){
"use strict";
const previous=root.MW_TEST_ART_CATALOG,ready=root.MW_READY_ART;
const sourceIds={"NEU-045":"1LUTYPW55FxCDRyFGsw5DT_TMyugr_jtW","NEU-046":"1NKjoQlDKKjcP2PIvfNhvf6QXG_gttuaZ","NEU-047":"1jsuT90hRgb1obxCiefyrUOJxmb9rz5Id","NEU-048":"1FZT3-ao-8wTOK_UrEoDPRe4mq2AfBOQe","NEU-049":"1NKLB7i1wZO50SOX26eIKW5DJBGFqPWrh"};
const ids=Object.freeze(Object.keys(sourceIds));
const records=Object.freeze(Object.fromEntries(ids.map(id=>[id,Object.freeze({path:"test-art/"+id+".png",version:"v01",status:"source-approved",source:"Google Drive / ART / Арты / Нейтральные",driveId:sourceIds[id]})])));
const get=id=>records[id]||previous?.get(id)||null;
const allIds=Object.freeze([...new Set([...(previous?.ids||[]),...ids])]);
root.MW_TEST_ART_CATALOG=Object.freeze({count:allIds.length,ids:allIds,get,has:id=>!!get(id),url:id=>get(id)?.path||"",preview:id=>get(id)?.path||"",status:"test"});
root.MW_READY_ART=Object.freeze({version:"v05A-militia-20261119",ids:Object.freeze([...new Set([...(ready?.ids||[]),...ids])]),get:id=>records[id]||ready?.get(id)||null,cropFor:id=>records[id]?{x:0.5,y:0,zoom:1}:ready?.cropFor(id)||null});
root.MW_MILITIA_ART=Object.freeze({version:"2026-11-19",ids,get});
})(typeof window!=="undefined"?window:globalThis);
