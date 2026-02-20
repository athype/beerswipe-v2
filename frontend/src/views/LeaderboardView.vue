<template>
  <div class="leaderboard-view">
    <div class="page-header">
      <div class="page-title">
        <h1>Leaderboard</h1>
        <p>Monthly drink consumption rankings</p>
      </div>
    </div>

    <!-- Month Selector -->
    <div class="card selector-card">
      <MonthSelector
        v-model:year="selectedYear"
        v-model:month="selectedMonth"
        @change="handleMonthChange"
      />
    </div>

    <!-- Loading State -->
    <div v-if="leaderboardStore.loading" class="loading-state card">
      <div class="text-center">
        <p class="text-lg">Loading leaderboard...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="leaderboardStore.error" class="error-state card">
      <div class="text-center">
        <p class="text-error">{{ leaderboardStore.error }}</p>
        <button @click="fetchData" class="btn btn-primary mt-md">
          Retry
        </button>
      </div>
    </div>

    <!-- Leaderboard Content -->
    <div v-else>
      <!-- Period Info -->
      <div v-if="leaderboardStore.period" class="period-info card">
        <div class="period-content">
          <div class="period-icon"></div>
          <div class="period-text">
            <h3>{{ leaderboardStore.period.monthName }} {{ leaderboardStore.period.year }}</h3>
            <p class="text-sm">
              {{ leaderboardStore.leaderboard.length }} participants
            </p>
          </div>
        </div>
      </div>

      <!-- Top 3 Podium -->
      <div v-if="leaderboardStore.hasData" class="card podium-card">
        <div class="card-header">
          <h2 class="card-title">Top Performers</h2>
        </div>
        <div class="card-body">
          <LeaderboardPodium :entries="leaderboardStore.leaderboard" />
        </div>
      </div>

      <!-- Full Leaderboard Table -->
      <div class="card table-card">
        <div class="card-header">
          <h2 class="card-title">Full Rankings</h2>
        </div>
        <div class="card-body">
          <LeaderboardTable :entries="leaderboardStore.leaderboard" />
        </div>
      </div>

      <!-- Statistics Summary -->
      <div v-if="stats" class="stats-grid">
        <div class="card stat-card">
          <div class="stat-icon"></div>
          <div class="stat-content">
            <p class="stat-label">Total Drinks</p>
            <p class="stat-value">{{ stats.totalDrinks }}</p>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-icon"></div>
          <div class="stat-content">
            <p class="stat-label">Total Spent</p>
            <p class="stat-value">{{ stats.totalSpent }} cr</p>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-icon"></div>
          <div class="stat-content">
            <p class="stat-label">Avg per User</p>
            <p class="stat-value">{{ stats.avgPerUser }}</p>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-icon"></div>
          <div class="stat-content">
            <p class="stat-label">Transactions</p>
            <p class="stat-value">{{ stats.totalTransactions }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLeaderboardStore } from '../stores/leaderboard.ts'
import MonthSelector from '../components/MonthSelector.vue'
import LeaderboardPodium from '../components/LeaderboardPodium.vue'
import LeaderboardTable from '../components/LeaderboardTable.vue'

const leaderboardStore = useLeaderboardStore()

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)

const stats = computed(() => {
  if (!leaderboardStore.hasData) return null

  const totalDrinks = leaderboardStore.leaderboard.reduce((sum, entry) => sum + entry.totalDrinks, 0)
  const totalSpent = leaderboardStore.leaderboard.reduce((sum, entry) => sum + entry.totalSpent, 0)
  const totalTransactions = leaderboardStore.leaderboard.reduce((sum, entry) => sum + entry.transactionCount, 0)
  const userCount = leaderboardStore.leaderboard.length

  return {
    totalDrinks,
    totalSpent,
    totalTransactions,
    avgPerUser: userCount > 0 ? Math.round(totalDrinks / userCount) : 0
  }
})

const handleMonthChange = (_: { year: number; month: number }) => {
  fetchData()
}

const fetchData = async () => {
  await leaderboardStore.fetchLeaderboard(selectedYear.value, selectedMonth.value)
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.leaderboard-view {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--spacing-xl);
}

.page-header h1 {
  font-size: var(--font-size-4xl);
  color: var(--color-white);
  margin-bottom: var(--spacing-sm);
}

.page-header p {
  color: var(--color-medium-grey);
  font-size: var(--font-size-lg);
}

.selector-card {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-lg);
}

.loading-state,
.error-state {
  padding: var(--spacing-3xl);
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.period-info {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-lg);
}

.period-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.period-icon {
  font-size: 3rem;
}

.period-text h3 {
  font-size: var(--font-size-2xl);
  color: var(--color-white);
  margin-bottom: var(--spacing-xs);
}

.period-text p {
  color: var(--color-medium-grey);
}

.podium-card {
  margin-bottom: var(--spacing-xl);
}

.table-card {
  margin-bottom: var(--spacing-xl);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-icon {
  font-size: 3rem;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-medium-grey);
  margin-bottom: var(--spacing-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin: 0;
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: var(--font-size-3xl);
  }

  .period-content {
    flex-direction: column;
    text-align: center;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    justify-content: center;
  }
}
</style>
