import { mountWorkbench } from './stations/workbench/workbench.js';
import { testPlates, TEST_INKS } from './plates/test-plate.js';
import { MEDIA } from './state.js';

// 各站。目前只有工作桌；之後的站依 brief.md 的流程逐一加入。
const stations = {
  workbench: (root, data) => mountWorkbench(root, data)
};

const app = document.getElementById('app');
let current = null;

export function go(name, data) {
  if (current) current.destroy();
  current = stations[name](app, data);
}

go('workbench', { plates: testPlates(), inks: TEST_INKS, medium: MEDIA.paper });
