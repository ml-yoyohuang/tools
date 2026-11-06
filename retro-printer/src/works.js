import { shuffle } from './plates/fit.js';

// 這次瀏覽留下的作品。只存在記憶體裡，重新整理就清空。
// 入口的作品牆也讀這份資料。

const COUNT = ['零', '單', '兩', '三', '四', '五', '六', '七', '八', '九'];
const pad = (n, k = 2) => String(n).padStart(k, '0');

export const formatDate = d => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

// 作品說明牌的文字
export function workLabel({ no, imageName, mediumName, inks, date }) {
  const n = inks.length;
  return {
    no: `No. ${pad(no)}`,
    title: imageName,
    line: `絹印・${mediumName}・${COUNT[n] || n}色`,
    inks: inks.map(i => ({ name: i.name, rgb: i.rgb })),
    date: formatDate(date),
    file: `print-${pad(no)}.png`
  };
}

// 作品牆：這次印的作品在最前面（新的在前），後面接打亂順序的圖庫
export function wallItems(works, library, rnd = Math.random) {
  return [
    ...works.slice().reverse().map(work => ({ kind: 'work', work })),
    ...shuffle(library, rnd).map(item => ({ kind: 'library', item }))
  ];
}

// works：作品陣列；回傳新作品並加進去
export function addWork(works, { blob, url, imageName, mediumName, mediumPaper, inks, date = new Date() }) {
  const work = {
    no: works.length + 1, blob, url, mediumPaper,
    meta: { imageName, mediumName, inks: inks.map(i => ({ name: i.name, rgb: i.rgb })), date }
  };
  work.label = workLabel({ no: work.no, ...work.meta });
  works.push(work);
  return work;
}
