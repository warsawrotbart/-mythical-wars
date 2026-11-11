/* Mythical Wars v05.11 Hero HUD: presentation only. No state mutation.
 * The 2D and 3D views use the same game.players and engine.heroPowerStatus.
 * Buttons, hero targeting and portraits keep their original IDs and handlers.
 */
(function(global){
  "use strict";
  const doc=global.document;
  const node=(tag,cls,txt)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;};
  const byId=id=>doc.getElementById(id);
  const engine=()=>global.MW_GAME_ENGINE;
  let initialized=false;
  const state=new Map();
  const nameFor=(game,owner)=>game.players[owner]?.classId||"Герой";
  const titleFor=(game,owner)=>owner===0?"ИГРОК":"БОТ";
  const weaponArt=id=>global.MW_TEST_ART_CATALOG?.url(id)||"";
  function weaponSlot(source,cls){
    const slot=node("div",cls+" mw11-weapon-slot");
    slot.dataset.equipped="false";
    slot.setAttribute("role","img");
    slot.setAttribute("aria-label","Оружие не экипировано");
    slot.title="Оружие не экипировано";
    slot.append(node("span","mw11-slot-icon","⚔"),node("small","mw11-weapon-caption","ОРУЖИЕ"));
    if(source)slot.append(source);
    return slot;
  }
  function make2D(){
    for(const owner of [0,1]){
      const shell=doc.querySelector('[data-hero-owner="'+owner+'"]');
      if(!shell||shell.classList.contains("mw11-chassis"))continue;
      const strip=shell.querySelector(".hero-avatar-ability");
      const portrait=strip?.querySelector(".hero-portrait-group");
      const identity=strip?.querySelector(".hero-identity");
      const ability=strip?.querySelector(".hero-power-group");
      const oldWeapon=strip?.querySelector(".mw-equipped-weapon");
      if(!strip||!portrait||!identity||!ability||!oldWeapon)continue;
      const empty=weaponSlot(oldWeapon,"mw11-weapon-2d");
      const hero=node("div","mw11-hero-core");hero.append(portrait,identity);
      const armor=node("span","mw11-armor");armor.hidden=true;identity.append(armor);
      const stateLabel=node("small","mw11-ability-state","Ожидание");ability.append(stateLabel);
      strip.replaceChildren(empty,hero,ability);
      shell.classList.add("mw11-chassis");
      shell.dataset.mw11Owner=String(owner);
    }
  }
  function make3D(){
    const stage=byId("mw3dStage");if(!stage)return;
    for(const owner of [0,1]){
      const own=owner===0,prefix=own?"My":"Enemy";
      const summary=stage.querySelector(".mw3d-hero-summary."+(own?"own":"enemy"));
      const power=byId("mw3d"+(own?"Power":"EnemyPower"));
      if(!summary||!power||summary.closest(".mw11-stage-hud"))continue;
      const strip=node("div","mw11-stage-hud "+(own?"own":"enemy"));
      strip.dataset.owner=String(owner);
      const slot=weaponSlot(null,"mw11-weapon-3d");
      const img=node("img","mw11-weapon-picture");img.alt="";img.draggable=false;slot.append(img);
      const values=node("span","mw11-weapon-values");slot.append(values);
      const core=node("div","mw11-3d-core");
      const avatar=node("div","mw11-3d-avatar");
      const portrait=node("img","mw11-3d-portrait");portrait.alt="Портрет героя";portrait.draggable=false;avatar.append(portrait);
      const health=node("div","mw11-3d-stats");
      const status=node("span","mw11-3d-status");
      core.append(avatar,summary,health);
      const ability=node("div","mw11-3d-ability");
      const detail=node("div","mw11-ability-detail");
      ability.append(power,status,detail);
      strip.append(slot,core,ability);
      stage.append(strip);
    }
  }
  function init(){if(!initialized){make2D();make3D();initialized=true;}}
  function updateSlot(slot,player,source,owner){
    if(!slot)return;
    const weapon=player.weapon;
    slot.dataset.equipped=weapon?"true":"false";
    const id=weapon?.cardId||"";
    const title=weapon?String(source?.name||weapon.name||id)+" — атака "+weapon.attack+", прочность "+weapon.durability:"Оружие не экипировано";
    slot.title=title;
    slot.setAttribute("aria-label",title);
    slot.classList.toggle("mw11-weapon-damaged",!!weapon&&Number(weapon.durability)<=1);
    const raw=slot.querySelector(".mw11-weapon-picture");
    if(raw){
      const url=weaponArt(id);
      if(url&&raw.getAttribute("src")!==url){raw.src=url;raw.hidden=false;}
      if(!url){raw.removeAttribute("src");raw.hidden=true;}
    }
    const label=slot.querySelector(".mw11-weapon-values");
    if(label)label.textContent=weapon?"⚔ "+weapon.attack+"  ◈ "+weapon.durability:"";
    // The existing 2D renderer still owns the image in #myEquippedWeapon.
    const decorated=slot.querySelector(".mw-equipped-weapon");
    if(decorated&&weapon)decorated.setAttribute("data-hero-owner",String(owner));
  }
  function statusName(info,owner,targeting){
    if(owner===1)return "СИЛА ПРОТИВНИКА";
    if(targeting)return "ВЫБЕРИТЕ ЦЕЛЬ";
    if(info.used)return "ИСПОЛЬЗОВАНА";
    if(info.ok)return "ГОТОВА";
    if(/недостаточно маны/i.test(info.reason||""))return "НЕТ МАНЫ";
    if(/закрыто/i.test(info.reason||""))return "ЗАКРЫТА";
    return "НЕДОСТУПНА";
  }
  function updatePower(button,info,owner,targeting){
    if(!button)return;
    // Preserve action handlers and disabled semantics; only button contents are replaced.
    const title=node("span","mw11-ability-title",String(info.name||"Сила героя"));
    const cost=node("span","mw11-ability-cost",String(info.cost??0));
    cost.setAttribute("aria-label","Стоимость "+info.cost+" маны");
    button.replaceChildren(title,cost);
    button.title=info.reason||"Способность героя: один раз за ход";
    button.setAttribute("aria-label",info.name+". "+info.cost+" маны. "+statusName(info,owner,targeting)+(info.reason?". "+info.reason:""));
    button.dataset.mw11State=targeting?"target":info.ok?"ready":info.used?"used":"locked";
    const wrapper=button.closest(".hero-power-group,.mw11-3d-ability");
    if(wrapper){
      wrapper.dataset.mw11State=button.dataset.mw11State;
      const badge=wrapper.querySelector(".mw11-ability-state,.mw11-3d-status");
      if(badge)badge.textContent=statusName(info,owner,targeting);
      const detail=wrapper.querySelector(".mw11-ability-detail");
      if(detail){
        const text={
          "warrior-recruit":"Призывает ДРУЖЫННІКА 1/1 (Дзень) · один раз за ход",
          "warrior-torch":"Выбранный дружественный Чалавек действует как Дзень до конца хода",
          "necro-idol":"Идол: тип и время токена ещё не утверждены",
          "necro-undead":"Мертвец: тип и время токена ещё не утверждены"
        }[info.id]||"Описание силы уточняется для этого класса";
        detail.textContent=String(info.name||"Сила героя")+" · "+String(info.cost??0)+" маны. "+text+(info.reason?" · "+info.reason:"");
      }
    }
  }
  function render2D(game){
    if(!game||!game.players||!engine())return;
    init();
    for(const owner of [0,1]){
      const player=game.players[owner];
      const shell=doc.querySelector('[data-hero-owner="'+owner+'"]');if(!shell)return;
      const info=engine().heroPowerStatus(game,owner);
      const slot=shell.querySelector(".mw11-weapon-slot");
      updateSlot(slot,player,game.cards?.[player.weapon?.cardId],owner);
      const prefix=owner===0?"my":"bot";
      const health=byId(prefix+"Hero");
      if(health){health.textContent="♥ "+player.health;health.setAttribute("aria-label","Здоровье "+player.health+(player.armor?", броня "+player.armor:""));}
      const armor=shell.querySelector(".mw11-armor");if(armor){armor.hidden=!player.armor;armor.textContent="◈ "+(player.armor||0);}
      updatePower(byId(prefix+"HeroPower"),info,owner,!!(owner===0&&global.MW_BATTLE_VIEW_BRIDGE?.ui?.()?.pending?.kind==="hero-power"));
      shell.dataset.mw11Power=info.ok?"ready":info.used?"used":"locked";
      const prev=state.get("2d:"+owner);
      if(prev&&prev.health!==player.health){
        shell.classList.remove("mw11-hit","mw11-heal");void shell.offsetWidth;
        shell.classList.add(player.health<prev.health?"mw11-hit":"mw11-heal");
      }
      state.set("2d:"+owner,{health:player.health});
    }
  }
  function render3D(game){
    if(!game||!game.players||!engine())return;
    init();
    const phase=global.MW_GAME_ENGINE?.isBright?.(game.time)?"day":"night";
    for(const owner of [0,1]){
      const player=game.players[owner];
      const own=owner===0,pref=own?"My":"Enemy";
      const strip=doc.querySelector("#mw3dStage .mw11-stage-hud."+(own?"own":"enemy"));
      if(!strip)continue;
      const slot=strip.querySelector(".mw11-weapon-slot");
      updateSlot(slot,player,game.cards?.[player.weapon?.cardId],owner);
      const portrait=strip.querySelector(".mw11-3d-portrait");
      const art=global.MW_HERO_PORTRAIT_BRIDGE?.get(owner,nameFor(game,owner),phase)||global.MW_HERO_ART?.portraitFor(nameFor(game,owner),phase)||"";
      if(art&&portrait?.getAttribute("src")!==art){portrait.src=art;portrait.hidden=false;}
      else if(!art&&portrait){portrait.removeAttribute("src");portrait.hidden=true;}
      if(portrait)portrait.alt="Портрет героя "+nameFor(game,owner);
      const summary=strip.querySelector(".mw3d-hero-summary");
      const health=strip.querySelector(".mw11-3d-stats");
      if(health)health.textContent="♥ "+player.health+(player.armor?"  ◈ "+player.armor:"");
      if(summary){summary.title=titleFor(game,owner)+" — "+nameFor(game,owner);const heading=summary.querySelector("b");if(heading)heading.textContent=nameFor(game,owner).toLocaleUpperCase("ru");}
      const info=engine().heroPowerStatus(game,owner);
      const power=byId("mw3d"+(own?"Power":"EnemyPower"));
      const icon=global.MW_HERO_ART?.abilityFor(nameFor(game,owner))||"";
      if(power){power.classList.toggle("mw3d-hero-ability-art",!!icon);if(icon)power.style.setProperty("--mw-ability-image",`url("${icon}")`);else power.style.removeProperty("--mw-ability-image");}
      updatePower(power,info,owner,!!(own&&global.MW_BATTLE_VIEW_BRIDGE?.ui?.()?.pending?.kind==="hero-power"));
      if(own&&power)power.disabled=!info.ok||!!global.MW_BATTLE_VIEW_BRIDGE?.ui?.()?.busy;
    }
  }
  init();
  global.MW_HERO_HUD_V0511=Object.freeze({init,render2D,render3D});
})(window);
