<script setup lang="ts">
defineProps<{
  microLabel: string
  microPercent: number
  macroLabel: string
  macroPercent: number
}>()
</script>

<template>
  <div class="space-y-3">
    <div>
      <div class="mb-1 flex items-center justify-between text-sm">
        <span class="font-medium text-gray-700 dark:text-gray-200">{{ microLabel }}</span>
        <span class="text-gray-500 dark:text-gray-400">{{ microPercent }}%</span>
      </div>
      <div class="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-500 dark:bg-cyan-400"
          :style="{ width: `${Math.min(100, microPercent)}%` }"
        />
      </div>
    </div>
    <div>
      <div class="mb-1 flex items-center justify-between text-sm">
        <span class="font-medium text-gray-700 dark:text-gray-200">{{ macroLabel }}</span>
        <span class="text-gray-500 dark:text-gray-400">{{ macroPercent }}%</span>
      </div>
      <div class="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          class="h-full rounded-full bg-emerald-500 transition-all duration-500 dark:bg-emerald-400"
          :style="{ width: `${Math.min(100, macroPercent)}%` }"
        />
      </div>
    </div>
  </div>
</template>
