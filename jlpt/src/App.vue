<script setup lang="ts">
import { onMounted } from 'vue'
import { useQuizStore } from '@/stores/useQuizStore'
import { useSchedulerStore } from '@/stores/useSchedulerStore'
import AppNav from '@/components/AppNav.vue'

const quizStore = useQuizStore()
const schedulerStore = useSchedulerStore()

onMounted(async () => {
  await quizStore.init()
  await schedulerStore.init()
})
</script>

<template>
  <div class="pb-16">
    <RouterView />
  </div>
  <AppNav />
</template>
