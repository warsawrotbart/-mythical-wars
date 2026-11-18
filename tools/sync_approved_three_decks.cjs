// Mechanical data synchronization. Does not infer rules, costs, stats or admission.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/approved_three_decks_2026-11-18.json'),'utf8'));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const context={window:{}};
vm.runInNewContext(read('card-catalog.js'),context);
const updated=new Map(snapshot.cards.map(c=>[c.cardId,c]));
const cards=context.window.MW_CANONICAL_CARDS.map(c=>updated.has(c.cardId)?{...c,...updated.get(c.cardId)}:c);
// Only metadata/text changes were approved for these existing cards.
for(const c of context.window.MW_CANONICAL_CARDS){
 const next=cards.find(x=>x.cardId===c.cardId);
 for(const k of ['costType','costValue','attack','health','durability','rarityId','maxCopies'])
  if(next[k]!==c[k])throw Error('Unexpected balance change '+c.cardId+' '+k);
}
const source=read('card-catalog.js').replace(/window\.MW_CANONICAL_CARDS=\[.*\];/, 'window.MW_CANONICAL_CARDS='+JSON.stringify(cards)+';');
fs.writeFileSync(path.join(root,'card-catalog.js'),source);
// Keep the visual/editor seed in sync too; retain art, notes and publication status.
vm.runInNewContext(read('v05-library-seed.js'),context);
const seed=context.window.MW_V05_LIBRARY_SEED;
const row=c=>[c.cardId,c.name,c.costType==='mana'?c.costValue:null,c.rarityId,c.cardType,c.attack,c.health,c.durability,c.timeAffinityId||'—',c.creatureTypeId||'—',c.subtype||'—',c.ability||'—',c.keywords||'—',c.classId,c.maxCopies,c.status,c.costValue,c.costType==='corpses'?'Трупы':'Мана',c.schoolId||null,c.spellForm||null];
const type={creature:'Существо',spell:'Заклинание',weapon:'Оружие'};
const rarity={common:'Обычная (серая)',standard:'Стандартная (зелёная)',rare:'Редкая (синяя)',epic:'Эпическая (фиолетовая)',legendary:'Легендарная (золотая)'};
for(const [key,list]of [['cards',snapshot.cards],['tokens',snapshot.tokens]])for(const c of list){
 let existing=seed[key].find(r=>r[0]===c.cardId);
 if(!existing){existing=Array(21).fill(null);seed[key].push(existing);}
 const next=row(c);next[3]=rarity[c.rarityId]||existing[3]||(c.cardId.startsWith('TKN-')?'Токен':'Служебная');next[4]=type[c.cardType];
 next.forEach((v,i)=>existing[i]=v);
}
fs.writeFileSync(path.join(root,'v05-library-seed.js'),'/* Approved three-deck data snapshot 2026-11-18. Art and source notes retained. */\nwindow.MW_V05_LIBRARY_SEED='+JSON.stringify(seed)+';\n');
console.log('Synchronized '+snapshot.cards.length+' selected cards and '+snapshot.tokens.length+' generated/service cards. No balance values changed.');
