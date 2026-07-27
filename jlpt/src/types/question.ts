export type QuestionCategory = 'vocabulary' | 'grammar' | 'reading'

export interface QuestionExplanation {
  translation: string
  detail: string
  keyPoint: string
}

export interface Question {
  id: string
  category: QuestionCategory
  subCategory: string
  readingText: string | null
  question: string
  options: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  explanation: QuestionExplanation
}
