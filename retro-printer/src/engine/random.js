// 成品計算用的亂數來源。預設 Math.random，每次印出都不同；
// 測試時可換成固定種子，讓結果可重現。
let source = Math.random;

export const random = () => source();

export function setRandom(fn) {
  source = fn || Math.random;
}

// mulberry32：簡單、快速的可重現亂數
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
