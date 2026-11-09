import { soundEnabled, setSoundEnabled, onSoundChange } from '../audio/sound.js';

// 聲音開關：每一站右上角的小文字按鈕，狀態存在瀏覽器裡
export function mountSoundToggle(parent = document.body) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'text sound-toggle';
  const show = on => { b.textContent = on ? '聲音 開' : '聲音 關'; b.setAttribute('aria-pressed', String(on)); };
  show(soundEnabled());
  b.addEventListener('click', () => setSoundEnabled(!soundEnabled()));
  onSoundChange(show);
  parent.appendChild(b);
  return b;
}
