import { mountPlates } from './stations/plates/plates.js';
import { mountGallery } from './stations/plates/gallery.js';
import { mountInks } from './stations/inks/inks.js';
import { mountMedia } from './stations/media/media.js';
import { mountWorkbench } from './stations/workbench/workbench.js';

// 各站依 brief.md 的流程串接：
//   製版 → 欣賞版子 → 選墨水 → 選媒材 → 工作桌
// 圖片暫時用製版站內建的範例圖，之後由「提供圖片」站提供。
const stations = {
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
  plateState: { sample: 'flower', n: 3, cov: null, view: 'stack', active: 0 },
  plates: null,
  suggested: null,
  inks: null,
  customInks: [],
  medium: 'paper'
};

function toPlates() {
  go('plates', {
    state: session.plateState,
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

toPlates();
