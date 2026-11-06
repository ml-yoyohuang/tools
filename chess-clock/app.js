const { createApp, ref, computed, onMounted, onUnmounted, watch } = Vue;

createApp({
  setup() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('chess-clock-settings') || '{}') || {}; } catch (_) { saved = {}; }
    const countDownPerSec = ref(Math.min(86400, Math.max(10, Number(saved.seconds) || 90)));
    const isShowPopup = ref(false);
    const isPaused = ref(true);
    const isGameOver = ref(false);
    const activeIndex = ref(null);
    const gameElapsed = ref(0);
    const darkMode = ref(localStorage.getItem('chess-clock-theme') !== 'light');
    const winner = ref(null);
    const finishReason = ref('TIME OUT');
    const players = ref([
      { name: saved.black || 'Player 1', time: countDownPerSec.value * 1000, turnCount: 0 },
      { name: saved.white || 'Player 2', time: countDownPerSec.value * 1000, turnCount: 0 },
    ]);
    const presets = [{ label: '1 min', value: 60 }, { label: '3 min', value: 180 }, { label: '5 min', value: 300 }, { label: '10 min', value: 600 }];

    // Animation frames only repaint the UI. Timing uses monotonic timestamps so
    // dropped/throttled frames never become lost seconds.
    let frame = 0;
    let turnStartedAt = null;
    let turnTimeAtStart = 0;
    let gameSegmentStartedAt = null;
    let gameElapsedAtSegmentStart = 0;

    const isGameStarted = computed(() => activeIndex.value !== null);
    const statusText = computed(() => isGameOver.value ? `${finishReason.value} · GAME OVER` : !isGameStarted.value ? 'READY TO PLAY' : isPaused.value ? 'PAUSED' : `${players.value[activeIndex.value].name.toUpperCase()} TO MOVE`);
    const formatTime = (milliseconds) => { const total = Math.max(0, Math.ceil(milliseconds / 1000)); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
    const formatLongTime = (milliseconds) => { const total = Math.max(0, Math.floor(milliseconds / 1000)); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
    const safeSeconds = () => Math.min(86400, Math.max(10, Number(countDownPerSec.value) || 90));
    const playerClass = (index) => ({ active: activeIndex.value === index && !isPaused.value && !isGameOver.value, paused: activeIndex.value === index && isPaused.value, warning: players.value[index].time <= Math.min(10000, safeSeconds() * 1000 * 0.25) && players.value[index].time > 0, loser: isGameOver.value && players.value[index].time <= 0 });
    const canTap = (index) => isGameStarted.value && !isPaused.value && !isGameOver.value && activeIndex.value === index;
    const resultFor = (index) => isGameOver.value ? (winner.value === index ? 'WINNER' : winner.value === null ? '' : 'TIME OUT') : '';
    const persist = () => localStorage.setItem('chess-clock-settings', JSON.stringify({ seconds: countDownPerSec.value, black: players.value[0].name, white: players.value[1].name }));
    const now = () => performance.now();

    function syncClock(timestamp = now()) {
      if (isPaused.value || isGameOver.value || activeIndex.value === null || turnStartedAt === null) return;
      const turnRemaining = Math.max(0, turnTimeAtStart - (timestamp - turnStartedAt));
      players.value[activeIndex.value].time = turnRemaining;
      if (gameSegmentStartedAt !== null) gameElapsed.value = gameElapsedAtSegmentStart + (timestamp - gameSegmentStartedAt);
      if (turnRemaining <= 0) endGame(activeIndex.value);
    }

    function reset() {
      isShowPopup.value = false;
      isGameOver.value = false;
      isPaused.value = true;
      activeIndex.value = null;
      winner.value = null;
      finishReason.value = 'TIME OUT';
      gameElapsed.value = 0;
      turnStartedAt = null;
      gameSegmentStartedAt = null;
      gameElapsedAtSegmentStart = 0;
      countDownPerSec.value = safeSeconds();
      players.value.forEach((player) => { player.time = safeSeconds() * 1000; player.turnCount = 0; });
      persist();
    }

    function startGame() {
      reset();
      const timestamp = now();
      activeIndex.value = 0;
      players.value[0].turnCount = 1;
      isPaused.value = false;
      turnTimeAtStart = players.value[0].time;
      turnStartedAt = timestamp;
      gameElapsedAtSegmentStart = 0;
      gameSegmentStartedAt = timestamp;
    }

    function pauseGame() {
      if (!isGameStarted.value || isPaused.value || isGameOver.value) return;
      const timestamp = now();
      syncClock(timestamp);
      isPaused.value = true;
      turnStartedAt = null;
      gameElapsedAtSegmentStart = gameElapsed.value;
      gameSegmentStartedAt = null;
    }

    function togglePause() {
      if (!isGameStarted.value || isGameOver.value) return;
      if (!isPaused.value) { pauseGame(); return; }
      const timestamp = now();
      isPaused.value = false;
      turnTimeAtStart = players.value[activeIndex.value].time;
      turnStartedAt = timestamp;
      gameSegmentStartedAt = timestamp;
      gameElapsedAtSegmentStart = gameElapsed.value;
    }

    function switchTurn(from, to) {
      if (!canTap(from)) return;
      const timestamp = now();
      syncClock(timestamp);
      if (isGameOver.value) return;
      activeIndex.value = to;
      players.value[to].turnCount += 1;
      turnTimeAtStart = players.value[to].time;
      turnStartedAt = timestamp;
    }

    function surrender() {
      if (!isGameStarted.value || isGameOver.value) return;
      syncClock();
      if (isGameOver.value) return;
      winner.value = activeIndex.value === 0 ? 1 : 0;
      finishReason.value = 'RESIGNATION';
      isGameOver.value = true;
      isPaused.value = true;
      turnStartedAt = null;
      gameSegmentStartedAt = null;
    }

    function endGame(loser) {
      winner.value = loser === 0 ? 1 : 0;
      finishReason.value = 'TIME OUT';
      players.value[loser].time = 0;
      isGameOver.value = true;
      isPaused.value = true;
      turnStartedAt = null;
      gameSegmentStartedAt = null;
    }

    function render(timestamp) { syncClock(timestamp); frame = requestAnimationFrame(render); }
    function openSettings() { pauseGame(); isShowPopup.value = true; }
    function toggleTheme() { darkMode.value = !darkMode.value; localStorage.setItem('chess-clock-theme', darkMode.value ? 'dark' : 'light'); document.documentElement.classList.toggle('light', !darkMode.value); }

    function handleKey(event) {
      if (event.target.matches('input') || isShowPopup.value) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (isGameStarted.value && !isPaused.value) switchTurn(activeIndex.value, activeIndex.value === 0 ? 1 : 0);
        else if (isGameStarted.value) togglePause();
        else startGame();
      }
      if (event.key.toLowerCase() === 'r') reset();
      if (event.key === 'Escape') isShowPopup.value = false;
    }

    watch(countDownPerSec, () => { if (!isGameStarted.value) players.value.forEach((player) => { player.time = safeSeconds() * 1000; }); });
    watch(() => [countDownPerSec.value, players.value[0].name, players.value[1].name], persist);
    onMounted(() => {
      document.documentElement.classList.toggle('light', !darkMode.value);
      window.addEventListener('keydown', handleKey);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      frame = requestAnimationFrame(render);
    });
    function handleVisibilityChange() { if (!document.hidden) syncClock(); }
    onUnmounted(() => { cancelAnimationFrame(frame); window.removeEventListener('keydown', handleKey); document.removeEventListener('visibilitychange', handleVisibilityChange); });
    return { countDownPerSec, isShowPopup, isPaused, isGameOver, activeIndex, darkMode, players, presets, gameElapsed, isGameStarted, statusText, formatTime, formatLongTime, playerClass, canTap, resultFor, reset, startGame, togglePause, switchTurn, surrender, openSettings, toggleTheme };
  },
}).mount('#app');

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('./sw.js').catch(() => {});
