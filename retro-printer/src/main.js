import { mountMedia } from './stations/media/media.js';
import { mountWorkbench } from './stations/workbench/workbench.js';
import { testPlates, TEST_INKS } from './plates/test-plate.js';

// 各站依 brief.md 的流程串接。目前：選媒材 → 工作桌。
// 版與墨暫時用測試資料，之後由製版、選墨站提供。
const stations = {
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
const inks = TEST_INKS;

function toMedia(selected) {
  go('media', { plates, inks, selected, onPick: toWorkbench });
}
function toWorkbench(medium) {
  go('workbench', { plates, inks, medium, onBack: () => toMedia(medium.id) });
}

toMedia('paper');
