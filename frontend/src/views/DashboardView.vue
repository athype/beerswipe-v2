<template>
  <div class="dashboard">
    <div class="page-header">
      <div class="page-title">
        <div class="dashboard-header">
          <h1>Dashboard</h1>
        </div>
        <p class="">Welcome back, {{ authStore.user?.username }}!</p>
      </div>
    </div>

    <div class="stats-grid mb-xl" v-if="salesStore.stats">
      <div class="card stat-card">
        <div class="card-body text-center">
          <h3 class="text-lg mb-sm">Total Sales</h3>
          <CountUp
          :from="0"
          :to="salesStore.stats.sales?.totalSales || 0"
          direction="up"
          :duration="1"
          :start-when="true"
          class-name="stat-number"
          />
          <p class="text-sm">transactions</p>
        </div>
      </div>

      <div class="card stat-card">
        <div class="card-body text-center">
          <h3 class="text-lg mb-sm">Revenue</h3>
          <CountUp
          :from="0"
          :to="salesStore.stats.sales?.totalRevenue || 0"
          direction="up"
          :duration="1"
          :start-when="true"
          class-name="stat-number"
          />
          <p class="text-sm">credits earned</p>
        </div>
      </div>

      <div class="card stat-card">
        <div class="card-body text-center">
          <h3 class="text-lg mb-sm">Items Sold</h3>
          <CountUp
          :from="0"
          :to="salesStore.stats.sales?.totalItemsSold || 0"
          direction="up"
          :duration="1"
          :start-when="true"
          class-name="stat-number"
          />
          <p class="text-sm">drinks</p>
        </div>
      </div>

      <div class="card stat-card">
        <div class="card-body text-center">
          <h3 class="text-lg mb-sm">Credits Added</h3>
          <CountUp
          :from="0"
          :to="salesStore.stats.credits?.totalCreditsAdded || 0"
          direction="up"
          :duration="1"
          :start-when="true"
          class-name="stat-number"
          />
          <p class="text-sm">total credits</p>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <h2 class="qa-sign-title">Quick Actions</h2>
        </div>
        <div class="card-body">
          <div class="qa-menu">
            <RouterLink to="/sales" class="qa-menu-row qa-menu-row-primary">
              <span>Make Sale</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/users" class="qa-menu-row">
              <span>Manage Users</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/drinks" class="qa-menu-row">
              <span>Manage Drinks</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </RouterLink>
            <RouterLink to="/history" class="qa-menu-row">
              <span>View History</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/leaderboard" class="qa-menu-row">
              <span>View Leaderboard</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </RouterLink>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Recent Sales</h2>
        </div>
        <div class="card-body">
          <div v-if="salesStore.loading" class="text-center py-xl">
            <p>Loading recent transactions...</p>
          </div>
          <div v-else-if="recentTransactions.length === 0" class="text-center py-xl">
            <p>No recent transactions</p>
          </div>
          <div v-else class="transaction-list">
            <div
              v-for="transaction in recentTransactions"
              :key="transaction.id"
              class="transaction-item"
            >
              <div class="transaction-icon">
                <span class="badge" :class="transaction.type === 'sale' ? 'badge-success' : 'badge-primary'">
                  {{ transaction.type === 'sale' ? 'Sale' : 'Credit' }}
                </span>
              </div>
              <div class="transaction-details flex-1">
                <p class="text-sm font-medium mb-xs">{{ transaction.description }}</p>
                <p class="text-xs">
                  {{ transaction.user?.username }} •
                  {{ transaction.amount }} credits •
                  {{ formatDate(transaction.transactionDate) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="lowStockDrinks.length > 0" class="card card-warning mt-lg">
      <div class="card-header">
        <h3 class="card-title text-warning">Low Stock Alert</h3>
      </div>
      <div class="card-body">
        <div class="low-stock-grid">
          <div
            v-for="drink in lowStockDrinks"
            :key="drink.id"
            class="low-stock-item"
          >
            <span>{{ drink.name }}</span>
            <span class="badge badge-warning">{{ drink.stock }} left</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useSalesStore } from '@/stores/sales.js'
import { useDrinksStore } from '@/stores/drinks.js'
import CountUp from '@/vue-bits-animations/CountUp/CountUp.vue'

const authStore = useAuthStore()
const salesStore = useSalesStore()
const drinksStore = useDrinksStore()

const recentTransactions = computed(() =>
  salesStore.transactions.slice(0, 5)
)

const lowStockDrinks = computed(() =>
  drinksStore.drinks.filter(drink => drink.isActive && drink.stock <= 5)
)

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(async () => {
  await Promise.all([
    salesStore.fetchStats(),
    salesStore.fetchTransactionHistory({ limit: 5 }),
    drinksStore.fetchDrinks()
  ])
})
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
}

.stat-card {
  border-left: 4px solid var(--color-teal);
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 900;
  margin: var(--spacing-xs) 0;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xl);
}

.dashboard-header h1 {
  font-size: var(--font-size-4xl);
}

.qa-sign-title {
  margin: 0 0 20px;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #ffffff;
  text-shadow: 0 0 11px rgba(48, 164, 108, 0.55), 0 0 2px rgba(177, 241, 203, 0.5), 0 2px 6px rgba(0, 0, 0, 0.6);
}

.qa-menu {
  display: flex;
  flex-direction: column;
}

.qa-menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--color-light-grey);
  transition: background 0.2s ease, transform 0.25s ease;
}

.qa-menu-row:last-child {
  border-bottom: none;
}

.qa-menu-row:hover {
  background: var(--green-3);
  transform: translateX(4px);
}

.qa-menu-row-primary {
  color: var(--green-11);
  background: rgba(48, 164, 108, 0.08);
}

.qa-menu-row svg {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.qa-menu-row:hover svg {
  opacity: 1;
  transform: translateX(0);
}

.transaction-list {
  max-height: 300px;
  overflow-y: auto;
}

.transaction-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--color-grey);
}

.transaction-item:last-child {
  border-bottom: none;
}

.transaction-icon {
  flex-shrink: 0;
}

.low-stock-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.low-stock-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-black);
  border-radius: var(--border-radius);
  border: 1px solid var(--color-grey);
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .low-stock-grid {
    grid-template-columns: 1fr;
  }
}
</style>
