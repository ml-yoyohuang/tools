<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/useQuizStore'
import { useSchedulerStore } from '@/stores/useSchedulerStore'
import QuizCard from '@/components/quiz/QuizCard.vue'
import CategoryMasteryList from '@/components/CategoryMasteryList.vue'
import type { Question, QuestionCategory } from '@/types/question'

const route = useRoute()
const router = useRouter()
const quiz = useQuizStore()
const scheduler = useSchedulerStore()

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const mode = computed(() => (route.query.mode as string) ?? 'daily')
const riskFilter = computed(() => route.query.risk as string | undefined)
const isTimedMode = computed(() => mode.value === 'mock')

const queue = ref<Question[]>([])

onMounted(async () => {
  await quiz.init()
  await scheduler.init()
  queue.value = buildQueue()
  if (isTimedMode.value && queue.value.length > 0) startTimer()
})

onUnmounted(() => {
  stopTimer()
})

function buildQueue(): Question[] {
  switch (mode.value) {
    case 'daily':
      return scheduler.todayQuestionPool
    case 'mock':
      return quiz.wrongQuestions.map((w) => w.question)
    case 'micro':
      return shuffle(quiz.questions).slice(0, 10)
    case 'wrong':
      return quiz.wrongQuestions
        .filter((w) => !riskFilter.value || w.risk === riskFilter.value)
        .map((w) => w.question)
    case 'bookmark':
      return quiz.bookmarkedQuestions
    case 'uncertain':
      return quiz.uncertainQuestions
    case 'note':
      return quiz.notedQuestions
    default:
      return []
  }
}

const currentIndex = ref(0)
const sessionStats = ref({ correct: 0, wrong: 0 })
const sessionAnswers = ref<{ question: Question; isCorrect: boolean }[]>([])

const currentQuestion = computed(() => queue.value[currentIndex.value] ?? null)
const finished = computed(() => queue.value.length > 0 && currentIndex.value >= queue.value.length)

watch(finished, (isFinished) => {
  if (isFinished) stopTimer()
})

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  vocabulary: '文字・語彙',
  grammar: '文法',
  reading: '讀解／長句',
}

const categoryBreakdown = computed(() => {
  const groups: Partial<Record<QuestionCategory, { correct: number; total: number }>> = {}
  for (const a of sessionAnswers.value) {
    const g = (groups[a.question.category] ??= { correct: 0, total: 0 })
    g.total += 1
    if (a.isCorrect) g.correct += 1
  }
  return Object.entries(groups).map(([category, g]) => ({
    label: CATEGORY_LABELS[category as QuestionCategory],
    percent: g!.total === 0 ? 0 : Math.round((g!.correct / g!.total) * 1000) / 10,
  }))
})

const missedEntries = computed(() => sessionAnswers.value.filter((a) => !a.isCorrect))

function handleAnswer(isCorrect: boolean) {
  if (!currentQuestion.value) return
  quiz.answerQuestion(currentQuestion.value.id, isCorrect)
  sessionAnswers.value.push({ question: currentQuestion.value, isCorrect })
  if (isCorrect) sessionStats.value.correct += 1
  else sessionStats.value.wrong += 1
}

function next() {
  currentIndex.value += 1
}

function toggleBookmark() {
  if (currentQuestion.value) quiz.toggleBookmark(currentQuestion.value.id)
}

function toggleUncertain() {
  if (currentQuestion.value) quiz.toggleUncertain(currentQuestion.value.id)
}

function updateNote(note: string) {
  if (currentQuestion.value) quiz.setNote(currentQuestion.value.id, note)
}

// --- 考前密集模式：倒數計時測驗 ---
const SECONDS_PER_QUESTION = 90
const remainingSeconds = ref(0)
let timerHandle: ReturnType<typeof setInterval> | null = null

function startTimer() {
  remainingSeconds.value = queue.value.length * SECONDS_PER_QUESTION
  timerHandle = setInterval(() => {
    remainingSeconds.value -= 1
    if (remainingSeconds.value <= 0) {
      remainingSeconds.value = 0
      currentIndex.value = queue.value.length
      stopTimer()
    }
  }, 1000)
}

function stopTimer() {
  if (timerHandle) {
    clearInterval(timerHandle)
    timerHandle = null
  }
}

const formattedTime = computed(() => {
  const m = Math.floor(remainingSeconds.value / 60)
  const s = remainingSeconds.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const isTimeRunningOut = computed(
  () => isTimedMode.value && queue.value.length > 0 && remainingSeconds.value < (queue.value.length * SECONDS_PER_QUESTION) / 5,
)

const modeTitle: Record<string, string> = {
  daily: '今日排程',
  mock: '模擬考測驗',
  micro: '3 分鐘快刷',
  wrong: '錯題重測',
  bookmark: '收藏重測',
  uncertain: '不確定題重測',
  note: '筆記題重測',
}
</script>

<template>
  <main class="min-h-dvh bg-gray-50 p-4 pb-8 dark:bg-gray-950">
    <header class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">
        {{ modeTitle[mode] ?? '練習' }}
      </h1>
      <div class="flex items-center gap-3">
        <span
          v-if="isTimedMode && queue.length > 0 && !finished"
          class="rounded-full px-2 py-0.5 text-sm font-medium tabular-nums"
          :class="
            isTimeRunningOut
              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          "
        >
          ⏱ {{ formattedTime }}
        </span>
        <span v-if="queue.length > 0" class="text-sm text-gray-500 dark:text-gray-400">
          {{ Math.min(currentIndex + 1, queue.length) }} / {{ queue.length }}
        </span>
      </div>
    </header>

    <div v-if="queue.length === 0" class="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      目前沒有符合條件的題目。
      <button class="mt-3 block w-full rounded-lg bg-blue-600 py-2 font-medium text-white" @click="router.push('/')">
        回首頁
      </button>
    </div>

    <div v-else-if="finished" class="space-y-4">
      <div class="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {{ remainingSeconds <= 0 && isTimedMode ? '時間到！' : '練習完成！' }}
        </p>
        <p class="mt-2 text-gray-500 dark:text-gray-400">
          答對 {{ sessionStats.correct }} 題・答錯 {{ sessionStats.wrong }} 題
        </p>
      </div>

      <div
        v-if="categoryBreakdown.length > 0"
        class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">弱點分析</h2>
        <CategoryMasteryList :items="categoryBreakdown" />
      </div>

      <div
        v-if="missedEntries.length > 0"
        class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">本次答錯的考點</h2>
        <ul class="space-y-1">
          <li
            v-for="(entry, i) in missedEntries"
            :key="i"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            ・{{ entry.question.subCategory }}
          </li>
        </ul>
        <button
          class="mt-3 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
          @click="router.push('/bookmarks')"
        >
          前往錯題本複習
        </button>
      </div>

      <button class="w-full rounded-lg bg-blue-600 py-2 font-medium text-white" @click="router.push('/')">
        回首頁
      </button>
    </div>

    <QuizCard
      v-else-if="currentQuestion"
      :key="currentQuestion.id"
      :question="currentQuestion"
      :is-bookmarked="quiz.getProgress(currentQuestion.id).isBookmarked"
      :is-uncertain="quiz.getProgress(currentQuestion.id).isUncertain"
      :note="quiz.getProgress(currentQuestion.id).userNotes ?? ''"
      @answer="handleAnswer"
      @next="next"
      @toggle-bookmark="toggleBookmark"
      @toggle-uncertain="toggleUncertain"
      @update-note="updateNote"
    />
  </main>
</template>
