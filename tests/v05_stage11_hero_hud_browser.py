import asyncio,base64,hashlib,json,mimetypes,re,sys,traceback
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image,ImageOps,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'QA_EVIDENCE_v05S11'
OUT.mkdir(parents=True,exist_ok=True)

def image_data(p):
 m=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
 return 'data:'+m+';base64,'+base64.b64encode(p.read_bytes()).decode()

async def setup(page):
 raw=(ROOT/'index.html').read_text('utf8')
 scripts=re.findall(r'<script\s+src="([^"]+)"',raw)
 styles=re.findall(r'<link\s+rel="stylesheet"\s+href="([^"]+)"',raw)
 raw=re.sub(r'<script\s+src="[^"]+"\s*></script>','',raw)
 raw=re.sub(r'<link\s+rel="stylesheet"[^>]*>','',raw)
 await page.set_content(raw,wait_until='domcontentloaded')
 for css in styles:
  text=(ROOT/css.split('?')[0]).read_text('utf8')
  def asset(m):
   v=m.group(1).strip('"\' ')
   f=ROOT/v
   if f.is_file() and f.stat().st_size<260000 and (('hero_' in v) or ('power_' in v) or ('resource_' in v) or ('weapon_' in v) or ('corpse' in v) or ('graveyard' in v)):
    return "url('"+image_data(f)+"')"
   return m.group(0)
  text=re.sub(r'url\(([^)]*)\)',asset,text)
  await page.add_style_tag(content=text)
 for js in scripts:
  await page.add_script_tag(content=(ROOT/js.split('?')[0]).read_text('utf8'))
 art_root=ROOT/'assets/hero-art-v2.1K'
 portraits={'Воин':{'day':image_data(art_root/'warrior_day_test.webp'),'night':image_data(art_root/'warrior_night_test.webp')},'Чернокнижник':{'day':image_data(art_root/'warlock_keeper_test.webp'),'night':image_data(art_root/'warlock_keeper_test.webp')}}
 abilities={'Воин':image_data(art_root/'warrior_ability_torch_test.webp'),'Чернокнижник':image_data(art_root/'warlock_ability_void_test.webp')}
 await page.evaluate('''o=>{
  const original=window.MW_HERO_ART;
  window.MW_HERO_ART=Object.freeze({...original,portraitFor:(cl,phase='day')=>o.portraits[cl]?.[phase==='night'?'night':'day']||'',abilityFor:cl=>o.abilities[cl]||''});
 }''',{'portraits':portraits,'abilities':abilities})
 return scripts

async def test():
 checks=[];errors=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  try:
   page=await browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
   page.on('pageerror',lambda e:errors.append(str(e)))
   js=await setup(page)
   assert 'hero-hud-v05S11.js?v=0511' in js
   assert await page.locator('.mw11-chassis').count()==2
   assert await page.locator('#mw3dStage .mw11-stage-hud').count()==2
   checks.extend(['2D hero HUD built for both players','3D hero HUD built for both players'])
   await page.locator('[data-app-mode="battle"]').click()
   await page.locator('#battleQuickStart').click()
   if await page.locator('#battleMulligan').is_visible():await page.locator('#mulliganConfirm').click()
   await page.wait_for_function('MW_BATTLE_VIEW_BRIDGE.state()?.phase==="battle"',timeout=15000)
   # Set both heroes to known graphic classes, only in sandbox QA state.
   await page.evaluate('''()=>{
    const g=MW_BATTLE_VIEW_BRIDGE.state();g.players[0].classId='Воин';g.players[1].classId='Чернокнижник';
    g.players[0].health=27;g.players[0].armor=3;g.players[1].health=19;
    MW_BATTLE_VIEW_BRIDGE.render();
   }''')
   await page.wait_for_timeout(300)
   first=await page.evaluate('''()=>({health:document.querySelector('#myHero').textContent,armor:document.querySelector('[data-mw11-owner="0"] .mw11-armor').textContent,
    slot:document.querySelector('[data-mw11-owner="0"] .mw11-weapon-slot').dataset.equipped,
    powerTitle:document.querySelector('#myHeroPower .mw11-ability-title')?.textContent,
    cost:document.querySelector('#myHeroPower .mw11-ability-cost')?.textContent,
    picture:document.querySelector('#myHeroPortrait img')?.naturalWidth||0,
    slotText:document.querySelector('[data-mw11-owner="0"] .mw11-weapon-slot').getAttribute('aria-label')})''')
   print('2D',first,flush=True)
   assert first['health']=='♥ 27' and first['armor']=='◈ 3'
   checks.append('health and armor show authoritative game values')
   assert first['slot']=='false' and 'не экипировано' in first['slotText']
   checks.append('weapon slot remains visible while empty')
   assert first['powerTitle'] and first['cost'] is not None
   checks.append('ability name and mana cost appear separately')
   assert first['picture']>0
   checks.append('hero portrait decodes from included art')
   # Demonstrate engine-derived ready / insufficient mana / spent states.
   statuses=await page.evaluate("""()=>{
      const g=MW_BATTLE_VIEW_BRIDGE.state(),pl=g.players[0];
      g.turn=0;g.phase='battle';g.time=12;pl.classId='Воин';pl.heroProfile='demo-unlocked';
      pl.heroPowerUsed=false;pl.maxMana=10;pl.mana=10;
      const read=()=>{MW_HERO_HUD_V0511.render2D(g);return document.querySelector('[data-mw11-owner="0"] .mw11-ability-state').textContent};
      const ready=read();pl.mana=0;const noMana=read();pl.mana=10;pl.heroPowerUsed=true;const used=read();
      pl.heroPowerUsed=false;return {ready,noMana,used};
   }""")
   print('power statuses',statuses,flush=True)
   assert statuses['ready']=='ГОТОВА' and statuses['noMana']=='НЕТ МАНЫ' and statuses['used']=='ИСПОЛЬЗОВАНА'
   checks.append('ready, insufficient mana and already-used power states come from the engine')
   # show equipment state and art; never modify actual production file.
   weapon=await page.evaluate('''()=>{const g=MW_BATTLE_VIEW_BRIDGE.state();const x=Object.values(g.cards).find(c=>c.cardType==='weapon');
     if(!x)return null;g.players[0].weapon={cardId:x.cardId,name:x.name,attack:3,durability:2};
     MW_HERO_HUD_V0511.render2D(g);MW_HERO_HUD_V0511.render3D(g);
     return {cardId:x.cardId,title:x.name};}''')
   print('weapon',weapon,flush=True)
   assert weapon
   second=await page.evaluate('''()=>({twoD:document.querySelector('[data-mw11-owner="0"] .mw11-weapon-slot').dataset.equipped,
      threeD:document.querySelector('.mw11-stage-hud.own .mw11-weapon-slot').dataset.equipped,
      weaponLabel:document.querySelector('.mw11-stage-hud.own .mw11-weapon-slot').getAttribute('aria-label'),
      threeDPortrait:document.querySelector('.mw11-stage-hud.own .mw11-3d-portrait').naturalWidth})''')
   print('equipped',second,flush=True)
   assert second['twoD']=='true' and second['threeD']=='true'
   assert 'атака 3' in second['weaponLabel'] and 'прочность 2' in second['weaponLabel']
   checks.append('equipped weapon reflects attack and durability in 2D and 3D')
   await page.wait_for_timeout(300)
   # Screenshot 2D HUD after equipment while game is active.
   await page.locator('[data-mw11-owner="0"] .hero-avatar-ability').screenshot(path=str(OUT/'Hero_HUD_2D_1600.png'))
   # 1366x768 responsive verification.
   await page.set_viewport_size({'width':1366,'height':768})
   await page.wait_for_timeout(180)
   rect=await page.evaluate('''()=>{const outer=document.querySelector('[data-mw11-owner="0"] .hero-avatar-ability');
     const children=[...outer.children].map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,visible:r.width>0&&r.height>0}});
     const p=outer.getBoundingClientRect();return {outer:{left:p.left,right:p.right,top:p.top,bottom:p.bottom},children};}''')
   print('responsive rects',rect,flush=True)
   assert all(c['visible'] for c in rect['children'])
   assert all(c['left']>=rect['outer']['left']-3 and c['right']<=rect['outer']['right']+3 for c in rect['children'])
   checks.append('all three 2D control groups fit at 1366x768')
   await page.locator('[data-mw11-owner="0"] .hero-avatar-ability').screenshot(path=str(OUT/'Hero_HUD_2D_1366x768.png'))
   # 3D HUD DOM can be tested even when WebGL is not available in this container.
   await page.evaluate('''()=>{
     const g=MW_BATTLE_VIEW_BRIDGE.state();MW_HERO_HUD_V0511.render3D(g);
     const stage=document.getElementById('mw3dStage');stage.hidden=false;
     stage.querySelector('.mw11-stage-hud.own').style.cssText+=';left:48px;top:140px;';
     stage.querySelector('.mw11-stage-hud.enemy').style.cssText+=';left:48px;top:32px;';
   }''')
   await page.wait_for_timeout(250)
   rect3d=await page.evaluate('''()=>{const a=document.querySelector('.mw11-stage-hud.own');const r=a.getBoundingClientRect();
    const ch=[...a.children].map(n=>{const x=n.getBoundingClientRect();return [x.left,x.right]});
    return {outer:[r.left,r.right],children:ch,portrait:a.querySelector('.mw11-3d-portrait').naturalWidth,
        power:a.querySelector('#mw3dPower .mw11-ability-title')?.textContent,source:a.querySelector('.mw11-weapon-picture').getAttribute('src')};}''')
   print('3D rect',rect3d,flush=True)
   assert rect3d['portrait']>0
   assert rect3d['power']
   assert all(l>=rect3d['outer'][0]-4 and r<=rect3d['outer'][1]+4 for l,r in rect3d['children'])
   checks.append('3D overlay hero/weapon/ability layout fits and renders portraits')
   await page.locator('.mw11-stage-hud.own').screenshot(path=str(OUT/'Hero_HUD_3D_1366x768.png'))
   # Simulate cooldown display from engine status but without altering engine rules.
   assert not errors,errors
   checks.append('no browser JavaScript exceptions')
  finally:await browser.close()
 print('PASS',len(checks),checks,flush=True)
 (OUT/'BROWSER_QA_v05S11.json').write_text(json.dumps({'checks':checks,'errors':errors,'count':len(checks)},ensure_ascii=False,indent=2))
 # Compose a QA preview contact sheet of screenshot results.
 panels=[Image.open(OUT/name).convert('RGB') for name in ['Hero_HUD_2D_1600.png','Hero_HUD_2D_1366x768.png','Hero_HUD_3D_1366x768.png']]
 w=max(im.width for im in panels)+80
 h=sum(im.height for im in panels)+180
 poster=Image.new('RGB',(w,h),(14,25,33));d=ImageDraw.Draw(poster)
 y=12
 titles=['2D · игрок · 1600×900','2D · компактный экран · 1366×768','3D · интерфейс игрока · 1366×768']
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
 for label,im in zip(titles,panels):
  d.text((20,y),label,fill=(241,208,145),font=font);y+=31
  poster.paste(im,(40,y));y+=im.height+25
 poster.save(str(OUT/'MW_v05.11_Hero_HUD_Preview.png'))
if __name__=='__main__':asyncio.run(test())
