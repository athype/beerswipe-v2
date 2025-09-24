<template>
  <div class="history-view">
    <div class="history-header">
      <h1>Transaction History</h1>
    </div>

    <div class="history-filters">
      <div class="filter-group">
        <label for="userFilter">User:</label>
        <input
          id="userFilter"
          v-model="filters.userSearch"
          type="text"
          placeholder="Search by username..."
          @input="debouncedSearch"
        />
      </div>
      
      <div class="filter-group">
        <label for="typeFilter">Type:</label>
        <select id="typeFilter" v-model="filters.type" @change="applyFilters">
          <option value="">All Types</option>
          <option value="sale">Sales</option>
          <option value="credit_addition">Credit Additions</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label for="startDate">Start Date:</label>
        <input
          id="startDate"
          v-model="filters.startDate"
          type="date"
          @change="applyFilters"
        />
      </div>
      
      <div class="filter-group">
        <label for="endDate">End Date:</label>
        <input
          id="endDate"
          v-model="filters.endDate"
          type="date"
          @change="applyFilters"
        />
      </div>
      
      <button @click="clearFilters" class="btn">Clear Filters</button>
    </div>

    <div class="transactions-table">
      <div v-if="salesStore.loading" class="loading">Loading transactions...</div>
      <div v-else-if="salesStore.transactions.length === 0" class="no-data">
        No transactions found
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Type</th>
            <th>User</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Quantity</th>
            <th>Admin</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transaction in salesStore.transactions" :key="transaction.id">
            <td>{{ formatDateTime(transaction.transactionDate) }}</td>
            <td>
              <span class="transaction-type" :class="transaction.type">
                {{ transaction.type === 'sale' ? '🛒 Sale' : '💰 Credit Addition' }}
              </span>
            </td>
            <td>
              <div class="user-info">
                <span class="username">{{ transaction.user?.username }}</span>
                <span class="user-type">{{ transaction.user?.userType }}</span>
              </div>
            </td>
            <td>{{ transaction.description }}</td>
            <td class="amount">{{ transaction.amount }} credits</td>
            <td>{{ transaction.quantity || '-' }}</td>
            <td>{{ transaction.admin?.username }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="salesStore.pagination.pages > 1" class="pagination">
      <button 
        @click="changePage(salesStore.pagination.page - 1)"
        :disabled="salesStore.pagination.page === 1"
        class="btn small"
      >
        Previous
      </button>
      <span>
        Page {{ salesStore.pagination.page }} of {{ salesStore.pagination.pages }}
      </span>
      <button 
        @click="changePage(salesStore.pagination.page + 1)"
        :disabled="salesStore.pagination.page === salesStore.pagination.pages"
        class="btn small"
      >
        Next
      </button>
    </div>

    <!-- Statistics Summary -->
    <div class="stats-summary">
      <h2>Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Transactions</h3>
          <p class="stat-number">{{ salesStore.pagination.total }}</p>
        </div>
        
        <div class="stat-card">
          <h3>Sales Count</h3>
          <p class="stat-number">{{ salesCount }}</p>
        </div>
        
        <div class="stat-card">
          <h3>Credit Additions</h3>
          <p class="stat-number">{{ creditAdditionsCount }}</p>
        </div>
        
        <div class="stat-card">
          <h3>Total Revenue</h3>
          <p class="stat-number">{{ totalRevenue }} credits</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useSalesStore } from '../stores/sales.js'

const salesStore = useSalesStore()

const filters = reactive({
  userSearch: '',
  type: '',
  startDate: '',
  endDate: ''
})

// Debounced search for user filter
let searchTimeout = null
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    applyFilters()
  }, 500)
}

const salesCount = computed(() => {
  return salesStore.transactions.filter(t => t.type === 'sale').length
})

const creditAdditionsCount = computed(() => {
  return salesStore.transactions.filter(t => t.type === 'credit_addition').length
})

const totalRevenue = computed(() => {
  return salesStore.transactions
    .filter(t => t.type === 'sale')
    .reduce((total, t) => total + t.amount, 0)
})

const applyFilters = async () => {
  const params = {}
  
  if (filters.userSearch) {
    // Note: This would require backend support for user search in transactions
    // For now, we'll filter client-side after fetching
  }
  
  if (filters.type) {
    params.type = filters.type
  }
  
  if (filters.startDate) {
    params.startDate = filters.startDate
  }
  
  if (filters.endDate) {
    params.endDate = filters.endDate
  }
  
  await salesStore.fetchTransactionHistory(params)
}

const changePage = async (page) => {
  const params = { page }
  
  if (filters.type) params.type = filters.type
  if (filters.startDate) params.startDate = filters.startDate
  if (filters.endDate) params.endDate = filters.endDate
  
  await salesStore.fetchTransactionHistory(params)
}

const clearFilters = () => {
  Object.assign(filters, {
    userSearch: '',
    type: '',
    startDate: '',
    endDate: ''
  })
  applyFilters()
}

const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  salesStore.fetchTransactionHistory()
})
</script>

<style scoped>
.history-view {
  max-width: 1400px;
  margin: 0 auto;
}

.history-header {
  margin-bottom: 2rem;
}

.history-header h1 {
  font-size: 2.5rem;
  color: var(--color-teal);
}

.history-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
}

.filter-group label {
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.filter-group input,
.filter-group select {
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
}

.transactions-table {
  background: var(--color-black);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 2rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e1e1e1;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  position: sticky;
  top: 0;
}

.transaction-type {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}

.transaction-type.sale {
  background: var(--color-teal);
  color: var(--color-white);
}

.transaction-type.credit_addition {
  background: var(--color-green);
  color: var(--color-white);
}

.user-info {
  display: flex;
  flex-direction: column;
}

.username {
  font-weight: 500;
}

.user-type {
  font-size: 0.8rem;
  color: #7f8c8d;
  text-transform: uppercase;
}

.amount {
  font-weight: bold;
  color: var(--color-teal);
}

.btn {
  background: var(--color-teal);
  color: var(--color-white);
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;
}

.btn:hover {
  background: var(--color-teal-dark);
}

.btn.small {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
}

.btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.stats-summary {
  background: var(--color-black);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.stats-summary h2 {
  color: #2c3e50;
  margin-bottom: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  border-left: 4px solid var(--color-teal);
}

.stat-card h3 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: var(--color-teal);
  margin: 0;
}

.loading,
.no-data {
  text-align: center;
  color: #7f8c8d;
  padding: 3rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .history-filters {
    grid-template-columns: 1fr;
  }
  
  .transactions-table {
    overflow-x: auto;
  }
  
  table {
    min-width: 800px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
