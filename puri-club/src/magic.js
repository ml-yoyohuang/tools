// One-tap magic stamp sets and the ?magic-dev export helper.
import { normAngle } from "./adjust.js";
import { MAGIC_SETS } from "./data/magic-sets.js";
import { canEdit, objects, remember, renderEditor } from "./editor.js";
import { stampDims } from "./stamps.js";
import { state } from "./state.js";
import { $, clamp, status } from "./util.js";

export function initMagic() {
  // Each tap swaps the previous magic stamps for the next set. Photo n starts n sets in so the four photos differ, and
  // every other pass through the list is mirrored. Stamps the player moves or turns stop counting as magic and stay put.
  $("autoDecor").onclick = () => {
    if (!canEdit()) return;
    const sets = MAGIC_SETS[state.theme].filter((s) => !s.only || s.only === state.orient),
      turn = state.activePhoto + state.magicTurns[state.activePhoto],
      set = sets[turn % sets.length],
      flip = Math.floor(turn / sets.length) % 2 === 1,
      keep = objects().filter((o) => !o.magic);
    if (keep.length + set.stamps.length > 200) return;
    state.magicTurns[state.activePhoto]++;
    remember();
    state.selectedId = null;
    const short = Math.min(state.PW, state.PH);
    // A stamp that would hang off the photo is nudged back inside, using its turned bounding box.
    state.decorations[state.activePhoto] = keep.concat(
      set.stamps.map(([key, x, y, size, deg]) => {
        const rotation = ((flip ? -deg : deg) * Math.PI) / 180,
          px = Math.round(size * short),
          { w, h } = stampDims(key, px),
          bw = Math.abs(w * Math.cos(rotation)) + Math.abs(h * Math.sin(rotation)),
          bh = Math.abs(w * Math.sin(rotation)) + Math.abs(h * Math.cos(rotation));
        return {
          id: state.nextId++,
          type: "stamp",
          key,
          x: clamp((flip ? 1 - x : x) * state.PW, bw / 2 + 6, state.PW - bw / 2 - 6),
          y: clamp(y * state.PH, bh / 2 + 6, state.PH - bh / 2 - 6),
          size: px,
          rotation,
          magic: true,
        };
      }),
    );
    renderEditor();
    status("魔法套組 " + ((turn % sets.length) + 1) + " / " + sets.length + (flip ? "（鏡像）" : ""));
  };
  // Authoring aid for MAGIC_SETS: ?magic-dev shows a button that copies the current photo's stamps as one set.
  if (new URLSearchParams(location.search).has("magic-dev")) {
    const b = $("exportMagic");
    b.hidden = false;
    b.onclick = async () => {
      const r = (n) => Math.round(n * 1000) / 1000,
        short = Math.min(state.PW, state.PH),
        stamps = objects()
          .filter((o) => o.type === "stamp")
          .map((o) => [
            o.key,
            r(o.x / state.PW),
            r(o.y / state.PH),
            r(o.size / short),
            Math.round((normAngle(o.rotation) * 180) / Math.PI),
          ]),
        text = JSON.stringify({ stamps });
      try {
        await navigator.clipboard.writeText(text);
        status(
          "已複製 " +
            stamps.length +
            " 個印章的套組資料（" +
            (state.orient === "portrait" ? "直式" : "橫式") +
            "照片）。",
        );
      } catch (e) {
        prompt("複製這段套組資料：", text);
      }
    };
  }
}
