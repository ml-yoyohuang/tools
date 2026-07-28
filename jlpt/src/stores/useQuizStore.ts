import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import db, { createDefaultProgress, type UserProgress } from '@/db/db'
import type { Question, QuestionCategory } from '@/types/question'
import { todayKey } from '@/utils/date'
import { isDueForReview, riskLevel, type RiskLevel } from '@/utils/srs'

export interface WrongQuestionEntry {
  question: Question
  progress: UserProgress
  risk: RiskLevel
}

export const useQuizStore = defineStore('quiz', () => {
  const questions = ref<Question[]>([])
  const progressMap = ref<Record<string, UserProgress>>({})
  const todayDate = ref('')
  const todayCompletedCount = ref(0)
  const initialized = ref(false)

  async function init() {
    if (initialized.value) return

    const response = await fetch(`${import.meta.env.BASE_URL}data/n1-questions.json`)
    const seedQuestions: Question[] = await response.json()

    await db.questions.bulkPut(seedQuestions)
    questions.value = await db.questions.toArray()

    const progressRows = await db.user_progress.toArray()
    const map: Record<string, UserProgress> = {}
    for (const row of progressRows) map[row.questionId] = row
    for (const q of questions.value) {
      if (!map[q.id]) map[q.id] = createDefaultProgress(q.id)
    }
    progressMap.value = map

    const today = todayKey()
    const stat = await db.daily_stats.get(today)
    todayDate.value = today
    todayCompletedCount.value = stat?.completedCount ?? 0

    initialized.value = true
  }

  function getProgress(questionId: string): UserProgress {
    return progressMap.value[questionId] ?? createDefaultProgress(questionId)
  }

  const totalCount = computed(() => questions.value.length)

  const masteredCount = computed(
    () => questions.value.filter((q) => getProgress(q.id).correctStreak >= 2).length,
  )

  const masteryRate = computed(() =>
    totalCount.value === 0 ? 0 : Math.round((masteredCount.value / totalCount.value) * 1000) / 10,
  )

  function masteryRateOf(category: QuestionCategory): number {
    const inCategory = questions.value.filter((q) => q.category === category)
    if (inCategory.length === 0) return 0
    const mastered = inCategory.filter((q) => getProgress(q.id).correctStreak >= 2).length
    return Math.round((mastered / inCategory.length) * 1000) / 10
  }

  const masteryByCategory = computed(() => ({
    vocabulary: masteryRateOf('vocabulary'),
    grammar: masteryRateOf('grammar'),
    reading: masteryRateOf('reading'),
  }))

  const unmasteredQuestions = computed(() =>
    questions.value.filter((q) => getProgress(q.id).correctStreak < 2),
  )

  const newQuestions = computed(() =>
    questions.value.filter((q) => !getProgress(q.id).lastAnsweredAt),
  )

  const dueReviewQuestions = computed(() =>
    questions.value.filter((q) => {
      const p = getProgress(q.id)
      return p.lastAnsweredAt !== '' && isDueForReview(p)
    }),
  )

  /** 錯題清單：wrongCount > 0 且尚未達到 correctStreak >= 2 的消除門檻 */
  const wrongQuestions = computed<WrongQuestionEntry[]>(() =>
    questions.value
      .filter((q) => {
        const p = getProgress(q.id)
        return p.wrongCount > 0 && p.correctStreak < 2
      })
      .map((q) => {
        const progress = getProgress(q.id)
        return { question: q, progress, risk: riskLevel(progress.wrongCount) }
      })
      .sort((a, b) => b.progress.wrongCount - a.progress.wrongCount),
  )

  const highRiskWrongQuestions = computed(() =>
    wrongQuestions.value.filter((w) => w.risk === 'red'),
  )

  const bookmarkedQuestions = computed(() =>
    questions.value.filter((q) => getProgress(q.id).isBookmarked),
  )

  const uncertainQuestions = computed(() =>
    questions.value.filter((q) => getProgress(q.id).isUncertain),
  )

  const notedQuestions = computed(() =>
    questions.value.filter((q) => !!getProgress(q.id).userNotes?.trim()),
  )

  function ensureToday() {
    const today = todayKey()
    if (todayDate.value !== today) {
      todayDate.value = today
      todayCompletedCount.value = 0
    }
  }

  async function persistProgress(updated: UserProgress) {
    progressMap.value = { ...progressMap.value, [updated.questionId]: updated }
    await db.user_progress.put(updated)
  }

  async function answerQuestion(questionId: string, isCorrect: boolean) {
    ensureToday()
    const current = getProgress(questionId)
    const updated: UserProgress = {
      ...current,
      wrongCount: isCorrect ? current.wrongCount : current.wrongCount + 1,
      correctStreak: isCorrect ? current.correctStreak + 1 : 0,
      lastAnsweredAt: new Date().toISOString(),
    }
    await persistProgress(updated)

    todayCompletedCount.value += 1
    await db.daily_stats.put({ date: todayDate.value, completedCount: todayCompletedCount.value })
  }

  async function toggleBookmark(questionId: string) {
    const current = getProgress(questionId)
    await persistProgress({ ...current, isBookmarked: !current.isBookmarked })
  }

  async function toggleUncertain(questionId: string) {
    const current = getProgress(questionId)
    await persistProgress({ ...current, isUncertain: !current.isUncertain })
  }

  async function setNote(questionId: string, note: string) {
    const current = getProgress(questionId)
    await persistProgress({ ...current, userNotes: note })
  }

  return {
    questions,
    progressMap,
    todayDate,
    todayCompletedCount,
    initialized,
    init,
    getProgress,
    answerQuestion,
    toggleBookmark,
    toggleUncertain,
    setNote,
    totalCount,
    masteredCount,
    masteryRate,
    masteryByCategory,
    unmasteredQuestions,
    newQuestions,
    dueReviewQuestions,
    wrongQuestions,
    highRiskWrongQuestions,
    bookmarkedQuestions,
    uncertainQuestions,
    notedQuestions,
  }
})
