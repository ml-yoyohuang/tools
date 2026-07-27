import type { UserProgress } from '@/db/db'

export const SRS_INTERVAL_DAYS = [1, 2, 4, 7, 15, 30]

export function isDueForReview(progress: UserProgress, now: Date = new Date()): boolean {
  if (!progress.lastAnsweredAt) return false
  const intervalIndex = Math.min(progress.correctStreak, SRS_INTERVAL_DAYS.length - 1)
  const interval = SRS_INTERVAL_DAYS[intervalIndex]
  const elapsedDays = Math.floor((now.getTime() - new Date(progress.lastAnsweredAt).getTime()) / 86_400_000)
  return elapsedDays >= interval
}

export type RiskLevel = 'none' | 'yellow' | 'red'

export function riskLevel(wrongCount: number): RiskLevel {
  if (wrongCount >= 3) return 'red'
  if (wrongCount >= 1) return 'yellow'
  return 'none'
}
