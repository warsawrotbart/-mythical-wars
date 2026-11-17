/* Reproducible engine profile; no rendered-FPS claim. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),{performance}=require('node:perf_hooks');
global.window=global;require('../card-catalog.js');const E=require('../battle-engine.js'),R=require('../battle-replay.js');
const C=new Map(MW_CANONICAL_CARDS.map(c=>[c.cardId,c])),d=MW_APPROVED_EXAMPLE_DECKS[0],durations=[],hashes=[];
let turns=0,ended=0;const start=performance.now();global.gc?.();const before=process.memoryUsage().heapUsed;
for(let i=0;i<100;i++){
 const s=E.makeGame(d,d,C,{seed:7000+i,firstPlayer:i%2,hour:i%24});E.confirmMulligan(s,[]);
 for(let j=0;j<300&&s.phase==='battle';j++){const a=performance.now(),r=E.runBotTurn(s,s.turn);durations.push(performance.now()-a);turns++;if(!r.ok)throw Error('Failed turn '+i+':'+j);}
 if(s.phase==='ended')ended++;else throw Error('Battle exceeded 300 turns');if(!R.verify(R.exportReplay(s)).ok)throw Error('Replay mismatch '+i);hashes.push(R.checksum(R.snapshot(s)));
}
global.gc?.();const sorted=durations.slice().sort((a,b)=>a-b);
const result={scope:'100 engine games, alternating AI players and 100 verified replays; no DOM/FPS claim',node:process.version,OS:os.platform(),arch:os.arch(),CPU:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,RAMGiB:Math.round(os.totalmem()/1073741824),games:100,ended,turns,elapsedMs:performance.now()-start,botTurnMedianMs:sorted[Math.floor(sorted.length*.5)],botTurnP95Ms:sorted[Math.floor(sorted.length*.95)],botTurnMaxMs:sorted.at(-1),heapBeforeGC:before,heapAfterGC:process.memoryUsage().heapUsed,hashes};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,hashes:'100 entries in output file'},null,2));
