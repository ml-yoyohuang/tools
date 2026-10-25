/* New expedition interface. No layout or inventory markup from the 2D game. */
(function(root){'use strict';
const C=root.MushConfig,T=root.MushContent,F=root.MushFormat,B=root.MushCombat,$=id=>document.getElementById(id),text=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=value},esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
class UI{
 constructor(opts){this.game=opts.game;this.handlers=opts.handlers;this.numberStyle='short';this.buyMode=1;this.maskVocabulary=false;this.showFullCoins=false;this.targetNodes=new Map();this.pending=new Map();this.frozenHold=null;this.currentTypingView=null;this.bookPage='devices';this.wordLevel='all';this.wordLetter='a';this.lastTrend=0;this.trend='';this.previousRate=0;this.highSince=0;this.el={};
 const ids={stage:'stage',stageImage:null,targets:'targets',floaters:'floaters',typingPrompt:'typing-prompt',typingTranslation:'typing-translation',typingInput:'typing-input',typingStatus:'typing-status',typingMaskTools:'typing-mask-tools',btnTypingMask:'btn-typing-mask',typingRate:'typing-rate',typingModeLabel:'typing-mode-label',typingModeCaption:'typing-mode-caption',typingAlert:'typing-alert',btnSkipPrompt:'btn-skip-prompt',btnHold:'btn-hold',holdFill:'hold-fill',holdLabel:'hold-label',frozenList:'frozen-list',bossPanel:'boss-panel',bossCombo:'boss-combo',bossComboValue:'boss-combo-value',bossComboFill:'boss-combo-fill',bossComboHint:'boss-combo-hint',bossHelp:'boss-help',bossProgress:'boss-progress',btnExitBoss:'btn-exit-boss',fieldActions:'field-actions',btnBoss:'btn-boss',courier:'courier',book:'field-book',bookContent:'book-content',bookToolbar:'book-toolbar'};for(const [k,id]of Object.entries(ids))this.el[k]=id?$(id):null;this.el.typingSection=document.querySelector('.typing');this.el.stageImage=document.querySelector('.stage__image');
 this.words=this.buildWords(opts.typingVocab||{});this._bindTyping();this._bindStage();this.bindMenus();this.buildZones();this.tickFast(Date.now());this.tickSlow(Date.now());
 }
 num(n){return this.numberStyle==='full'?F.full(n):F.short(n)}setNumberStyle(n){this.numberStyle=n}setBuyMode(n){this.buyMode=n;this.bookSignature='';if(this.el.book.open)this.renderBook()}
 refreshArt(){}announce(s){text($('live-region'),s)}focusTypingInput(){this.el.typingInput.focus({preventScroll:true})}
 toast(s){const n=$('toast');text(n,s);n.hidden=false;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>n.hidden=true,3200)}
 bindMenus(){document.querySelectorAll('[data-open-book]').forEach(b=>b.addEventListener('click',()=>this.openBook(b.dataset.openBook)));document.querySelectorAll('[data-book]').forEach(b=>b.addEventListener('click',()=>{this.bookPage=b.dataset.book;this.bookSignature='';this.renderBook()}));this.el.book.addEventListener('close',()=>this.focusTypingInput());
 this.el.bookContent.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.device)this.handlers.onBuyDevice(d.device);if(d.upgrade)this.handlers.onBuyUpgrade(d.upgrade);if(d.buyItem)this.handlers.onBuyItem(d.buyItem);if(d.useItem)this.handlers.onUseItem(d.useItem);if(d.equip)this.handlers.onEquip(d.equip);this.bookSignature='';this.renderBook()});
 this.el.bookToolbar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.buyMode){const mode=b.dataset.buyMode==='max'?'max':+b.dataset.buyMode;this.buyMode=mode;this.handlers.onBuyMode(mode)}if(b.dataset.level)this.wordLevel=b.dataset.level;if(b.dataset.letter)this.wordLetter=b.dataset.letter;this.bookSignature='';this.renderBook()});
 this.el.btnBoss.addEventListener('click',()=>this.handlers.onBoss());this.el.btnExitBoss.addEventListener('click',()=>this.handlers.onExitBoss());this.el.courier.addEventListener('click',()=>this.handlers.onCourier());
 }
 buildZones(){for(const [i,z]of C.ZONES.entries()){let b=document.createElement('button');b.type='button';b.dataset.zoneId=z.id;b.textContent='0'+(i+1);b.title=z.name;b.setAttribute('aria-label',z.name);b.addEventListener('click',()=>this.handlers.onZone(z.id));$('zone-tabs').appendChild(b)}}
 openBook(page){this.bookPage=page;this.bookSignature='';this.renderBook();this.el.book.showModal()}
 buildWords(banks){const map=new Map();for(const level of ['geptElementary','geptIntermediate'])for(const v of banks[level]||[]){const key=v.text.toLowerCase();if(!/^[a-z]/.test(key))continue;let item=map.get(key)||{key,text:v.text,translations:[],levels:[]};if(v.translation&&!item.translations.includes(v.translation))item.translations.push(v.translation);item.levels.push(level);map.set(key,item)}return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key))}
 renderBook(){const g=this.game,s=g.state,page=this.bookPage,title={devices:['設備整備','BUILD YOUR CREW'],upgrades:['永久升級','SMALL STEPS, BIG POWER'],items:['遠征補給','A LITTLE HELP GOES A LONG WAY'],equipment:['隨身裝備','YOUR PERSONAL LOADOUT'],dex:['蘑菇觀察誌','MEET YOUR INGREDIENTS'],words:['單字筆記','WORDS WORTH REMEMBERING'],achievements:['遠征成就','EVERY EXPEDITION COUNTS']}[page];text($('book-title'),title[0]);text($('book-kicker'),title[1]);text($('book-coins'),this.num(s.coins));text($('book-broth'),this.num(s.broth));document.querySelectorAll('[data-book]').forEach(b=>b.setAttribute('aria-current',b.dataset.book===page?'page':'false'));
 const content=this.el.bookContent,scroll=content.scrollTop;let toolbar='',html='';const badge=(s,c='')=>`<span class="kit-badge ${c}">${esc(s)}</span>`,btn=(attr,label,disabled=false)=>`<button type="button" ${attr} ${disabled?'disabled':''}>${label}</button>`;
 if(page==='devices'){toolbar=`<div class="quantity-switch"><span>購買數量</span>${[1,10,'max'].map(n=>`<button type="button" data-buy-mode="${n}" aria-pressed="${n===this.buyMode}">${n==='max'?'最大':'×'+n}</button>`).join('')}</div>`;html='<div class="kit-grid">'+C.DEVICES.map((d,i)=>{const un=g.deviceUnlocked(d),count=s.devices[d.id]||0,p=g.planDevicePurchase(d.id,this.buyMode),stats=g.stats.perDevice[d.id],frozen=!!s.frozen[d.id],pay=un&&p.count?g.devicePaybackSeconds(d.id,p.count,p.cost,Date.now()):null;return `<article class="kit-card ${un?'':'locked'} ${frozen?'frozen':''}"><header><span class="kit-number">0${i+1}</span>${badge(frozen?'❄ 凍結中':d.role==='attack'?'自動攻擊':d.role==='aura'?'光環':'支援')}</header><div class="device-symbol symbol-${i}">${['⌁','⁙','⇓','╳','⌇','◴','◎','✳'][i]}</div><h2>${esc(d.name)}</h2><p>${esc(d.flavor)}</p><div class="kit-metrics"><span>持有 <b>${count} 台</b></span><span>${d.role==='attack'?'每台 <b>'+this.num(stats.dps)+'</b> / 秒':'支援效果'}</span></div><div class="kit-detail">${un?(d.role==='attack'?'持有合計 '+this.num(frozen?0:stats.totalDps)+' 傷害／秒':'觸發週期 '+(d.cooldown||'持續')+' 秒')+'<br>首台英打加成 ×'+d.typingDamageMult:esc(d.unlockText)}</div>${pay!==null&&isFinite(pay)?'<small class="payback">約 '+Math.floor(Math.ceil(pay)/60)+' 分 '+(Math.ceil(pay)%60)+' 秒回本</small>':''}<footer>${un?'<strong>'+this.num(p.cost)+' <small>菇幣'+(p.brothCost?' ＋ '+p.brothCost+' 金湯滴':'')+'</small></strong>':'<small>尚未解鎖</small>'}${btn('data-device="'+d.id+'"',un?'×'+p.count+' 台':'未解鎖',!un||!p.affordable||!p.count)}</footer></article>`}).join('')+'</div>';
 }else if(page==='upgrades'){html='<div class="upgrade-list">'+T.UPGRADES.map((u,i)=>{const owned=!!s.upgrades[u.id],available=g.meetsRequirement(u.req),price=u.cost*g.stats.shopDiscount;return `<article class="upgrade-entry ${owned?'owned':''}"><span class="upgrade-index">${owned?'✓':String(i+1).padStart(2,'0')}</span><div><h2>${esc(u.name)}</h2><p>${esc(u.desc)}</p><small>${u.auto?'菇王里程碑自動授予':this.num(price)+' 菇幣'+(u.brothCost?' + '+u.brothCost+' 金湯滴':'')}</small></div>${btn('data-upgrade="'+u.id+'"',owned?'已取得':u.auto?'里程碑':available?'研究':'尚未解鎖',owned||u.auto||!available||s.coins<price||s.broth<(u.brothCost||0))}</article>`}).join('')+'</div>';
 }else if(page==='items'){toolbar=`<p class="book-note">${g.itemShopOpen()?'補給可以購買，也可從外送員取得。哨子今日剩 '+g.whistleRemaining(Date.now())+' 次。':'擊敗第二區菇王後開放購買；已持有的補給可以立即使用。'}</p>`;html='<div class="kit-grid">'+T.ITEMS.map((i,n)=>{const count=s.items[i.id]||0,price=i.cost*g.stats.shopDiscount,now=Date.now(),cool=(s.itemCooldowns[i.id]||0)>now,blocked=(i.effect.type==='energy'&&s.buffs.energy>now)||(i.effect.type==='brothCapsule'&&s.buffs.broth>now)||(i.effect.type==='whistle'&&g.whistleRemaining(now)<=0);return `<article class="kit-card supply"><header>${badge('補給 0'+(n+1))}<b>×${count}</b></header><div class="supply-symbol">${['✹','♜','◉','♩'][n]}</div><h2>${esc(i.name)}</h2><p>${esc(i.desc)}</p><small>${esc(i.note)}</small><footer>${btn('data-buy-item="'+i.id+'"',this.num(price)+' 菇幣',!g.itemShopOpen()||s.coins<price)}${btn('data-use-item="'+i.id+'"',cool?'冷卻中':blocked?'效果生效中':'使用',!count||cool||blocked)}</footer></article>`}).join('')+'</div>';
 }else if(page==='equipment'){toolbar='<p class="book-note">僅可裝備一件。擊敗第三區菇王後取得全套裝備；切換不會累加效果。</p>';html='<div class="kit-grid">'+T.EQUIPMENT.map((e,i)=>`<article class="kit-card ${s.equipmentOwned[e.id]?'':'locked'}"><header>${badge(s.equipped===e.id?'已裝備':'裝備 0'+(i+1))}</header><div class="gear-symbol">${['◇','♜','♧','◈','◒','✧'][i]}</div><h2>${esc(e.name)}</h2><p>${esc(e.desc)}</p><footer>${btn('data-equip="'+e.id+'"',s.equipped===e.id?'卸下裝備':s.equipmentOwned[e.id]?'裝備':'未取得',!s.equipmentOwned[e.id])}</footer></article>`).join('')+'</div>';
 }else if(page==='dex'){html='<div class="specimen-grid">'+C.MUSHROOMS.map((m,i)=>`<article class="specimen ${s.seen[m.id]?'':'undiscovered'}"><div class="specimen-illustration" style="--specimen:${m.color}"><i></i><b></b></div><span class="eyebrow">SPECIMEN 0${i+1}</span><h2>${s.seen[m.id]?esc(m.name):'尚未發現'}</h2><p>${s.seen[m.id]?esc(m.dex):'在遠征中遇見牠，就會留下觀察筆記。'}</p><small>${s.seen[m.id]?'已擊敗 '+(s.kills[m.id]||0)+' 隻':'UNKNOWN'}</small></article>`).join('')+'</div><h2 class="book-subtitle">菇王收藏</h2><div class="collection-row">'+C.BOSSES.map(b=>`<article><span>✧</span><h3>${s.collections[b.id]?esc(b.collection):'尚未取得'}</h3><p>${esc(b.name)}</p></article>`).join('')+'</div>';
 }else if(page==='words'){const filtered=this.words.filter(w=>this.wordLevel==='all'||w.levels.includes(this.wordLevel)),rows=filtered.filter(w=>w.key.startsWith(this.wordLetter));toolbar=`<div class="word-level">${[['all','全部'],['geptElementary','初級'],['geptIntermediate','中級']].map(([id,name])=>`<button type="button" data-level="${id}" aria-pressed="${id===this.wordLevel}">${name}</button>`).join('')}<small>${filtered.length} 個單字</small></div><div class="alphabet">${'abcdefghijklmnopqrstuvwxyz'.split('').map(l=>`<button type="button" data-letter="${l}" aria-pressed="${l===this.wordLetter}">${l.toUpperCase()}</button>`).join('')}</div>`;html='<div class="word-pages">'+(rows.length?rows.map(w=>`<article><h2>${esc(w.text)}</h2><span>${w.levels.map(l=>l==='geptElementary'?'初級':'中級').join(' · ')}</span><p>${esc(w.translations.join('；'))}</p></article>`).join(''):'<p class="book-note">這個字母目前沒有收錄單字。</p>')+'</div>';
 }else{toolbar=`<p class="book-note">已完成 ${Object.keys(s.achievements).length} / ${T.ACHIEVEMENTS.length} 項遠征成就。</p>`;html='<div class="achievement-grid">'+T.ACHIEVEMENTS.map(a=>`<article class="achievement ${s.achievements[a.id]?'complete':''}"><span>${s.achievements[a.id]?'✧':'◇'}</span><div><h2>${esc(a.name)}</h2><p>${esc(a.desc)}</p><small>${s.achievements[a.id]?'已達成':a.optional?'可選挑戰':'探索中'}</small></div></article>`).join('')+'</div>'}
 this.el.bookToolbar.innerHTML=toolbar;content.innerHTML=html;content.scrollTop=scroll;const frozen=Object.keys(s.frozen);$('device-freeze-note').hidden=!frozen.length;text($('device-freeze-note'),'❄ 自動效果暫停：'+frozen.map(id=>C.DEVICE_BY_ID[id].name).join('、')+'。回到菇王戰按住 2 秒解凍。');
 }
 renderTypingMode(active, replay=false){
  const console=this.el.typingSection,entering=active&&(!console.classList.contains('crazy-mode')||replay);
  console.classList.toggle('crazy-mode',active);
  text(this.el.typingModeLabel,active?'FRENZY MODE':'TYPE TO STRIKE');
  text(this.el.typingModeCaption,active?'瘋狂連打':'英打攻擊');
  this.el.typingInput.placeholder=active?'連打 A，火力全開！':'在這裡輸入，逐字出擊…';
  if(entering){
   console.classList.remove('crazy-burst');
   void console.offsetWidth;
   console.classList.add('crazy-burst');
   this.announce('瘋狂連打！連續輸入 A，火力全開！');
  }else if(!active){console.classList.remove('crazy-burst')}
 }
 renderTyping(prompt,index,status,error,translation,crazy,force){this.currentTypingView={prompt,index,status,error,translation,crazy,force};this._renderTypingPrompt()}
 _renderTypingPrompt(){const v=this.currentTypingView;if(!v)return;const masked=this.maskVocabulary&&!!v.translation&&!v.crazy;let done=esc(v.prompt.slice(0,v.index));if(v.index>0)done=esc(v.prompt.slice(0,v.index-1))+`<span class="typing__typed-hit">${esc(v.prompt[v.index-1]===' '?' ':v.prompt[v.index-1])}</span>`;const rest=v.prompt.slice(v.index);this.el.typingPrompt.innerHTML=`<span class="typed-text">${done}</span>`+(masked?`<span class="masked-text">${'•'.repeat(rest.length)}</span>`:rest?`<span class="next-character">${esc(rest[0]===' '?'␣':rest[0])}</span>${esc(rest.slice(1))}`:'');this.el.typingMaskTools.hidden=!v.translation||v.crazy;this.el.btnTypingMask.setAttribute('aria-pressed',String(this.maskVocabulary));text(this.el.btnTypingMask.querySelector('span'),masked?'盲打中':'閉眼模式');text(this.el.typingTranslation,v.translation||'');this.el.typingTranslation.hidden=!v.translation;this.renderTypingMode(!!v.crazy,!!v.force);this.el.typingInput.classList.toggle('has-error',!!v.error);if(this.el.typingStatus.textContent!==v.status||v.force){text(this.el.typingStatus,v.status);this.el.typingStatus.classList.remove('status-pulse');void this.el.typingStatus.offsetWidth;this.el.typingStatus.classList.add('status-pulse')}this.updateBlindTier()}
 updateBlindTier(){const tier=Math.min(5,Math.floor((this.game.state.blindCombo||0)/10));this.el.btnTypingMask.dataset.tier=tier;this.el.btnTypingMask.title=this.maskVocabulary?'閉眼連打 '+this.game.state.blindCombo+' 字元 · 傷害 +'+tier*5+'%':'閉眼模式：遮住未輸入的字元'}
 pulseTypingCharacter(){const n=this.el.typingPrompt.querySelector('.typing__typed-hit');if(n){n.classList.remove('is-hit');void n.offsetWidth;n.classList.add('is-hit')}}
 tickFast(now){const g=this.game,s=g.state,stats=g.stats;text($('res-coins'),this.showFullCoins?F.full(s.coins):this.num(s.coins));$('res-coins').title=F.full(s.coins)+' 菇幣';text($('res-broth'),this.num(s.broth));text($('res-click'),this.num(B.expectedClickDamage(stats)));text($('res-boss-typing'),'菇王 ×'+F.short(stats.bossTypingMult)+' · 設備 ×'+F.short(stats.deviceTypingMult));text($('res-dps'),this.num(Math.max(0,stats.autoDps-Object.keys(s.frozen).reduce((sum,id)=>sum+(stats.perDevice[id]?.totalDps||0),0))));for(const [id,value]of Object.entries({'res-typing-count':s.clicks,'res-couriers-caught':s.couriersCaught,'res-lifetime-coins':s.lifetimeCoins,'res-total-damage':s.totalDamage,'res-broth-lifetime':s.brothLifetime,'res-device-total':Object.values(s.devices).reduce((a,b)=>a+b,0)}))text($(id),F.full(value));
 const count=(s.burstWindow||[]).filter(t=>now-t<=10000).length,rate=count/10;if(now-this.lastTrend>=3000){this.trend=rate>this.previousRate?'▲':rate<this.previousRate?'▼':'→';this.previousRate=rate;this.lastTrend=now}if(rate>=3.5){if(!this.highSince)this.highSince=now}else this.highSince=0;const fire=this.highSince&&now-this.highSince>=3000;text(this.el.typingRate,(rate===0?'':fire?'🔥 ':this.trend+' ')+rate.toFixed(1)+' 字/秒');this.el.typingRate.dataset.trend=fire?'fire':this.trend==='▲'?'up':this.trend==='▼'?'down':'';
 this.updateBlindTier();const buffs=[];if(s.blindCombo>0)buffs.push('閉眼 '+s.blindCombo+' · +'+Math.round((g.blindTypingDamageMult()-1)*100)+'%');for(const [id,label]of [['energy','英打 ×3'],['broth','金湯 ×5'],['haste','設備加速']])if(s.buffs[id]>now)buffs.push(label+' '+Math.ceil((s.buffs[id]-now)/1000)+'s');if(s.slowActive)buffs.push('❄ 自動火力減半');const signature=buffs.join('|');if(signature!==this.buffSignature){this.el.typingSection.querySelector('#buff-bar').innerHTML=buffs.map(b=>'<li>'+esc(b)+'</li>').join('');this.buffSignature=signature}
 const sponge=g.aliveTargets().some(t=>t.typeId==='sh_sponge');this.el.typingAlert.hidden=!sponge;if(sponge)text(this.el.typingAlert,'吸湯海綿菇：3 秒沒有英打攻擊後，每秒回血 15%。');this._renderTargets(now);this.renderBoss(now);const courier=s.courier;this.el.courier.hidden=!courier||now>=courier.expiresAt;if(courier)text($('courier-countdown'),Math.max(0,Math.ceil((courier.expiresAt-now)/1000))+'s');for(const [uid,e]of this.pending){if(now>=e.until){this.floater((e.crit?'暴擊 ':'')+this.num(e.amount),e.crit?'crit':'damage');this.pending.delete(uid)}}
 }
 _renderTargets(now){const alive=this.game.aliveTargets(),seen=new Set();this.el.stage.classList.toggle('is-crowded',alive.length>3);for(const t of alive){seen.add(t.uid);const info=C.MUSHROOM_BY_ID[t.typeId]||C.BOSS_BY_ID[t.typeId];let n=this.targetNodes.get(t.uid);if(!n){const li=document.createElement('li'),button=document.createElement('div');button.className='enemy-marker';button.innerHTML='<span class="enemy-name"></span><div class="enemy-life"><i></i></div><span class="enemy-hp"></span><div class="enemy-traits"></div><span class="enemy-art" hidden></span>';li.appendChild(button);this.el.targets.appendChild(li);n={li,button,art:button.querySelector('.enemy-art'),name:button.querySelector('.enemy-name'),fill:button.querySelector('i'),hpText:button.querySelector('.enemy-hp'),tags:button.querySelector('.enemy-traits')};this.targetNodes.set(t.uid,n);button.dataset.select3d='1';button.setAttribute('role','button');button.tabIndex=0;button.addEventListener('click',()=>this.handlers.onSelectTarget(t.uid));button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.handlers.onSelectTarget(t.uid)}})}text(n.name,info.name);n.fill.style.width=Math.max(0,t.hp/t.maxHp*100)+'%';text(n.hpText,this.num(t.hp)+' / '+this.num(t.maxHp));const tags=[];if(t.shields)tags.push('盾 ×'+t.shields);if(t.armorThreshold)tags.push('岩殼 '+this.num(t.armorThreshold));if(t.softenUntil>now)tags.push('軟化 ×2');if(t.fleeAt)tags.push('逃跑 '+Math.max(0,Math.ceil((t.fleeAt-now)/1000))+'s');if(t.typeId==='sh_sponge')tags.push('吸湯回血');if(t.typeId==='sh_ice')tags.push('設備減速');if(t.typeId==='sh_gold')tags.push('金湯掉落');text(n.tags,tags.join(' · '));n.button.classList.toggle('locked-target',this.game.state.preferredUid===t.uid);n.button.setAttribute('aria-label',info.name+'，血量 '+F.short(t.hp)+' / '+F.short(t.maxHp)+'，'+tags.join('、'))}this.targetNodes.forEach((n,id)=>{if(!seen.has(id)){n.li.remove();this.targetNodes.delete(id)}})}
 renderBoss(now){const g=this.game,s=g.state,boss=g.boss,inBoss=g.mode==='boss'&&boss;this.el.bossPanel.hidden=!inBoss;this.el.fieldActions.hidden=!!inBoss;if(!inBoss){const st=g.bossRespawnStatus(g.zone().bossId);this.el.btnBoss.disabled=!st.canChallenge;this.el.btnBoss.classList.toggle('is-ready',st.canChallenge);text(this.el.btnBoss,st.canChallenge?'挑戰 '+C.BOSS_BY_ID[g.zone().bossId].name:(st.firstClear?'首次挑戰':'再次挑戰')+' · '+st.progress+' / '+st.goal);return}const stacks=s.combo||0;text(this.el.bossComboValue,stacks+' / 10 · ×'+g.stats.comboMult.toFixed(2));this.el.bossComboFill.style.width=stacks*10+'%';this.el.bossComboFill.parentNode.setAttribute('aria-valuenow',stacks);this.el.bossCombo.classList.toggle('full-resonance',stacks===10);text(this.el.bossComboHint,'停打 3 秒，連擊歸零');const gate=g.bossShieldGateStatus();this.el.btnHold.hidden=!gate;this.el.bossProgress.hidden=false;if(gate){this.el.btnHold.disabled=!gate.canBreak;this.el.holdFill.style.width=g.holdProgress(now)*100+'%';text(this.el.holdLabel,gate.canBreak?'按住 2 秒後放開 · 破第 '+gate.layer+' 層':'先完成 '+gate.goal+' 單字 · '+gate.progress+' / '+gate.goal);text(this.el.bossProgress,'護盾 '+gate.left+' 層 · '+(gate.canBreak?'準備破盾':'繼續完成英打'))}else if(boss.mechanic==='clickMilestone'){const current=(g.targets[0]?.clickCount||0)%20;text(this.el.bossProgress,'資源噴發 · '+current+' / 20 次英打')}else text(this.el.bossProgress,boss.mechanic==='freezeDevices'?'每 18 秒凍結部分設備':'護盾已破，集中攻擊');
 const frozen=Object.keys(s.frozen),signature=frozen.join('|');if(signature!==this.frozenSignature){if(this.frozenHold){clearInterval(this.frozenHold.timer);this.frozenHold=null}this.frozenSignature=signature;this.el.frozenList.innerHTML='';for(const id of frozen){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='frozen-chip';button.innerHTML='<i class="frozen-chip__fill"></i><span>❄ '+esc(C.DEVICE_BY_ID[id].name)+' · 按住 2 秒</span>';this._bindFrozenHold(button,id);li.appendChild(button);this.el.frozenList.appendChild(li)}}
 }
 tickSlow(now){const g=this.game,z=g.zone();text($('destination-name'),z.name);text($('zone-desc'),z.desc);text($('zone-depth'),g.depthOf());$('zone-depth').style.color='hsl('+Math.round(120*(1-(g.depthOf()-1)/98))+' 65% 70%)';for(const b of $('zone-tabs').children){b.disabled=!g.state.unlockedZones[b.dataset.zoneId];b.setAttribute('aria-pressed',String(b.dataset.zoneId===z.id))}if(this.el.book.open){const sig=JSON.stringify([this.bookPage,Math.floor(g.state.coins),g.state.broth,g.state.devices,g.state.items,g.state.upgrades,g.state.equipped,g.state.frozen]);if(this.bookSignature!==sig){this.bookSignature=sig;this.renderBook()}}}
 queueDamage(uid,amount,opts={}){const n=this.targetNodes.get(uid);if(n){n.hpText.classList.add('hit-label');clearTimeout(n.hitTimer);n.hitTimer=setTimeout(()=>n.hpText.classList.remove('hit-label'),220)}const p=this.pending.get(uid);if(p){p.amount+=amount;p.crit=p.crit||opts.crit}else this.pending.set(uid,{amount,crit:opts.crit,until:Date.now()+400})}
 floater(label,type=''){if(document.documentElement.classList.contains('reduce-motion'))return;const parent=this.el.floaters;if(parent.children.length>=8)parent.firstChild.remove();const n=document.createElement('span');n.className='world-floater '+type;n.textContent=label;n.style.setProperty('--offset',Math.random()*30+'px');parent.appendChild(n);setTimeout(()=>n.remove(),1000)}
 killReward(name,e){this.floater('+'+this.num(e.bounty)+' 菇幣','reward');if(e.broth)this.toast('金湯滴 +'+e.broth)}showPass(){this.floater('PASS','pass')}shieldBreak(){this.floater('護盾破裂','shield')}luckyHit(){this.floater('幸運加成 ×2','luck')}comboMilestone(n,m){this.floater('共鳴 '+n+' · ×'+m.toFixed(2),'combo')}blindTypingMilestone(n,m){this.floater('閉眼連打 '+n+' · +'+Math.round((m-1)*100)+'%','blind')}bossSceneTransition(direction){this.el.stage.dataset.transition=direction;setTimeout(()=>delete this.el.stage.dataset.transition,800)}
}
    UI.prototype._bindTyping = function () {
        var self = this;
        var composing = false;
        var compositionHandled = false;
        var ignoreCompositionInput = false;

        function physicalTypingKey(event) {
            if (event.key && event.key.length === 1) return event.key;
            var code = event.code || '';
            if (/^Key[A-Z]$/.test(code)) {
                var caps = event.getModifierState && event.getModifierState('CapsLock');
                var upper = !!event.shiftKey !== !!caps;
                var letter = code.slice(3);
                return upper ? letter : letter.toLowerCase();
            }
            if (code === 'Space') return ' ';
            var shiftedKeys = {
                Digit0: [')', '0'], Digit1: ['!', '1'], Digit2: ['@', '2'],
                Digit3: ['#', '3'], Digit4: ['$', '4'], Digit5: ['%', '5'],
                Digit6: ['^', '6'], Digit7: ['&', '7'], Digit8: ['*', '8'], Digit9: ['(', '9'],
                Minus: ['_', '-'], Equal: ['+', '='], BracketLeft: ['{', '['], BracketRight: ['}', ']'],
                Backslash: ['|', '\\'], Semicolon: [':', ';'], Quote: ['"', "'"],
                Backquote: ['~', '`'], Comma: ['<', ','], Period: ['>', '.'], Slash: ['?', '/']
            };
            var pair = shiftedKeys[code];
            return pair ? pair[event.shiftKey ? 0 : 1] : '';
        }

        function sendText(text) {
            if (!text) return;
            for (var i = 0; i < text.length; i++) {
                var character = text.charAt(i);
                if (/^[\x20-\x7E]$/.test(character)) self.handlers.onTypingKey(character);
            }
        }

        this.el.btnSkipPrompt.addEventListener('click', function () { self.handlers.onSkipPrompt(); });
        this.el.btnTypingMask.addEventListener('click', function () {
            self.maskVocabulary = !self.maskVocabulary;
            self.el.btnTypingMask.setAttribute('aria-pressed', self.maskVocabulary ? 'true' : 'false');
            self.el.btnTypingMask.setAttribute('aria-label', self.maskVocabulary ? '顯示完整單字' : '遮住單字');
            self.el.btnTypingMask.title = self.maskVocabulary ? '顯示完整單字' : '遮住尚未輸入的字母';
            if (self.handlers.onTypingMaskChange) self.handlers.onTypingMaskChange(self.maskVocabulary);
            if (self.currentTypingView) self._renderTypingPrompt();
        });
        this.el.typingInput.addEventListener('keydown', function (event) {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            var isComposing = composing || event.isComposing || event.key === 'Process' || event.keyCode === 229;
            if (isComposing) {
                var composingKey = physicalTypingKey(event);
                if (composingKey) {
                    event.preventDefault();
                    compositionHandled = true;
                    self.handlers.onTypingKey(composingKey);
                }
                return;
            }
            if (!event.key || event.key.length !== 1) return;
            event.preventDefault();
            self.handlers.onTypingKey(event.key);
        });
        this.el.typingInput.addEventListener('compositionstart', function () {
            composing = true;
            compositionHandled = false;
        });
        this.el.typingInput.addEventListener('compositionend', function (event) {
            composing = false;
            if (!compositionHandled) sendText(event.data || '');
            compositionHandled = false;
            ignoreCompositionInput = true;
            self.el.typingInput.value = '';
            setTimeout(function () { ignoreCompositionInput = false; }, 0);
        });
        // 保留 IME 組字；一般軟鍵盤輸入則逐字送進英打判定。
        this.el.typingInput.addEventListener('input', function (event) {
            if (composing || event.isComposing) return;
            if (ignoreCompositionInput) {
                this.value = '';
                ignoreCompositionInput = false;
                return;
            }
            sendText(event.data || this.value);
            this.value = '';
        });
        this.el.typingInput.addEventListener('paste', function (event) { event.preventDefault(); });

    };


    UI.prototype._bindStage = function () {
        var self = this;
        var hold = this.el.btnHold;

        var start = function (event) {
            if (event.type === 'keydown') {
                if (event.key !== ' ' && event.key !== 'Enter') return;
                if (event.repeat) return;
                event.preventDefault();
            } else if (event.type === 'pointerdown') {
                if (event.button !== 0) return;
                if (hold.setPointerCapture && event.pointerId !== undefined) {
                    try { hold.setPointerCapture(event.pointerId); } catch (ignore) {}
                }
            }
            self.handlers.onHoldStart();
        };
        var stop = function (event) {
            if (event.type === 'keyup' && event.key !== ' ' && event.key !== 'Enter') return;
            self.handlers.onHoldEnd(event.type === 'pointerup' || event.type === 'keyup');
        };

        hold.addEventListener('pointerdown', start);
        hold.addEventListener('pointerup', stop);
        hold.addEventListener('pointercancel', stop);
        hold.addEventListener('lostpointercapture', stop);
        hold.addEventListener('keydown', start);
        hold.addEventListener('keyup', stop);
        hold.addEventListener('blur', stop);
        // 避免長按在手機上跳出系統選單
        hold.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    };


    UI.prototype._bindFrozenHold = function (button, deviceId) {
        var self = this;
        var fill = button.querySelector('.frozen-chip__fill');
        var duration = 2000;

        var reset = function () {
            if (!self.frozenHold || self.frozenHold.button !== button) return;
            clearInterval(self.frozenHold.timer);
            self.frozenHold = null;
            fill.style.width = '0%';
        };
        var start = function (event) {
            if (event.type === 'keydown') {
                if (event.key !== ' ' && event.key !== 'Enter') return;
                if (event.repeat) return;
                event.preventDefault();
            } else if (event.type === 'pointerdown') {
                if (event.button !== 0) return;
                if (button.setPointerCapture && event.pointerId !== undefined) {
                    try { button.setPointerCapture(event.pointerId); } catch (ignore) {}
                }
            }
            if (self.frozenHold) return;
            var hold = { button: button, startedAt: Date.now(), timer: null };
            self.frozenHold = hold;
            hold.timer = setInterval(function () {
                if (self.frozenHold !== hold) return;
                var progress = Math.min(1, (Date.now() - hold.startedAt) / duration);
                fill.style.width = (progress * 100).toFixed(1) + '%';
                if (progress >= 1) {
                    clearInterval(hold.timer);
                    self.frozenHold = null;
                    self.handlers.onUnfreeze(deviceId);
                }
            }, 30);
        };
        var stop = function (event) {
            if (event.type === 'keyup' && event.key !== ' ' && event.key !== 'Enter') return;
            reset();
        };

        button.addEventListener('pointerdown', start);
        button.addEventListener('pointerup', stop);
        button.addEventListener('pointercancel', stop);
        button.addEventListener('lostpointercapture', stop);
        button.addEventListener('keydown', start);
        button.addEventListener('keyup', stop);
        button.addEventListener('blur', stop);
        button.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    };


root.MushUI={UI};
})(typeof self!=='undefined'?self:this);
