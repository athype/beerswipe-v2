<template>
  <div class="history-view">
    <div class="history-header">
      <h1>Transaction History</h1>
    </div>

    <div class="history-filters">
      <div class="filter-group">
        <label for="userFilter">User:</label>
        <div class="user-search-container">
          <input
            id="userFilter"
            v-model="filters.userSearch"
            type="text"
            placeholder="Search by username..."
            @input="debouncedSearch"
            @focus="showUserSuggestions = true"
            @blur="hideUserSuggestions"
          />
          <div v-if="showUserSuggestions && userSuggestions.length > 0" class="user-suggestions">
            <div 
              v-for="user in userSuggestions" 
              :key="user.id"
              class="user-suggestion"
              @mousedown="selectUser(user)"
            >
              <span class="suggestion-username">{{ user.username }}</span>
              <span class="suggestion-type">{{ user.userType }}</span>
            </div>
          </div>
        </div>
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
            <th>Actions</th>
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
            <td>
              <button 
                @click="openUndoModal(transaction)" 
                class="btn small undo-btn"
                title="Undo Transaction"
              >
                ↺ Undo
              </button>
            </td>
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

    <!-- Undo Transaction Modal -->
    <UndoTransactionModal
      :show="showUndoModal"
      :transaction="selectedTransaction"
      @close="closeUndoModal"
      @confirm="handleUndoTransaction"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useSalesStore } from '../stores/sales.js'
import { useUsersStore } from '../stores/users.js'
import { useNotifications } from '@/composables/useNotifications.js'
import UndoTransactionModal from '../components/UndoTransactionModal.vue'

const salesStore = useSalesStore()
const usersStore = useUsersStore()
const { showSuccess, showError } = useNotifications()

const filters = reactive({
  userSearch: '',
  type: '',
  startDate: '',
  endDate: ''
})

const showUserSuggestions = ref(false)
const userSuggestions = ref([])
const showUndoModal = ref(false)
const selectedTransaction = ref(null)

let searchTimeout = null
const debouncedSearch = async () => {
  clearTimeout(searchTimeout)
  
  if (filters.userSearch.length >= 2) {
    try {
      const result = await usersStore.fetchUsers({ 
        search: filters.userSearch,
        limit: 10
      })
      if (result.success) {
        userSuggestions.value = usersStore.users
      }
    } catch (error) {
      console.error('User suggestion error:', error)
    }
  } else {
    userSuggestions.value = []
  }
  
  searchTimeout = setTimeout(() => {
    applyFilters()
  }, 500)
}

const selectUser = (user) => {
  filters.userSearch = user.username
  showUserSuggestions.value = false
  userSuggestions.value = []
  applyFilters()
}

const hideUserSuggestions = () => {
  setTimeout(() => {
    showUserSuggestions.value = false
  }, 200)
}

const getUserIdFromSearch = async () => {
  if (!filters.userSearch.trim()) {
    return null
  }
  
  try {
    const userSearchResult = await usersStore.fetchUsers({ 
      search: filters.userSearch,
      limit: 100
    })
    
    if (userSearchResult.success && usersStore.users.length > 0) {
      return usersStore.users[0].id
    } else {
      return -1
    }
  } catch (error) {
    console.error('User search error:', error)
    return null
  }
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
  
  const userId = await getUserIdFromSearch()
  if (userId !== null) {
    params.userId = userId
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
  
  const userId = await getUserIdFromSearch()
  if (userId !== null) {
    params.userId = userId
  }
  
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

const openUndoModal = (transaction) => {
  selectedTransaction.value = transaction
  showUndoModal.value = true
}

const closeUndoModal = () => {
  showUndoModal.value = false
  selectedTransaction.value = null
}

const handleUndoTransaction = async (transaction) => {
  try {
    const result = await salesStore.undoTransaction(transaction.id)
    
    if (result.success) {
      closeUndoModal()
      showSuccess(`Transaction undone successfully! ${
        transaction.type === 'sale' 
          ? `${transaction.amount} credits restored to ${transaction.user?.username}` 
          : `${transaction.amount} credits deducted from ${transaction.user?.username}`
      }`)
      
      await applyFilters()
    } else {
      showError(result.error || 'Failed to undo transaction')
      closeUndoModal()
    }
  } catch (error) {
    showError('An unexpected error occurred while undoing the transaction')
    closeUndoModal()
  }
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
  font-size: var(--font-size-4xl);
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
  color: var(--color-light-grey);
}

.filter-group input,
.filter-group select {
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
}

.user-search-container {
  position: relative;
}

.user-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--glass-bg-dark);
  backdrop-filter: var(--glass-blur-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-border-accent);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-glass);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
}

.user-suggestion {
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--color-grey);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-suggestion:hover {
  background: rgba(5, 94, 104, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-white);
}

.user-suggestion:last-child {
  border-bottom: none;
}

.suggestion-username {
  font-weight: 500;
  color: var(--color-light-grey);
}

.suggestion-type {
  font-size: 0.8rem;
  color: var(--color-medium-grey);
  text-transform: uppercase;
}

.user-suggestion:hover .suggestion-username,
.user-suggestion:hover .suggestion-type {
  color: var(--color-white);
}

.transactions-table {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border-accent);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
  overflow: hidden;
  margin-bottom: var(--spacing-xl);
  transition: all 0.3s ease;
}

.transactions-table:hover {
  border-color: var(--color-teal);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: var(--spacing-lg);
  text-align: left;
  border-bottom: 1px solid var(--glass-border);
}

tbody tr {
  transition: all 0.2s ease;
}

tbody tr:hover {
  background: rgba(5, 94, 104, 0.15);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

th {
  background: rgba(5, 94, 104, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-weight: 600;
  color: var(--color-white);
  position: sticky;
  top: 0;
  border-bottom: 2px solid var(--color-teal);
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
  color: var(--color-medium-grey);
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

.undo-btn {
  background: var(--color-warning);
  color: var(--color-black);
  font-weight: 600;
}

.undo-btn:hover {
  background: #e0a800;
  color: var(--color-black);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.stats-summary {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border-accent);
  padding: var(--spacing-xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
  transition: all 0.3s ease;
}

.stats-summary:hover {
  background: var(--glass-bg-dark);
  border-color: var(--color-teal);
}

.stats-summary h2 {
  color: var(--color-light-grey);
  margin-bottom: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: rgba(34, 34, 34, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-left: 4px solid var(--color-teal);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  text-align: center;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-md);
}

.stat-card:hover {
  background: rgba(34, 34, 34, 0.7);
  border-color: var(--color-teal);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.stat-card h3 {
  color: var(--color-light-grey);
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
  color: var(--color-medium-grey);
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
