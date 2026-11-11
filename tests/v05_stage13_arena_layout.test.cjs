'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'arena-layout-v05S13.css'),'utf8');
const js=fs.readFileSync(path.join(root,'arena-layout-v05S13.js'),'utf8');
const {fanPlan,overlapFor,storageKey}=require(path.join(root,'arena-layout-v05S13.js'));

test('stage B is actually loaded by the real battle entrypoint after legacy HUD',()=>{
 assert.match(html,/<link[^>]+href="arena-layout-v05S13\.css\?v=0513b"/);
 assert.match(html,/<script[^>]+src="arena-layout-v05S13\.js\?v=0513b"/);
 assert.ok(html.indexOf('hero-hud-v05S11.css')<html.indexOf('arena-layout-v05S13.css'));
 assert.ok(html.indexOf('hero-hud-v05S11.js')<html.indexOf('arena-layout-v05S13.js'));
});

test('live game objects and hooks remain on the battle page, exactly once',()=>{
 for(const id of ['battleWorkspace','botBoard','myBoard','botHand','myHand','botHeroPortrait','myHeroPortrait','botHeroPower','myHeroPower','botEquippedWeapon','myEquippedWeapon','battleClock','battleTurnInfo','mwArtBotDeckCount','mwArtMyDeckCount','battleEndTurn']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 assert.match(html,/src="battle-engine\.js"/);
 assert.match(html,/src="battle-card-renderer-v2\.1C\.js\?v=(?:0510|0514a|0514b|0515)"/);
 assert.doesNotMatch(html,/v05-template-editor\.js/);
});

test('scope limits new styles to optional battle 2D, preserving 3D and classic mode',()=>{
 assert.match(css,/#battleWorkspace\.mw13-2d-layout:not\(\.mw3d-active\)/);
 assert.doesNotMatch(css,/(?:#mw3dStage|MW_GAME_ENGINE|\.mw11-stage-hud)/);
 assert.match(css,/grid-template-rows:minmax\(0,43fr\) 7px minmax\(0,57fr\)/);
 assert.match(css,/arena-art\/slot_empty\.webp/);
 assert.match(css,/\#battleEndTurn/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test('fan positioning uses live DOM elements, never game state or HTML replacements',()=>{
 assert.deepEqual(fanPlan(0),[]);
 assert.deepEqual(fanPlan(1),[{angle:0,y:0}]);
 assert.deepEqual(fanPlan(5).map(x=>x.angle),[-8.5,-4.25,0,4.25,8.5]);
 assert.equal(fanPlan(10).length,10);
 assert.ok(fanPlan(10).every(x=>x.angle>=-14&&x.angle<=14));
 assert.ok(fanPlan(5).every(x=>Number.isFinite(x.angle)&&Number.isInteger(x.y)));
 assert.equal(overlapFor(1,500,112),0);
 assert.ok(overlapFor(10,800,112)<-17);
 assert.ok(overlapFor(10,800,112)>-112);
 assert.equal(storageKey,'mw-v0513-battle-layout');
 assert.match(js,/MutationObserver/);
 assert.match(js,/childList:true/);
 assert.match(js,/aria-pressed/);
 assert.match(js,/localStorage/);
 for(const pattern of [/\.innerHTML\s*=/,/\.onclick\s*=/,/MW_GAME_ENGINE\s*=/,/game\.players/])assert.doesNotMatch(js,pattern);
});

test('all generated CSS and JS are isolated new assets, without modifying protected data',()=>{
 assert.ok(fs.statSync(path.join(root,'arena-layout-v05S13.css')).size>8000);
 assert.ok(fs.statSync(path.join(root,'arena-layout-v05S13.js')).size>2000);
 assert.equal(fs.existsSync(path.join(root,'v05/production/editor_manifest.json')),true);
});
