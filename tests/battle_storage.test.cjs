const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../battle-storage.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const battle=(turn=1)=>({format:'mythical-wars-battle',version:2,game:{turns:turn,cards:{local:{artImage:'data:image/png;base64,ART'}},battleReplay:{initial:{cards:{local:{artImage:'data:image/png;base64,ART'}}},actions:[{command:'endTurn'}]}},turnTimer:{remainingMs:31000},presentationUI:{pendingChoice:{uid:'choice'}}});
function fixture(){
 const disk={},values=new Map(),writes=[];
 const legacy={getItem:k=>values.get(k)||null,setItem(k,v){values.set(k,v);},removeItem:k=>values.delete(k)};
 const backend={async readAll(){return clone(disk);},async write(data){writes.push(clone(data));if(backend.fail)throw new Error('QuotaExceededError');Object.assign(disk,clone(data));}};
 return {disk,values,legacy,backend,writes};
}
test('migrates both legacy slots, preserves replay, art, timer and input; unrelated data untouched',async()=>{
 const f=fixture(),a=battle(3),b=battle(2);f.values.set(S.keys.current,JSON.stringify(a));f.values.set(S.keys.previous,JSON.stringify(b));f.values.set('mw-cards','ARTS');
 const s=await S.create(f).open();assert.deepEqual(s.read(),a);assert.deepEqual(s.read(true),b);assert.equal(f.writes.length,1);assert.equal(f.values.has(S.keys.current),false);assert.equal(f.values.get('mw-cards'),'ARTS');
 const reload=await S.create(f).open();assert.deepEqual(reload.read(),a);
});
test('failed migration retains both original JSON files',async()=>{
 const f=fixture();f.values.set(S.keys.current,JSON.stringify(battle()));f.values.set(S.keys.previous,JSON.stringify(battle(0)));f.backend.fail=true;
 await assert.rejects(S.create(f).open(),/Quota/);assert.equal(f.values.size,2);assert.deepEqual(f.disk,{});
});
test('larger than localStorage quota saves with IndexedDB backend and survives reload',async()=>{
 const f=fixture();f.legacy.setItem=()=>{throw new Error('localStorage full');};const s=await S.create(f).open();const a=battle();a.game.cards.local.artImage='x'.repeat(6*1024*1024);
 await s.save(a);assert.deepEqual((await S.create(f).open()).read(),a);
});
test('queued snapshots are captured at request time; backup waits for latest write',async()=>{
 const f=fixture();let release;const gate=new Promise(r=>release=r),original=f.backend.write;
 f.backend.write=async data=>{await gate;return original(data);};const s=await S.create(f).open(),a=battle(2);
 const first=s.save(battle(1)),last=s.save(a);a.game.turns=999;const backup=s.backup();assert.equal(s.read(),null);release();await Promise.all([first,last,backup]);
 assert.equal(s.read().game.turns,2);assert.equal(s.read(true).game.turns,2);
 await s.save(battle(3));assert.equal(s.read(true).game.turns,2);
});
test('failed save/backup keeps last committed slots and queue recovers',async()=>{
 const f=fixture(),s=await S.create(f).open();await s.save(battle(1));await s.backup();f.backend.fail=true;
 await assert.rejects(s.save(battle(2)));await assert.rejects(s.backup());assert.equal(s.read().game.turns,1);assert.equal(s.read(true).game.turns,1);
 f.backend.fail=false;await s.save(battle(3));await s.flush();assert.equal(s.read().game.turns,3);
});
test('existing IndexedDB save takes precedence without deleting different legacy save',async()=>{
 const f=fixture();f.disk.current=battle(5);const old=JSON.stringify(battle(2));f.values.set(S.keys.current,old);
 const s=await S.create(f).open();assert.equal(s.read().game.turns,5);assert.equal(f.values.get(S.keys.current),old);
});
test('fallback reports actual quota failure and retains prior save',async()=>{
 const f=fixture(),s=await S.create({legacy:f.legacy}).open();await s.save(battle(1));f.legacy.setItem=()=>{throw new Error('QuotaExceededError');};
 await assert.rejects(s.save(battle(2)),/Quota/);assert.equal(s.read().game.turns,1);
});
test('IndexedDB request success alone does not report a successful save',async()=>{
 let tx;const db={transaction(){tx={objectStore(){return {put(){return {};}}}};return tx;}};
 const backend=S.indexedDBBackend(db);let settled=false;const pending=backend.write({current:battle()}).then(()=>{settled=true;});
 await Promise.resolve();assert.equal(settled,false);tx.oncomplete();await pending;assert.equal(settled,true);
 const aborted=backend.write({current:battle(2)});tx.error=new Error('transaction aborted');tx.onabort();await assert.rejects(aborted,/aborted/);
});
