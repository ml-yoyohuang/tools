import { ref, watch } from 'vue'

const STORAGE_KEY = 'n1-passmaster-theme'

const isDark = ref(false)
let bootstrapped = false

function applyClass() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

function bootstrap() {
  if (bootstrapped) return
  bootstrapped = true
  const stored = localStorage.getItem(STORAGE_KEY)
  isDark.value = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  applyClass()
  watch(isDark, () => {
    applyClass()
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  })
}

export function useDarkMode() {
  bootstrap()
  function toggle() {
    isDark.value = !isDark.value
  }
  return { isDark, toggle }
}
