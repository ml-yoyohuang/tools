/*!
 * 頭頂名牌（DOM 疊層）
 *
 * 文字用 DOM 繪製，確保中文清晰、可被輔助科技讀取；位置每幀跟著 3D 頭頂投影移動。
 * 名牌本身是按鈕：點擊或用鍵盤按下都能指定優先目標，不需要瞄準 3D 模型。
 * 血條、生命值與標籤一律不換行；最小化模式只保留微型血條與第一個標籤。
 */
export class Labels {
    constructor(container, onPick) {
        this.container = container;
        this.onPick = onPick;
        this.nodes = new Map();
    }

    ensure(uid) {
        let n = this.nodes.get(uid);
        if (n) return n;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tlabel';
        const name = document.createElement('span');
        name.className = 'tlabel__name';
        const bar = document.createElement('span');
        bar.className = 'tlabel__bar';
        const fill = document.createElement('span');
        fill.className = 'tlabel__fill';
        bar.appendChild(fill);
        const hp = document.createElement('span');
        hp.className = 'tlabel__hp';
        const tags = document.createElement('span');
        tags.className = 'tlabel__tags';
        button.append(name, bar, hp, tags);
        button.addEventListener('pointerdown', (event) => event.preventDefault());   // 不搶走英打輸入框的焦點
        button.addEventListener('click', () => this.onPick(uid));
        this.container.appendChild(button);
        n = { button, name, fill, hp, tags, sig: '', hitTimer: null, lastRatio: 1 };
        this.nodes.set(uid, n);
        return n;
    }

    /** 更新文字內容（呼叫端節流）。 */
    setContent(uid, view) {
        const n = this.ensure(uid);
        const tagSig = view.tags.map((t) => t.text + t.cls).join('|');
        const sig = view.name + '#' + view.hpText + '#' + tagSig + '#' + view.preferred + '#' + view.isBoss;
        n.fill.style.width = (view.ratio * 100).toFixed(1) + '%';
        n.fill.classList.toggle('is-low', view.ratio < 0.3);
        if (view.ratio < n.lastRatio - 1e-9) this.flashHit(uid);
        n.lastRatio = view.ratio;
        if (sig === n.sig) return;
        n.sig = sig;
        if (n.name.textContent !== view.name) n.name.textContent = view.name;
        if (n.hp.textContent !== view.hpText) n.hp.textContent = view.hpText;
        if (n.tagSig !== tagSig) {
            n.tagSig = tagSig;
            n.tags.textContent = '';
            view.tags.forEach((tag) => {
                const span = document.createElement('span');
                span.className = 'tag' + (tag.cls ? ' ' + tag.cls : '');
                span.textContent = tag.text;
                n.tags.appendChild(span);
            });
        }
        n.button.classList.toggle('is-preferred', !!view.preferred);
        n.button.classList.toggle('is-boss', !!view.isBoss);
        n.button.setAttribute('aria-label', view.aria);
        n.button.setAttribute('aria-pressed', view.preferred ? 'true' : 'false');
    }

    /** 受擊：生命值文字變色，血條閃一下。 */
    flashHit(uid) {
        const n = this.nodes.get(uid);
        if (!n) return;
        n.button.classList.remove('is-hit');
        void n.button.offsetWidth;
        n.button.classList.add('is-hit');
        clearTimeout(n.hitTimer);
        n.hitTimer = setTimeout(() => n.button.classList.remove('is-hit'), 380);
    }

    place(uid, x, y, visible, depthOrder) {
        const n = this.nodes.get(uid);
        if (!n) return;
        n.button.hidden = !visible;
        if (!visible) return;
        n.button.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
        n.button.style.zIndex = String(10 + depthOrder);
    }

    rect(uid) {
        const n = this.nodes.get(uid);
        if (!n || n.button.hidden) return null;
        return n.button.getBoundingClientRect();
    }

    remove(uid) {
        const n = this.nodes.get(uid);
        if (!n) return;
        clearTimeout(n.hitTimer);
        n.button.remove();
        this.nodes.delete(uid);
    }

    clear() {
        Array.from(this.nodes.keys()).forEach((uid) => this.remove(uid));
    }
}
