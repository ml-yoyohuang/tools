(() => {
  'use strict';
  const R=window.InvoiceArtworkRenderer,variants={moire:0,blob:0,riso:0};let orientation='portrait',revision=0;
  async function render(){
    const token=++revision,wide=orientation==='landscape';
    document.getElementById('status').textContent='正在繪製…';
    document.querySelectorAll('[data-orientation]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.orientation===orientation)));
    try{
      for(const meta of R.metadata){
        const variant=variants[meta.id],url=await R.imageURL(meta.id,variant,orientation);if(token!==revision)return;
        const decoded=new Image();decoded.src=url;await decoded.decode();if(token!==revision)return;
        const canvas=document.getElementById(meta.id);canvas.width=decoded.naturalWidth;canvas.height=decoded.naturalHeight;canvas.getContext('2d').drawImage(decoded,0,0);
        const link=document.getElementById('download-'+meta.id);link.href=url;link.download=`${meta.id}-${['original','alternate-1','alternate-2'][variant]}-${orientation}.png`;link.setAttribute('aria-disabled','false');
        const button=document.querySelector(`[data-variant="${meta.id}"]`);button.dataset.value=variant;button.textContent=(variant?`異色版 ${variant}`:'原色版')+' · '+meta.labels[variant];
      }
      document.getElementById('status').textContent=`三張已完成 · ${wide?'2540 × 1595':'1595 × 2540'} px · 點圖片切換色系`;
    }catch(e){document.getElementById('status').textContent=e.message;}
  }
  for(const meta of R.metadata){
    const flip=()=>{variants[meta.id]=(variants[meta.id]+1)%meta.colors.length;render();};
    const canvas=document.getElementById(meta.id);canvas.setAttribute('role','button');canvas.tabIndex=0;canvas.setAttribute('aria-label',meta.name+'，點選切換色系');canvas.onclick=flip;canvas.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip();}};
    const button=document.createElement('button');button.dataset.variant=meta.id;button.className='variant';button.onclick=flip;canvas.closest('article').querySelector('h2').after(button);
  }
  document.querySelectorAll('[data-orientation]').forEach(el=>el.onclick=()=>{orientation=el.dataset.orientation;render();});render();
})();
