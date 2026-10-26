(() => {
  'use strict';
  const R=window.InvoiceArtworkRenderer;
  const variants={moire:0,blob:0,riso:0};
  const settings=Object.fromEntries(Object.entries(R.defaultSettings).map(([id,variants])=>[id,variants.map(values=>({...values}))]));
  const pending=new Set();
  let orientation='portrait';

  function renderArtwork(id){
    const meta=R.metadata.find(art=>art.id===id),variant=variants[id];
    try{
      const preview=R.create(id,variant,orientation,1000,settings[id][variant]);
      const canvas=document.getElementById(id);
      canvas.width=preview.width;canvas.height=preview.height;
      canvas.getContext('2d').drawImage(preview,0,0);
      const button=document.querySelector(`[data-variant="${id}"]`);
      button.dataset.value=variant;
      button.textContent=(variant?`異色版 ${variant}`:'原色版')+' · '+meta.labels[variant];
      document.getElementById('download-'+id).setAttribute('aria-disabled','false');
      return true;
    }catch(error){
      document.getElementById('download-'+id).setAttribute('aria-disabled','true');
      document.getElementById('status').textContent=`${meta.name}：${error.message}`;
      return false;
    }
  }

  function schedule(id){
    if(pending.has(id))return;
    pending.add(id);
    requestAnimationFrame(()=>{pending.delete(id);renderArtwork(id);});
  }

  function renderAll(){
    document.querySelectorAll('[data-orientation]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.orientation===orientation)));
    document.getElementById('status').textContent='正在繪製…';
    let success=0;
    for(const meta of R.metadata)if(renderArtwork(meta.id))success++;
    if(success===3)document.getElementById('status').textContent=`三張已完成 · 下載 ${orientation==='landscape'?'2540 × 1595':'1595 × 2540'} px · 點圖片切換色系`;
  }

  for(const meta of R.metadata){
    const flip=()=>{variants[meta.id]=(variants[meta.id]+1)%meta.colors.length;syncControls(meta.id);schedule(meta.id);};
    const canvas=document.getElementById(meta.id);
    canvas.setAttribute('role','button');canvas.tabIndex=0;canvas.setAttribute('aria-label',meta.name+'，點選切換色系');
    canvas.onclick=flip;
    canvas.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();flip();}};
    const button=document.createElement('button');button.dataset.variant=meta.id;button.className='variant';button.onclick=flip;
    canvas.closest('article').querySelector('h2').after(button);

    document.getElementById('download-'+meta.id).onclick=async event=>{
      event.preventDefault();
      const link=event.currentTarget;if(link.getAttribute('aria-disabled')==='true')return;
      link.setAttribute('aria-disabled','true');
      try{
        const variant=variants[meta.id],values={...settings[meta.id][variant]},direction=orientation;
        const full=R.create(meta.id,variant,direction,2540,values);
        const blob=await new Promise((resolve,reject)=>full.toBlob(value=>value?resolve(value):reject(Error('PNG 輸出失敗')),'image/png'));
        const url=URL.createObjectURL(blob),download=document.createElement('a');
        download.href=url;
        download.download=`${meta.id}-${['original','alternate-1','alternate-2'][variant]}-${direction}${meta.id==='moire'?'-spacing-'+values.moireSpacing:'-size-'+values.zoom}-x-${values.panX}-y-${values.panY}.png`;
        download.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      }catch(error){document.getElementById('status').textContent=error.message;}
      finally{link.setAttribute('aria-disabled','false');}
    };
  }

  function syncControls(id){
    document.querySelectorAll(`[data-art="${id}"][data-setting]`).forEach(input=>{
      const key=input.dataset.setting,value=settings[id][variants[id]][key];
      input.value=value;
      document.getElementById(input.id+'-value').textContent=formatValue(key,value);
    });
  }
  function formatValue(key,value){return key==='moireSpacing'?String(value):key==='zoom'?`${value}%`:`${value>0?'+':''}${value}%`;}
  document.querySelectorAll('[data-art][data-setting]').forEach(input=>{
    const id=input.dataset.art,key=input.dataset.setting,output=document.getElementById(input.id+'-value');
    input.oninput=()=>{
      const value=Number(input.value);settings[id][variants[id]][key]=value;
      output.textContent=formatValue(key,value);
      schedule(id);
    };
  });
  document.querySelectorAll('[data-orientation]').forEach(el=>el.onclick=()=>{orientation=el.dataset.orientation;renderAll();});
  for(const meta of R.metadata)syncControls(meta.id);
  renderAll();
})();
