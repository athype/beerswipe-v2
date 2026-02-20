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
          <h2 class="card-title">Quick Actions</h2>
        </div>
        <div class="card-body">
          <div class="action-buttons">
            <RouterLink to="/sales" class="btn btn-primary btn-lg">
              Make Sale
            </RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/users" class="btn btn-secondary btn-lg">
              Manage Users
            </RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/drinks" class="btn btn-secondary btn-lg">
              Manage Drinks
            </RouterLink>
            <RouterLink to="/history" class="btn btn-secondary btn-lg">
              View History
            </RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/leaderboard" class="btn btn-secondary btn-lg">
              View Leaderboard
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

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.ts'
import { useSalesStore } from '@/stores/sales.ts'
import { useDrinksStore } from '@/stores/drinks.ts'
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

const formatDate = (date: string | undefined) => {
  if (!date) return "";
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

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
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
  
  .action-buttons {
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
