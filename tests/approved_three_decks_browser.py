"""Local UI smoke test; no publication, external writes or screenshot artifacts."""
import asyncio,json
from playwright.async_api import async_playwright

async def main():
    errors=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
        page=await browser.new_page(viewport={'width':1600,'height':900})
        page.on('pageerror',lambda e: errors.append(str(e)))
        await page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
        await page.wait_for_function('window.MW_DECK_TEST && window.MW_BATTLE_VIEW_BRIDGE',timeout=30000)
        await page.locator('[data-app-mode="battle"]').click()
        await page.locator('#mw02ToolsMenu > summary').click()
        await page.locator('#battleSettingsDrawer > summary').click()
        results=[]
        for cls,deck,name in [('Воин','sample-warrior','Рагвалод'),('Чернокнижник','sample-warlock','Велімір'),('Некромант','sample-necro','Чернобог')]:
            await page.select_option('#battleMyDeck',deck)
            await page.select_option('#battleBotDeck','sample-warrior')
            await page.select_option('#battleHeroProfile','approved-three-decks')
            await page.select_option('#battleBotHeroProfile','approved-three-decks')
            await page.evaluate('MW_DECK_TEST.startBattle()')
            # Prepare a deterministic test action using the existing QA state bridge.
            await page.evaluate('''()=>{const g=MW_DECK_TEST.game();g.phase='battle';g.turn=0;g.time=12;g.players[0].mana=10;g.players[0].heroPowerUsed=false;MW_BATTLE_VIEW_BRIDGE.render();}''')
            state=await page.evaluate('''()=>{const g=MW_DECK_TEST.game();return {name:g.players[0].heroName,armor:g.players[0].armor,mode:g.timeMode,power:MW_GAME_ENGINE.heroPowerStatus(g,0)}}''')
            assert state['name']==name,state
            assert state['mode']=='floor',state
            assert state['power']['ok'],state
            # Render and click the original live control, not a parallel test button.
            await page.evaluate("document.getElementById('myHeroPower').click()")
            await page.wait_for_function('MW_DECK_TEST.game().players[0].heroPowerUsed',timeout=10000)
            await page.wait_for_function('!MW_BATTLE_VIEW_BRIDGE.ui().busy',timeout=10000)
            after=await page.evaluate('''()=>{const g=MW_DECK_TEST.game();return {name:g.players[0].heroName,mana:g.players[0].mana,armor:g.players[0].armor,board:g.players[0].board.map(m=>m.cardId),disabled:document.getElementById('myHeroPower').disabled}}''')
            assert after['mana']==8,after
            assert after['disabled'],after
            if cls=='Воин': assert after['board']==['TKN-001'] and after['armor']==10,after
            if cls=='Чернокнижник': assert after['armor']==2,after
            if cls=='Некромант': assert after['board']==['TKN-010'],after
            results.append(after)
            await page.evaluate("MW_DECK_TEST.game().phase='ended'")
        assert not errors,errors
        print(json.dumps({'passed':3,'heroes':results,'pageErrors':errors},ensure_ascii=False))
        await browser.close()

asyncio.run(main())
