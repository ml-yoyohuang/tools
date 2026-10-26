/* Replace a record's src with a local artwork path when final artwork is ready.
   Inline SVG data URLs keep the initial placeholders exportable even via file://. */
window.InvoiceArtwork = [
  {id:'morning',name:'晨間餐桌',category:'daily',color:'#e9e2d1',accent:'#c4b993',ink:'#647a54',label:'MORNING TABLE'},
  {id:'afternoon',name:'午後點心',category:'daily',color:'#e8d9d2',accent:'#caad9c',ink:'#946954',label:'AFTERNOON BREAK'},
  {id:'garden',name:'花園一角',category:'plant',color:'#dfe6d7',accent:'#adc094',ink:'#6b805b',label:'A LITTLE GARDEN'},
  {id:'window',name:'窗邊綠意',category:'plant',color:'#dce4e2',accent:'#b1c4bc',ink:'#5c8279',label:'BY THE WINDOW'},
  {id:'balance',name:'色塊平衡',category:'shape',color:'#e6e2d9',accent:'#c6b987',ink:'#777c55',label:'SHAPES IN BALANCE'},
  {id:'orbit',name:'小小軌道',category:'shape',color:'#dce0e9',accent:'#b2bad2',ink:'#747b9b',label:'A SMALL ORBIT'}
].map((art,index) => ({...art,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
  <title>${art.label} — SVG illustration placeholder</title>
  <rect width="1200" height="1600" fill="${art.color}"/>
  <rect x="100" y="100" width="1000" height="1400" rx="500" fill="none" stroke="${art.ink}" stroke-opacity=".18" stroke-width="2"/>
  <circle cx="600" cy="620" r="255" fill="${art.accent}"/>
  <path d="M345 620a255 255 0 0 0 510 0Z" fill="${art.ink}" fill-opacity=".62"/>
  <circle cx="600" cy="620" r="165" fill="${art.color}"/>
  <path d="M600 310v55m0 510v55M290 620h55m510 0h55" stroke="${art.ink}" stroke-opacity=".5" stroke-width="2"/>
  <text x="600" y="640" fill="${art.ink}" font-family="Georgia,serif" font-size="76" text-anchor="middle">0${index+1}</text>
  <text x="600" y="1000" fill="${art.ink}" font-family="sans-serif" font-size="22" letter-spacing="6" text-anchor="middle">${art.label}</text>
  <text x="600" y="1050" fill="${art.ink}" fill-opacity=".7" font-family="sans-serif" font-size="15" letter-spacing="4" text-anchor="middle">ILLUSTRATION PLACEHOLDER</text>
  </svg>`)
}));
