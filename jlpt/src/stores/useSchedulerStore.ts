import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import db from '@/db/db'
import { useQuizStore } from '@/stores/useQuizStore'
import { todayKey, daysBetween } from '@/utils/date'
import type { Question } from '@/types/question'

const EXAM_CONFIG_KEY = 'targetExamDate'
const DAILY_NEW_COUNT_FOUNDATION = 15

/**
 * foundation: 溫和打底期 (剩餘天數 > 60)
 * sprint: 衝刺強化期 (30 <= 剩餘天數 <= 60)
 * rescue: 考前急救期 (剩餘天數 < 30)
 */
export type SchedulerPhase = 'not-set' | 'foundation' | 'sprint' | 'rescue'

export const useSchedulerStore = defineStore('scheduler', () => {
  const quizStore = useQuizStore()

  const targetExamDate = ref('')
  const initialized = ref(false)

  async function init() {
    if (initialized.value) return
    const row = await db.exam_config.get(EXAM_CONFIG_KEY)
    targetExamDate.value = row?.targetExamDate ?? ''
    initialized.value = true
  }

  async function setTargetExamDate(dateKey: string) {
    targetExamDate.value = dateKey
    await db.exam_config.put({ key: EXAM_CONFIG_KEY, targetExamDate: dateKey })
  }

  const remainingDays = computed<number | null>(() =>
    targetExamDate.value ? daysBetween(todayKey(), targetExamDate.value) : null,
  )

  const phase = computed<SchedulerPhase>(() => {
    const days = remainingDays.value
    if (days === null) return 'not-set'
    if (days > 60) return 'foundation'
    if (days >= 30) return 'sprint'
    return 'rescue'
  })

  const dailyNewCount = computed(() =>
    phase.value === 'foundation'
      ? Math.min(DAILY_NEW_COUNT_FOUNDATION, quizStore.newQuestions.length)
      : 0,
  )

  const dailyReviewCount = computed(() =>
    phase.value === 'foundation' ? quizStore.dueReviewQuestions.length : 0,
  )

  /** 今日動態排程目標題數，作為微觀進度條的分母 */
  const dailyTargetCount = computed(() => {
    const days = remainingDays.value
    switch (phase.value) {
      case 'foundation':
        return dailyNewCount.value + dailyReviewCount.value
      case 'sprint': {
        if (!days || days <= 0) return 0
        const pool = quizStore.unmasteredQuestions.length + quizStore.highRiskWrongQuestions.length
        return Math.ceil(pool / days)
      }
      case 'rescue':
        return quizStore.wrongQuestions.length
      default:
        return 0
    }
  })

  /** 今日應派發的題目池，依三階段邏輯決定內容 */
  const todayQuestionPool = computed<Question[]>(() => {
    switch (phase.value) {
      case 'foundation':
        return [
          ...quizStore.newQuestions.slice(0, dailyNewCount.value),
          ...quizStore.dueReviewQuestions,
        ]
      case 'sprint':
        return [...quizStore.unmasteredQuestions].sort(
          (a, b) => quizStore.getProgress(b.id).wrongCount - quizStore.getProgress(a.id).wrongCount,
        )
      case 'rescue':
        return quizStore.wrongQuestions.map((w) => w.question)
      default:
        return []
    }
  })

  const isMockExamMode = computed(() => phase.value === 'rescue')

  /** 微觀進度（今日排程進度）：今日已完成題數 / 今日動態排程目標題數 */
  const microProgressPercent = computed(() => {
    if (dailyTargetCount.value === 0) return 0
    return Math.min(
      100,
      Math.round((quizStore.todayCompletedCount / dailyTargetCount.value) * 1000) / 10,
    )
  })

  return {
    targetExamDate,
    initialized,
    init,
    setTargetExamDate,
    remainingDays,
    phase,
    dailyNewCount,
    dailyReviewCount,
    dailyTargetCount,
    todayQuestionPool,
    isMockExamMode,
    microProgressPercent,
  }
})
