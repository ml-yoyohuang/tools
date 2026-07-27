<script setup lang="ts">
import { Home, BookOpenCheck, Bookmark, Sun, Moon } from 'lucide-vue-next'
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark, toggle } = useDarkMode()

const links = [
  { to: '/', label: '首頁', icon: Home },
  { to: '/quiz', label: '練習', icon: BookOpenCheck },
  { to: '/bookmarks', label: '錯題', icon: Bookmark },
]
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-20 flex items-center border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-gray-800 dark:bg-gray-950/95"
  >
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-gray-500 dark:text-gray-400"
      active-class="text-blue-600 dark:text-cyan-400"
    >
      <component :is="link.icon" :size="20" />
      {{ link.label }}
    </RouterLink>
    <button
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-gray-500 dark:text-gray-400"
      @click="toggle"
    >
      <component :is="isDark ? Sun : Moon" :size="20" />
      {{ isDark ? '淺色' : '深色' }}
    </button>
  </nav>
</template>
