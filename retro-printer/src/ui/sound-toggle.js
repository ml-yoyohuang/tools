import { soundEnabled, setSoundEnabled, onSoundChange } from '../audio/sound.js';

// 聲音開關：每一站右上角的小按鈕，喇叭圖示加文字，狀態存在瀏覽器裡
const SPEAKER = '<path d="M2.5 6h2.6L8.6 3v10L5.1 10H2.5z" fill="currentColor" stroke="none"/>';
const ICON_ON = `${SPEAKER}<path d="M10.8 5.6a3.4 3.4 0 0 1 0 4.8M12.6 3.8a6 6 0 0 1 0 8.4"/>`;
const ICON_OFF = `${SPEAKER}<path d="M11 6.2l3.6 3.6M14.6 6.2L11 9.8"/>`;

export function mountSoundToggle(parent = document.body) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sound-toggle';
  b.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"></svg><span></span>`;
  const svg = b.querySelector('svg'), label = b.querySelector('span');
  const show = on => {
    svg.innerHTML = on ? ICON_ON : ICON_OFF;
    label.textContent = on ? '聲音 開' : '聲音 關';
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('off', !on);
  };
  show(soundEnabled());
  b.addEventListener('click', () => setSoundEnabled(!soundEnabled()));
  onSoundChange(show);
  parent.appendChild(b);
  return b;
}
