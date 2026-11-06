import { mountSource } from './stations/source/source.js';
import { mountPlates } from './stations/plates/plates.js';
import { mountGallery } from './stations/plates/gallery.js';
import { mountInks } from './stations/inks/inks.js';
import { mountMedia } from './stations/media/media.js';
import { mountWorkbench } from './stations/workbench/workbench.js';

// 各站依 brief.md 的流程串接：
//   提供圖片 → 製版 → 欣賞版子 → 選墨水 → 選媒材 → 工作桌
const stations = {
  source: mountSource,
  plates: mountPlates,
  gallery: mountGallery,
  inks: mountInks,
  media: mountMedia,
  workbench: mountWorkbench
};

const app = document.getElementById('app');
let current = null;

export function go(name, data) {
  if (current) current.destroy();
  current = stations[name](app, data);
  window.scrollTo(0, 0);
}

// 在各站之間保留的選擇
const session = {
  source: { kind: 'library', id: 'flower', bitmap: null, mode: 'contain', pan: [0, 0] },
  image: null,
  plateStates: new WeakMap(),   // 每張圖各自的製版設定；換圖就回到那張圖的預設
  plates: null,
  suggested: null,
  inks: null,
  customInks: [],
  medium: 'paper'
};

function toSource() {
  go('source', { source: session.source, onNext: image => { session.image = image; toPlates(); } });
}
function toPlates() {
  const image = session.image;
  if (!session.plateStates.has(image)) {
    session.plateStates.set(image, { n: image.colors, cov: null, view: 'stack', active: 0 });
  }
  go('plates', {
    image,
    state: session.plateStates.get(image),
    onBack: toSource,
    onDone: ({ plates, inks }) => {
      session.plates = plates;
      session.suggested = inks;
      session.inks = inks.slice();   // 換了版，墨改回建議墨色
      toGallery();
    }
  });
}
function toGallery() {
  go('gallery', { plates: session.plates, inks: session.suggested, onNext: toInks, onBack: toPlates });
}
function toInks() {
  go('inks', {
    plates: session.plates, session,
    onNext: inks => { session.inks = inks; toMedia(); },
    onBack: toGallery
  });
}
function toMedia() {
  go('media', {
    plates: session.plates, inks: session.inks, selected: session.medium,
    onPick: medium => { session.medium = medium.id; toWorkbench(medium); },
    onBack: toInks
  });
}
function toWorkbench(medium) {
  go('workbench', { plates: session.plates, inks: session.inks, medium, onBack: toMedia });
}

toSource();
