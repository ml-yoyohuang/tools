<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Volume2, Star, HelpCircle, NotebookPen } from 'lucide-vue-next'
import type { Question } from '@/types/question'

const props = defineProps<{
  question: Question
  isBookmarked: boolean
  isUncertain: boolean
  note: string
}>()

const emit = defineEmits<{
  answer: [isCorrect: boolean]
  next: []
  'toggle-bookmark': []
  'toggle-uncertain': []
  'update-note': [note: string]
}>()

const selected = ref<number | null>(null)
const revealed = computed(() => selected.value !== null)
const showNotes = ref(false)
const noteDraft = ref(props.note)

watch(
  () => props.question.id,
  () => {
    selected.value = null
    showNotes.value = false
    noteDraft.value = props.note
  },
)

watch(
  () => props.note,
  (value) => {
    noteDraft.value = value
  },
)

function saveNote() {
  if (noteDraft.value !== props.note) emit('update-note', noteDraft.value)
}

function goNext() {
  saveNote()
  emit('next')
}

function selectOption(i: number) {
  if (revealed.value) return
  selected.value = i
  emit('answer', i === props.question.answer)
}

function optionClass(i: number) {
  if (!revealed.value) {
    return 'border-gray-200 hover:border-blue-400 active:bg-gray-50 dark:border-gray-700 dark:active:bg-gray-800'
  }
  if (i === props.question.answer) {
    return 'border-green-500 bg-green-50 dark:border-green-500 dark:bg-green-950'
  }
  if (i === selected.value) {
    return 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950'
  }
  return 'border-gray-200 opacity-50 dark:border-gray-700'
}

function speak() {
  if (!('speechSynthesis' in window)) return
  const plainText = props.question.question.replace(/[【】]/g, '')
  const utterance = new SpeechSynthesisUtterance(plainText)
  utterance.lang = 'ja-JP'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

let touchStartX = 0
function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
}
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (revealed.value && Math.abs(dx) > 60) goNext()
}
</script>

<template>
  <div
    class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <div class="mb-3 flex items-center justify-between">
      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        {{ question.subCategory }}
      </span>
      <div class="flex items-center gap-3 text-gray-400 dark:text-gray-500">
        <button aria-label="發音" @click="speak">
          <Volume2 :size="18" />
        </button>
        <button
          aria-label="標記不確定"
          :class="{ 'text-amber-500': isUncertain }"
          @click="$emit('toggle-uncertain')"
        >
          <HelpCircle :size="18" />
        </button>
        <button
          aria-label="收藏"
          :class="{ 'text-yellow-400': isBookmarked }"
          @click="$emit('toggle-bookmark')"
        >
          <Star :size="18" :fill="isBookmarked ? 'currentColor' : 'none'" />
        </button>
        <button
          aria-label="筆記"
          :class="{ 'text-emerald-500': !!note.trim() }"
          @click="showNotes = !showNotes"
        >
          <NotebookPen :size="18" />
        </button>
      </div>
    </div>

    <div v-if="showNotes" class="mb-3">
      <textarea
        v-model="noteDraft"
        rows="2"
        placeholder="寫下這題的筆記…"
        class="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-800 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        @blur="saveNote"
      />
    </div>

    <p
      v-if="question.readingText"
      class="mb-3 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    >
      {{ question.readingText }}
    </p>

    <p class="mb-4 text-lg font-medium leading-relaxed text-gray-900 dark:text-gray-100">
      {{ question.question }}
    </p>

    <div class="space-y-2">
      <button
        v-for="(option, i) in question.options"
        :key="i"
        class="w-full rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-default"
        :class="optionClass(i)"
        :disabled="revealed"
        @click="selectOption(i)"
      >
        {{ option }}
      </button>
    </div>

    <div v-if="revealed" class="mt-4 space-y-2 rounded-lg bg-blue-50 p-3 text-sm dark:bg-gray-800">
      <p class="font-medium text-gray-900 dark:text-gray-100">{{ question.explanation.translation }}</p>
      <p class="text-gray-600 dark:text-gray-300">{{ question.explanation.detail }}</p>
      <p class="font-medium text-blue-700 dark:text-cyan-400">💡 {{ question.explanation.keyPoint }}</p>
      <button class="mt-2 w-full rounded-lg bg-blue-600 py-2 font-medium text-white" @click="goNext">
        下一題
      </button>
    </div>
  </div>
</template>
