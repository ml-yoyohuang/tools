import Dexie, { type EntityTable } from 'dexie'
import type { Question } from '@/types/question'

export interface UserProgress {
  questionId: string
  isBookmarked: boolean
  isUncertain: boolean
  wrongCount: number
  correctStreak: number
  lastAnsweredAt: string
  userNotes?: string
}

export interface ExamConfig {
  key: string
  targetExamDate: string
}

export interface DailyStats {
  date: string
  completedCount: number
}

const db = new Dexie('N1PassMasterDB') as Dexie & {
  questions: EntityTable<Question, 'id'>
  user_progress: EntityTable<UserProgress, 'questionId'>
  exam_config: EntityTable<ExamConfig, 'key'>
  daily_stats: EntityTable<DailyStats, 'date'>
}

db.version(1).stores({
  questions: 'id, category, subCategory',
  user_progress: 'questionId, isBookmarked, isUncertain, wrongCount, correctStreak, lastAnsweredAt',
  exam_config: 'key',
  daily_stats: 'date',
})

export function createDefaultProgress(questionId: string): UserProgress {
  return {
    questionId,
    isBookmarked: false,
    isUncertain: false,
    wrongCount: 0,
    correctStreak: 0,
    lastAnsweredAt: '',
  }
}

export default db
