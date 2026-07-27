<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore, type WrongQuestionEntry } from '@/stores/useQuizStore'
import RiskBadge from '@/components/RiskBadge.vue'
import type { Question } from '@/types/question'

const quiz = useQuizStore()
const router = useRouter()

type TabKey = 'all' | 'red' | 'yellow' | 'bookmark' | 'uncertain' | 'note'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部錯題' },
  { key: 'red', label: '🔴 高危' },
  { key: 'yellow', label: '🟡 需注意' },
  { key: 'bookmark', label: '⭐ 收藏' },
  { key: 'uncertain', label: '🤔 不確定' },
  { key: 'note', label: '📝 筆記' },
]

const activeTab = ref<TabKey>('all')

const wrongEntries = computed<WrongQuestionEntry[]>(() => {
  if (activeTab.value === 'red') return quiz.wrongQuestions.filter((w) => w.risk === 'red')
  if (activeTab.value === 'yellow') return quiz.wrongQuestions.filter((w) => w.risk === 'yellow')
  if (activeTab.value === 'all') return quiz.wrongQuestions
  return []
})

const plainQuestions = computed<Question[]>(() => {
  if (activeTab.value === 'bookmark') return quiz.bookmarkedQuestions
  if (activeTab.value === 'uncertain') return quiz.uncertainQuestions
  if (activeTab.value === 'note') return quiz.notedQuestions
  return []
})

const isEmpty = computed(() => wrongEntries.value.length === 0 && plainQuestions.value.length === 0)

function startRetest() {
  if (activeTab.value === 'bookmark') router.push({ path: '/quiz', query: { mode: 'bookmark' } })
  else if (activeTab.value === 'uncertain') router.push({ path: '/quiz', query: { mode: 'uncertain' } })
  else if (activeTab.value === 'note') router.push({ path: '/quiz', query: { mode: 'note' } })
  else if (activeTab.value === 'red') router.push({ path: '/quiz', query: { mode: 'wrong', risk: 'red' } })
  else if (activeTab.value === 'yellow') router.push({ path: '/quiz', query: { mode: 'wrong', risk: 'yellow' } })
  else router.push({ path: '/quiz', query: { mode: 'wrong' } })
}
</script>

<template>
  <main class="min-h-dvh bg-gray-50 p-4 pb-8 dark:bg-gray-950">
    <header class="mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">錯題／收藏</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">連續答對 2 次即消除錯題標籤</p>
    </header>

    <div class="mb-4 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium"
        :class="
          activeTab === tab.key
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-600 dark:bg-gray-900 dark:text-gray-300'
        "
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="isEmpty" class="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      這裡目前沒有題目。
    </div>

    <template v-else>
      <button class="mb-3 w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white" @click="startRetest">
        開始重測（{{ wrongEntries.length || plainQuestions.length }} 題）
      </button>

      <ul class="space-y-2">
        <li
          v-for="entry in wrongEntries"
          :key="entry.question.id"
          class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ entry.question.subCategory }}</span>
            <RiskBadge :risk="entry.risk" />
          </div>
          <p class="mt-1 line-clamp-2 text-sm text-gray-800 dark:text-gray-100">{{ entry.question.question }}</p>
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            答錯 {{ entry.progress.wrongCount }} 次・連續答對 {{ entry.progress.correctStreak }} 次
          </p>
        </li>

        <li
          v-for="q in plainQuestions"
          :key="q.id"
          class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
        >
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ q.subCategory }}</span>
          <p class="mt-1 line-clamp-2 text-sm text-gray-800 dark:text-gray-100">{{ q.question }}</p>
          <p
            v-if="activeTab === 'note'"
            class="mt-1 line-clamp-2 text-xs italic text-emerald-600 dark:text-emerald-400"
          >
            📝 {{ quiz.getProgress(q.id).userNotes }}
          </p>
        </li>
      </ul>
    </template>
  </main>
</template>
