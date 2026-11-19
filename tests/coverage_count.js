// Registry census for 162 canonical cards; no external packages.
global.window=global;
const path=require("node:path");
const root=path.resolve(__dirname,"..");
require(path.join(root,"card-catalog.js"));
const E=require(path.join(root,"battle-engine.js"));
const counts={};
for(const c of global.MW_CANONICAL_CARDS){
 const status=E.abilitySupport(c);
 counts[status]=(counts[status]||0)+1;
}
console.log("Effect coverage:",counts);
if(global.MW_CANONICAL_CARDS.length!==162||
   counts.complete!==141||counts.partial!==21||(counts.unavailable||0)!==0){
 console.error("Unexpected coverage — audit this release.");
 process.exitCode=1;
}
