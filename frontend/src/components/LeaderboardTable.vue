<script setup>
import { computed } from 'vue'

const props = defineProps({
  entries: {
    type: Array,
    required: true,
    default: () => []
  }
})

const getMedalEmoji = (rank) => {
  switch (rank) {
    case 1: return '🥇'
    case 2: return '🥈'
    case 3: return '🥉'
    default: return ''
  }
}

const getRankClass = (rank) => {
  switch (rank) {
    case 1: return 'rank-gold'
    case 2: return 'rank-silver'
    case 3: return 'rank-bronze'
    default: return ''
  }
}
</script>

<template>
  <div class="leaderboard-table">
    <div v-if="entries.length === 0" class="empty-state">
      <p>No data available for this period</p>
    </div>
    
    <div v-else class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th class="rank-col">Rank</th>
            <th>User</th>
            <th class="text-center">Drinks</th>
            <th class="text-center">Transactions</th>
            <th class="text-center">Spent</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="entry in entries" 
            :key="entry.userId"
            :class="getRankClass(entry.rank)"
            class="leaderboard-row"
          >
            <td class="rank-col">
              <div class="rank-display">
                <span v-if="entry.rank <= 3" class="medal">{{ getMedalEmoji(entry.rank) }}</span>
                <span v-else class="rank-number">{{ entry.rank }}</span>
              </div>
            </td>
            <td>
              <div class="user-info">
                <span class="username">{{ entry.username }}</span>
                <span class="user-type">{{ entry.userType }}</span>
              </div>
            </td>
            <td class="text-center">
              <span class="stat-value">{{ entry.totalDrinks }}</span>
            </td>
            <td class="text-center">
              <span class="stat-value">{{ entry.transactionCount }}</span>
            </td>
            <td class="text-center">
              <span class="stat-value credits">{{ entry.totalSpent }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.leaderboard-table {
  width: 100%;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-3xl);
  color: var(--color-medium-grey);
}

.table-container {
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table {
  width: 100%;
}

.rank-col {
  width: 80px;
  text-align: center;
}

.rank-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
}

.medal {
  font-size: var(--font-size-2xl);
}

.rank-number {
  font-weight: 600;
  font-size: var(--font-size-lg);
  color: var(--color-medium-grey);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.username {
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--color-white);
}

.user-type {
  font-size: var(--font-size-xs);
  color: var(--color-medium-grey);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-weight: 600;
  font-size: var(--font-size-lg);
}


.stat-value.credits {
  font-size: var(--font-size-base);
}

/* Top 3 highlighting */
.leaderboard-row.rank-gold {
  background: rgba(255, 215, 0, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.leaderboard-row.rank-gold:hover {
  background: rgba(255, 215, 0, 0.15) !important;
}

.leaderboard-row.rank-silver {
  background: rgba(192, 192, 192, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.leaderboard-row.rank-silver:hover {
  background: rgba(192, 192, 192, 0.15) !important;
}

.leaderboard-row.rank-bronze {
  background: rgba(205, 127, 50, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.leaderboard-row.rank-bronze:hover {
  background: rgba(205, 127, 50, 0.15) !important;
}

.leaderboard-row {
  transition: all 0.3s ease;
}

@media (max-width: 768px) {
  .table thead th:nth-child(4) {
    display: none;
  }
  
  .table tbody td:nth-child(4) {
    display: none;
  }
}
</style>
