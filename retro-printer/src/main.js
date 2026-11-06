import { mountInks } from './stations/inks/inks.js';
import { mountMedia } from './stations/media/media.js';
import { mountWorkbench } from './stations/workbench/workbench.js';
import { testPlates } from './plates/test-plate.js';
import { DEFAULT_INKS } from './inks.js';

// 各站依 brief.md 的流程串接。目前：選墨水 → 選媒材 → 工作桌。
// 版暫時用測試資料，之後由製版站提供。
const stations = {
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

const plates = testPlates();
// 在各站之間保留的選擇
const session = {
  inks: DEFAULT_INKS.slice(0, plates.length),
  customInks: [],
  medium: 'paper'
};

function toInks() {
  go('inks', { plates, session, onNext: inks => { session.inks = inks; toMedia(); } });
}
function toMedia() {
  go('media', {
    plates, inks: session.inks, selected: session.medium,
    onPick: medium => { session.medium = medium.id; toWorkbench(medium); },
    onBack: toInks
  });
}
function toWorkbench(medium) {
  go('workbench', { plates, inks: session.inks, medium, onBack: toMedia });
}

toInks();
