/* 儲存層：和其他程式分開。現在存在瀏覽器裡；之後接 LINE（LIFF）時，只要換一個 adapter。
   adapter 介面（全部回傳 Promise）：load() → object|null、save(object)、clear() */
import { CONFIG } from './config.js';

export const localAdapter = {
  async load() { try { const s = localStorage.getItem(CONFIG.STORAGE_KEY); return s ? JSON.parse(s) : null; } catch (_) { return null; } },
  async save(obj) { try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(obj)); } catch (_) {} },
  async clear() { try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (_) {} },
};

/* 用記憶體當備援（瀏覽器不能存時，至少這次能玩完） */
export const memoryAdapter = (() => { let mem = null; return {
  async load() { return mem ? JSON.parse(mem) : null; },
  async save(obj) { mem = JSON.stringify(obj); },
  async clear() { mem = null; },
}; })();

let adapter = localAdapter;
export function useAdapter(a) { adapter = a; }

/* 存檔格式（版本 1）
   card: { name, signature, issuedAt }                   領卡資料：打字的名字或手寫簽名（筆畫陣列），都可為空
   impressions: [ { station, x, y, a, taps, hold, smear, press, seed, retouch, e, comment, at } ]
                                                         依實際蓋印順序；同一站可能有多次（第一次＋補蓋）
   路線 = impressions 依序取不重複的站號 */
const EMPTY = () => ({ v: 1, card: null, impressions: [] });

export const store = {
  data: EMPTY(),

  async init() {
    const d = await adapter.load();
    this.data = d && d.v === 1 ? d : EMPTY();
    return this.data;
  },
  hasCard() { return !!this.data.card; },
  get card() { return this.data.card; },
  get impressions() { return this.data.impressions; },
  route() { return [...new Set(this.data.impressions.map(i => i.station))]; },
  stationsLeft() { return 3 - this.route().length; },

  async issueCard({ name = '', signature = null, issuedAt = new Date().toISOString() } = {}) {
    this.data = { v: 1, card: { name, signature, issuedAt }, impressions: [] };
    await adapter.save(this.data);
  },
  async addImpression(imp) {
    this.data.impressions.push(imp);
    await adapter.save(this.data);
  },
  async reset() {
    this.data = EMPTY();
    await adapter.clear();
  },
};
