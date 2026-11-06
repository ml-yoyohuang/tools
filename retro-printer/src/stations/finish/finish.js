// 完成：成品像美術館裡的一件作品，旁邊是作品說明牌。
//   works    這次瀏覽的作品（見 src/works.js）
//   current  要展示的那一件
//   onAgain  同樣的版、墨、媒材再印一張
//   onNewImage  回到提供圖片
const css = rgb => `rgb(${rgb.join(',')})`;

export function mountFinish(root, { works, current, onAgain, onNewImage }) {
  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.innerHTML = `<div class="sheet finish-sheet"><img class="work" alt=""></div>`;
  root.appendChild(stage);
  const sheet = stage.querySelector('.sheet'), img = stage.querySelector('.work');

  const panel = document.createElement('aside');
  panel.className = 'panel finish-panel';
  panel.innerHTML = `
    <h1>完成</h1>
    <dl class="label">
      <dt class="no"></dt>
      <dd class="title"></dd>
      <dd class="line"></dd>
      <dd class="inks"></dd>
      <dd class="date"></dd>
    </dl>
    <div class="act">
      <a class="primary download" href="#">下載 PNG</a>
    </div>
    <div class="works-block">
      <p class="sub">這次的作品</p>
      <div class="works" role="radiogroup" aria-label="這次的作品"></div>
    </div>
    <div class="foot">
      <button class="text again" type="button">再印一張</button>
      <button class="text new-image" type="button">換一張圖</button>
    </div>`;
  root.appendChild(panel);
  const $ = s => panel.querySelector(s);
  const list = $('.works'), download = $('.download');

  const thumbs = works.map(w => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'work-thumb';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', w.label.no);
    b.title = w.label.no;
    const t = document.createElement('img');
    t.src = w.url;
    t.alt = '';
    b.appendChild(t);
    b.addEventListener('click', () => show(w));
    list.appendChild(b);
    return { w, b };
  });

  function show(w) {
    const l = w.label;
    img.src = w.url;
    img.alt = `${l.no} ${l.title}`;
    sheet.style.background = css(w.mediumPaper);
    $('.no').textContent = l.no;
    $('.title').textContent = l.title;
    $('.line').textContent = l.line;
    $('.date').textContent = l.date;
    const inksEl = $('.inks');
    inksEl.innerHTML = '';
    for (const ink of l.inks) {
      const s = document.createElement('span');
      s.className = 'ink-item';
      s.innerHTML = '<i></i><span></span>';
      s.querySelector('i').style.background = css(ink.rgb);
      s.querySelector('span').textContent = ink.name;
      inksEl.appendChild(s);
    }
    download.href = w.url;
    download.download = l.file;
    for (const t of thumbs) t.b.setAttribute('aria-checked', String(t.w === w));
  }

  $('.again').addEventListener('click', onAgain);
  $('.new-image').addEventListener('click', onNewImage);

  show(current);
  return { destroy() { root.innerHTML = ''; } };
}
