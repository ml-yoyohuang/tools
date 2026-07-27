<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { Zap } from 'lucide-vue-next'
import { useQuizStore } from '@/stores/useQuizStore'
import { useSchedulerStore } from '@/stores/useSchedulerStore'
import DualProgressBar from '@/components/DualProgressBar.vue'
import CategoryMasteryList from '@/components/CategoryMasteryList.vue'

const quiz = useQuizStore()
const scheduler = useSchedulerStore()
const router = useRouter()

const examDateInput = ref('')
const showDateEditor = ref(false)
watchEffect(() => {
  if (scheduler.targetExamDate) examDateInput.value = scheduler.targetExamDate
})

function submitExamDate() {
  if (examDateInput.value) {
    scheduler.setTargetExamDate(examDateInput.value)
    showDateEditor.value = false
  }
}

const phaseInfo = computed(() => {
  switch (scheduler.phase) {
    case 'foundation':
      return { label: '溫和打底期', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' }
    case 'sprint':
      return { label: '衝刺強化期', class: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' }
    case 'rescue':
      return { label: '考前急救期', class: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' }
    default:
      return { label: '尚未設定', class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' }
  }
})

const categoryItems = computed(() => [
  { label: '文字・語彙', percent: quiz.masteryByCategory.vocabulary },
  { label: '文法', percent: quiz.masteryByCategory.grammar },
  { label: '讀解／長句', percent: quiz.masteryByCategory.reading },
])

function startDailySchedule() {
  router.push({ path: '/quiz', query: { mode: scheduler.isMockExamMode ? 'mock' : 'daily' } })
}

function startMicroLearning() {
  router.push({ path: '/quiz', query: { mode: 'micro' } })
}
</script>

<template>
  <main class="min-h-dvh bg-gray-50 p-4 pb-8 dark:bg-gray-950">
    <header class="mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">N1 PassMaster</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">掌握真實進度，備戰 JLPT N1</p>
    </header>

    <section class="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div v-if="scheduler.phase === 'not-set'">
        <p class="mb-2 text-sm text-gray-600 dark:text-gray-300">設定你的 JLPT N1 目標考試日期，開始動態排程。</p>
        <div class="flex gap-2">
          <input
            v-model="examDateInput"
            type="date"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" @click="submitExamDate">
            設定
          </button>
        </div>
      </div>
      <div v-else>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">距離考試剩餘</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ scheduler.remainingDays }} 天</p>
          </div>
          <span class="rounded-full px-3 py-1 text-sm font-medium" :class="phaseInfo.class">
            {{ phaseInfo.label }}
          </span>
        </div>
        <button class="mt-3 text-xs text-gray-400 underline dark:text-gray-500" @click="showDateEditor = !showDateEditor">
          更改考試日期
        </button>
        <div v-if="showDateEditor" class="mt-2 flex gap-2">
          <input
            v-model="examDateInput"
            type="date"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" @click="submitExamDate">
            更新
          </button>
        </div>
      </div>
    </section>

    <section class="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <DualProgressBar
        micro-label="今日排程進度"
        :micro-percent="scheduler.microProgressPercent"
        macro-label="真實掌握度"
        :macro-percent="quiz.masteryRate"
      />
      <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
        今日 {{ quiz.todayCompletedCount }} / {{ scheduler.dailyTargetCount }} 題・已掌握 {{ quiz.masteredCount }} / {{ quiz.totalCount }} 題
      </p>
    </section>

    <section class="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">分類掌握度</h2>
      <CategoryMasteryList :items="categoryItems" />
    </section>

    <section class="grid grid-cols-1 gap-3">
      <button
        class="rounded-xl bg-blue-600 p-4 text-left font-medium text-white shadow-sm"
        @click="startDailySchedule"
      >
        {{ scheduler.isMockExamMode ? '📝 開始模擬考測驗' : '▶ 開始今日排程' }}
        <span class="block text-xs font-normal opacity-80">目標 {{ scheduler.dailyTargetCount }} 題</span>
      </button>
      <button
        class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-left font-medium text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        @click="startMicroLearning"
      >
        <Zap :size="18" class="text-amber-500" />
        3 分鐘隨機 10 題快刷
      </button>
    </section>
  </main>
</template>
