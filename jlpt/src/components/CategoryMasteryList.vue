<script setup lang="ts">
defineProps<{
  items: { label: string; percent: number }[]
}>()
</script>

<template>
  <div class="space-y-3">
    <div v-for="item in items" :key="item.label">
      <div class="mb-1 flex items-center justify-between text-sm">
        <span class="text-gray-700 dark:text-gray-200">{{ item.label }}</span>
        <span class="text-gray-500 dark:text-gray-400">{{ item.percent }}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          class="h-full rounded-full bg-violet-500 transition-all duration-500 dark:bg-violet-400"
          :style="{ width: `${Math.min(100, item.percent)}%` }"
        />
      </div>
    </div>
  </div>
</template>
