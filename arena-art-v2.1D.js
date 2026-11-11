/* MW v2.1D: offline decorative UI for the supplied 38-current-asset art pack.
   Only presentation: no card IDs, costs, targets, game logic, imports or saves changed.
   Fixed-size WebP files are reproducibly created from the original packaged PNGs.
*/
(function(global){
  "use strict";
  const $=id=>document.getElementById(id);
  let initialized=false;
  // Canonical v02 is the only available 2D battlefield. This compatibility
  // helper still provides counters; the old art/block switch is retired.
  function make(tag,cls){const el=document.createElement(tag);el.className=cls;return el;}
  function setOn(){
    const workspace=$("battleWorkspace");
    if(workspace)workspace.classList.remove("mw-art-off");
  }
  function init(){
    if(initialized)return true;
    const workspace=$("battleWorkspace"),dial=workspace?.querySelector(".battle-time-dial");
    if(!workspace||!dial)return false;
    initialized=true;
    const art=make("div","mw-art-clock");
    art.setAttribute("aria-hidden","true");
    const disc=make("div","mw-art-clock-disc");
    const frame=make("div","mw-art-clock-frame");
    const pointer=make("div","mw-art-clock-pointer");
    art.append(disc,frame);
    // 12 purely decorative markers. Their phase color does not change the game's logic.
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6;
      const marker=make("span","mw-art-clock-marker day off");
      marker.dataset.index=String(i);
      marker.style.left=(50+40*Math.sin(angle))+"%";
      marker.style.top=(50-40*Math.cos(angle))+"%";
      art.appendChild(marker);
    }
    art.appendChild(pointer);
    dial.prepend(art);
    for(let owner=0;owner<=1;owner++){
      const chassis=workspace.querySelector('[data-hero-owner="'+owner+'"]');
      const res=chassis?.querySelector(".hero-resources");
      if(!res)continue;
      const mana=make("div","mw-art-mana");
      mana.id=owner?"mwArtManaBot":"mwArtManaMy";
      mana.setAttribute("aria-hidden","true");
      for(let i=0;i<10;i++)mana.appendChild(make("span","mw-art-mana-gem"));
      res.insertBefore(mana,res.firstChild);
      const corpses=make("span","mw-art-corpse");
      corpses.id=owner?"mwArtCorpseBot":"mwArtCorpseMy";
      corpses.setAttribute("aria-label","Трупы");
      corpses.hidden=false;
      res.appendChild(corpses);
      const armor=make("span","mw-art-armor");
      armor.id=owner?"mwArtArmorBot":"mwArtArmorMy";
      armor.setAttribute("aria-label","Броня");
      armor.hidden=true;
      chassis.querySelector(".hero-portrait-group")?.appendChild(armor);
    }
    setOn();
    return true;
  }
  function render(game){
    if(!initialized&&!init())return;
    const hour=game?((Number(game.time)||0)%24+24)%24:12;
    const clock=$("battleWorkspace")?.querySelector(".battle-time-dial .mw-art-clock");
    if(clock){
      // Same 12-step rule as 3D: day = 06:00–17:59, night = 18:00–05:59.
      // Completed markers glow, future markers remain dark; icons never mix phases.
      const day=hour>=6&&hour<18,phase=day?"day":"night";
      const elapsed=(hour-(day?6:18)+24)%24;
      clock.dataset.phase=phase;
      clock.style.setProperty("--mw-hour-angle",(hour%12)*30+"deg");
      for(const marker of clock.querySelectorAll(".mw-art-clock-marker")){
        const i=Number(marker.dataset.index);
        marker.classList.toggle("day",day);
        marker.classList.toggle("night",!day);
        marker.classList.toggle("on",i<elapsed);
        marker.classList.toggle("off",i>=elapsed);
        marker.title=`${i+1}-й час: ${i<elapsed?"пройден":"ожидается"}`;
      }
      const phaseLabel=$("battleWorkspace")?.querySelector(".battle-clock-title");
      if(phaseLabel)phaseLabel.textContent=day?"День":"Ночь";
      // When artwork is active, keep the time and phase on separate lines.
      // The normal text presentation is kept unchanged when artwork is disabled.
      const clockText=$("battleClock");
      if(clockText&&!$("battleWorkspace")?.classList.contains("mw-art-off")&&game){
        clockText.textContent=String(hour).padStart(2,"0")+":00";
      }
    }
    for(const owner of [0,1]){
      const deck=$("mwArt"+(owner?"Bot":"My")+"Deck");
      const count=$("mwArt"+(owner?"Bot":"My")+"DeckCount");
      const player=game?.players?.[owner];
      const length=Array.isArray(player?.deck)?player.deck.length:null;
      if(count)count.textContent=length==null?"—":String(length);
      if(deck)deck.setAttribute("aria-label",(owner?"Колода соперника":"Моя колода")+
        (length==null?": партия не начата":": "+length+" карт"));
      const corpse=$(owner?"mwArtCorpseBot":"mwArtCorpseMy");
      const armor=$(owner?"mwArtArmorBot":"mwArtArmorMy");
      if(corpse){
        const n=Math.max(0,Number(player?.corpses)||0);
        corpse.hidden=false;corpse.textContent=String(n);corpse.title="Трупы: "+n;
      }
      if(armor){
        const n=Math.max(0,Number(player?.armor)||0);
        armor.hidden=!n;armor.textContent=String(n);armor.title="Броня: "+n;
      }
      const row=$(owner?"mwArtManaBot":"mwArtManaMy");
      if(row){
        const max=player?Math.max(0,Math.min(10,Number(player.maxMana)||0)):0;
        const mana=player?Math.max(0,Math.min(max,Number(player.mana)||0)):0;
        row.title=player?"Мана: "+mana+" из "+max:"Нет партии";
        row.querySelectorAll(".mw-art-mana-gem").forEach((el,i)=>{
          el.classList.toggle("filled",i<mana);
          el.style.visibility=i<max?"visible":"hidden";
        });
      }
    }
  }
  global.MW_ARENA_ART=Object.freeze({init,render,setOn,
    stats:()=>({initialized,enabled:!$("battleWorkspace")?.classList.contains("mw-art-off"),
      deckMy:$("mwArtMyDeckCount")?.textContent,deckBot:$("mwArtBotDeckCount")?.textContent,
      markers:document.querySelectorAll(".mw-art-clock-marker").length})});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})(window);
