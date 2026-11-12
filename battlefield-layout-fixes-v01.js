/* Battlefield Layout Fixes v01 · BF-01 — BF-11. Presentation only; never mutates engine state. */
(function(global){
  'use strict';
  const doc=global.document;if(!doc)return;
  const $=id=>doc.getElementById(id);
  let initialized=false;
  const ROOT='assets/hero-art-v2.1K/';
  function init(){
    if(initialized)return true;
    const arena=$('battleWorkspace'),stage=arena?.querySelector('.battle-main');
    if(!arena||!stage||!arena.classList.contains('mw02-field'))return false;
    // Clock is an independent stage element, rather than a transformed child of the 30px divider.
    const clock=arena.querySelector('.battle-time-dial');
    if(clock&&clock.parentElement!==stage)stage.appendChild(clock);
    // Keep navigation visible; put all technical controls behind one fold-out.
    const actions=arena.querySelector('.battle-quick-actions');
    if(actions&&!$('mw02ToolsMenu')){
      const menu=doc.createElement('details');menu.id='mw02ToolsMenu';menu.className='mw02-tools-menu';
      const summary=doc.createElement('summary');summary.textContent='⚙ Меню';
      const list=doc.createElement('div');list.className='mw02-tools-items';
      menu.append(summary,list);actions.append(menu);
      for(const id of ['battle3DToggle','battleSideToggle','battleSettingsDrawer','battleInfoDrawer']){
        const element=$(id);if(element)list.append(element);
      }
      // Graveyard buttons are real game actions, but their old bare 0 labels
      // must not float over the battlefield or overlap a player's hand.
      for(const [id,label] of [['myGraveyardBtn','Кладбище игрока'],['botGraveyardBtn','Кладбище соперника']]){
        const button=$(id);if(!button)continue;
        const row=doc.createElement('div');row.className='mw02-grave-row';
        const text=doc.createElement('span');text.textContent=label;
        row.append(text,button);list.append(row);
      }
    }
    for(const owner of [0,1]){
      const deck=$(owner?'mwArtBotDeck':'mwArtMyDeck');
      if(deck&&!deck.querySelector('.mw02-deck-card')){
        const back=doc.createElement('span');back.className='mw02-deck-card';
        back.setAttribute('aria-hidden','true');deck.prepend(back);
      }
    }
    initialized=true;return true;
  }
  function render(game){
    if(!initialized&&!init())return;
    if(!game?.players)return;
    const phase=game.time>=6&&game.time<=17?'day':'night';
    for(const owner of [0,1]){
      const player=game.players[owner];if(!player)continue;
      const shell=doc.querySelector('[data-hero-owner="'+owner+'"]');
      if(!shell)continue;
      shell.dataset.mw02Class=player.classId||'';
      const powerStatus=global.MW_GAME_ENGINE?.heroPowerStatus?.(game,owner);
      if(powerStatus){
        shell.dataset.mw02PowerState=powerStatus.ok?'ready':powerStatus.used?'used':
          /недостаточно маны/i.test(powerStatus.reason||'')?'no-mana':
          /нет свободного места|нет дружественного существа|цели|цель/i.test(powerStatus.reason||'')?'no-target':'locked';
        const control=$(owner?'botHeroPower':'myHeroPower');
        if(control)control.title=String(powerStatus.name||'Сила героя')+' · '+String(powerStatus.cost??0)+' маны'+(powerStatus.reason?' · '+powerStatus.reason:'');
      }
      const portrait=$(owner?'botHeroPortrait':'myHeroPortrait');
      const classId=player.classId;
      // The supplied Ragvalod frame/portrait remains the approved Warrior asset.
      const fromBridge=global.MW_HERO_PORTRAIT_BRIDGE?.get?.(owner,classId,phase)||
          global.MW_HERO_ART?.portraitFor?.(classId,phase)||'';
      const url=classId==='Некромант'?ROOT+'necro_portrait_test_v01.png':fromBridge;
      if(portrait){
        if(classId==='Воин'){portrait.style.removeProperty('background-image');}
        else if(url)portrait.style.setProperty('background-image','url("'+url.replace(/"/g,'%22')+'")','important');
        else portrait.style.removeProperty('background-image');
        portrait.setAttribute('aria-label',(owner?'Герой противника: ':'Ваш герой: ')+classId);
      }
      // Zero armor is a real, readable HUD state; hero identity stays attached to portrait.
      const armor=shell.querySelector('.mw11-armor');
      if(armor){armor.hidden=false;armor.textContent=String(player.armor??0);}
      const deck=$(owner?'mwArtBotDeck':'mwArtMyDeck');
      if(deck)deck.dataset.empty=String((player.deck?.length??0)===0);
    }
  }
  global.MW_BF_LAYOUT_FIXES=Object.freeze({init,render});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})(window);
