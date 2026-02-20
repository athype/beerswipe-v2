<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['update:year', 'update:month', 'change'])

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
]

const currentYear = new Date().getFullYear()
const years = computed(() => {
  const yearList = []
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearList.push(y)
  }
  return yearList
})

const handleMonthChange = (event: Event) => {
  const newMonth = parseInt((event.target as HTMLSelectElement).value)
  emit('update:month', newMonth)
  emit('change', { year: props.year, month: newMonth })
}

const handleYearChange = (event: Event) => {
  const newYear = parseInt((event.target as HTMLSelectElement).value)
  emit('update:year', newYear)
  emit('change', { year: newYear, month: props.month })
}

const goToPreviousMonth = () => {
  let newMonth = props.month - 1
  let newYear = props.year
  
  if (newMonth < 1) {
    newMonth = 12
    newYear = props.year - 1
  }
  
  emit('update:month', newMonth)
  emit('update:year', newYear)
  emit('change', { year: newYear, month: newMonth })
}

const goToNextMonth = () => {
  let newMonth = props.month + 1
  let newYear = props.year
  
  if (newMonth > 12) {
    newMonth = 1
    newYear = props.year + 1
  }
  
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  
  // Don't go beyond current month
  if (newYear > currentYear || (newYear === currentYear && newMonth > currentMonth)) {
    return
  }
  
  emit('update:month', newMonth)
  emit('update:year', newYear)
  emit('change', { year: newYear, month: newMonth })
}

const isNextDisabled = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  
  return props.year > currentYear || 
         (props.year === currentYear && props.month >= currentMonth)
})
</script>

<template>
  <div class="month-selector">
    <button 
      @click="goToPreviousMonth" 
      class="btn btn-sm nav-btn"
      aria-label="Previous month"
    >
      ‹
    </button>
    
    <div class="select-group">
      <select 
        :value="month" 
        @change="handleMonthChange"
        class="form-select month-select"
      >
        <option 
          v-for="m in months" 
          :key="m.value" 
          :value="m.value"
        >
          {{ m.label }}
        </option>
      </select>
      
      <select 
        :value="year" 
        @change="handleYearChange"
        class="form-select year-select"
      >
        <option 
          v-for="y in years" 
          :key="y" 
          :value="y"
        >
          {{ y }}
        </option>
      </select>
    </div>
    
    <button 
      @click="goToNextMonth" 
      class="btn btn-sm nav-btn"
      :disabled="isNextDisabled"
      aria-label="Next month"
    >
      ›
    </button>
  </div>
</template>

<style scoped>
.month-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  justify-content: center;
  margin-bottom: var(--spacing-xl);
}

.select-group {
  display: flex;
  gap: var(--spacing-sm);
}

.month-select,
.year-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 500;
  min-width: 120px;
}

.year-select {
  min-width: 80px;
}

.nav-btn {
  min-width: 40px;
  height: 40px;
  font-size: var(--font-size-2xl);
  font-weight: bold;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
