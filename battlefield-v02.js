/* Mythical Wars — only 2D battlefield, authoritative TZ v02, 11 Nov 2026.
 * View adapter only: reads live engine state and moves existing DOM; no gameplay
 * rules, card IDs, costs, deck contents or user saves are changed.
 * The optional WebGL 3D prototype remains an independent view.
 */
(function(global){
  'use strict';
  const BASE_WIDTH=1920,BASE_HEIGHT=1080,BOARD_WIDTH=1176,MAX_CREATURES=7;
  const CARD_WIDTH=120,CARD_HEIGHT=180,CARD_GAP=12;
  const CLOCK_CENTERS=[
    [281.46,85.34],[375.14,110.47],[446.88,181.30],[472.47,281.37],
    [447.34,377.33],[376.05,448.16],[280.55,474.21],[184.13,447.70],
    [111.93,377.79],[84.06,281.83],[111.48,182.67],[184.13,110.47]
  ];
  const ROOT='battlefield-v02/';
  const path=(part)=>ROOT+part;
  const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
  const hourOf=(h)=>((Math.trunc(finite(h,12))%24)+24)%24;
  const dayOf=(h)=>{const hour=hourOf(h);return hour>=6&&hour<=17;};
  const frame=(h)=>({hour:hourOf(h),day:dayOf(h),index:hourOf(h)%12,angle:30*(hourOf(h)%12),half:Math.floor(hourOf(h)/12)});
  function plan(count){
    const n=Math.trunc(finite(count));
    if(n<0||n>MAX_CREATURES)throw RangeError('TZ v02 board count must be 0–7');
    const width=n?CARD_WIDTH*n+CARD_GAP*(n-1):0;
    const left=BASE_WIDTH/2-width/2;
    return {n,width,left,right:left+width,x:Array.from({length:n},(_,i)=>left+(CARD_WIDTH+CARD_GAP)*i)};
  }
  function viewportFit(width,height){
    const w=Math.max(1,finite(width,BASE_WIDTH)),h=Math.max(1,finite(height,BASE_HEIGHT));
    const scale=Math.min(w/BASE_WIDTH,h/BASE_HEIGHT);
    return {scale,left:(w-BASE_WIDTH*scale)/2,top:(h-BASE_HEIGHT*scale)/2};
  }
  function markerSrc(day,active){
    return path('clock_assets/ART-15_clock_'+(day?'day':'night')+'_marker_'+(active?'on':'off')+'_v2.png');
  }
  if(typeof module==='object'&&module.exports)module.exports={plan,viewportFit,frame,BOARD_WIDTH,MAX_CREATURES};
  const document=global.document;
  if(!document||typeof document.getElementById!=='function')return;
  const byId=(id)=>document.getElementById(id);
  const element=(tag,cls)=>{const node=document.createElement(tag);if(cls)node.className=cls;return node;};
  let initialized=false,workspace=null,stage=null,clock=null,face=null,clockText=null,
      dial=null,pointer=null,markers=[],manaPanels=[],oldTimeText=null,mutationObserver=null;
  let resizeObserver=null,lastGame=null;

  function addPicture(parent,cls,src){
    const image=element('img',cls);image.src=path(src);image.alt='';image.draggable=false;
    parent.append(image);return image;
  }
  function buildClock(){
    clock=workspace.querySelector('.battle-time-dial');
    if(!clock||clock.querySelector('.mw02-clock-face'))return;
    face=element('div','mw02-clock-face');face.setAttribute('role','img');
    face.setAttribute('aria-label','Игровое время, циферблат на 12 делений');
    dial=addPicture(face,'mw02-clock-dial','clock_assets/ART-16_clock_day_dial_v2.png');
    addPicture(face,'mw02-clock-frame','clock_assets/ART-15_clock_frame_v2.png');
    markers=CLOCK_CENTERS.map(([cx,cy],i)=>{
      const m=addPicture(face,'mw02-clock-marker', 'clock_assets/ART-15_clock_day_marker_off_v2.png');
      m.dataset.index=String(i);
      m.style.left=(cx*0.6-15.6)+'px';m.style.top=(cy*0.6-15.6)+'px';
      return m;
    });
    pointer=addPicture(face,'mw02-clock-pointer','clock_assets/ART-17_clock_pointer.png');
    clockText=byId('battleClock');
    if(clockText)face.append(clockText);
    clock.append(face);
  }
  function buildMana(){
    if(!stage)return;
    manaPanels=[];
    for(const owner of [1,0]){
      const panel=element('div','mw02-mana');panel.dataset.owner=String(owner);
      panel.setAttribute('role','status');panel.setAttribute('aria-live','off');
      const value=element('strong','mw02-mana-value');
      const gems=element('div','mw02-mana-gems');
      Object.assign(gems.style,{display:'flex',gap:'3px',alignItems:'center',marginLeft:'56px'});
      for(let i=0;i<11;i++){const gem=element('span','mw02-mana-gem');gem.hidden=true;gems.append(gem);}
      panel.append(value,gems);stage.append(panel);manaPanels.push({owner,panel,value,gems});
    }
  }
  function addWeaponObjects(){
    for(const owner of [0,1]){
      const shell=workspace.querySelector('[data-hero-owner="'+owner+'"]');
      const slot=shell?.querySelector('.mw11-weapon-slot');if(!slot)continue;
      if(!slot.querySelector('.mw02-equipped-art')){
        const art=element('img','mw02-equipped-art');art.alt='';art.hidden=true;art.draggable=false;
        const attack=element('span','mw02-weapon-number attack');attack.hidden=true;
        const durability=element('span','mw02-weapon-number durability');durability.hidden=true;
        slot.append(art,attack,durability);
      }
    }
  }
  function addBackNavigation(){
    const actions=workspace.querySelector('.battle-quick-actions');if(!actions)return;
    const oldArt=byId('battleArtToggle');
    // The previous 2D art/block variants must no longer be selectable.
    global.MW_ARENA_ART?.init?.();
    global.MW_ARENA_ART?.setOn?.(true,false);
    oldArt?.remove();byId('battleLayoutToggle')?.remove();
    if(!byId('battlefieldV02Exit')){
      const exit=element('button','btn btn-outline');exit.type='button';exit.id='battlefieldV02Exit';
      exit.textContent='← Колоды';exit.title='Вернуться к конструктору колод';
      exit.addEventListener('click',()=>{
        const nav=document.querySelector('.app-mode-nav [data-app-mode="decks"]');
        if(nav){nav.click();return;}
        workspace.hidden=true;syncVisibility();
      });
      actions.prepend(exit);
    }
  }
  function syncVisibility(){
    if(!workspace)return;
    const visible=!workspace.hidden&&!workspace.classList.contains('mw3d-active');
    document.body?.classList.toggle('mw02-battle-open',visible);
    if(visible)syncScale();
  }
  function syncScale(){
    if(!stage||!workspace)return;
    const holder=workspace.querySelector('.battle-layout');
    const width=holder?.clientWidth||global.innerWidth||BASE_WIDTH;
    const height=holder?.clientHeight||global.innerHeight||BASE_HEIGHT;
    const fit=viewportFit(width,height);
    stage.style.setProperty('--mw02-scale',String(fit.scale));
    stage.style.setProperty('--mw02-left',fit.left+'px');
    stage.style.setProperty('--mw02-top',fit.top+'px');
  }
  function renderClock(game){
    if(!face||!game)return;
    const current=frame(game.time),hh=String(current.hour).padStart(2,'0')+':00';
    dial.src=path('clock_assets/ART-16_clock_'+(current.day?'day':'night')+'_dial_v2.png');
    pointer.style.transform='rotate('+current.angle+'deg)';
    // Color each socket from the real gaming hour of its half-dial, never
    // from the non-canonical `socket.type` in the artist layout JSON.
    for(let i=0;i<12;i++){
      const socketHour=current.half*12+i;
      const markerDay=dayOf(socketHour);
      markers[i].src=markerSrc(markerDay,i===current.index);
      markers[i].title=String(socketHour).padStart(2,'0')+':00';
    }
    if(clockText)clockText.textContent=hh;
    face.setAttribute('aria-label','Игровое время '+hh+'. '+(current.day?'Светлое':'Тёмное')+' время');
    workspace.dataset.mw02Bright=current.day?'true':'false';
  }
  function renderMana(game){
    for(const {owner,panel,value,gems} of manaPanels){
      const player=game.players[owner];if(!player)continue;
      const mana=Math.max(0,Math.trunc(finite(player.mana)));
      const max=Math.max(0,Math.trunc(finite(player.maxMana)));
      // The 11th gem only appears when the temporary resource is present.
      const actualMax=Math.max(max,mana),count=Math.min(11,actualMax);
      for(let i=0;i<11;i++){
        const gem=gems.children[i];gem.hidden=i>=count;gem.classList.toggle('filled',i<mana);
      }
      value.textContent=mana+'/'+max;
      panel.setAttribute('aria-label',(owner?'Мана соперника: ':'Моя мана: ')+mana+' из '+max);
    }
  }
  function renderHeroes(game){
    const day=dayOf(game.time);
    for(const owner of [0,1]){
      const player=game.players[owner];
      const shell=workspace.querySelector('[data-hero-owner="'+owner+'"]');if(!player||!shell)continue;
      shell.dataset.mw02Warrior=String(player.classId==='Воин');
      shell.dataset.mw02Phase=day?'day':'night';
      // The values are independent of the supplied hero preview artwork.
      const health=byId(owner?'botHero':'myHero');if(health)health.textContent=String(player.health);
      const armor=shell.querySelector('.mw11-armor');
      if(armor){armor.hidden=!(Number(player.armor)>0);armor.textContent=String(player.armor||0);}
      const slot=shell.querySelector('.mw11-weapon-slot'),weapon=player.weapon;
      const art=slot?.querySelector('.mw02-equipped-art');
      const attack=slot?.querySelector('.mw02-weapon-number.attack');
      const durability=slot?.querySelector('.mw02-weapon-number.durability');
      if(!art||!attack||!durability)continue;
      const artPath=weapon?.cardId&&global.MW_TEST_ART_CATALOG?.url?.(weapon.cardId);
      if(artPath){if(art.getAttribute('src')!==artPath)art.setAttribute('src',artPath);art.hidden=false;}
      else{art.removeAttribute('src');art.hidden=true;}
      attack.hidden=durability.hidden=!weapon;
      attack.textContent=weapon?String(weapon.attack):'';
      durability.textContent=weapon?String(weapon.durability):'';
    }
  }
  function syncHand(){
    const hand=byId('myHand');if(!hand)return;
    const count=Array.from(hand.children).filter(x=>x.classList.contains('battle-card')&&x.classList.contains('hand')).length;
    const overlap=count>1?Math.min(0,(1040-120*count-12*(count-1))/(count-1)):0;
    hand.style.setProperty('--mw02-hand-overlap',Math.max(-90,overlap)+'px');
  }
  function render(game){
    if(!initialized)init();
    if(!initialized||!game||!game.players)return;
    lastGame=game;
    renderClock(game);renderMana(game);renderHeroes(game);syncHand();syncVisibility();
    const opponent=game.players[1],player=game.players[0];
    if(byId('mwArtBotDeckCount'))byId('mwArtBotDeckCount').textContent=String(opponent?.deck?.length??0);
    if(byId('mwArtMyDeckCount'))byId('mwArtMyDeckCount').textContent=String(player?.deck?.length??0);
  }
  function init(){
    if(initialized)return true;
    workspace=byId('battleWorkspace');stage=workspace?.querySelector('.battle-main');
    if(!workspace||!stage)return false;
    global.MW_HERO_HUD_V0511?.init?.();
    global.MW_ARENA_V05S13?.init?.();
    workspace.classList.add('mw02-field');
    workspace.classList.remove('mw-art-off');
    buildClock();buildMana();addWeaponObjects();addBackNavigation();
    initialized=true;
    if(typeof global.MutationObserver==='function'){
      mutationObserver=new global.MutationObserver(()=>syncVisibility());
      mutationObserver.observe(workspace,{attributes:true,attributeFilter:['hidden','class']});
      const hand=byId('myHand');if(hand){
        const observer=new global.MutationObserver(()=>syncHand());
        observer.observe(hand,{childList:true});
      }
    }
    if(typeof global.ResizeObserver==='function'){
      resizeObserver=new global.ResizeObserver(()=>syncScale());
      resizeObserver.observe(workspace.querySelector('.battle-layout'));
    }
    global.addEventListener?.('resize',syncScale,{passive:true});
    syncVisibility();syncHand();
    return true;
  }
  const api=Object.freeze({init,render,plan,viewportFit,frame,syncScale,MAX_CREATURES,BOARD_WIDTH});
  global.MW_BATTLEFIELD_V02=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
