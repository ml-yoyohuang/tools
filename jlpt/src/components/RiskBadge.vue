<script setup lang="ts">
import type { RiskLevel } from '@/utils/srs'

const props = defineProps<{ risk: RiskLevel }>()

const labels: Record<RiskLevel, string> = {
  red: '🔴 高危題',
  yellow: '🟡 需注意',
  none: '',
}

const classes: Record<RiskLevel, string> = {
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  none: '',
}
</script>

<template>
  <span
    v-if="props.risk !== 'none'"
    class="rounded-full px-2 py-0.5 text-xs font-medium"
    :class="classes[props.risk]"
  >
    {{ labels[props.risk] }}
  </span>
</template>
