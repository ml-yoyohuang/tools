// Builds layout wireframes from the sheetSpec() in puri-club.html so the art templates match the site exactly.
const fs=require("fs"),path=require("path");
const [,,html,outDir]=process.argv;
const src=fs.readFileSync(html,"utf8");
const block=src.slice(src.indexOf("const SHEET_HEAD"),src.indexOf("function stickerPath("));
const heart="M12 20.5C6 16.6 2.5 13.2 2.5 9 2.5 6.2 4.6 4 7.3 4c2 0 3.6 1.1 4.7 2.8C13.1 5.1 14.7 4 16.7 4c2.7 0 4.8 2.2 4.8 5 0 4.2-3.5 7.6-9.5 11.5z";
const r1=n=>Math.round(n*10)/10;
function shape(kind,x,y,w,h,attrs){
 if(kind==="square")return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" ${attrs}/>`;
 if(kind==="oval")return `<ellipse cx="${r1(x+w/2)}" cy="${r1(y+h/2)}" rx="${r1(w/2)}" ry="${r1(h/2)}" ${attrs}/>`;
 if(kind==="pill")return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(Math.min(w,h)/2)}" ${attrs}/>`;
 if(kind==="arch"){const r=w/2,k=w*.08;return `<path d="M${r1(x)} ${r1(y+r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x+w)} ${r1(y+r)}V${r1(y+h-k)}Q${r1(x+w)} ${r1(y+h)} ${r1(x+w-k)} ${r1(y+h)}H${r1(x+k)}Q${r1(x)} ${r1(y+h)} ${r1(x)} ${r1(y+h-k)}Z" ${attrs}/>`}
 if(kind==="heart"){const s=Math.min(w/19,h/16.5);return `<path d="${heart}" transform="translate(${r1(x+w/2)} ${r1(y+h/2)}) scale(${s.toFixed(3)}) translate(-12 -12.25)" vector-effect="non-scaling-stroke" ${attrs}/>`}
 if(kind==="stamp"){const r=Math.min(w,h)*.035;let d=`M${r1(x)} ${r1(y)}`;for(const [sx,sy,len,a] of [[x,y,w,0],[x+w,y,h,Math.PI/2],[x+w,y+h,w,Math.PI],[x,y+h,h,-Math.PI/2]]){const dx=Math.cos(a),dy=Math.sin(a),n=Math.max(3,Math.round(len/(r*4.2)));for(let j=0;j<n;j++){const t=(j+.5)*len/n,cx=sx+dx*t,cy=sy+dy*t;d+=`L${r1(cx-dx*r)} ${r1(cy-dy*r)}A${r1(r)} ${r1(r)} 0 0 0 ${r1(cx+dx*r)} ${r1(cy+dy*r)}`}d+=`L${r1(sx+dx*len)} ${r1(sy+dy*len)}`}return `<path d="${d}Z" ${attrs}/>`}
 return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(Math.min(w,h)*.08)}" ${attrs}/>`}
const names={split:"大中小分割",eight:"8 分割"},orients={portrait:"直式照片",landscape:"橫式照片"};
for(const orient of ["portrait","landscape"])for(const layout of ["split","eight"]){
 const [PW,PH]=orient==="portrait"?[600,800]:[800,600];
 const {sheetSpec,SHEET_HEAD,SHEET_FOOT}=new Function("PW","PH","orient","layout",block+";return {sheetSpec,SHEET_HEAD,SHEET_FOOT}")(PW,PH,orient,layout);
 const s=sheetSpec(layout),out=[];
 out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}" role="img" aria-labelledby="title desc">`,
 `<title id="title">${names[layout]}（${orients[orient]}）拍貼版型對位稿</title>`,
 `<desc id="desc">與網站輸出同尺寸的線框；藍色是照片窗，紫色實線是貼紙外形，紫色虛線是半斷割線，粉紅虛線是標題與頁尾區。</desc>`,
 `<rect width="${s.w}" height="${s.h}" fill="#fffdf9"/>`,
 `<rect x=".5" y=".5" width="${s.w-1}" height="${s.h-1}" fill="none" stroke="#1b2433"/>`);
 // Bare sheets are photos edge to edge with no title or tagline area.
 if(!s.bare)out.push(`<rect x="${r1(s.w*.14)}" y="15" width="${r1(s.w*.72)}" height="42" rx="21" fill="none" stroke="#a23570" stroke-width="1.5" stroke-dasharray="5 3"/>`,
 `<text x="${s.w/2}" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#a23570">LOGO / TITLE AREA</text>`,
 `<line x1="0" y1="${SHEET_HEAD}" x2="${s.w}" y2="${SHEET_HEAD}" stroke="#a23570" stroke-width="1" stroke-dasharray="4 4"/>`,
 `<line x1="0" y1="${s.h-SHEET_FOOT}" x2="${s.w}" y2="${s.h-SHEET_FOOT}" stroke="#a23570" stroke-width="1" stroke-dasharray="4 4"/>`,
 `<text x="${s.w/2}" y="${s.h-20}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#a23570">TAGLINE / DATE AREA</text>`);
 s.pieces.forEach(p=>{const base=Math.min(p.w,p.h),stamp=p.shape==="stamp",f=p.flush?0:stamp?base*.09:Math.max(2.5,base*.035),o=Math.max(2.5,base*.025),inner=stamp?"square":p.shape;
  out.push(`<g data-photo="${p.photo+1}" data-shape="${p.shape}" data-x="${r1(p.x)}" data-y="${r1(p.y)}" data-width="${r1(p.w)}" data-height="${r1(p.h)}" data-window-inset="${r1(f)}">`,
  p.flush?"":shape(stamp?"square":p.shape,p.x-o,p.y-o,p.w+o*2,p.h+o*2,'fill="none" stroke="#764d70" stroke-width="1" stroke-dasharray="4 3"'),
  shape(p.shape,p.x,p.y,p.w,p.h,'fill="#fff" stroke="#764d70" stroke-width="1.2"'),
  shape(inner,p.x+f,p.y+f,p.w-f*2,p.h-f*2,'fill="#edf7ff" stroke="#087eae" stroke-width="1.5"'),
  `<text x="${r1(p.x+p.w/2)}" y="${r1(p.y+p.h/2+4)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${base>100?14:9}" font-weight="700" fill="#087eae">P${p.photo+1}</text>`,
  `</g>`)});
 out.push("</svg>","");
 const file=path.join(outDir,`${layout}-${orient}-wireframe.svg`);fs.writeFileSync(file,out.join("\n"));console.log(file,s.w+"×"+s.h,s.pieces.length+" pieces");
}
