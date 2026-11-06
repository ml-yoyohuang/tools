const { createApp, ref, computed, onMounted, onUnmounted, watch } = Vue;

createApp({
  setup() {
    const saved = JSON.parse(localStorage.getItem('chess-clock-settings') || '{}');
    const countDownPerSec = ref(Number(saved.seconds) || 90);
    const isShowPopup = ref(false);
    const isPaused = ref(true);
    const isGameOver = ref(false);
    const activeIndex = ref(null);
    const startedAt = ref(0);
    const gameElapsed = ref(0);
    const darkMode = ref(localStorage.getItem('chess-clock-theme') !== 'light');
    const winner = ref(null);
    const finishReason = ref('TIME');
    const players = ref([
      { name: saved.black || 'Player 1', time: countDownPerSec.value * 1000, turnCount: 0 },
      { name: saved.white || 'Player 2', time: countDownPerSec.value * 1000, turnCount: 0 },
    ]);
    const presets = [{ label: '1 min', value: 60 }, { label: '3 min', value: 180 }, { label: '5 min', value: 300 }, { label: '10 min', value: 600 }];
    let frame = 0;
    let lastTick = 0;

    const isGameStarted = computed(() => activeIndex.value !== null);
    const statusText = computed(() => isGameOver.value ? `${finishReason.value} · GAME OVER` : !isGameStarted.value ? 'READY TO PLAY' : isPaused.value ? 'PAUSED' : `${players.value[activeIndex.value].name.toUpperCase()} TO MOVE`);
    const formatTime = (milliseconds) => { const total = Math.max(0, Math.ceil(milliseconds / 1000)); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
    const formatLongTime = (milliseconds) => { const total = Math.floor(milliseconds / 1000); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
    const playerClass = (index) => ({ active: activeIndex.value === index && !isPaused.value && !isGameOver.value, paused: activeIndex.value === index && isPaused.value, warning: players.value[index].time <= Math.min(countDownPerSec.value * 250, 10000) && players.value[index].time > 0, loser: isGameOver.value && players.value[index].time <= 0 });
    const canTap = (index) => isGameStarted.value && !isPaused.value && !isGameOver.value && activeIndex.value === index;
    const resultFor = (index) => isGameOver.value ? (winner.value === index ? 'WINNER' : winner.value === null ? '' : 'TIME OUT') : '';
    const persist = () => localStorage.setItem('chess-clock-settings', JSON.stringify({ seconds: countDownPerSec.value, black: players.value[0].name, white: players.value[1].name }));

    function reset() { isShowPopup.value = false; isGameOver.value = false; isPaused.value = true; activeIndex.value = null; winner.value = null; gameElapsed.value = 0; players.value.forEach((p) => { p.time = countDownPerSec.value * 1000; p.turnCount = 0; }); persist(); }
    function startGame() { if (isGameOver.value) reset(); activeIndex.value = 0; players.value[0].turnCount = 1; isPaused.value = false; startedAt.value = performance.now(); lastTick = startedAt.value; }
    function togglePause() { if (!isGameStarted.value || isGameOver.value) return; isPaused.value = !isPaused.value; lastTick = performance.now(); }
    function switchTurn(from, to) { if (!canTap(from)) return; players.value[from].time = Math.max(0, players.value[from].time); activeIndex.value = to; players.value[to].turnCount += 1; lastTick = performance.now(); }
    function surrender() { if (!isGameStarted.value || isGameOver.value) return; winner.value = activeIndex.value === 0 ? 1 : 0; finishReason.value = 'RESIGNATION'; isGameOver.value = true; isPaused.value = true; }
    function endGame(loser) { winner.value = loser === 0 ? 1 : 0; finishReason.value = 'TIME OUT'; isGameOver.value = true; isPaused.value = true; players.value[loser].time = 0; }
    function tick(now) { if (!isPaused.value && !isGameOver.value && activeIndex.value !== null) { const delta = Math.min(100, now - lastTick); players.value[activeIndex.value].time -= delta; gameElapsed.value = now - startedAt.value; if (players.value[activeIndex.value].time <= 0) endGame(activeIndex.value); } lastTick = now; frame = requestAnimationFrame(tick); }
    function openSettings() { isPaused.value = true; isShowPopup.value = true; }
    function toggleTheme() { darkMode.value = !darkMode.value; localStorage.setItem('chess-clock-theme', darkMode.value ? 'dark' : 'light'); document.documentElement.classList.toggle('light', !darkMode.value); }
    function handleKey(event) { if (event.target.matches('input')) return; if (event.code === 'Space') { event.preventDefault(); if (activeIndex.value !== null) switchTurn(activeIndex.value, activeIndex.value === 0 ? 1 : 0); else startGame(); } if (event.key.toLowerCase() === 'r') reset(); if (event.key === 'Escape') isShowPopup.value = false; }

    watch(countDownPerSec, (value) => { if (!isGameStarted.value) players.value.forEach((p) => { p.time = Math.max(10, Number(value) || 90) * 1000; }); });
    onMounted(() => { document.documentElement.classList.toggle('light', !darkMode.value); window.addEventListener('keydown', handleKey); frame = requestAnimationFrame(tick); });
    onUnmounted(() => { cancelAnimationFrame(frame); window.removeEventListener('keydown', handleKey); });
    return { countDownPerSec, isShowPopup, isPaused, isGameOver, activeIndex, darkMode, players, presets, gameElapsed, isGameStarted, statusText, formatTime, formatLongTime, playerClass, canTap, resultFor, reset, startGame, togglePause, switchTurn, surrender, openSettings, toggleTheme };
  },
}).mount('#app');

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('./sw.js').catch(() => {});
