/* Title menu presentation. This controller never advances combat or changes saved progress. */
(function(root){'use strict';
const C=root.MushConfig,F=root.MushFormat,$=id=>document.getElementById(id);
class TitleScreen{
 constructor(handlers){this.handlers=handlers;this.el={screen:$('title-screen'),hud:$('game-hud'),stage:$('stage'),start:$('title-start'),label:$('title-start-label'),save:$('title-save'),location:$('title-save-location'),stats:$('title-save-stats'),note:$('title-save-note')};
  this.el.start.addEventListener('click',()=>handlers.onStart());
  $('title-help').addEventListener('click',()=>handlers.onHelp());
  $('title-settings').addEventListener('click',()=>handlers.onSettings());
  $('btn-title-home').addEventListener('click',()=>handlers.onReturn());
  $('btn-return-title').addEventListener('click',()=>handlers.onReturn());
 }
 render({state,hasSave,storageAvailable}){
  this.el.label.textContent=hasSave?'繼續遠征':'開始遠征';
  this.el.start.disabled=false;this.el.save.hidden=!hasSave;
  const zone=C.ZONE_BY_ID[state.zoneId]||C.ZONES[0],depth=(state.depths||{})[zone.id]||1,devices=Object.values(state.devices||{}).reduce((a,b)=>a+b,0),bosses=Object.values(state.bosses||{}).filter(Boolean).length;
  this.el.location.textContent=zone.name+' · 深度 '+depth;
  this.el.stats.textContent='英打 '+F.full(state.clicks||0)+' 次　·　設備 '+F.full(devices)+' 台　·　菇王 '+bosses+' / 3';
  this.el.note.textContent=storageAvailable?'你的遠征，會自動保存在這個瀏覽器。':'目前無法儲存進度，仍可開始遊戲。';
 }
 show(){
  this.el.screen.hidden=false;this.el.screen.inert=false;this.el.hud.inert=true;this.el.stage.inert=true;this.el.stage.setAttribute('aria-hidden','true');
  document.documentElement.classList.add('title-screen-active');document.documentElement.classList.remove('game-entering');
  this.el.start.focus({preventScroll:true});
 }
 hide(){
  this.el.screen.inert=true;this.el.screen.hidden=true;this.el.hud.inert=false;this.el.stage.inert=false;this.el.stage.removeAttribute('aria-hidden');
  document.documentElement.classList.remove('title-screen-active');document.documentElement.classList.add('game-entering');
  clearTimeout(this.enterTimer);this.enterTimer=setTimeout(()=>document.documentElement.classList.remove('game-entering'),700);
 }
}
root.MushTitleScreen=TitleScreen;
})(typeof self!=='undefined'?self:this);
