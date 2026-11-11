/* MW v05.17 — controlled import for one image: SYS-001 only. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const coin=require("../mw-coin-art-v05S17.js");
const registry=JSON.parse(read("ART_ASSET_REGISTRY_v05S17.json"));
test("single imported art is the original v01 PNG matching the verified Drive source",()=>{
 assert.equal(registry.entries.length,1);
 const entry=registry.entries[0];
 assert.equal(entry.cardId,"SYS-001");
 assert.equal(entry.artVersion,"v01");
 assert.equal(entry.sourceFileId,"1VzHc1HRW-0O8BFqg86bkK1iqAzKHQIse");
 const buf=fs.readFileSync(path.join(root,entry.originalPath));
 assert.equal(crypto.createHash("sha256").update(buf).digest("hex"),entry.sha256);
 assert.deepEqual([...buf.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.equal(buf.readUInt32BE(16),1448);
 assert.equal(buf.readUInt32BE(20),1086);
 assert.equal(entry.maskCheck,"pending-visual-review");
 assert.equal(entry.crop.verified,false);
 assert.equal(entry.cardAdmission,"service-only; not collectible");
});
test("coin keeps its internal runtime ID distinct from the library visual ID",()=>{
 assert.equal(coin.runtimeId,"__coin__");
 assert.equal(coin.cardId,"SYS-001");
 assert.equal(coin.visualId("__coin__"),"SYS-001");
 assert.equal(coin.visualId("KNZ-019"),"KNZ-019");
 const card=coin.definition();
 assert.equal(card.cardId,"SYS-001");
 assert.equal(card.cardType,"spell");
 assert.equal(card.classId,"Нейтральная");
 assert.equal(card.costValue,0);
 assert.equal(card.costType,"mana");
 assert.equal(card.rarityId,null);
 assert.match(card.ability,/да канца гэтага ходу/);
 assert.match(card.ability,/не павялічвае пастаянны максімум/);
});
test("one local art mapping is shared between game and editor",()=>{
 const lookup=require("../mw-test-art-catalog.js");
 assert.equal(lookup.get("SYS-001").version,"v01");
 assert.equal(lookup.url("SYS-001"),registry.entries[0].originalPath);
 const app=read("index.html"),editor=read("v05-dynamic.html");
 assert.match(app,/mw-test-art-catalog\.js\?v=0517/);
 assert.match(editor,/mw-test-art-catalog\.js\?v=0517/);
 assert.ok(app.indexOf("mw-coin-art-v05S17.js")<app.indexOf("battle-card-renderer-v2.1C.js"));
 assert.ok(!app.includes("https://drive.google.com/file/d/1VzHc1"));
});
test("coin renders through the approved v05 spell template in mulligan, hand and inspect",()=>{
 const game=read("deckgame.js"),renderer=read("battle-card-renderer-v2.1C.js"),hand=read("battle-hand-v05S14.js");
 assert.match(game,/const type=coin\?"spell":/);
 assert.match(game,/h\.cardId==="__coin__"\?window\.MW_SYS001_COIN\?\.definition\(\):game\.cards\[h\.cardId\]/);
 assert.match(renderer,/id==="__coin__"\?global\.MW_SYS001_COIN\?\.definition\(\)/);
 assert.match(renderer,/item\.cardId==="__coin__"\?global\.MW_SYS001_COIN\?\.definition\(\)/);
 assert.doesNotMatch(renderer,/mw-inspect-coin/);
 assert.match(hand,/hand\.cardId==="__coin__"\?win\.MW_SYS001_COIN\?\.definition\(\)/);
 assert.match(game,/button\.querySelector\("\.mulligan-fallback"\)\?\.setAttribute\("hidden",""\)/);
});
test("existing coin game mechanic is untouched",()=>{
 const src=read("battle-engine.js");
 assert.match(src,/cardId:"__coin__"/);
 assert.match(src,/if\(hand\.cardId==="__coin__"\)return 0/);
 assert.match(src,/if\(h\.cardId==="__coin__"\)\{p\.hand\.splice\(idx,1\);p\.mana\+\+/);
 assert.match(src,/h\.cardId!=="__coin__"/);
 assert.match(read("coin-art-v05S17.css"),/mulligan-fallback\[hidden\]/);
});
