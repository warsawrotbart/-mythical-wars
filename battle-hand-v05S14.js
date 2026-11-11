/* Mythical Wars v05.14 Stages 3–6: 2D hand presentation only.
 * Interactive previews and visual indicators use the existing engine and renderer.
 * No game state writes, costs, targets, actions or rules are reimplemented here.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MW14_HAND_UI=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function statusFor(game,uid,engine,blocked=false){
    if(!game||game.phase!=="battle"||game.turn!==0||blocked||!engine)
      return {ok:false,reason:"Сейчас карту нельзя разыграть."};
    const h=game.players?.[0]?.hand?.find(x=>String(x.uid)===String(uid));
    if(!h)return {ok:false,reason:"Карты нет в руке."};
    const result=engine.actionStatus(game,0,h.uid);
    return {ok:result?.ok===true,reason:result?.reason||"",
      targetType:result?.targetType||null,choice:!!result?.choice};
  }
  function previewBounds(cardRect,mainRect){
    const width=Math.max(115,Math.min(355,mainRect.width*.52,Math.max(115,(mainRect.height-30)*2/3)));
    const height=width*1.5;
    const left=clamp(cardRect.left+cardRect.width/2-mainRect.left-width/2,6,Math.max(6,mainRect.width-width-6));
    const above=cardRect.top-mainRect.top-height-12;
    const top=clamp(above,6,Math.max(6,mainRect.height-height-6));
    return {width,height,left,top};
  }
  function init(doc,win){
    if(!doc||!win)return null;
    const workspace=doc.getElementById("battleWorkspace"),main=workspace?.querySelector(".battle-main");
    if(!workspace||!main)return null;
    let state=null,engine=win.MW_GAME_ENGINE,busy=false,previewUid=null,previewNode=null;
    let portal=null,img=null,generation=0,lastGame=null,boardKeys=null;
    function ensurePreview(){
      if(portal)return;
      portal=doc.createElement("div");portal.id="mw14HandPreview";
      portal.className="mw14-hand-preview";portal.hidden=true;portal.setAttribute("aria-hidden","true");
      img=doc.createElement("img");img.alt="Полная карта";img.draggable=false;img.decoding="async";img.hidden=true;
      portal.append(img);main.append(portal);
    }
    function hide(){
      generation++;previewUid=null;previewNode=null;
      if(portal)portal.hidden=true;
      workspace.querySelectorAll(".battle-card.hand.mw14-hovered").forEach(x=>x.classList.remove("mw14-hovered"));
    }
    function active(){return !!state&&!workspace.classList.contains("mw3d-active");}
    function findHand(node){
      if(!node||!node.closest)return null;
      const card=node.closest("#myHand .battle-card.hand[data-battle-hand]");
      return card&&workspace.contains(card)?card:null;
    }
    function show(node){
      if(!active()||busy||!node?.isConnected)return hide();
      const uid=node.dataset.battleHand,hand=state.players?.[0]?.hand?.find(x=>String(x.uid)===String(uid));
      if(!hand)return hide();
      ensurePreview();
      if(previewUid===String(uid)&&previewNode===node&&!portal.hidden)return;
      hide();previewUid=String(uid);previewNode=node;
      node.classList.add("mw14-hovered");
      const dimensions=previewBounds(node.getBoundingClientRect(),main.getBoundingClientRect());
      portal.style.width=dimensions.width+"px";portal.style.height=dimensions.height+"px";
      portal.style.left=dimensions.left+"px";portal.style.top=dimensions.top+"px";
      portal.hidden=false;img.hidden=true;img.removeAttribute("src");
      // The full card comes from the same renderer as the hand/inspect, not a duplicate UI drawing.
      const definition=state.cards?.[hand.cardId];
      const fallback=node.querySelector(":scope > .mw-template-face");
      const token=generation;
      const renderer=win.MW_BATTLE_CARD_RENDERER;
      const request=definition&&renderer?.request?
        renderer.request(definition,"full",{cost:engine.currentCost(state,0,hand)}):
        Promise.resolve(fallback?.src||"");
      Promise.resolve(request).then(src=>{
        if(token!==generation||!portal||portal.hidden||!src)return;
        img.src=src;img.hidden=false;
      }).catch(()=>{
        if(token!==generation||portal.hidden)return;
        const src=fallback?.src;
        if(src){img.src=src;img.hidden=false;}
      });
    }
    function animateBoard(game){
      if(lastGame!==game){lastGame=game;boardKeys=null;}
      const keys=new Set();
      for(let o=0;o<2;o++)for(const minion of game.players?.[o]?.board||[])keys.add(o+"|"+minion.uid);
      if(boardKeys!==null){
        for(const key of keys)if(!boardKeys.has(key)){
          const cards=workspace.querySelectorAll(".battle-board .battle-card[data-battle-minion]");
          const card=Array.from(cards).find(x=>x.dataset.battleMinion===key);
          card?.classList.add("mw14-new-summon");
        }
      }
      boardKeys=keys;
    }
    function render(game,options={}){
      state=game||null;engine=win.MW_GAME_ENGINE;
      busy=!!options.busy||!!options.pendingChoice||!!options.pending;
      const nodes=workspace.querySelectorAll("#myHand .battle-card.hand[data-battle-hand]");
      for(const node of nodes){
        const available=statusFor(state,node.dataset.battleHand,engine,busy);
        node.classList.toggle("mw14-can-play",available.ok);
        node.classList.toggle("mw14-cannot-play",!available.ok);
        node.dataset.mw14Playable=available.ok?"true":"false";
      }
      if(game)animateBoard(game);else{boardKeys=null;lastGame=null;}
      if(!state||workspace.classList.contains("mw3d-active")||busy||(
          previewUid&&!Array.from(nodes).some(x=>x.dataset.battleHand===previewUid)))hide();
    }
    workspace.addEventListener("pointerover",e=>{
      if(e.pointerType==="touch")return;
      const card=findHand(e.target);if(card)show(card);
    });
    workspace.addEventListener("pointerout",e=>{
      const card=findHand(e.target);
      if(card&&previewNode===card&&!card.contains(e.relatedTarget))hide();
    });
    workspace.addEventListener("focusin",e=>{const card=findHand(e.target);if(card)show(card);});
    workspace.addEventListener("focusout",e=>{
      const card=findHand(e.target);
      if(card&&previewNode===card&&!card.contains(e.relatedTarget))hide();
    });
    win.addEventListener?.("resize",hide,{passive:true});
    function dragStarted(card,dataTransfer){
      hide();
      // Opaque, readable card face follows the pointer in native HTML5 DnD.
      if(!card||!dataTransfer?.setDragImage)return;
      const source=card.querySelector(":scope > .mw-template-face");
      if(source?.complete&&source.naturalWidth>0){
        const canvas=doc.createElement("canvas");
        canvas.width=190;canvas.height=285;
        const ctx=canvas.getContext("2d");
        if(ctx){
          ctx.drawImage(source,0,0,190,285);
          canvas.className="mw14-drag-image";
          doc.body.append(canvas);
          dataTransfer.setDragImage(canvas,95,140);
          win.setTimeout?.(()=>canvas.remove(),0);
          return;
        }
      }
      dataTransfer.setDragImage(card,card.clientWidth/2,card.clientHeight/2);
    }
    return {render,hide,dragStarted,previewBounds,dispose:hide};
  }
  const api={statusFor,previewBounds,init};
  if(typeof window!=="undefined"&&window.document){
    const start=()=>{if(!api.live)api.live=init(window.document,window);};
    if(window.document.readyState==="loading")window.document.addEventListener("DOMContentLoaded",start,{once:true});
    else start();
  }
  return api;
});
